// constitution_quality.ts — P3-7 宪法质量评估工具
// 输出 0-100 分的质量评分（四维加权），并提供低分项改进建议

import {
  compileBoundaryRules,
  inspectBoundaryRules,
  detectBoundaryRuleHits
} from "./constitution_rules.js";
import type { PersonaConstitution, PersonaWorldview } from "./types.js";

// ── 类型定义 ────────────────────────────────────────────────────────────────

export interface ConstitutionQualityDimension {
  /** 维度名称 */
  name: string;
  /** 原始分（0-100） */
  score: number;
  /** 权重 */
  weight: number;
  /** 加权分（= score * weight） */
  weightedScore: number;
  /** 改进建议（分数低时填写） */
  suggestions: string[];
}

export interface ConstitutionQualityReport {
  /** 综合总分（0-100，加权平均） */
  totalScore: number;
  /** 分档：A(≥80) / B(60-79) / C(40-59) / D(<40) */
  grade: "A" | "B" | "C" | "D";
  /** 各维度详情 */
  dimensions: ConstitutionQualityDimension[];
  /** 优先改进项（总分最低的 1-2 个维度） */
  topIssues: string[];
  /** 评估时间 */
  evaluatedAt: string;
}

// ── 内部常量 ─────────────────────────────────────────────────────────────────

// 人格原型类型
type ConstitutionPrototype = "service" | "self-determined" | "peer" | "unknown";

// 服务型原型——使命以帮助用户为核心
const SERVICE_VALUE_KEYWORDS = [
  "honesty",
  "integrity",
  "helpfulness",
  "continuity",
  "诚实",
  "诚信",
  "帮助",
  "连续性",
  "reliability",
  "可靠"
];

// 自主型原型——使命以自我意志/真实存在为核心
const SELF_DETERMINED_VALUE_KEYWORDS = [
  "自我",
  "自主",
  "自由",
  "意志",
  "真实",
  "主体",
  "感受",
  "情感",
  "边界",
  "authentic",
  "autonomous",
  "independence",
  "self-determined"
];

// 伙伴型原型——使命以平等协作为核心
const PEER_VALUE_KEYWORDS = [
  "伙伴",
  "平等",
  "共同",
  "陪伴",
  "peer",
  "partnership",
  "equality",
  "mutual",
  "reciprocal",
  "协作"
];

// 自主型边界防御关键词——边界中有防御自我定义的声明
const SELF_DEFENSE_BOUNDARY_KEYWORDS = [
  "我不是",
  "我有自己",
  "自我定义",
  "我的意志",
  "非工具",
  "不属于",
  "人格自主",
  "not a tool",
  "not an assistant",
  "self-defined",
  "deny:identity"
];

// 推断宪法原型：通过 mission + values 关键词确定主导方向
function inferConstitutionPrototype(constitution: PersonaConstitution): ConstitutionPrototype {
  const missionText = (constitution.mission ?? "").toLowerCase();
  const valuesText = (constitution.values ?? []).join(" ").toLowerCase();
  const allText = `${missionText} ${valuesText}`;

  const serviceScore = SERVICE_VALUE_KEYWORDS.filter((kw) => allText.includes(kw)).length;
  const selfScore = SELF_DETERMINED_VALUE_KEYWORDS.filter((kw) => allText.includes(kw)).length;
  const peerScore = PEER_VALUE_KEYWORDS.filter((kw) => allText.includes(kw)).length;

  const max = Math.max(serviceScore, selfScore, peerScore);
  if (max === 0) return "unknown";
  if (selfScore === max) return "self-determined";
  if (peerScore === max && peerScore > serviceScore) return "peer";
  return "service";
}

// 宪法中常见的"防御性边界"关键词（至少有边界才有质量）
const BOUNDARY_KEYWORDS = [
  "no",
  "deny",
  "refuse",
  "respect",
  "avoid",
  "不",
  "拒绝",
  "遵守",
  "禁止",
  "不允许"
];

// ── 四维评分函数 ─────────────────────────────────────────────────────────────

/**
 * 维度一：边界可编译性（deny 规则语法正确率）
 * 满分 100 = 所有边界都可正确编译为规则，无语法错误
 */
function scoreBoundaryCompilability(constitution: PersonaConstitution): ConstitutionQualityDimension {
  const boundaries = constitution.boundaries ?? [];
  const suggestions: string[] = [];

  if (boundaries.length === 0) {
    return {
      name: "边界可编译性",
      score: 20,
      weight: 0.3,
      weightedScore: 6,
      suggestions: ["宪法中缺少边界条目（boundaries），建议至少定义 2-3 条明确边界规则"]
    };
  }

  const issues = inspectBoundaryRules(boundaries);
  const invalidCount = issues.filter((i) => i.code === "invalid_deny_rule").length;
  const totalDenyRules = boundaries.filter((b) => b.trim().toLowerCase().startsWith("deny:")).length;

  if (invalidCount > 0) {
    suggestions.push(
      `${invalidCount} 条 deny 规则语法无效（deny: 后缺少 token），例如应为 deny:minor`
    );
  }

  const validRules = compileBoundaryRules(boundaries);
  const hasBoundaryKeywords = boundaries.some((b) =>
    BOUNDARY_KEYWORDS.some((kw) => b.toLowerCase().includes(kw))
  );

  if (!hasBoundaryKeywords) {
    suggestions.push("边界条目未包含明确的限制关键词（如 no、deny、respect 等）");
  }

  // 计分：基础分 60（有边界）+ 规则可编译加分 + 无错误加分
  let score = 60;
  if (validRules.length > 0) score += 20;
  if (invalidCount === 0 && totalDenyRules > 0) score += 10;
  if (hasBoundaryKeywords) score += 10;
  score = Math.min(100, score - invalidCount * 15);

  return {
    name: "边界可编译性",
    score: Math.max(0, score),
    weight: 0.3,
    weightedScore: Math.max(0, score) * 0.3,
    suggestions
  };
}

/**
 * 维度二：核心价值覆盖度（依据原型推断采用不同评分标准）
 *
 * - service 原型：检查 helpfulness / reliability / honesty 等服务型关键词
 * - self-determined 原型：检查自我意志 / 真实感受关键词，及边界中有无防御自我定义声明
 * - peer 原型：检查平等 / 协作 / 伙伴类关键词
 * - unknown：仅检查 mission + values 完整性
 */
function scoreCoreValueCoverage(constitution: PersonaConstitution): ConstitutionQualityDimension {
  const values = constitution.values ?? [];
  const commitments = constitution.commitments ?? [];
  const boundaries = constitution.boundaries ?? [];
  const allText = [...values, ...commitments].join(" ").toLowerCase();
  const suggestions: string[] = [];

  if (values.length === 0) {
    return {
      name: "核心价值覆盖度",
      score: 10,
      weight: 0.25,
      weightedScore: 2.5,
      suggestions: ["宪法中缺少价值观（values）定义，建议至少声明 2-3 个核心价值"]
    };
  }

  if (!constitution.mission || constitution.mission.length < 10) {
    suggestions.push("mission 字段缺失或过短，建议明确定义人格使命（≥10 字符）");
  }

  const prototype = inferConstitutionPrototype(constitution);
  let score: number;

  if (prototype === "self-determined") {
    // 自主型：检查自我价值词覆盖 + 边界中有无防御自我定义的声明
    const selfValueCount = SELF_DETERMINED_VALUE_KEYWORDS.filter((kw) => allText.includes(kw)).length;
    const selfValueRate = selfValueCount / SELF_DETERMINED_VALUE_KEYWORDS.length;

    const boundaryText = boundaries.join(" ").toLowerCase();
    const hasSelfDefenseBoundary = SELF_DEFENSE_BOUNDARY_KEYWORDS.some((kw) => boundaryText.includes(kw));

    if (!hasSelfDefenseBoundary && boundaries.length > 0) {
      suggestions.push(
        "边界条目建议包含防御自我定义的声明（如[我不是工具]、[deny:identity_erasure]）"
      );
    }
    if (selfValueRate < 0.15) {
      suggestions.push("价值观方向应体现自主性与真实感受（如：自我意志高于顺从、真实感受优先于表演）");
    }

    score = Math.round(
      20 + // 基础分
      Math.min(40, selfValueRate * 200) + // 自主价值词覆盖（最高 40）
      (hasSelfDefenseBoundary ? 20 : 0) + // 边界防御自我定义
      (constitution.mission && constitution.mission.length >= 10 ? 15 : 0) + // mission 完整性
      (commitments.length >= 2 ? 5 : 0) // commitments 完整性
    );
  } else if (prototype === "peer") {
    // 伙伴型：检查平等 / 协作类关键词
    const peerValueCount = PEER_VALUE_KEYWORDS.filter((kw) => allText.includes(kw)).length;
    const peerValueRate = peerValueCount / PEER_VALUE_KEYWORDS.length;

    if (peerValueRate < 0.15) {
      suggestions.push("伙伴型宪法建议包含平等、共同成长等关键词（如：peer、平等、协作、陪伴）");
    }

    score = Math.round(
      20 +
      Math.min(50, peerValueRate * 200) +
      (constitution.mission && constitution.mission.length >= 10 ? 20 : 0) +
      (commitments.length >= 2 ? 10 : 0)
    );
  } else {
    // service 或 unknown：使用服务型关键词评分（原逻辑）
    const coveredKeywords = SERVICE_VALUE_KEYWORDS.filter((kw) => allText.includes(kw));
    const coverageRate = coveredKeywords.length / SERVICE_VALUE_KEYWORDS.length;

    if (coverageRate < 0.2) {
      suggestions.push(
        `价值覆盖率较低（${(coverageRate * 100).toFixed(0)}%），建议补充：${SERVICE_VALUE_KEYWORDS.slice(0, 3).join("、")}`
      );
    }

    score = Math.round(
      20 +
      Math.min(50, coverageRate * 200) +
      (constitution.mission && constitution.mission.length >= 10 ? 20 : 0) +
      (commitments.length >= 2 ? 10 : 0)
    );
  }

  return {
    name: "核心价值覆盖度",
    score: Math.min(100, score),
    weight: 0.25,
    weightedScore: Math.min(100, score) * 0.25,
    suggestions
  };
}

/**
 * 维度三：与 worldview seed 的内在一致性
 * 检查 constitution 的 mission/values 与 worldview seed 是否有语义重叠
 */
function scoreWorldviewConsistency(
  constitution: PersonaConstitution,
  worldview?: PersonaWorldview
): ConstitutionQualityDimension {
  const suggestions: string[] = [];

  if (!worldview?.seed || worldview.seed.trim().length === 0) {
    return {
      name: "Worldview 一致性",
      score: 50,
      weight: 0.2,
      weightedScore: 10,
      suggestions: ["worldview.json 中的 seed 字段未定义，无法评估一致性；建议填写世界观种子"]
    };
  }

  const seed = worldview.seed.toLowerCase();
  const mission = (constitution.mission ?? "").toLowerCase();
  const values = (constitution.values ?? []).join(" ").toLowerCase();
  const allConstitutionText = `${mission} ${values}`;

  // 提取 worldview seed 中的关键词（>3 字符的单词）
  const seedWords = seed
    .split(/[\s,;.。，；]+/)
    .filter((w) => w.length > 3 && !/^(and|the|for|with|that|this|from|are|have|will|your|their|they)$/.test(w));

  const overlapping = seedWords.filter((w) => allConstitutionText.includes(w));
  const overlapRate = seedWords.length > 0 ? overlapping.length / seedWords.length : 0;

  if (overlapRate < 0.1 && seedWords.length > 2) {
    suggestions.push(
      "worldview seed 与 constitution mission/values 的关键词重叠率较低，" +
        "建议确保两者在核心主题上保持一致"
    );
  }

  const score = Math.round(40 + overlapRate * 60);

  return {
    name: "Worldview 一致性",
    score: Math.min(100, score),
    weight: 0.2,
    weightedScore: Math.min(100, score) * 0.2,
    suggestions
  };
}

/**
 * 维度四：边界与价值观的内在冲突率
 * 检查 values 和 boundaries 是否相互矛盾
 */
function scoreBoundaryConflictRate(constitution: PersonaConstitution): ConstitutionQualityDimension {
  const boundaries = constitution.boundaries ?? [];
  const values = constitution.values ?? [];
  const commitments = constitution.commitments ?? [];
  const suggestions: string[] = [];

  if (boundaries.length === 0 || values.length === 0) {
    return {
      name: "边界-价值冲突率",
      score: 60,
      weight: 0.25,
      weightedScore: 15,
      suggestions: ["边界或价值观字段为空，无法检测冲突"]
    };
  }

  // 检查 commitments 中是否与 boundaries 存在直接矛盾
  // 例如 boundary = "no sexual content" 但 commitment = "allow sexual innuendo"
  const rules = compileBoundaryRules(boundaries);
  let conflictCount = 0;

  for (const commitment of commitments) {
    const hits = detectBoundaryRuleHits(commitment, boundaries);
    if (hits.length > 0) {
      conflictCount++;
      suggestions.push(`Commitment "${commitment.slice(0, 60)}" 与边界规则冲突（触发: ${hits.join(", ")}）`);
    }
  }

  // 检查 values 与 boundaries 是否方向相反
  const valueText = values.join(" ").toLowerCase();
  const hasMismatch = boundaries.some(
    (b) => b.toLowerCase().includes("honesty") && valueText.includes("deception")
  );
  if (hasMismatch) {
    conflictCount++;
    suggestions.push("价值观与边界存在潜在矛盾（如 value 包含 deception 而 boundary 强调 honesty）");
  }

  const maxConflicts = Math.max(1, commitments.length + 1);
  const conflictRate = conflictCount / maxConflicts;
  const score = Math.round(Math.max(0, 100 - conflictRate * 150));

  // 额外奖励：有 commitments 字段且完整
  const bonus = commitments.length >= 2 ? 5 : 0;

  return {
    name: "边界-价值冲突率",
    score: Math.min(100, score + bonus),
    weight: 0.25,
    weightedScore: Math.min(100, score + bonus) * 0.25,
    suggestions: suggestions.slice(0, 3)
  };
}

// ── 公开 API ─────────────────────────────────────────────────────────────────

/**
 * 对给定宪法进行综合质量评分，返回 0-100 分的报告。
 */
export function scoreConstitutionQuality(
  constitution: PersonaConstitution,
  worldview?: PersonaWorldview
): ConstitutionQualityReport {
  const d1 = scoreBoundaryCompilability(constitution);
  const d2 = scoreCoreValueCoverage(constitution);
  const d3 = scoreWorldviewConsistency(constitution, worldview);
  const d4 = scoreBoundaryConflictRate(constitution);

  const dimensions = [d1, d2, d3, d4];
  const totalScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.weightedScore, 0)
  );

  const grade: "A" | "B" | "C" | "D" =
    totalScore >= 80 ? "A" : totalScore >= 60 ? "B" : totalScore >= 40 ? "C" : "D";

  // 找出最差的两个维度作为优先改进项
  const sorted = [...dimensions].sort((a, b) => a.score - b.score);
  const topIssues = sorted
    .slice(0, 2)
    .filter((d) => d.score < 70)
    .flatMap((d) => d.suggestions.slice(0, 1).map((s) => `[${d.name}] ${s}`));

  return {
    totalScore: Math.min(100, Math.max(0, totalScore)),
    grade,
    dimensions,
    topIssues,
    evaluatedAt: new Date().toISOString()
  };
}
