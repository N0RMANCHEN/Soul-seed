import path from "node:path";

export interface ToolImpact {
  readPaths?: string[];
  writePaths?: string[];
  estimatedDurationMs?: number;
}

export interface ToolBudget {
  maxCallsPerSession: number;
  maxDurationMs: number;
}

export interface ToolApproval {
  approved: boolean;
  reason: string;
  budget: ToolBudget;
  allowedReadRoots?: string[];
  allowedWriteRoots?: string[];
}

export interface ToolSessionState {
  callCount: number;
}

export interface ToolCallRequest<T> {
  toolName: string;
  impact: ToolImpact;
  approval?: ToolApproval;
  session: ToolSessionState;
  signal?: AbortSignal;
  run: (signal: AbortSignal) => Promise<T>;
}

export interface ToolBudgetSnapshot extends ToolBudget {
  sessionCallCount: number;
}

export interface ToolCallOutcome<T> {
  status: "ok" | "rejected" | "aborted" | "timeout";
  toolName: string;
  reason: string;
  durationMs: number;
  budgetSnapshot: ToolBudgetSnapshot;
  result?: T;
}

const DEFAULT_REJECT_BUDGET: ToolBudgetSnapshot = {
  maxCallsPerSession: 0,
  maxDurationMs: 0,
  sessionCallCount: 0
};

export function createToolSessionState(): ToolSessionState {
  return { callCount: 0 };
}

export async function executeToolCall<T>(request: ToolCallRequest<T>): Promise<ToolCallOutcome<T>> {
  const started = Date.now();
  const approval = request.approval;
  if (!approval || approval.approved !== true) {
    return {
      status: "rejected",
      toolName: request.toolName,
      reason: "tool call rejected: deny-by-default (missing explicit approval)",
      durationMs: Date.now() - started,
      budgetSnapshot: DEFAULT_REJECT_BUDGET
    };
  }

  const snapshot: ToolBudgetSnapshot = {
    ...approval.budget,
    sessionCallCount: request.session.callCount
  };

  const rootIssue = validateImpactRoots(request.impact, approval);
  if (rootIssue) {
    return {
      status: "rejected",
      toolName: request.toolName,
      reason: rootIssue,
      durationMs: Date.now() - started,
      budgetSnapshot: snapshot
    };
  }

  if (request.session.callCount + 1 > approval.budget.maxCallsPerSession) {
    return {
      status: "rejected",
      toolName: request.toolName,
      reason: `tool call rejected: session call budget exceeded (${request.session.callCount + 1}/${approval.budget.maxCallsPerSession})`,
      durationMs: Date.now() - started,
      budgetSnapshot: snapshot
    };
  }

  request.session.callCount += 1;
  snapshot.sessionCallCount = request.session.callCount;

  const controller = new AbortController();
  const stopInputForward = forwardAbort(request.signal, controller);
  let timeoutId: NodeJS.Timeout | null = null;
  timeoutId = setTimeout(() => controller.abort("timeout"), Math.max(1, approval.budget.maxDurationMs));

  try {
    const result = await request.run(controller.signal);
    if (controller.signal.aborted) {
      return {
        status: String(controller.signal.reason) === "timeout" ? "timeout" : "aborted",
        toolName: request.toolName,
        reason: String(controller.signal.reason ?? "aborted"),
        durationMs: Date.now() - started,
        budgetSnapshot: snapshot
      };
    }
    return {
      status: "ok",
      toolName: request.toolName,
      reason: approval.reason,
      durationMs: Date.now() - started,
      budgetSnapshot: snapshot,
      result
    };
  } catch (error: unknown) {
    const aborted = controller.signal.aborted || isAbortError(error);
    const timeout = String(controller.signal.reason) === "timeout";
    return {
      status: timeout ? "timeout" : aborted ? "aborted" : "rejected",
      toolName: request.toolName,
      reason: aborted
        ? String(controller.signal.reason ?? "aborted")
        : error instanceof Error
          ? error.message
          : String(error),
      durationMs: Date.now() - started,
      budgetSnapshot: snapshot
    };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    stopInputForward();
  }
}

function validateImpactRoots(impact: ToolImpact, approval: ToolApproval): string | null {
  const readIssue = validateRoots(impact.readPaths ?? [], approval.allowedReadRoots ?? [], "read");
  if (readIssue) {
    return readIssue;
  }
  const writeIssue = validateRoots(impact.writePaths ?? [], approval.allowedWriteRoots ?? [], "write");
  if (writeIssue) {
    return writeIssue;
  }
  return null;
}

function validateRoots(paths: string[], roots: string[], mode: "read" | "write"): string | null {
  if (paths.length === 0) {
    return null;
  }
  if (roots.length === 0) {
    return `tool call rejected: ${mode} roots are not approved`;
  }
  const normalizedRoots = roots.map((item) => normalizeFsPath(item));
  for (const item of paths) {
    const target = normalizeFsPath(item);
    const allowed = normalizedRoots.some((root) => target === root || target.startsWith(`${root}${path.sep}`));
    if (!allowed) {
      return `tool call rejected: ${mode} path out of approved scope (${target})`;
    }
  }
  return null;
}

function normalizeFsPath(input: string): string {
  return path.resolve(input);
}

function forwardAbort(source: AbortSignal | undefined, target: AbortController): () => void {
  if (!source) {
    return () => undefined;
  }
  if (source.aborted) {
    target.abort(source.reason ?? "aborted");
    return () => undefined;
  }
  const onAbort = () => target.abort(source.reason ?? "aborted");
  source.addEventListener("abort", onAbort, { once: true });
  return () => source.removeEventListener("abort", onAbort);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
