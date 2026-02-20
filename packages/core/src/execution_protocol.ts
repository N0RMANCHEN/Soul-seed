import { decide } from "./orchestrator.js";
import { runAgentExecution, type AgentToolExecutor } from "./agent_engine.js";
import { DECISION_TRACE_SCHEMA_VERSION, normalizeDecisionTrace } from "./decision_trace.js";
import { decideDualProcessRoute } from "./dual_process_router.js";
import { runRuntimePipeline, type RuntimeStageTrace } from "./runtime_pipeline.js";
import type { AdultSafetyContext, ExecutionResult, ModelAdapter, PersonaPackage } from "./types.js";

export interface ExecuteTurnResult {
  mode: "soul" | "agent";
  reply: string;
  trace: ReturnType<typeof decide> | null;
  execution: ExecutionResult | null;
  pipelineStages?: RuntimeStageTrace[];
}

export async function executeTurnProtocol(params: {
  rootPath: string;
  personaPkg: PersonaPackage;
  userInput: string;
  model: string;
  lifeEvents: Parameters<typeof decide>[3] extends infer T
    ? T extends { lifeEvents?: infer L }
      ? L
      : never
    : never;
  memoryWeights?: Parameters<typeof decide>[3] extends infer T
    ? T extends { memoryWeights?: infer W }
      ? W
      : never
    : never;
  safetyContext?: AdultSafetyContext;
  recalledMemories?: string[];
  recalledMemoryBlocks?: Parameters<typeof decide>[3] extends infer T
    ? T extends { recalledMemoryBlocks?: infer B }
      ? B
      : never
    : never;
  recallTraceId?: string;
  toolExecutor?: AgentToolExecutor;
  plannerAdapter?: ModelAdapter;
  goalId?: string;
  mode?: "auto" | "soul" | "agent";
  maxSteps?: number;
}): Promise<ExecuteTurnResult> {
  const desiredMode = params.mode ?? "auto";
  const routeDecision = decideDualProcessRoute({
    userInput: params.userInput,
    personaPkg: params.personaPkg,
    recalledMemories: params.recalledMemories,
    recalledMemoryBlocks: params.recalledMemoryBlocks,
    lifeEvents: params.lifeEvents
  });
  const taskLike = /(帮我|请你|完成|实现|整理|执行|读取|分析|写|修复|任务|todo|implement|build|plan)/iu.test(params.userInput);
  const shouldUseAgent =
    desiredMode === "agent" || (desiredMode === "auto" && routeDecision.route === "deliberative" && taskLike);
  const pipeline = await runRuntimePipeline({
    userInput: params.userInput,
    route: routeDecision.route,
    routeReasonCodes: routeDecision.reasonCodes,
    decideMode: () => (shouldUseAgent ? "agent" : "soul"),
    runAgent: async () => {
      const execution = await runAgentExecution({
        rootPath: params.rootPath,
        personaPkg: params.personaPkg,
        userInput: params.userInput,
        goalId: params.goalId,
        maxSteps: params.maxSteps,
        toolExecutor: params.toolExecutor,
        plannerAdapter: params.plannerAdapter
      });
      return { execution };
    },
    runSoul: async () => {
      const trace = decide(params.personaPkg, params.userInput, params.model, {
        lifeEvents: params.lifeEvents,
        memoryWeights: params.memoryWeights,
        recalledMemories: params.recalledMemories,
        recalledMemoryBlocks: params.recalledMemoryBlocks,
        recallTraceId: params.recallTraceId,
        safetyContext: params.safetyContext
      });
      trace.executionMode = "soul";
      return { trace };
    }
  });

  if (pipeline.mode === "agent" && pipeline.execution) {
    return {
      mode: "agent",
      reply: pipeline.reply,
      trace: normalizeDecisionTrace({
        version: DECISION_TRACE_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        selectedMemories: [],
        askClarifyingQuestion: false,
        refuse: pipeline.execution.consistencyVerdict === "reject",
        riskLevel: pipeline.execution.status === "blocked" ? "medium" : "low",
        reason: pipeline.execution.status === "blocked" ? "agent execution blocked" : "agent execution completed",
        model: params.model,
        executionMode: "agent",
        routeDecision: routeDecision.route,
        routeReasonCodes: routeDecision.reasonCodes,
        goalId: pipeline.execution.goalId,
        planVersion: pipeline.execution.planState?.version ?? 1,
        consistencyVerdict: pipeline.execution.consistencyVerdict,
        consistencyRuleHits: pipeline.execution.consistencyRuleHits,
        consistencyTraceId: pipeline.execution.consistencyTraceId
      }),
      execution: pipeline.execution,
      pipelineStages: pipeline.stages
    };
  }

  return {
    mode: "soul",
    reply: "",
    trace:
      pipeline.trace == null
        ? null
        : {
            ...pipeline.trace,
            routeDecision: routeDecision.route,
            routeReasonCodes: routeDecision.reasonCodes
          },
    execution: null,
    pipelineStages: pipeline.stages
  };
}
