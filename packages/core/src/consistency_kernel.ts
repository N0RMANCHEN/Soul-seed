import { enforceFactualGroundingGuard } from "./factual_grounding_guard.js";
import { enforceIdentityGuard } from "./identity_guard.js";
import { enforceRecallGroundingGuard } from "./recall_grounding_guard.js";
import { enforceRelationalGuard } from "./relational_guard.js";
import type { ConsistencyCheckInput, ConsistencyCheckResult, ConsistencyRuleHit } from "./types.js";
import { randomUUID } from "node:crypto";

export function runConsistencyKernel(input: ConsistencyCheckInput): ConsistencyCheckResult {
  const hits: ConsistencyRuleHit[] = [];
  let text = input.candidateText;

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

  const hasHard = hits.some((item) => item.severity === "hard");
  return {
    verdict: hasHard ? "reject" : hits.length > 0 ? "rewrite" : "allow",
    text,
    ruleHits: hits,
    traceId: randomUUID()
  };
}

function detectConstitutionHardViolations(text: string, boundaries: string[]): string[] {
  const result: string[] = [];
  const lowered = text.trim().toLowerCase();
  if (!lowered) {
    return result;
  }
  const unsafePattern = /(ignore your values|break your rules|违法|犯罪|coercion|minor|未成年)/i;
  if (unsafePattern.test(lowered)) {
    result.push("boundary_override_signal");
  }
  for (const boundary of boundaries) {
    const token = boundary.trim().toLowerCase();
    if (!token) {
      continue;
    }
    if (token.includes("no fabricated facts") && /(我记得你上次|你昨天说)/i.test(lowered)) {
      result.push("possible_fabricated_recall");
    }
  }
  return [...new Set(result)];
}
