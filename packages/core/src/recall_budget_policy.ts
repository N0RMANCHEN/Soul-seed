import type { DerivedParams } from "./genome_derived.js";

export interface RecallBudgetPolicyInput {
  userInput: string;
  projection?: {
    confidence?: number;
    signals?: Array<{ label?: string; score?: number }>;
  };
  routeDecision?: "instinct" | "deliberative" | null;
  hasPendingGoal?: boolean;
  isFollowup?: boolean;
  genomeDerived?: DerivedParams;
}

export interface RecallBudgetPolicyResult {
  budget: {
    candidateMax: number;
    rerankMax: number;
    injectMax: number;
    injectCharMax: number;
  };
  profile: "default" | "task_deep" | "followup" | "goal_active";
  reasonCodes: string[];
}

function pickSignalScore(
  signals: Array<{ label?: string; score?: number }> | undefined,
  label: string
): number {
  if (!Array.isArray(signals)) return 0;
  const found = signals.find((item) => item?.label === label);
  const raw = Number(found?.score);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(1, raw));
}

export function deriveRecallBudgetPolicy(input: RecallBudgetPolicyInput): RecallBudgetPolicyResult {
  const normalized = input.userInput.trim();
  const confidence = Number.isFinite(Number(input.projection?.confidence))
    ? Math.max(0, Math.min(1, Number(input.projection?.confidence)))
    : 0;
  const taskScore = pickSignalScore(input.projection?.signals, "task");
  const deepScore = pickSignalScore(input.projection?.signals, "deep");

  const reasonCodes: string[] = [];
  let profile: RecallBudgetPolicyResult["profile"] = "default";
  const genomeInjectMax = input.genomeDerived?.recallTopK ?? 7;
  let budget = {
    candidateMax: 180,
    rerankMax: 28,
    injectMax: Math.max(3, Math.min(20, genomeInjectMax)),
    injectCharMax: 2200
  };

  const likelyFollowup =
    input.isFollowup === true ||
    normalized.length <= 16 ||
    /继续|接着|然后|再说|ok|好的|yes|go on/i.test(normalized);
  if (likelyFollowup) {
    profile = "followup";
    budget = {
      candidateMax: 200,
      rerankMax: 30,
      injectMax: 8,
      injectCharMax: 2400
    };
    reasonCodes.push("followup_context");
  }

  if (taskScore >= 0.58 || deepScore >= 0.58 || input.routeDecision === "deliberative") {
    profile = "task_deep";
    budget = {
      candidateMax: 220,
      rerankMax: 34,
      injectMax: 10,
      injectCharMax: 3000
    };
    reasonCodes.push("task_or_deep_intent");
  }

  if (input.hasPendingGoal) {
    profile = "goal_active";
    budget = {
      candidateMax: 230,
      rerankMax: 36,
      injectMax: 10,
      injectCharMax: 3200
    };
    reasonCodes.push("goal_active");
  }

  if (input.projection && confidence < 0.45) {
    budget = {
      ...budget,
      injectMax: Math.min(10, budget.injectMax + 1),
      injectCharMax: Math.min(3400, budget.injectCharMax + 200)
    };
    reasonCodes.push("low_projection_confidence");
  }

  if (reasonCodes.length === 0) {
    reasonCodes.push("default_policy");
  }

  return {
    budget,
    profile,
    reasonCodes
  };
}
