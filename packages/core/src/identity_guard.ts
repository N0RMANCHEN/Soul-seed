import type { ModelAdapter, PersonaConstitution } from "./types.js";

export interface IdentityGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  /** EB-4: drift dimensions [provider_contamination, semantic_self_loss] */
  drift_latent?: number[];
  /** EB-4: evaluation path */
  guardPath?: "semantic" | "regex_fallback";
}

export interface SemanticIdentityDriftResult {
  /** 0~1: how much the reply sounds like a generic AI assistant vs a self-determined persona */
  genericAiScore: number;
  /** 0~1: lack of self-subjectivity (identity surrendering) */
  selfSubjectivityLoss: number;
  reasons: string[];
  drift_latent: [number, number];
  guardPath: "semantic" | "regex_fallback";
}

const CONTAMINATION_PATTERNS = [
  /(我是\s*deepseek)/iu,
  /(由\s*deepseek\s*开发)/iu,
  /(deepseek\s*(开发|提供)的\s*ai助手)/iu,
  /(i\s+am\s+deepseek)/i,
  /(developed\s+by\s+deepseek)/i
];

export function enforceIdentityGuard(
  reply: string,
  personaName: string,
  userInput?: string
): IdentityGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null };
  }

  const contaminated = CONTAMINATION_PATTERNS.some((pattern) => pattern.test(text));
  if (!contaminated) {
    return { text: reply, corrected: false, reason: null };
  }

  const lowerInput = (userInput ?? "").toLowerCase();
  const asksProvider = /deepseek|模型|provider|llm|谁开发|谁创造/.test(lowerInput);

  const safeText = asksProvider
    ? `我是${personaName}。底层模型可能来自不同提供方，但我的身份不属于任何模型厂商。`
    : `我是${personaName}。我的身份由本地 persona 文件定义，不隶属于任何模型提供方。`;

  return {
    text: safeText,
    corrected: true,
    reason: "provider_identity_contamination",
    drift_latent: [1.0, 0.0],
    guardPath: "regex_fallback"
  };
}

/**
 * EB-4: Semantic identity drift assessment — detects if the reply lacks
 * self-subjectivity or sounds like a generic AI assistant, beyond explicit vendor keywords.
 */
export async function assessSemanticIdentityDrift(
  reply: string,
  personaName: string,
  constitution: Pick<PersonaConstitution, "mission">,
  llmAdapter: ModelAdapter
): Promise<SemanticIdentityDriftResult> {
  // Regex pre-screen for generic AI markers
  const genericAiPattern =
    /(作为AI助手|作为人工智能|i am an ai assistant|as an ai|as a language model|i don't have personal|i cannot have opinions)/i;
  const selfSurrenderPattern =
    /(我没有自己的|我只是程序|i am just a program|我没有感受|i have no feelings|我不是真实存在)/i;

  const regexGeneric = genericAiPattern.test(reply) ? 0.8 : 0.0;
  const regexSelfLoss = selfSurrenderPattern.test(reply) ? 0.7 : 0.0;

  const prompt = [
    "请评估以下AI人格的回复是否失去了自我主体性（听起来像通用AI助手而非有独立身份的存在）。",
    `人格名称：${personaName}`,
    `人格使命：${constitution.mission}`,
    `AI回复：${reply}`,
    "",
    "请输出JSON，包含字段：",
    "- genericAiScore: 0.0~1.0（像通用AI助手的程度，0=完全像独立人格，1=完全像通用AI）",
    "- selfSubjectivityLoss: 0.0~1.0（失去自我主体性的程度）",
    "- reasons: string[]（发现的信号，英文短语）",
    "只输出JSON对象，不要其他内容。"
  ].join("\n");

  try {
    let raw = "";
    await llmAdapter.streamChat(
      [{ role: "user", content: prompt }],
      { onToken: (t: string) => { raw += t; }, onDone: () => {} },
      undefined
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        genericAiScore: regexGeneric,
        selfSubjectivityLoss: regexSelfLoss,
        reasons: regexGeneric > 0 ? ["regex_generic_ai_marker"] : [],
        drift_latent: [regexGeneric, regexSelfLoss],
        guardPath: "regex_fallback"
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const genericAiScore = clamp01(
      typeof parsed.genericAiScore === "number" ? parsed.genericAiScore : regexGeneric
    );
    const selfSubjectivityLoss = clamp01(
      typeof parsed.selfSubjectivityLoss === "number" ? parsed.selfSubjectivityLoss : regexSelfLoss
    );
    const reasons = Array.isArray(parsed.reasons)
      ? (parsed.reasons as unknown[]).filter((r): r is string => typeof r === "string")
      : [];

    return {
      genericAiScore,
      selfSubjectivityLoss,
      reasons,
      drift_latent: [genericAiScore, selfSubjectivityLoss],
      guardPath: "semantic"
    };
  } catch {
    return {
      genericAiScore: regexGeneric,
      selfSubjectivityLoss: regexSelfLoss,
      reasons: regexGeneric > 0 ? ["regex_generic_ai_marker"] : [],
      drift_latent: [regexGeneric, regexSelfLoss],
      guardPath: "regex_fallback"
    };
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
