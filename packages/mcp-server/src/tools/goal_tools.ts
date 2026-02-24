import {
  cancelGoal,
  createGoal,
  executeTurnProtocol,
  getExecutionTrace,
  getGoal,
  getGoalContext,
  listExecutionTraces,
  listGoals,
  loadPersonaPackage,
  inspectRuntimeModelConfig,
  runAgentExecution
} from "@soulseed/core";

export async function runGoalCreateTool(personaPath: string, args: {
  title: string;
  summary?: string;
  source?: "user" | "system" | "mcp";
}): Promise<Record<string, unknown>> {
  const title = String(args.title ?? "").trim();
  if (!title) {
    throw new Error("goal.create: title is required");
  }
  const created = await createGoal({
    rootPath: personaPath,
    title,
    summary: typeof args.summary === "string" ? args.summary : undefined,
    source: args.source ?? "mcp"
  });
  return {
    status: "ok",
    goal: created
  };
}

export async function runGoalListTool(personaPath: string, args: {
  status?: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const status =
    args.status === "pending" ||
    args.status === "active" ||
    args.status === "blocked" ||
    args.status === "completed" ||
    args.status === "canceled" ||
    args.status === "suspended"
      ? args.status
      : undefined;
  const items = await listGoals(personaPath, {
    status,
    limit: typeof args.limit === "number" ? args.limit : undefined
  });
  return {
    status: "ok",
    items
  };
}

export async function runGoalGetTool(personaPath: string, args: {
  goalId: string;
}): Promise<Record<string, unknown>> {
  const goalId = String(args.goalId ?? "").trim();
  if (!goalId) {
    throw new Error("goal.get: goalId is required");
  }
  const goal = await getGoal(personaPath, goalId);
  return {
    status: "ok",
    found: Boolean(goal),
    goal
  };
}

export async function runGoalCancelTool(personaPath: string, args: {
  goalId: string;
}): Promise<Record<string, unknown>> {
  const goalId = String(args.goalId ?? "").trim();
  if (!goalId) {
    throw new Error("goal.cancel: goalId is required");
  }
  const goal = await cancelGoal(personaPath, goalId);
  return {
    status: "ok",
    found: Boolean(goal),
    goal
  };
}

export async function runAgentRunTool(personaPath: string, args: {
  userInput: string;
  goalId?: string;
  maxSteps?: number;
}): Promise<Record<string, unknown>> {
  const userInput = String(args.userInput ?? "").trim();
  if (!userInput) {
    throw new Error("agent.run: userInput is required");
  }
  const personaPkg = await loadPersonaPackage(personaPath);
  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput,
    goalId: typeof args.goalId === "string" ? args.goalId : undefined,
    maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
  });
  return {
    status: "ok",
    execution
  };
}

export async function runConsistencyInspectTool(personaPath: string, args: {
  goalId?: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const traces = await listExecutionTraces(personaPath, {
    goalId: typeof args.goalId === "string" ? args.goalId : undefined,
    limit: typeof args.limit === "number" ? args.limit : 20
  });
  const consistency = traces.filter((item) => item.type === "consistency");
  return {
    status: "ok",
    items: consistency
  };
}

export async function runTraceGetTool(personaPath: string, args: {
  traceId: string;
}): Promise<Record<string, unknown>> {
  const traceId = String(args.traceId ?? "").trim();
  if (!traceId) {
    throw new Error("trace.get: traceId is required");
  }
  const trace = await getExecutionTrace(personaPath, traceId);
  return {
    status: "ok",
    found: Boolean(trace),
    trace
  };
}

export async function runRuntimeTurnTool(personaPath: string, args: {
  userInput: string;
  mode?: "auto" | "soul" | "agent";
  model?: string;
  maxSteps?: number;
}): Promise<Record<string, unknown>> {
  const userInput = String(args.userInput ?? "").trim();
  if (!userInput) {
    throw new Error("runtime.turn: userInput is required");
  }
  const personaPkg = await loadPersonaPackage(personaPath);
  const runtimeConfig = inspectRuntimeModelConfig().config;
  const model =
    typeof args.model === "string" && args.model.trim().length > 0
      ? args.model.trim()
      : runtimeConfig.chatModel || "deepseek-chat";
  const mode = args.mode === "soul" || args.mode === "agent" ? args.mode : "auto";
  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput,
    model,
    lifeEvents: [],
    mode,
    maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
  });
  return {
    status: "ok",
    turn: {
      ...turn,
      requiresGeneration: turn.mode === "soul"
    }
  };
}

export async function runRuntimeGoalResumeTool(personaPath: string, args: {
  goalId?: string;
  userInput?: string;
  model?: string;
  maxSteps?: number;
}): Promise<Record<string, unknown>> {
  const listed = await listGoals(personaPath, { limit: 50 });
  const goalId = typeof args.goalId === "string" ? args.goalId.trim() : "";
  const targetId =
    goalId ||
    listed.find((item) => item.status === "active" || item.status === "suspended" || item.status === "blocked" || item.status === "pending")?.id ||
    listed[0]?.id ||
    "";
  if (!targetId) {
    return {
      status: "ok",
      found: false
    };
  }
  const goal = await getGoal(personaPath, targetId);
  if (!goal) {
    return {
      status: "ok",
      found: false
    };
  }
  const context = await getGoalContext(personaPath, targetId);
  const personaPkg = await loadPersonaPackage(personaPath);
  const runtimeConfig = inspectRuntimeModelConfig().config;
  const model =
    typeof args.model === "string" && args.model.trim().length > 0
      ? args.model.trim()
      : runtimeConfig.chatModel || "deepseek-chat";
  const userInput =
    typeof args.userInput === "string" && args.userInput.trim().length > 0
      ? args.userInput.trim()
      : context?.nextStepHint
        ? `${goal.title}\n续做提示: ${context.nextStepHint}`
        : goal.title;
  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput,
    goalId: targetId,
    model,
    lifeEvents: [],
    mode: "agent",
    maxSteps: typeof args.maxSteps === "number" ? args.maxSteps : undefined
  });
  return {
    status: "ok",
    found: true,
    goalId: targetId,
    turn: {
      ...turn,
      requiresGeneration: false
    }
  };
}

export async function runRuntimeTraceGetTool(personaPath: string, args: {
  traceId: string;
}): Promise<Record<string, unknown>> {
  const traceId = String(args.traceId ?? "").trim();
  if (!traceId) {
    throw new Error("runtime.trace.get: traceId is required");
  }
  const trace = await getExecutionTrace(personaPath, traceId);
  const goal =
    trace?.goalId && typeof trace.goalId === "string"
      ? await getGoal(personaPath, trace.goalId)
      : null;
  return {
    status: "ok",
    found: Boolean(trace),
    trace,
    goal
  };
}
