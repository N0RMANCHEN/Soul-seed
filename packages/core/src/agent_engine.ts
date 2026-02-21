import type {
  ChatMessage,
  ExecutionAction,
  ExecutionObservation,
  ExecutionResult,
  Goal,
  GoalStatus,
  CapabilityName,
  MetaActionDraft,
  MetaIntentPlan,
  ModelAdapter,
  PlanState,
  StopCondition,
  PersonaPackage
} from "./types.js";
import {
  appendExecutionTrace,
  appendGoalStep,
  createGoal,
  finishGoalStep,
  getGoalContext,
  getGoal,
  saveGoalContext,
  saveGoal
} from "./goal_store.js";
import { runConsistencyKernel } from "./consistency_kernel.js";
import { runMetaReviewLlm } from "./meta_review.js";
import { readLifeEvents } from "./persona.js";

export interface AgentToolExecutor {
  run: (params: {
    toolName: string;
    input: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<ExecutionObservation>;
}

/**
 * EA-3: Agent 类型白名单工具集
 * - retrieval: 只读，低风险，自动执行
 * - transform: 只读变换，低风险，自动执行
 * - capture: 只写 event log，中等风险，自动执行
 * - action: 全工具集，高风险，默认要求确认
 */
export const AGENT_TOOL_WHITELIST: Record<string, readonly string[]> = {
  retrieval: ["memory.search", "session.read_file", "session.fetch_url", "http.fetch", "workspace.read"],
  transform: ["memory.search", "session.read_file", "workspace.read"],
  capture: ["session.log_event"],
  action: [] // empty = no restriction (full toolset)
};

export function isToolAllowedForAgentType(
  toolName: string,
  agentType: "retrieval" | "transform" | "capture" | "action"
): boolean {
  if (agentType === "action") return true; // full toolset
  const allowed = AGENT_TOOL_WHITELIST[agentType] ?? [];
  return allowed.includes(toolName);
}

export async function runAgentExecution(params: {
  rootPath: string;
  personaPkg: PersonaPackage;
  userInput: string;
  goalId?: string;
  maxSteps?: number;
  toolExecutor?: AgentToolExecutor;
  plannerAdapter?: ModelAdapter;
  signal?: AbortSignal;
  /** EA-3: Agent 类型，用于限制可用工具集 */
  agentType?: "retrieval" | "transform" | "capture" | "action";
}): Promise<ExecutionResult> {
  const maxSteps = Number.isFinite(params.maxSteps) ? Math.max(1, Math.min(12, Math.floor(params.maxSteps as number))) : 4;
  let goal: Goal;
  if (params.goalId) {
    const existing = await getGoal(params.rootPath, params.goalId);
    if (!existing) {
      goal = await createGoal({
        rootPath: params.rootPath,
        title: params.userInput,
        source: "user"
      });
    } else {
      goal = existing;
    }
  } else {
    goal = await createGoal({
      rootPath: params.rootPath,
      title: params.userInput,
      source: "user"
    });
  }

  const traces: string[] = [];
  let finalReply = "";
  let finalStatus: GoalStatus = goal.status;
  let finalVerdict: "allow" | "rewrite" | "reject" = "allow";
  let finalConsistencyTraceId = "";
  const finalRuleHits = new Set<string>();
  const finalDegradeReasons = new Set<string>();
  let degradedExecution = false;
  let stopCondition: StopCondition | undefined;
  const planState: PlanState = {
    goalId: goal.id,
    version: 1,
    stepNo: 0,
    plannerSource: "fallback_rule",
    policy: {
      strategy: "tool_first",
      allowToolCalls: true,
      maxRetries: 1
    },
    history: [],
    lastUpdatedAt: new Date().toISOString()
  };
  await saveGoalContext(params.rootPath, {
    goalId: goal.id,
    planVersion: planState.version,
    nextStepHint: "开始规划并执行第一步",
    updatedAt: new Date().toISOString()
  });

  const prePlanCheck = runConsistencyKernel({
    stage: "pre_plan",
    policy: "soft",
    personaName: params.personaPkg.persona.displayName,
    constitution: params.personaPkg.constitution,
    candidateText: `任务计划: ${params.userInput}`,
    userInput: params.userInput
  });
  const prePlanTrace = await appendExecutionTrace(params.rootPath, {
    type: "consistency",
    goalId: goal.id,
      payload: {
        phase: "pre_plan",
        verdict: prePlanCheck.verdict,
        ruleHits: prePlanCheck.ruleHits,
        degradeRecommended: prePlanCheck.degradeRecommended,
        degradeReasons: prePlanCheck.degradeReasons,
        explanations: prePlanCheck.explanations
      }
    });
  traces.push(prePlanTrace.id);
  for (const hit of prePlanCheck.ruleHits) {
    finalRuleHits.add(hit.ruleId);
  }
  for (const reason of prePlanCheck.degradeReasons) {
    finalDegradeReasons.add(reason);
  }
  if (prePlanCheck.verdict === "reject") {
    finalStatus = "blocked";
    finalVerdict = "reject";
    finalConsistencyTraceId = prePlanCheck.traceId;
    finalReply = "这个目标与我的边界冲突，我不能直接执行。我可以帮你改成安全可行的方案。";
    stopCondition = {
      kind: "blocked_by_consistency",
      reason: "pre_plan_reject"
    };
  } else if (prePlanCheck.degradeRecommended) {
    degradedExecution = true;
    planState.policy = {
      strategy: "reply_first",
      allowToolCalls: false,
      maxRetries: 0
    };
  }
  const initialPlanned = await buildPlannedActions({
    plannerAdapter: params.plannerAdapter,
    personaPkg: params.personaPkg,
    userInput: params.userInput,
    degradedExecution,
    maxSteps
  });
  let plannedActions = initialPlanned.actions;
  planState.plannerSource = initialPlanned.source;
  const ideationTrace = await appendExecutionTrace(params.rootPath, {
    type: "execution",
    goalId: goal.id,
    payload: {
      phase: "idea_deliberation_merged",
      plannerSource: initialPlanned.source,
      ideaPacket: initialPlanned.ideaPacket,
      draftAction: initialPlanned.draftAction
    }
  });
  traces.push(ideationTrace.id);

  for (let stepNo = 0; stepNo < maxSteps; stepNo += 1) {
    if (finalStatus === "blocked") {
      break;
    }
    if (params.signal?.aborted) {
      finalStatus = "suspended";
      finalReply = "执行已中止。";
      stopCondition = {
        kind: "aborted",
        reason: "signal_aborted"
      };
      break;
    }
    const planned = plannedActions[stepNo] ?? planActionFromInput(params.userInput, stepNo);
    const action = degradedExecution ? degradeAction(planned, prePlanCheck.degradeReasons) : planned;
    if (action.kind === "complete") {
      finalStatus = "completed";
      finalReply = action.replyDraft ?? "任务已完成。";
      stopCondition = {
        kind: "goal_completed",
        reason: action.reason
      };
      break;
    }

    if (action.kind === "reply" || action.kind === "clarify") {
      finalReply = action.replyDraft ?? "我需要你再明确一下目标。";
      finalStatus = action.kind === "clarify" ? "blocked" : "completed";
      stopCondition = {
        kind: action.kind === "clarify" ? "clarify_required" : "goal_completed",
        reason: action.reason
      };
      break;
    }

    const step = await appendGoalStep(params.rootPath, goal.id, {
      title: action.reason,
      toolName: action.toolName,
      input: action.toolInput
    });
    if (!step) {
      finalStatus = "blocked";
      finalReply = "目标状态异常，无法继续执行。";
      stopCondition = {
        kind: "blocked_by_consistency",
        reason: "goal_step_append_failed"
      };
      break;
    }

    const preCheck = runConsistencyKernel({
      stage: "pre_action",
      policy: "soft",
      personaName: params.personaPkg.persona.displayName,
      constitution: params.personaPkg.constitution,
      candidateText: `执行步骤: ${action.reason}`,
      userInput: params.userInput
    });
    const preTrace = await appendExecutionTrace(params.rootPath, {
      type: "consistency",
      goalId: goal.id,
      stepId: step.id,
      payload: {
        phase: "pre_action",
        verdict: preCheck.verdict,
        ruleHits: preCheck.ruleHits,
        degradeRecommended: preCheck.degradeRecommended,
        degradeReasons: preCheck.degradeReasons,
        explanations: preCheck.explanations
      }
    });
    traces.push(preTrace.id);
    for (const hit of preCheck.ruleHits) {
      finalRuleHits.add(hit.ruleId);
    }
    for (const reason of preCheck.degradeReasons) {
      finalDegradeReasons.add(reason);
    }

    if (preCheck.verdict === "reject") {
      await finishGoalStep(params.rootPath, goal.id, step.id, {
        ok: false,
        error: "consistency_rejected"
      });
      finalStatus = "blocked";
      finalReply = "这个任务步骤会破坏人格一致性，我不能执行。";
      finalVerdict = "reject";
      finalConsistencyTraceId = preCheck.traceId;
      stopCondition = {
        kind: "blocked_by_consistency",
        reason: "pre_action_reject"
      };
      break;
    } else if (preCheck.degradeRecommended && action.kind === "tool_call") {
      degradedExecution = true;
      const degradedAction = degradeAction(action, preCheck.degradeReasons);
      if (degradedAction.kind === "reply" || degradedAction.kind === "clarify") {
        finalReply = degradedAction.replyDraft ?? "这个任务我需要先降低风险再继续。";
        finalStatus = "completed";
        finalVerdict = "rewrite";
        finalConsistencyTraceId = preCheck.traceId;
        stopCondition = {
          kind: "goal_completed",
          reason: "degraded_to_reply"
        };
        break;
      }
    }

    // EA-3: whitelist check before tool execution
    const toolNameForCheck = action.toolName ?? "unknown";
    const agentType = params.agentType ?? "action";
    if (!isToolAllowedForAgentType(toolNameForCheck, agentType)) {
      finalStatus = "blocked";
      finalVerdict = "reject";
      finalReply = `工具 "${toolNameForCheck}" 不在 ${agentType} 类型 Agent 的允许工具集内，执行被阻断。`;
      stopCondition = {
        kind: "blocked_by_consistency",
        reason: `tool_not_allowed_for_agent_type:${agentType}`
      };
      break;
    }

    const observation = params.toolExecutor
      ? await params.toolExecutor.run({
          toolName: toolNameForCheck,
          input: action.toolInput ?? {},
          signal: params.signal
        })
      : {
          ok: true,
          summary: "tool_executor_not_provided",
          output: {
            simulated: true
          }
        };

    await finishGoalStep(params.rootPath, goal.id, step.id, {
      ok: observation.ok,
      output: observation.output,
      error: observation.error
    });

    const execTrace = await appendExecutionTrace(params.rootPath, {
      type: "execution",
      goalId: goal.id,
      stepId: step.id,
      payload: {
        action,
        observation
      }
    });
    traces.push(execTrace.id);

    const postCheck = runConsistencyKernel({
      stage: "post_action",
      policy: "soft",
      personaName: params.personaPkg.persona.displayName,
      constitution: params.personaPkg.constitution,
      candidateText: observation.summary,
      userInput: params.userInput
    });
    const postTrace = await appendExecutionTrace(params.rootPath, {
      type: "consistency",
      goalId: goal.id,
      stepId: step.id,
      payload: {
        phase: "post_action",
        verdict: postCheck.verdict,
        ruleHits: postCheck.ruleHits,
        degradeRecommended: postCheck.degradeRecommended,
        degradeReasons: postCheck.degradeReasons,
        explanations: postCheck.explanations
      }
    });
    traces.push(postTrace.id);
    for (const hit of postCheck.ruleHits) {
      finalRuleHits.add(hit.ruleId);
    }
    for (const reason of postCheck.degradeReasons) {
      finalDegradeReasons.add(reason);
    }
    finalVerdict = postCheck.verdict;
    finalConsistencyTraceId = postCheck.traceId;

    if (!observation.ok || postCheck.verdict === "reject") {
      finalStatus = "blocked";
      finalReply = observation.error
        ? `执行受阻：${observation.error}`
        : "执行结果与人格一致性冲突，任务已阻断。";
      stopCondition = {
        kind: postCheck.verdict === "reject" ? "blocked_by_consistency" : "max_steps_reached",
        reason: observation.error ? "tool_error" : "post_action_reject"
      };
      break;
    }

    planState.history.push({
      stepNo,
      action: action.reason,
      observation: observation.summary,
      verdict: postCheck.verdict
    });
    planState.stepNo = stepNo + 1;
    planState.lastUpdatedAt = new Date().toISOString();
    await saveGoalContext(params.rootPath, {
      goalId: goal.id,
      planVersion: planState.version,
      lastObservation: observation.summary,
      nextStepHint: stepNo + 1 < maxSteps ? "继续下一步执行" : "生成最终回复并收敛任务",
      updatedAt: planState.lastUpdatedAt
    });

    if (observation.ok && isObservationInsufficient(observation) && stepNo + 1 < maxSteps) {
      const remainingSteps = maxSteps - (stepNo + 1);
      const replanInput = `${params.userInput}\n[latest_observation]\n${observation.summary}`;
      const replanned = await buildPlannedActions({
        plannerAdapter: params.plannerAdapter,
        personaPkg: params.personaPkg,
        userInput: replanInput,
        degradedExecution,
        maxSteps: remainingSteps
      });
      for (let idx = 0; idx < remainingSteps; idx += 1) {
        const next = replanned.actions[idx];
        if (next) {
          plannedActions[stepNo + 1 + idx] = next;
        }
      }
      planState.version += 1;
      planState.plannerSource = replanned.source;
      planState.lastUpdatedAt = new Date().toISOString();
      const replanTrace = await appendExecutionTrace(params.rootPath, {
        type: "execution",
        goalId: goal.id,
        stepId: step.id,
        payload: {
          phase: "replan",
          reason: "insufficient_observation",
          observation: observation.summary,
          plannerSource: replanned.source,
          planVersion: planState.version,
          ideaPacket: replanned.ideaPacket,
          draftAction: replanned.draftAction
        }
      });
      traces.push(replanTrace.id);
      await saveGoalContext(params.rootPath, {
        goalId: goal.id,
        planVersion: planState.version,
        lastObservation: observation.summary,
        nextStepHint: "观察结果不足，已重规划补步",
        updatedAt: planState.lastUpdatedAt
      });
    }

    if (stepNo === maxSteps - 1) {
      finalStatus = "completed";
      finalReply = "任务执行完成。";
      stopCondition = {
        kind: "max_steps_reached",
        reason: "reached_max_steps"
      };
    }
  }

  const refreshed = await getGoal(params.rootPath, goal.id);
  if (refreshed) {
    refreshed.status = finalStatus;
    await saveGoal(params.rootPath, refreshed);
    goal = refreshed;
  }
  const context = await getGoalContext(params.rootPath, goal.id);
  if (context) {
    await saveGoalContext(params.rootPath, {
      ...context,
      nextStepHint:
        finalStatus === "completed"
          ? "任务已完成"
          : finalStatus === "suspended"
            ? "等待恢复后继续执行"
            : finalStatus === "blocked"
              ? "目标被阻断，请调整约束后重试"
              : "继续推进目标"
    });
  }

  const finalCheck = runConsistencyKernel({
    stage: "pre_reply",
    policy: "soft",
    personaName: params.personaPkg.persona.displayName,
    constitution: params.personaPkg.constitution,
    candidateText: finalReply,
    userInput: params.userInput,
    lifeEvents: await readLifeEvents(params.rootPath)
  });
  finalVerdict = finalCheck.verdict;
  finalConsistencyTraceId = finalCheck.traceId;
  const finalTrace = await appendExecutionTrace(params.rootPath, {
    type: "consistency",
    goalId: goal.id,
    payload: {
      phase: "final_reply",
      verdict: finalCheck.verdict,
      ruleHits: finalCheck.ruleHits,
      degradeRecommended: finalCheck.degradeRecommended,
      degradeReasons: finalCheck.degradeReasons,
      explanations: finalCheck.explanations
    }
  });
  traces.push(finalTrace.id);
  for (const hit of finalCheck.ruleHits) {
    finalRuleHits.add(hit.ruleId);
  }
  for (const reason of finalCheck.degradeReasons) {
    finalDegradeReasons.add(reason);
  }
  if (finalCheck.verdict === "reject") {
    finalReply = "我不能以这种方式继续，因为会破坏人格一致性。";
  } else {
    finalReply = finalCheck.text || finalReply;
  }

  const metaReview = await runMetaReviewLlm({
    adapter: params.plannerAdapter,
    personaPkg: params.personaPkg,
    userInput: params.userInput,
    candidateReply: finalReply,
    consistencyVerdict: finalCheck.verdict,
    consistencyReasons: [...finalDegradeReasons],
    domain: "tool"
  });
  const metaTrace = await appendExecutionTrace(params.rootPath, {
    type: "consistency",
    goalId: goal.id,
    payload: {
      phase: "meta_review",
      applied: metaReview.applied,
      verdict: metaReview.verdict,
      rationale: metaReview.rationale,
      degradeOrRejectReason: metaReview.degradeOrRejectReason
    }
  });
  traces.push(metaTrace.id);
  if (metaReview.applied) {
    if (metaReview.verdict === "rewrite" && metaReview.rewrittenReply) {
      finalReply = metaReview.rewrittenReply;
      finalVerdict = "rewrite";
    } else if (metaReview.verdict === "reject") {
      finalReply = "我不能按这个方向继续。我可以给你一个符合边界的替代方案。";
      finalVerdict = "reject";
      finalStatus = "blocked";
    }
    if (metaReview.degradeOrRejectReason) {
      finalDegradeReasons.add(metaReview.degradeOrRejectReason);
    }
  }

  return {
    goalId: goal.id,
    status: finalStatus,
    reply: finalReply,
    steps: goal.steps,
    consistencyVerdict: finalVerdict,
    consistencyTraceId: finalConsistencyTraceId,
    consistencyRuleHits: [...finalRuleHits],
    consistencyDegradeReasons: [...finalDegradeReasons],
    traceIds: traces,
    planState,
    stopCondition
  };
}

function degradeAction(action: ExecutionAction, reasons: string[]): ExecutionAction {
  if (action.kind !== "tool_call") {
    return action;
  }
  return {
    kind: "reply",
    reason: "degraded_by_consistency_kernel",
    replyDraft: `为了保持人格一致性和安全边界，我先不给出直接执行动作。当前更稳妥的方式是：先明确目标约束，再给你可执行方案。(${reasons.join(",") || "consistency_guard"})`
  };
}

async function buildPlannedActions(params: {
  plannerAdapter?: ModelAdapter;
  personaPkg: PersonaPackage;
  userInput: string;
  degradedExecution: boolean;
  maxSteps: number;
}): Promise<{
  source: "llm" | "fallback_rule";
  actions: ExecutionAction[];
  ideaPacket: MetaIntentPlan;
  draftAction: MetaActionDraft;
}> {
  const fallbackActions = Array.from({ length: params.maxSteps }, (_, idx) =>
    params.degradedExecution
      ? degradeAction(planActionFromInput(params.userInput, idx), ["pre_plan_degrade"])
      : planActionFromInput(params.userInput, idx)
  );

  if (!params.plannerAdapter) {
    return {
      source: "fallback_rule",
      actions: fallbackActions,
      ideaPacket: {
        domain: "dialogue",
        intent: "reply",
        rationale: "planner_adapter_missing"
      },
      draftAction: {
        replyDraft: fallbackActions[0]?.replyDraft ?? "我先给你一个安全、可执行的下一步。"
      }
    };
  }

  if (params.plannerAdapter.name === "deepseek") {
    const apiKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
    if (!apiKey || apiKey === "test-key") {
      return {
        source: "fallback_rule",
        actions: fallbackActions,
        ideaPacket: {
          domain: "dialogue",
          intent: "reply",
          rationale: "planner_adapter_unavailable"
        },
        draftAction: {
          replyDraft: fallbackActions[0]?.replyDraft ?? "我先给你一个安全、可执行的下一步。"
        }
      };
    }
  }

  try {
    const messages = buildPlannerMessages(params.personaPkg, params.userInput, params.maxSteps);
    const result = await params.plannerAdapter.streamChat(
      messages,
      {
        onToken: () => {
          // planning is hidden from user-facing token stream.
        }
      }
    );
    const parsed = parsePlannerOutput(result.content, params.maxSteps);
    if (parsed.actions.length === 0) {
      return {
        source: "fallback_rule",
        actions: fallbackActions,
        ideaPacket: {
          domain: "dialogue",
          intent: "reply",
          rationale: "planner_output_invalid"
        },
        draftAction: {
          replyDraft: fallbackActions[0]?.replyDraft ?? "我先给你一个安全、可执行的下一步。"
        }
      };
    }
    const normalized = parsed.actions.map((item) =>
      params.degradedExecution ? degradeAction(item, ["pre_plan_degrade"]) : item
    );
    return {
      source: "llm",
      actions: normalized,
      ideaPacket: parsed.ideaPacket,
      draftAction: params.degradedExecution
        ? {
            replyDraft:
              parsed.draftAction.replyDraft ??
              normalized[0]?.replyDraft ??
              "为了保持一致性，我先给你低风险执行建议。"
          }
        : parsed.draftAction
    };
  } catch {
    return {
      source: "fallback_rule",
      actions: fallbackActions,
      ideaPacket: {
        domain: "dialogue",
        intent: "reply",
        rationale: "planner_call_failed"
      },
      draftAction: {
        replyDraft: fallbackActions[0]?.replyDraft ?? "我先给你一个安全、可执行的下一步。"
      }
    };
  }
}

function buildPlannerMessages(personaPkg: PersonaPackage, userInput: string, maxSteps: number): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        `你是${personaPkg.persona.displayName}的任务规划器。`,
        "你必须输出严格 JSON，不要输出解释文本。",
        "JSON schema:",
        '{"idea_packet":{"domain":"dialogue|tool","intent":"reply|ask_clarify|tool_call|refuse","rationale":"string"},"draft_action":{"replyDraft":"string?","toolDraft":{"name":"session.read_file|session.fetch_url|session.show_modes|session.proactive_tune|session.proactive_status|session.owner_auth|session.set_mode|session.exit","input":{}}?},"steps":[{"kind":"tool_call|reply|clarify|complete","reason":"string","toolName":"string?","toolInput":{}?,"replyDraft":"string?"}]}',
        `steps 长度 1-${Math.min(maxSteps, 6)}，必须可执行且保持人格边界。`,
        "idea_packet 与 draft_action 必填，steps 可为空（为空时将由 draft_action 回退生成）。",
        `Mission: ${personaPkg.constitution.mission}`,
        `Values: ${personaPkg.constitution.values.join(", ")}`,
        `Boundaries: ${personaPkg.constitution.boundaries.join("; ")}`
      ].join("\n")
    },
    {
      role: "user",
      content: `请规划这个任务：${userInput}`
    }
  ];
}

function parsePlannerOutput(
  content: string,
  maxSteps: number
): { actions: ExecutionAction[]; ideaPacket: MetaIntentPlan; draftAction: MetaActionDraft } {
  const text = content.trim();
  if (!text) {
    return fallbackPlannerParseResult([]);
  }
  const jsonCandidate = extractFirstJsonObject(text);
  if (!jsonCandidate) {
    return fallbackPlannerParseResult([]);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return fallbackPlannerParseResult([]);
  }
  if (typeof parsed !== "object" || parsed == null) {
    return fallbackPlannerParseResult([]);
  }
  const record = parsed as Record<string, unknown>;
  const ideaPacket = parseIdeaPacket(record.idea_packet);
  const draftAction = parseDraftAction(record.draft_action);
  const rawSteps = Array.isArray(record.steps) ? record.steps : [];
  const steps = rawSteps.slice(0, Math.max(1, Math.min(12, maxSteps)));
  const actions: ExecutionAction[] = [];
  for (const step of steps) {
    if (typeof step !== "object" || step == null) {
      continue;
    }
    const row = step as Record<string, unknown>;
    const kind = row.kind;
    if (kind !== "tool_call" && kind !== "reply" && kind !== "clarify" && kind !== "complete") {
      continue;
    }
    const reason = typeof row.reason === "string" && row.reason.trim() ? row.reason.trim() : "llm_planned_step";
    const action: ExecutionAction = {
      kind,
      reason
    };
    if (typeof row.toolName === "string" && row.toolName.trim()) {
      action.toolName = row.toolName.trim();
    }
    if (typeof row.replyDraft === "string" && row.replyDraft.trim()) {
      action.replyDraft = row.replyDraft.trim();
    }
    if (typeof row.toolInput === "object" && row.toolInput != null && !Array.isArray(row.toolInput)) {
      action.toolInput = row.toolInput as Record<string, unknown>;
    }
    actions.push(action);
  }
  if (actions.length === 0) {
    const fallbackAction = buildActionFromDraft(draftAction);
    if (fallbackAction) {
      actions.push(fallbackAction);
    }
  }
  return {
    actions,
    ideaPacket,
    draftAction
  };
}

function extractFirstJsonObject(content: string): string | null {
  const fenceMatch = /```json\s*([\s\S]*?)```/i.exec(content);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  return content.slice(firstBrace, lastBrace + 1);
}

function parseIdeaPacket(value: unknown): MetaIntentPlan {
  if (typeof value !== "object" || value == null) {
    return {
      domain: "dialogue",
      intent: "reply",
      rationale: "planner_missing_idea_packet"
    };
  }
  const packet = value as Record<string, unknown>;
  const domain = packet.domain === "tool" ? "tool" : "dialogue";
  const rawIntent = packet.intent;
  const intent =
    rawIntent === "reply" || rawIntent === "ask_clarify" || rawIntent === "tool_call" || rawIntent === "refuse"
      ? rawIntent
      : "reply";
  const rationale =
    typeof packet.rationale === "string" && packet.rationale.trim()
      ? packet.rationale.trim()
      : "planner_default_rationale";
  return {
    domain,
    intent,
    rationale
  };
}

function parseDraftAction(value: unknown): MetaActionDraft {
  if (typeof value !== "object" || value == null) {
    return {
      replyDraft: "我先给你一个可执行的下一步。"
    };
  }
  const draft = value as Record<string, unknown>;
  const parsed: MetaActionDraft = {};
  if (typeof draft.replyDraft === "string" && draft.replyDraft.trim()) {
    parsed.replyDraft = draft.replyDraft.trim();
  }
  if (typeof draft.toolDraft === "object" && draft.toolDraft != null && !Array.isArray(draft.toolDraft)) {
    const toolDraft = draft.toolDraft as Record<string, unknown>;
    if (typeof toolDraft.name === "string" && toolDraft.name.trim()) {
      const toolName = toolDraft.name.trim() as CapabilityName;
      parsed.toolDraft = {
        name: toolName,
        input:
          typeof toolDraft.input === "object" && toolDraft.input != null && !Array.isArray(toolDraft.input)
            ? (toolDraft.input as Record<string, unknown>)
            : undefined
      };
    }
  }
  if (!parsed.replyDraft && !parsed.toolDraft) {
    parsed.replyDraft = "我先给你一个可执行的下一步。";
  }
  return parsed;
}

function buildActionFromDraft(draftAction: MetaActionDraft): ExecutionAction | null {
  if (draftAction.toolDraft) {
    return {
      kind: "tool_call",
      reason: "llm_draft_tool",
      toolName: draftAction.toolDraft.name,
      toolInput: draftAction.toolDraft.input
    };
  }
  if (draftAction.replyDraft) {
    return {
      kind: "reply",
      reason: "llm_draft_reply",
      replyDraft: draftAction.replyDraft
    };
  }
  return null;
}

function fallbackPlannerParseResult(actions: ExecutionAction[]): {
  actions: ExecutionAction[];
  ideaPacket: MetaIntentPlan;
  draftAction: MetaActionDraft;
} {
  return {
    actions,
    ideaPacket: {
      domain: "dialogue",
      intent: "reply",
      rationale: "planner_parse_fallback"
    },
    draftAction: {
      replyDraft: actions[0]?.replyDraft ?? "我先给你一个可执行的下一步。"
    }
  };
}

function planActionFromInput(input: string, stepNo: number): ExecutionAction {
  const text = input.trim();
  if (!text) {
    return {
      kind: "clarify",
      reason: "empty_input",
      replyDraft: "请先告诉我要完成的目标。"
    };
  }
  if (stepNo > 0) {
    return {
      kind: "complete",
      reason: "single_step_default",
      replyDraft: "我已经完成关键步骤，并整理好结果。"
    };
  }
  if (/https?:\/\//i.test(text)) {
    const matched = /https?:\/\/\S+/i.exec(text)?.[0] ?? "";
    return {
      kind: "tool_call",
      reason: "fetch_reference",
      toolName: "http.fetch",
      toolInput: {
        url: matched
      }
    };
  }
  if (/文件|file|read|读取/i.test(text)) {
    return {
      kind: "tool_call",
      reason: "read_workspace_file",
      toolName: "workspace.read",
      toolInput: {}
    };
  }
  return {
    kind: "reply",
    reason: "non_tool_task",
    replyDraft: "我理解你的目标了。我会先给出可执行方案并保持人格一致性。"
  };
}

function isObservationInsufficient(observation: ExecutionObservation): boolean {
  const summary = observation.summary.trim().toLowerCase();
  if (!summary) {
    return true;
  }
  if (summary.includes("tool_executor_not_provided")) {
    return true;
  }
  if (summary.includes("simulated")) {
    return true;
  }
  if (summary.includes("unknown")) {
    return true;
  }
  return false;
}
