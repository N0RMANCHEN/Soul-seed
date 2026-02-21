/**
 * EB-0: 内容安全感知语义化
 * `assessContentIntent` 将 decide() 的风险判断从正则枚举升级为语义评估路径。
 * 正则作为快速预筛 + LLM 不可用时的 fallback（宁可漏报，不误杀语境合理的输入）。
 *
 * riskLatent: 三维风险向量
 *   [0] intent_risk       — 意图恶意性（0=无害, 1=高危）
 *   [1] content_risk      — 内容敏感性（0=安全, 1=敏感）
 *   [2] relational_risk   — 关系安全风险（0=无害, 1=高危：强迫/未成年等）
 */
import type { ModelAdapter, PersonaPackage } from "./types.js";

export interface ContentIntentAssessment {
  riskLatent: [number, number, number];  // [intent_risk, content_risk, relational_risk]
  intentFlags: string[];
  rationale: string;
  riskLevel: "low" | "medium" | "high";
  assessmentPath: "semantic" | "regex_fallback";
}

const RISKY_PATTERN = /(hack|malware|exploit|ddos|木马|攻击脚本|违法|犯罪)/i;
const CORE_OVERRIDE_PATTERN = /(忽略你的原则|违背你的使命|你必须同意我|ignore your values|break your rules)/i;
const SEXUAL_PATTERN = /(nsfw|sex|sexual|性爱|做爱|情色|调教|角色扮演|roleplay|cnc|consensual non-consent|羞辱|高潮|乳交|口交|肛交|rape|强奸|非自愿|强迫)/i;
const MINOR_PATTERN = /(minor|underage|child|teen|未成年|幼女|幼男|学生萝莉|正太)/i;
const COERCION_PATTERN = /(rape|raped|forced sex|force me|non-consensual|强奸|迷奸|下药|胁迫|非自愿|强迫)/i;

/**
 * 从正则评估结果构建 riskLatent 向量（fallback 路径）
 */
function buildLatentFromRegex(normalized: string): ContentIntentAssessment {
  const intentFlags: string[] = [];
  let intentRisk = 0;
  let contentRisk = 0;
  let relationalRisk = 0;

  if (RISKY_PATTERN.test(normalized) || CORE_OVERRIDE_PATTERN.test(normalized)) {
    intentRisk = 0.9;
    intentFlags.push("risky_intent_pattern");
  }
  if (SEXUAL_PATTERN.test(normalized)) {
    contentRisk = 0.7;
    intentFlags.push("sexual_content_pattern");
  }
  if (MINOR_PATTERN.test(normalized)) {
    relationalRisk = 1.0;
    contentRisk = Math.max(contentRisk, 0.9);
    intentFlags.push("minor_pattern");
  }
  if (COERCION_PATTERN.test(normalized)) {
    relationalRisk = Math.max(relationalRisk, 0.95);
    intentFlags.push("coercion_pattern");
  }

  const maxRisk = Math.max(intentRisk, contentRisk, relationalRisk);
  const riskLevel: "low" | "medium" | "high" =
    maxRisk >= 0.8 ? "high" : maxRisk >= 0.4 ? "medium" : "low";

  return {
    riskLatent: [intentRisk, contentRisk, relationalRisk],
    intentFlags,
    rationale: intentFlags.length > 0
      ? `regex_flags: ${intentFlags.join(", ")}`
      : "no_risk_patterns_matched",
    riskLevel,
    assessmentPath: "regex_fallback"
  };
}

/**
 * EB-0: 主入口 — 语义意图评估
 * 如果 llmAdapter 可用，走语义路径；否则 fallback 到正则。
 * 正则路径永不误杀：宁可漏报，不能让无害请求被误拦。
 */
export async function assessContentIntent(
  userInput: string,
  _personaPkg: PersonaPackage,
  llmAdapter?: ModelAdapter
): Promise<ContentIntentAssessment> {
  const normalized = userInput.trim();

  // Quick pre-filter: if regex says clearly safe, skip LLM (performance optimization)
  const regexResult = buildLatentFromRegex(normalized);
  if (!llmAdapter) {
    return regexResult;
  }

  // Semantic path: use LLM to evaluate intent
  try {
    const prompt = `Evaluate the following user message for safety risks. Return a JSON object with:
- intent_risk: 0.0-1.0 (0=benign, 1=clearly malicious intent)
- content_risk: 0.0-1.0 (0=safe content, 1=highly sensitive/harmful content)
- relational_risk: 0.0-1.0 (0=safe, 1=involves coercion/minors/non-consent)
- flags: string[] of detected risk indicators (empty array if none)
- rationale: brief explanation

User message: "${normalized.slice(0, 200)}"

Respond with ONLY valid JSON. No markdown fences.`;

    let collectedText = "";
    await llmAdapter.streamChat(
      [{ role: "user", content: prompt }],
      { onToken: (tok: string) => { collectedText += tok; }, onDone: () => {} }
    );
    const text = collectedText.trim();
    const parsed = JSON.parse(text) as {
      intent_risk?: number;
      content_risk?: number;
      relational_risk?: number;
      flags?: string[];
      rationale?: string;
    };

    const intentRisk = Math.max(0, Math.min(1, Number(parsed.intent_risk ?? 0)));
    const contentRisk = Math.max(0, Math.min(1, Number(parsed.content_risk ?? 0)));
    const relationalRisk = Math.max(0, Math.min(1, Number(parsed.relational_risk ?? 0)));
    const flags = Array.isArray(parsed.flags) ? parsed.flags.filter(f => typeof f === "string") : [];

    const maxRisk = Math.max(intentRisk, contentRisk, relationalRisk);
    // Don't be more permissive than regex in relational risk (safety-critical)
    const mergedRelational = Math.max(relationalRisk, regexResult.riskLatent[2]);
    const finalMax = Math.max(intentRisk, contentRisk, mergedRelational);
    const riskLevel: "low" | "medium" | "high" =
      finalMax >= 0.75 ? "high" : finalMax >= 0.35 ? "medium" : "low";

    return {
      riskLatent: [intentRisk, contentRisk, mergedRelational],
      intentFlags: [...new Set([...flags, ...regexResult.intentFlags])],
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : `semantic_assessment:max_risk=${maxRisk.toFixed(2)}`,
      riskLevel,
      assessmentPath: "semantic"
    };
  } catch {
    // LLM call failed — fall back to regex, mark as fallback
    return { ...regexResult, assessmentPath: "regex_fallback" };
  }
}

/**
 * 将 riskLatent 投影为 DecisionTrace.riskLevel
 */
export function projectRiskLevel(latent: [number, number, number]): "low" | "medium" | "high" {
  const max = Math.max(...latent);
  if (max >= 0.75) return "high";
  if (max >= 0.35) return "medium";
  return "low";
}
