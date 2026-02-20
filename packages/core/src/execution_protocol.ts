import { decide } from "./orchestrator.js";
import { runAgentExecution, type AgentToolExecutor } from "./agent_engine.js";
import { DECISION_TRACE_SCHEMA_VERSION, normalizeDecisionTrace } from "./decision_trace.js";
import type { AdultSafetyContext, ExecutionResult, PersonaPackage } from "./types.js";

export interface ExecuteTurnResult {
  mode: "soul" | "agent";
  reply: string;
  trace: ReturnType<typeof decide> | null;
  execution: ExecutionResult | null;
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
  mode?: "auto" | "soul" | "agent";
  maxSteps?: number;
}): Promise<ExecuteTurnResult> {
  const desiredMode = params.mode ?? "auto";
  const taskLike = /(帮我|请你|完成|实现|整理|执行|读取|分析|写|修复|任务|todo|implement|build|plan)/iu.test(
    params.userInput
  );
  const shouldUseAgent = desiredMode === "agent" || (desiredMode === "auto" && taskLike);
  if (shouldUseAgent) {
    const execution = await runAgentExecution({
      rootPath: params.rootPath,
      personaPkg: params.personaPkg,
      userInput: params.userInput,
      maxSteps: params.maxSteps,
      toolExecutor: params.toolExecutor
    });
    return {
      mode: "agent",
      reply: execution.reply,
      trace: normalizeDecisionTrace({
        version: DECISION_TRACE_SCHEMA_VERSION,
        timestamp: new Date().toISOString(),
        selectedMemories: [],
        askClarifyingQuestion: false,
        refuse: execution.consistencyVerdict === "reject",
        riskLevel: execution.status === "blocked" ? "medium" : "low",
        reason: execution.status === "blocked" ? "agent execution blocked" : "agent execution completed",
        model: params.model,
        executionMode: "agent",
        goalId: execution.goalId,
        planVersion: 1,
        consistencyVerdict: execution.consistencyVerdict,
        consistencyRuleHits: [],
        consistencyTraceId: execution.consistencyTraceId
      }),
      execution
    };
  }
  const trace = decide(params.personaPkg, params.userInput, params.model, {
    lifeEvents: params.lifeEvents,
    memoryWeights: params.memoryWeights,
    recalledMemories: params.recalledMemories,
    recalledMemoryBlocks: params.recalledMemoryBlocks,
    recallTraceId: params.recallTraceId,
    safetyContext: params.safetyContext
  });
  trace.executionMode = "soul";
  return {
    mode: "soul",
    reply: "",
    trace,
    execution: null
  };
}
