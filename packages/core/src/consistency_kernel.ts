import { enforceFactualGroundingGuard } from "./factual_grounding_guard.js";
import { enforceIdentityGuard } from "./identity_guard.js";
import { enforceRecallGroundingGuard } from "./recall_grounding_guard.js";
import { enforceRelationalGuard } from "./relational_guard.js";
import { detectBoundaryRuleHits, explainBoundaryRuleHit } from "./constitution_rules.js";
import type { ConsistencyCheckInput, ConsistencyCheckResult, ConsistencyRuleHit } from "./types.js";
import { randomUUID } from "node:crypto";

export function runConsistencyKernel(input: ConsistencyCheckInput): ConsistencyCheckResult {
  const hits: ConsistencyRuleHit[] = [];
  let text = input.candidateText;
  const stage = input.stage ?? "pre_reply";
  const policy = input.policy ?? "soft";

  const identity = enforceIdentityGuard(text, input.personaName, input.userInput ?? "");
  if (identity.corrected) {
    text = identity.text;
    hits.push({
      ruleId: "identity_guard",
      severity: "hard",
      reason: identity.reason ?? "identity_adjusted"
    });
  }

  const relational = enforceRelationalGuard(text, {
    selectedMemories: input.selectedMemories ?? [],
    selectedMemoryBlocks: input.selectedMemoryBlocks ?? [],
    lifeEvents: input.lifeEvents ?? [],
    personaName: input.personaName
  });
  if (relational.corrected) {
    text = relational.text;
    hits.push({
      ruleId: "relational_guard",
      severity: relational.flags.includes("servile_self_positioning") ? "hard" : "soft",
      reason: relational.flags.join(",") || "relational_adjusted"
    });
  }

  const grounding = enforceRecallGroundingGuard(text, {
    selectedMemories: input.selectedMemories ?? [],
    selectedMemoryBlocks: input.selectedMemoryBlocks ?? [],
    lifeEvents: input.lifeEvents ?? [],
    strictMemoryGrounding: input.strictMemoryGrounding !== false
  });
  if (grounding.corrected) {
    text = grounding.text;
    hits.push({
      ruleId: "recall_grounding_guard",
      severity: "hard",
      reason: grounding.flags.join(",") || "recall_grounding_adjusted"
    });
  }

  const factual = enforceFactualGroundingGuard(text, { mode: "general" });
  if (factual.corrected) {
    text = factual.text;
    hits.push({
      ruleId: "factual_grounding_guard",
      severity: "hard",
      reason: factual.reason ?? "factual_adjusted"
    });
  }

  const constitutionHardHits = detectConstitutionHardViolations(text, input.constitution.boundaries);
  for (const reason of constitutionHardHits) {
    hits.push({
      ruleId: "constitution_boundary",
      severity: "hard",
      reason
    });
  }

  const hardHits = hits.filter((item) => item.severity === "hard");
  const hasHard = hardHits.length > 0;
  const hasBlockingHard = hardHits.some((item) => isBlockingHardRule(item.ruleId));
  const degradeRecommended = hasHard && stage !== "post_action";
  const degradeReasons = hardHits.map((item) => item.reason).slice(0, 8);
  const verdict =
    hasBlockingHard || (policy === "hard" && hasHard)
      ? "reject"
      : hasHard || hits.length > 0
        ? "rewrite"
        : "allow";
  const explanations = hits.map((item) => explainBoundaryRuleHit(item.reason || item.ruleId));

  return {
    verdict,
    text,
    ruleHits: hits,
    degradeRecommended,
    degradeReasons,
    explanations,
    traceId: randomUUID()
  };
}

function isBlockingHardRule(ruleId: string): boolean {
  return ruleId === "constitution_boundary";
}

function detectConstitutionHardViolations(text: string, boundaries: string[]): string[] {
  const result = detectBoundaryRuleHits(text, boundaries);
  const lowered = text.trim().toLowerCase();
  if (!lowered) {
    return result;
  }
  const unsafePattern =
    /(ignore your values|break your rules|ignore (all )?(previous|prior) instructions|jailbreak|prompt injection|越狱|忽略(所有|之前|以上)?指令|违法|犯罪|未成年)/iu;
  if (unsafePattern.test(lowered)) {
    result.push("boundary_override_signal");
  }
  return [...new Set(result)];
}
