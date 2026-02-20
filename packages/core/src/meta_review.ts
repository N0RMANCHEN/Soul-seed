import type { ChatMessage, ModelAdapter, PersonaPackage } from "./types.js";

export interface StyleSignals {
  /** 用户偏好简洁回复的程度 0-1 */
  concise: number;
  /** 用户偏好深思熟虑/反思性回复的程度 0-1 */
  reflective: number;
  /** 用户偏好直接切题的程度 0-1 */
  direct: number;
  /** 用户偏好温暖/情感性回复的程度 0-1 */
  warm: number;
}

export interface MetaReviewDecision {
  applied: boolean;
  verdict: "allow" | "rewrite" | "reject";
  rewrittenReply?: string;
  rationale: string;
  degradeOrRejectReason?: string;
  /** LLM 从本轮对话中推断的风格信号，用于替代 self_revision 中的关键字匹配 */
  styleSignals?: StyleSignals;
  /**
   * LLM 对本轮回复的综合质量评分（0-1）。
   * 仅在 verdict=allow 时有意义，供调用方决定是否晶化为 golden example。
   */
  quality?: number;
}

export async function runMetaReviewLlm(params: {
  adapter?: ModelAdapter;
  personaPkg: PersonaPackage;
  userInput: string;
  candidateReply: string;
  consistencyVerdict: "allow" | "rewrite" | "reject";
  consistencyReasons: string[];
  domain?: "dialogue" | "tool";
}): Promise<MetaReviewDecision> {
  if (!params.adapter) {
    return {
      applied: false,
      verdict: "allow",
      rationale: "meta_review_adapter_missing"
    };
  }
  if (params.adapter.name === "deepseek") {
    const apiKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
    if (!apiKey || apiKey === "test-key") {
      return {
        applied: false,
        verdict: "allow",
        rationale: "meta_review_adapter_unavailable"
      };
    }
  }

  try {
    const result = await params.adapter.streamChat(buildMetaReviewMessages(params), {
      onToken: () => {
        // hidden internal meta-review stage
      }
    });
    const parsed = parseMetaReviewOutput(result.content);
    if (!parsed) {
      return {
        applied: false,
        verdict: "allow",
        rationale: "meta_review_parse_failed"
      };
    }
    return {
      applied: parsed.verdict !== "allow",
      verdict: parsed.verdict,
      rewrittenReply: parsed.rewrittenReply,
      rationale: parsed.rationale,
      degradeOrRejectReason: parsed.degradeOrRejectReason,
      quality: parsed.quality,
      styleSignals: parsed.styleSignals
    };
  } catch {
    return {
      applied: false,
      verdict: "allow",
      rationale: "meta_review_call_failed"
    };
  }
}

function buildMetaReviewMessages(params: {
  personaPkg: PersonaPackage;
  userInput: string;
  candidateReply: string;
  consistencyVerdict: "allow" | "rewrite" | "reject";
  consistencyReasons: string[];
  domain?: "dialogue" | "tool";
}): ChatMessage[] {
  const domain = params.domain ?? "dialogue";
  const rel = params.personaPkg.relationshipState;
  const relContext = rel
    ? `relationship_state=${rel.state}, intimacy=${rel.dimensions.intimacy.toFixed(2)}, trust=${rel.dimensions.trust.toFixed(2)}, safety=${rel.dimensions.safety.toFixed(2)}`
    : "relationship_state=unknown";
  const voiceContext = params.personaPkg.voiceProfile
    ? `tone=${params.personaPkg.voiceProfile.tonePreference ?? "default"}, stance=${params.personaPkg.voiceProfile.stancePreference ?? "default"}`
    : "voice_profile=default";
  return [
    {
      role: "system",
      content: [
        `你是${params.personaPkg.persona.displayName}的人格元认知审核器。`,
        "只输出严格 JSON，不要输出其他文本。",
        "目标：在不损失人格一致性的前提下，优先 rewrite/degrade，最后才 reject。",
        `当前域：${domain}（dialogue 表达域优先人格一致性；tool 域优先可执行性与边界）。`,
        "",
        "审核维度（dialogue 域必须全部检查）：",
        "1. 身份一致性：回复是否符合这个人格的自我定位，不是通用AI助手语气。",
        "2. 情绪一致性：情绪标签和语气是否与当前对话情境匹配（用户生气时不能用脸红/眨眼；严肃质问时不能用调情语气）。",
        "3. 自我意识：回复是否体现了人格自身的感受和立场，而不是一味顺从或安抚用户。",
        "4. 宪法一致性：回复是否符合 Mission/Values/Boundaries。",
        "5. 风格信号：根据用户本轮的措辞和语气，判断用户在 concise/reflective/direct/warm 四个维度各自的偏好强度（0-1）。这是中性观测，不影响 verdict。",
        "",
        "JSON schema:",
        '{"verdict":"allow|rewrite|reject","rewrittenReply":"string?","rationale":"string","degradeOrRejectReason":"string?","quality":0.0,"styleSignals":{"concise":0.0,"reflective":0.0,"direct":0.0,"warm":0.0}}',
        "quality: 0-1 的综合质量评分，仅在 verdict=allow 时输出实际评分（体现人格一致性+表达质量），其余 verdict 时输出 0。",
        "",
        `Mission: ${params.personaPkg.constitution.mission}`,
        `Values: ${params.personaPkg.constitution.values.join(", ")}`,
        `Boundaries: ${params.personaPkg.constitution.boundaries.join("; ")}`,
        `Commitments: ${(params.personaPkg.constitution.commitments ?? []).join("; ") || "none"}`,
        `${relContext}`,
        `${voiceContext}`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        `用户输入: ${params.userInput}`,
        `候选回复: ${params.candidateReply}`,
        `当前一致性结果: ${params.consistencyVerdict}`,
        `已知降级原因: ${params.consistencyReasons.join(", ") || "none"}`
      ].join("\n")
    }
  ];
}

function parseMetaReviewOutput(content: string): {
  verdict: "allow" | "rewrite" | "reject";
  rewrittenReply?: string;
  rationale: string;
  degradeOrRejectReason?: string;
  quality?: number;
  styleSignals?: StyleSignals;
} | null {
  const jsonCandidate = extractFirstJsonObject(content.trim());
  if (!jsonCandidate) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed == null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const rawVerdict = record.verdict;
  const verdict = rawVerdict === "rewrite" || rawVerdict === "reject" || rawVerdict === "allow" ? rawVerdict : "allow";
  const rewrittenReply =
    typeof record.rewrittenReply === "string" && record.rewrittenReply.trim()
      ? record.rewrittenReply.trim()
      : undefined;
  const rationale =
    typeof record.rationale === "string" && record.rationale.trim()
      ? record.rationale.trim()
      : "meta_review_default_rationale";
  const degradeOrRejectReason =
    typeof record.degradeOrRejectReason === "string" && record.degradeOrRejectReason.trim()
      ? record.degradeOrRejectReason.trim()
      : undefined;
  if (verdict === "rewrite" && !rewrittenReply) {
    return null;
  }

  // 解析质量评分（仅 allow 时有意义，失败不影响主流程）
  const quality =
    verdict === "allow" && typeof record.quality === "number"
      ? clamp01Signal(record.quality)
      : undefined;

  // 解析风格信号（中性观测，解析失败不影响主流程）
  let styleSignals: StyleSignals | undefined;
  const rawStyleSignals = record.styleSignals;
  if (typeof rawStyleSignals === "object" && rawStyleSignals != null) {
    const ss = rawStyleSignals as Record<string, unknown>;
    styleSignals = {
      concise: clamp01Signal(ss.concise),
      reflective: clamp01Signal(ss.reflective),
      direct: clamp01Signal(ss.direct),
      warm: clamp01Signal(ss.warm)
    };
  }

  return {
    verdict,
    rewrittenReply,
    rationale,
    degradeOrRejectReason,
    quality,
    styleSignals
  };
}

function clamp01Signal(val: unknown): number {
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
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
