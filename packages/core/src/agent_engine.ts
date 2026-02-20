import type {
  ExecutionAction,
  ExecutionObservation,
  ExecutionResult,
  Goal,
  GoalStatus,
  PersonaPackage
} from "./types.js";
import {
  appendExecutionTrace,
  appendGoalStep,
  createGoal,
  finishGoalStep,
  getGoal,
  saveGoal
} from "./goal_store.js";
import { runConsistencyKernel } from "./consistency_kernel.js";
import { readLifeEvents } from "./persona.js";

export interface AgentToolExecutor {
  run: (params: {
    toolName: string;
    input: Record<string, unknown>;
    signal?: AbortSignal;
  }) => Promise<ExecutionObservation>;
}

export async function runAgentExecution(params: {
  rootPath: string;
  personaPkg: PersonaPackage;
  userInput: string;
  goalId?: string;
  maxSteps?: number;
  toolExecutor?: AgentToolExecutor;
  signal?: AbortSignal;
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

  for (let stepNo = 0; stepNo < maxSteps; stepNo += 1) {
    if (params.signal?.aborted) {
      finalStatus = "blocked";
      finalReply = "执行已中止。";
      break;
    }
    const action = planActionFromInput(params.userInput, stepNo);
    if (action.kind === "complete") {
      finalStatus = "completed";
      finalReply = action.replyDraft ?? "任务已完成。";
      break;
    }

    if (action.kind === "reply" || action.kind === "clarify") {
      finalReply = action.replyDraft ?? "我需要你再明确一下目标。";
      finalStatus = action.kind === "clarify" ? "blocked" : "completed";
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
      break;
    }

    const preCheck = runConsistencyKernel({
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
        ruleHits: preCheck.ruleHits
      }
    });
    traces.push(preTrace.id);

    if (preCheck.verdict === "reject") {
      await finishGoalStep(params.rootPath, goal.id, step.id, {
        ok: false,
        error: "consistency_rejected"
      });
      finalStatus = "blocked";
      finalReply = "这个任务步骤会破坏人格一致性，我不能执行。";
      finalVerdict = "reject";
      finalConsistencyTraceId = preCheck.traceId;
      break;
    }

    const observation = params.toolExecutor
      ? await params.toolExecutor.run({
          toolName: action.toolName ?? "unknown",
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
        ruleHits: postCheck.ruleHits
      }
    });
    traces.push(postTrace.id);
    finalVerdict = postCheck.verdict;
    finalConsistencyTraceId = postCheck.traceId;

    if (!observation.ok || postCheck.verdict === "reject") {
      finalStatus = "blocked";
      finalReply = observation.error
        ? `执行受阻：${observation.error}`
        : "执行结果与人格一致性冲突，任务已阻断。";
      break;
    }

    if (stepNo === maxSteps - 1) {
      finalStatus = "completed";
      finalReply = "任务执行完成。";
    }
  }

  const refreshed = await getGoal(params.rootPath, goal.id);
  if (refreshed) {
    refreshed.status = finalStatus;
    await saveGoal(params.rootPath, refreshed);
    goal = refreshed;
  }

  const finalCheck = runConsistencyKernel({
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
      ruleHits: finalCheck.ruleHits
    }
  });
  traces.push(finalTrace.id);
  if (finalCheck.verdict === "reject") {
    finalReply = "我不能以这种方式继续，因为会破坏人格一致性。";
  } else {
    finalReply = finalCheck.text || finalReply;
  }

  return {
    goalId: goal.id,
    status: finalStatus,
    reply: finalReply,
    steps: goal.steps,
    consistencyVerdict: finalVerdict,
    consistencyTraceId: finalConsistencyTraceId,
    traceIds: traces
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
