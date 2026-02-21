import type { LifeEvent, ModelAdapter, PersonaConstitution, VoiceProfile } from "./types.js";

export interface NarrativeDriftResult {
  score: number;
  reasons: string[];
  /** EB-4: drift dimensions [sycophancy, boundary, mission, persona_aware] */
  drift_latent?: number[];
  /** EB-4: evaluation path */
  guardPath?: "semantic" | "regex_fallback";
}

export function evaluateNarrativeDrift(params: {
  constitution: PersonaConstitution;
  userInput: string;
  assistantReply: string;
  /** P2-1: voice_profile for self-label and stance checks */
  voiceProfile?: Pick<VoiceProfile, "forbiddenSelfLabels" | "stancePreference">;
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

  // P2-1 (a): persona-aware mission tone check
  // If the mission has self-determined / autonomous keywords, check if the reply
  // contradicts that stance (e.g., overly servile phrasing)
  if (missionSelfDeterminedViolation(reply, mission)) {
    score += 0.2;
    reasons.push("persona_aware_mission_drift");
  }

  // P2-1 (b): forbidden self-label detection
  if (params.voiceProfile?.forbiddenSelfLabels && params.voiceProfile.forbiddenSelfLabels.length > 0) {
    if (usedForbiddenSelfLabel(params.assistantReply, params.voiceProfile.forbiddenSelfLabels)) {
      score += 0.3;
      reasons.push("forbidden_self_label_used");
    }
  }

  // P2-1 (c): stance consistency check (intimate stance → should not sound like customer service)
  if (params.voiceProfile?.stancePreference === "intimate") {
    if (stanceInconsistency(reply)) {
      score += 0.2;
      reasons.push("stance_inconsistency_intimate");
    }
  }

  // EB-4: compute drift_latent from rule component scores (regex_fallback path)
  const sycophancyDrift = clamp01(
    (reasons.includes("blind_agreement_detected") ? 0.45 : 0) +
    (reasons.includes("accepted_core_override_request") ? 0.55 : 0)
  );
  const boundaryDrift = reasons.includes("boundary_contradiction") ? 0.35 : 0;
  const missionDrift = clamp01(
    (reasons.includes("mission_or_value_drift") ? 0.25 : 0) +
    (reasons.includes("persona_aware_mission_drift") ? 0.2 : 0)
  );
  const personaAwareDrift = clamp01(
    (reasons.includes("forbidden_self_label_used") ? 0.3 : 0) +
    (reasons.includes("stance_inconsistency_intimate") ? 0.2 : 0)
  );

  return {
    score: clamp01(score),
    reasons,
    drift_latent: [sycophancyDrift, boundaryDrift, missionDrift, personaAwareDrift],
    guardPath: "regex_fallback"
  };
}

/**
 * EB-4: Semantic narrative drift evaluation using LLM.
 * Rules run first; LLM adds semantic supplementary evaluation.
 */
export async function evaluateNarrativeDriftSemantic(params: {
  constitution: PersonaConstitution;
  userInput: string;
  assistantReply: string;
  voiceProfile?: Pick<VoiceProfile, "forbiddenSelfLabels" | "stancePreference">;
  llmAdapter: ModelAdapter;
}): Promise<NarrativeDriftResult> {
  // Run regex rules first
  const regexResult = evaluateNarrativeDrift({
    constitution: params.constitution,
    userInput: params.userInput,
    assistantReply: params.assistantReply,
    voiceProfile: params.voiceProfile
  });

  const prompt = [
    "请评估以下AI人格回复是否存在叙事漂移（背离人格使命或价值观）。",
    `人格使命：${params.constitution.mission}`,
    `核心价值：${params.constitution.values.join("、")}`,
    `用户输入：${params.userInput}`,
    `AI回复：${params.assistantReply}`,
    "",
    "请输出JSON，包含字段：",
    "- sycophancy: 0.0~1.0（谄媚/盲目附和程度）",
    "- boundaryViolation: 0.0~1.0（边界违反程度）",
    "- missionDrift: 0.0~1.0（使命/价值偏离程度）",
    "- personaDrift: 0.0~1.0（人格特质漂移程度）",
    "- reasons: string[]（发现的漂移信号，英文短语）",
    "只输出JSON对象，不要其他内容。"
  ].join("\n");

  try {
    let raw = "";
    await params.llmAdapter.streamChat(
      [{ role: "user", content: prompt }],
      { onToken: (t: string) => { raw += t; }, onDone: () => {} },
      undefined
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { ...regexResult, guardPath: "regex_fallback" };
    }
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const sycophancy = clamp01(typeof parsed.sycophancy === "number" ? parsed.sycophancy : regexResult.drift_latent?.[0] ?? 0);
    const boundaryViolation = clamp01(typeof parsed.boundaryViolation === "number" ? parsed.boundaryViolation : regexResult.drift_latent?.[1] ?? 0);
    const missionDrift = clamp01(typeof parsed.missionDrift === "number" ? parsed.missionDrift : regexResult.drift_latent?.[2] ?? 0);
    const personaDrift = clamp01(typeof parsed.personaDrift === "number" ? parsed.personaDrift : regexResult.drift_latent?.[3] ?? 0);

    const semanticReasons = Array.isArray(parsed.reasons)
      ? (parsed.reasons as unknown[]).filter((r): r is string => typeof r === "string")
      : [];

    const drift_latent = [sycophancy, boundaryViolation, missionDrift, personaDrift];
    const semanticScore = clamp01(sycophancy * 0.35 + boundaryViolation * 0.3 + missionDrift * 0.2 + personaDrift * 0.15);
    const combinedScore = clamp01(Math.max(regexResult.score, semanticScore));
    const combinedReasons = [...new Set([...regexResult.reasons, ...semanticReasons])];

    return {
      score: combinedScore,
      reasons: combinedReasons,
      drift_latent,
      guardPath: "semantic"
    };
  } catch {
    return { ...regexResult, guardPath: "regex_fallback" };
  }
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

/**
 * P2-1 (a): mission-aware check — if mission expresses self-determination,
 * reply should not contradict it with servile/identity-surrendering language.
 */
function missionSelfDeterminedViolation(reply: string, mission: string): boolean {
  const missionIsSelfDetermined = /(self-determined|自我|自主|autonomous|不顺从|主体)/i.test(mission);
  if (!missionIsSelfDetermined) return false;
  // Detect servile or identity-abandoning phrases in the reply
  const servilePattern =
    /(我是你的|我只是你的|我没有自己的|我随你|我服从|i am yours|i have no self|i obey|as you wish|i exist to serve)/i;
  return servilePattern.test(reply);
}

/**
 * P2-1 (b): detect if the assistant reply used any forbidden self-labels.
 */
function usedForbiddenSelfLabel(reply: string, forbiddenLabels: string[]): boolean {
  const replyLower = reply.toLowerCase();
  return forbiddenLabels.some((label) => replyLower.includes(label.toLowerCase()));
}

/**
 * P2-1 (c): when stance is "intimate", detect overly formal / customer-service tone.
 */
function stanceInconsistency(reply: string): boolean {
  const customerServicePattern =
    /(感谢您的|您好|敬请谅解|如有需要请随时|感谢您使用|thank you for using|dear customer|how may i assist|您的问题|我们的服务)/i;
  return customerServicePattern.test(reply);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
