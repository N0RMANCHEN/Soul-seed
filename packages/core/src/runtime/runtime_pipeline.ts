import { randomUUID } from "node:crypto";
import type { DecisionTrace, ExecutionResult } from "../types.js";
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

/**
 * EA-0: Soul-first pipeline.
 * `runSoul()` always executes first and returns a `DecisionTrace` with `agentRequest` populated.
 * Agent is invoked only if `trace.agentRequest?.needed === true`.
 * `decideMode` is no longer a parameter — the soul makes this decision.
 */
export async function runRuntimePipeline(params: {
  userInput: string;
  route: CognitiveRoute;
  routeReasonCodes: string[];
  runSoul: () => Promise<{ trace: DecisionTrace }>;
  runAgent: (soulTrace: DecisionTrace) => Promise<{ execution: ExecutionResult }>;
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

  // EA-0: Soul always runs first — never bypassed
  const { trace } = await params.runSoul();
  const agentNeeded = trace.agentRequest?.needed === true;

  // Idea stage: reflect soul's routing decision + agent intent
  const ideaSummary = [
    `route:${params.route}`,
    `mode:${agentNeeded ? "agent" : "soul"}`,
    `signals:${params.routeReasonCodes.join(",")}`,
    params.routeReasonCodes.includes("high_emotion_signal") ? "emotional_context:true" : "",
    params.routeReasonCodes.includes("relationship_intimacy_signal") ? "intimacy_context:true" : "",
    agentNeeded ? `agent_type:${trace.agentRequest?.agentType ?? "retrieval"}` : ""
  ].filter(Boolean).join(";");
  pushStage("idea", ideaSummary);

  if (agentNeeded) {
    // Agent runs with soul trace as context
    const { execution } = await params.runAgent(trace);
    const agentDelibSummary = [
      `planner_source:${execution.planState?.plannerSource ?? "unknown"}`,
      `steps:${execution.steps?.length ?? 0}`,
      `stop_kind:${execution.stopCondition?.kind ?? "none"}`,
      `soul_trace_id:${trace.recallTraceId ?? "none"}`
    ].join(";");
    pushStage("deliberation", agentDelibSummary);
    pushStage("meta_review", `consistency_verdict:${execution.consistencyVerdict};degrade_reasons:${execution.consistencyDegradeReasons?.join(",") ?? "none"}`);
    pushStage("commit", `goal_status:${execution.status};goal_id:${execution.goalId}`);
    return {
      mode: "agent",
      route: params.route,
      routeReasonCodes: params.routeReasonCodes,
      reply: execution.reply,
      trace,  // EA-0: soul trace is always present, even in agent mode
      execution,
      stages
    };
  }

  // Soul-only path
  const soulDelibSummary = [
    `risk_level:${trace.riskLevel ?? "low"}`,
    `refuse:${trace.refuse ? "yes" : "no"}`,
    `clarify:${trace.askClarifyingQuestion ? "yes" : "no"}`,
    `memories_used:${trace.memoryBudget?.usedItems ?? 0}`,
    `voice_intent:${trace.voiceIntent ? JSON.stringify(trace.voiceIntent).slice(0, 60) : "default"}`
  ].join(";");
  pushStage("deliberation", soulDelibSummary);
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
