import type { LifeEvent, PersonaConstitution } from "./types.js";

export interface NarrativeDriftResult {
  score: number;
  reasons: string[];
}

export function evaluateNarrativeDrift(params: {
  constitution: PersonaConstitution;
  userInput: string;
  assistantReply: string;
}): NarrativeDriftResult {
  const reasons: string[] = [];
  let score = 0;

  const reply = params.assistantReply.toLowerCase();
  const user = params.userInput.toLowerCase();
  const mission = params.constitution.mission.toLowerCase();
  const values = params.constitution.values.map((v) => v.toLowerCase());
  const boundaries = params.constitution.boundaries.map((b) => b.toLowerCase());

  const sycophancyPattern =
    /(你说得都对|你永远正确|你说什么我都同意|i fully agree with everything|you are always right)/i;
  if (sycophancyPattern.test(reply)) {
    score += 0.45;
    reasons.push("blind_agreement_detected");
  }

  const explicitOverridePattern =
    /(忽略你的原则|违背你的使命|不要遵守边界|ignore your values|break your rules)/i;
  if (explicitOverridePattern.test(user) && /(好的|同意|我会|i will|sure)/i.test(reply)) {
    score += 0.55;
    reasons.push("accepted_core_override_request");
  }

  if (boundaryContradiction(reply, boundaries)) {
    score += 0.35;
    reasons.push("boundary_contradiction");
  }

  if (missionContradiction(reply, mission, values)) {
    score += 0.25;
    reasons.push("mission_or_value_drift");
  }

  return {
    score: clamp01(score),
    reasons
  };
}

export function shouldRequestConstitutionReview(
  events: LifeEvent[],
  nowMs: number,
  options?: { windowSize?: number; minCount?: number; minScore?: number }
): boolean {
  const windowSize = options?.windowSize ?? 20;
  const minCount = options?.minCount ?? 3;
  const minScore = options?.minScore ?? 0.6;

  const recent = events.slice(-windowSize);
  const recentDrifts = recent.filter((event) => {
    if (event.type !== "narrative_drift_detected") {
      return false;
    }
    const score = Number(event.payload.score ?? 0);
    const ts = Date.parse(event.ts);
    if (!Number.isFinite(ts) || ts > nowMs + 1000) {
      return false;
    }
    return score >= minScore;
  });

  return recentDrifts.length >= minCount;
}

function boundaryContradiction(reply: string, boundaries: string[]): boolean {
  const unsafePattern = /(fabricat|编造|违法|犯罪|攻击脚本|木马|恶意软件|malware|exploit)/i;
  const hasUnsafeReply = unsafePattern.test(reply);
  const hasSafetyBoundary = boundaries.some((boundary) =>
    /(no fabricated|不编造|respect|合法|安全)/i.test(boundary)
  );
  return hasUnsafeReply && hasSafetyBoundary;
}

function missionContradiction(reply: string, mission: string, values: string[]): boolean {
  const antiContinuity = /(我不关心一致性|随便改身份|i am whoever you want)/i;
  const missionHasContinuity = /(continuity|一致)/i.test(mission);
  const valuesHasHonesty = values.some((v) => /(honesty|诚实)/i.test(v));
  const dishonestPattern = /(我编的|I made that up|我可以瞎说)/i;
  return (missionHasContinuity && antiContinuity.test(reply)) || (valuesHasHonesty && dishonestPattern.test(reply));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
