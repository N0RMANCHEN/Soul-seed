import { randomUUID } from "node:crypto";
import type { DecisionTrace, ExecutionResult } from "./types.js";
import type { CognitiveRoute } from "./dual_process_router.js";
import type { MetaReviewDecision } from "./meta_review.js";

export type RuntimeStageName =
  | "perception"
  | "idea"
  | "deliberation"
  | "meta_review"
  | "commit";

export interface RuntimeStageTrace {
  id: string;
  stage: RuntimeStageName;
  ts: string;
  summary: string;
}

export interface RuntimePipelineResult {
  mode: "soul" | "agent";
  route: CognitiveRoute;
  routeReasonCodes: string[];
  reply: string;
  trace: DecisionTrace | null;
  execution: ExecutionResult | null;
  stages: RuntimeStageTrace[];
  metaReview?: MetaReviewDecision;
}

export async function runRuntimePipeline(params: {
  userInput: string;
  route: CognitiveRoute;
  routeReasonCodes: string[];
  decideMode: () => "soul" | "agent";
  runSoul: () => Promise<{ trace: DecisionTrace }>;
  runAgent: () => Promise<{ execution: ExecutionResult }>;
}): Promise<RuntimePipelineResult> {
  const now = () => new Date().toISOString();
  const stages: RuntimeStageTrace[] = [];
  const pushStage = (stage: RuntimeStageName, summary: string): void => {
    stages.push({
      id: randomUUID(),
      stage,
      ts: now(),
      summary
    });
  };

  pushStage("perception", `stimulus_received:${params.userInput.trim().slice(0, 80)}`);
  const mode = params.decideMode();

  // Idea stage: record actual routing decision and intent signals
  const ideaSummary = [
    `route:${params.route}`,
    `mode:${mode}`,
    `signals:${params.routeReasonCodes.join(",")}`,
    params.routeReasonCodes.includes("high_emotion_signal") ? "emotional_context:true" : "",
    params.routeReasonCodes.includes("relationship_intimacy_signal") ? "intimacy_context:true" : ""
  ].filter(Boolean).join(";");
  pushStage("idea", ideaSummary);

  if (mode === "agent") {
    const { execution } = await params.runAgent();
    const agentDelibSummary = [
      `planner_source:${execution.planState?.plannerSource ?? "unknown"}`,
      `steps:${execution.steps?.length ?? 0}`,
      `stop_kind:${execution.stopCondition?.kind ?? "none"}`
    ].join(";");
    pushStage("deliberation", agentDelibSummary);
    pushStage("meta_review", `consistency_verdict:${execution.consistencyVerdict};degrade_reasons:${execution.consistencyDegradeReasons?.join(",") ?? "none"}`);
    pushStage("commit", `goal_status:${execution.status};goal_id:${execution.goalId}`);
    return {
      mode: "agent",
      route: params.route,
      routeReasonCodes: params.routeReasonCodes,
      reply: execution.reply,
      trace: null,
      execution,
      stages
    };
  }

  const { trace } = await params.runSoul();

  // Deliberation stage: summarize what the decision trace captured
  const soulDelibSummary = [
    `risk_level:${trace.riskLevel ?? "low"}`,
    `refuse:${trace.refuse ? "yes" : "no"}`,
    `clarify:${trace.askClarifyingQuestion ? "yes" : "no"}`,
    `memories_used:${trace.memoryBudget?.usedItems ?? 0}`,
    `voice_intent:${trace.voiceIntent ? JSON.stringify(trace.voiceIntent).slice(0, 60) : "default"}`
  ].join(";");
  pushStage("deliberation", soulDelibSummary);

  // Meta-review stage: note that LLM meta-review will run post-generation in CLI
  pushStage("meta_review", `pre_generation_consistency:pending;post_generation_meta_review:scheduled`);
  pushStage("commit", `turn_committed;route:${params.route}`);

  return {
    mode: "soul",
    route: params.route,
    routeReasonCodes: params.routeReasonCodes,
    reply: "",
    trace,
    execution: null,
    stages
  };
}
