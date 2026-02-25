import { decide, precomputeSemanticSignals } from "./orchestrator.js";
import { runAgentExecution, type AgentToolExecutor } from "./agent_engine.js";
import { DECISION_TRACE_SCHEMA_VERSION, normalizeDecisionTrace } from "./decision_trace.js";
import { decideDualProcessRoute } from "./dual_process_router.js";
import { runRuntimePipeline, type RuntimeStageTrace } from "./runtime_pipeline.js";
import type { AdultSafetyContext, DecisionTrace, ExecutionResult, ModelAdapter, PersonaPackage } from "./types.js";

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
  adaptiveReasoningEnabled?: boolean;
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
    // EA-0: Soul always runs first; agentRequest is set on the trace to signal whether agent is needed
    runSoul: async () => {
      const semantic = await precomputeSemanticSignals({
        userInput: params.userInput,
        personaPkg: params.personaPkg,
        llmAdapter: params.plannerAdapter,
        adaptiveReasoningEnabled: params.adaptiveReasoningEnabled
      });
      const trace = decide(params.personaPkg, params.userInput, params.model, {
        lifeEvents: params.lifeEvents,
        memoryWeights: params.memoryWeights,
        recalledMemories: params.recalledMemories,
        recalledMemoryBlocks: params.recalledMemoryBlocks,
        recallTraceId: params.recallTraceId,
        safetyContext: params.safetyContext,
        riskLatent: semantic.riskLatent,
        riskAssessmentPath: semantic.riskAssessmentPath,
        conversationProjection: semantic.conversationProjection
      });
      trace.reasoningDepth = semantic.reasoningDepth;
      trace.l3Triggered = semantic.l3Triggered;
      trace.l3TriggerReason = semantic.l3TriggerReason;
      trace.executionMode = shouldUseAgent ? "agent" : "soul";
      // EA-0: Populate agentRequest so pipeline knows whether to invoke agent
      trace.agentRequest = {
        needed: shouldUseAgent,
        agentType: "retrieval",  // default; EA-3 will specialize based on task semantics
        riskLevel: desiredMode === "agent" ? "medium" : "low",
        requiresConfirmation: false
      };
      return { trace };
    },
    // EA-0: Agent receives soul trace as context; links back via soulTraceId
    runAgent: async (soulTrace: DecisionTrace) => {
      const execution = await runAgentExecution({
        rootPath: params.rootPath,
        personaPkg: params.personaPkg,
        userInput: params.userInput,
        goalId: params.goalId,
        maxSteps: params.maxSteps,
        toolExecutor: params.toolExecutor,
        plannerAdapter: params.plannerAdapter,
        // EA-3: pass agentType from soul trace for tool whitelist enforcement
        agentType: soulTrace.agentRequest?.agentType ?? "action"
      });
      // Link agent execution back to soul trace
      execution.soulTraceId = soulTrace.recallTraceId;
      return { execution };
    }
  });

  if (pipeline.mode === "agent" && pipeline.execution) {
    // EA-0: soul trace is now always present in agent mode (pipeline.trace != null)
    const soulTrace = pipeline.trace;
    return {
      mode: "agent",
      reply: pipeline.reply,
      trace: normalizeDecisionTrace({
        ...(soulTrace ?? {}),
        version: DECISION_TRACE_SCHEMA_VERSION,
        timestamp: soulTrace?.timestamp ?? new Date().toISOString(),
        selectedMemories: soulTrace?.selectedMemories ?? [],
        askClarifyingQuestion: soulTrace?.askClarifyingQuestion ?? false,
        refuse: pipeline.execution.consistencyVerdict === "reject",
        riskLevel: pipeline.execution.status === "blocked" ? "medium" : (soulTrace?.riskLevel ?? "low"),
        reason: pipeline.execution.status === "blocked" ? "agent execution blocked" : "agent execution completed",
        model: params.model,
        executionMode: "agent",
        routeDecision: routeDecision.route,
        routeReasonCodes: routeDecision.reasonCodes,
        goalId: pipeline.execution.goalId,
        planVersion: pipeline.execution.planState?.version ?? 1,
        consistencyVerdict: pipeline.execution.consistencyVerdict,
        consistencyRuleHits: pipeline.execution.consistencyRuleHits,
        consistencyTraceId: pipeline.execution.consistencyTraceId,
        agentRequest: soulTrace?.agentRequest
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
