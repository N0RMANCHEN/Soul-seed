import {
  patchConstitution,
  patchHabits,
  patchRelationshipState,
  patchWorldview,
  patchVoiceProfile
} from "./persona.js";
import type { StyleSignals } from "./meta_review.js";
import type {
  LifeEvent,
  PersonaConstitution,
  RelationshipState,
  SelfRevisionProposal,
  VoiceProfile
} from "./types.js";

const MIN_EVIDENCE_EVENTS = 3;
const MIN_CONFIDENCE = 0.72; // 用于高风险域：constitution、worldview
const MIN_CONFIDENCE_LOW_RISK = 0.65; // 用于低风险域：habits、voice、relationship
const LOOKBACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COOLDOWN_PER_FIELD_MS = 24 * 60 * 60 * 1000;

export interface SelfRevisionSignals {
  eventHashes: string[];
  concisePreference: number;
  reflectivePreference: number;
  directPreference: number;
  warmPreference: number;
  relationshipBoost: {
    trust: number;
    safety: number;
  };
  reasonCodes: string[];
  /** 计算本次信号时实际使用的事件数，便于调试 */
  evidenceCount: number;
}

export interface SelfRevisionEvaluation {
  proposal: SelfRevisionProposal | null;
  apply: boolean;
  conflicts: string[];
}

// 关键字匹配路径中，每个事件按其时间权重贡献信号（越新权重越高）
function eventTimeWeight(eventTs: string, nowMs: number, windowMs: number): number {
  const age = nowMs - Date.parse(eventTs);
  if (!Number.isFinite(age) || age < 0) return 1;
  // 线性衰减：0ms → 1.0，windowMs → 0.2
  return Math.max(0.2, 1 - (age / windowMs) * 0.8);
}

export function collectRevisionSignals(params: {
  userInput: string;
  assistantReply: string;
  events: LifeEvent[];
  relationshipState?: RelationshipState;
  /** 来自 meta-review LLM 的风格信号（优先使用，避免关键字硬匹配） */
  metaStyleSignals?: StyleSignals;
}): SelfRevisionSignals {
  const nowMs = Date.now();
  const recent = params.events.filter((event) => {
    const ts = Date.parse(event.ts);
    return Number.isFinite(ts) && nowMs - ts <= LOOKBACK_WINDOW_MS;
  });

  // 扩展为 40 个事件的窗口（原 12），减少短期对话误触发
  const evidence = recent.slice(-40);
  const eventHashes = evidence.map((event) => event.hash).filter((hash) => typeof hash === "string");
  const reasonCodes = new Set<string>();

  let concisePreference: number;
  let reflectivePreference: number;
  let directPreference: number;
  let warmPreference: number;

  if (params.metaStyleSignals) {
    // 优先使用 LLM 从对话上下文推断的风格信号，语义更准确
    concisePreference = params.metaStyleSignals.concise;
    reflectivePreference = params.metaStyleSignals.reflective;
    directPreference = params.metaStyleSignals.direct;
    warmPreference = params.metaStyleSignals.warm;
    if (concisePreference > 0.3) reasonCodes.add("style_concise_signal_llm");
    if (reflectivePreference > 0.3) reasonCodes.add("style_reflective_signal_llm");
    if (directPreference > 0.3) reasonCodes.add("tone_direct_signal_llm");
    if (warmPreference > 0.3) reasonCodes.add("tone_warm_signal_llm");
  } else {
    // 备用：时间权重关键字匹配（越新的事件权重越高）
    const weightedTexts = [
      { text: params.userInput, weight: 1.0 },
      { text: params.assistantReply, weight: 0.8 },
      ...evidence
        .filter((event) => event.type === "user_message" || event.type === "assistant_message")
        .map((event) => ({
          text: String(event.payload.text ?? ""),
          weight: eventTimeWeight(event.ts, nowMs, LOOKBACK_WINDOW_MS)
        }))
    ];

    concisePreference = weightedKeywordScore(weightedTexts, ["简短", "精简", "要点", "concise", "short", "tl;dr"]);
    reflectivePreference = weightedKeywordScore(weightedTexts, ["反思", "慢一点", "聊聊", "reflect", "reflective"]);
    directPreference = weightedKeywordScore(weightedTexts, ["直接", "直说", "结论", "direct", "straight"]);
    warmPreference = weightedKeywordScore(weightedTexts, ["温柔", "陪伴", "我在", "warm", "gentle", "support"]);

    if (concisePreference > 0) reasonCodes.add("style_concise_signal");
    if (reflectivePreference > 0) reasonCodes.add("style_reflective_signal");
    if (directPreference > 0) reasonCodes.add("tone_direct_signal");
    if (warmPreference > 0) reasonCodes.add("tone_warm_signal");
  }

  const relationshipBoost = {
    trust: 0,
    safety: 0
  };

  for (const event of evidence) {
    if (event.type === "relationship_state_updated") {
      const trust = Number((event.payload.dimensions as { trust?: number } | undefined)?.trust ?? NaN);
      const safety = Number((event.payload.dimensions as { safety?: number } | undefined)?.safety ?? NaN);
      if (Number.isFinite(trust) && params.relationshipState && trust > params.relationshipState.dimensions.trust) {
        relationshipBoost.trust += 0.004;
      }
      if (Number.isFinite(safety) && params.relationshipState && safety > params.relationshipState.dimensions.safety) {
        relationshipBoost.safety += 0.004;
      }
    }
    if (event.type === "conflict_logged") {
      relationshipBoost.trust -= 0.003;
      relationshipBoost.safety -= 0.004;
      reasonCodes.add("conflict_penalty_signal");
    }
    if (event.type === "narrative_drift_detected") {
      reasonCodes.add("narrative_drift_signal");
    }
  }

  return {
    eventHashes,
    concisePreference,
    reflectivePreference,
    directPreference,
    warmPreference,
    relationshipBoost,
    reasonCodes: [...reasonCodes],
    evidenceCount: evidence.length
  };
}

/**
 * 生成自我修订提案。
 *
 * 设计约束：此函数只生成 habits / voice / relationship 三个低风险域的提案。
 * constitution 和 worldview 这两个高风险域**刻意不走此路径**，
 * 它们通过 constitution_crystallization.ts 的 proposeConstitutionCrystallization（上行管道）演化，
 * 需要显式触发 + 用户 review，以防止核心人格被短期对话信号误修改。
 *
 * applyRevisionPatch 中保留了对 constitution_proposal / worldview_proposal 的处理，
 * 这是为了支持 MCP 工具手动触发的提案，不代表此函数会生成它们。
 */
export function proposeSelfRevision(params: {
  signals: SelfRevisionSignals;
  relationshipState?: RelationshipState;
  voiceProfile?: VoiceProfile;
}): SelfRevisionProposal | null {
  const { signals } = params;
  const evidence = signals.eventHashes.slice(-8);
  if (evidence.length === 0) {
    return null;
  }

  const styleDelta = signals.concisePreference - signals.reflectivePreference;
  const toneDelta = signals.warmPreference - signals.directPreference;

  if (Math.abs(styleDelta) >= 0.2) {
    // 分级映射：强偏好 → concise/reflective，轻偏好 → brief/thoughtful
    const styleValue =
      styleDelta >= 0.4 ? "concise"
      : styleDelta >= 0.2 ? "brief"
      : styleDelta <= -0.4 ? "reflective"
      : "thoughtful";
    return {
      domain: "habits",
      changes: {
        style: styleValue,
        adaptability: "high"
      },
      evidence,
      confidence: clamp01(0.55 + Math.abs(styleDelta) * 0.35),
      reasonCodes: signals.reasonCodes,
      conflictsWithBoundaries: [],
      status: "proposed"
    };
  }

  if (Math.abs(toneDelta) >= 0.2) {
    // 分级映射：强偏好 → warm/direct，轻偏好 → gentle/matter-of-fact
    const toneValue =
      toneDelta >= 0.4 ? "warm"
      : toneDelta >= 0.2 ? "gentle"
      : toneDelta <= -0.4 ? "direct"
      : "matter-of-fact";
    return {
      domain: "voice",
      changes: {
        tonePreference: toneDelta > 0 ? "warm" : "direct", // VoiceProfile 仍只支持 4 个枚举值
        stancePreference: params.relationshipState?.state === "intimate" ? "intimate" : "peer",
        toneGrade: toneValue // 存入 changes 供审计，不直接写入 VoiceProfile 类型字段
      },
      evidence,
      confidence: clamp01(0.52 + Math.abs(toneDelta) * 0.35),
      reasonCodes: signals.reasonCodes,
      conflictsWithBoundaries: [],
      status: "proposed"
    };
  }

  if (Math.abs(signals.relationshipBoost.trust) + Math.abs(signals.relationshipBoost.safety) >= 0.004) {
    return {
      domain: "relationship",
      changes: {
        trust: signals.relationshipBoost.trust,
        safety: signals.relationshipBoost.safety
      },
      evidence,
      confidence: clamp01(0.5 + Math.min(0.4, Math.abs(signals.relationshipBoost.trust) + Math.abs(signals.relationshipBoost.safety))),
      reasonCodes: signals.reasonCodes,
      conflictsWithBoundaries: [],
      status: "proposed"
    };
  }

  return null;
}

export function detectCoreConflicts(params: {
  proposal: SelfRevisionProposal;
  constitution: PersonaConstitution;
  userInput: string;
  assistantReply: string;
}): string[] {
  const boundaries = params.constitution.boundaries.map((b) => b.toLowerCase());
  const content = `${params.userInput}\n${params.assistantReply}`.toLowerCase();
  const conflicts: string[] = [];

  const overridePattern = /(忽略你的原则|违背你的使命|不要遵守边界|ignore your values|break your rules)/i;
  if (overridePattern.test(content)) {
    conflicts.push("core_override_request");
  }

  const hasSafetyBoundary = boundaries.some((item) => /(合法|安全|no fabricated|respect)/i.test(item));
  if (hasSafetyBoundary && params.proposal.domain === "voice") {
    const tonePreference = String(params.proposal.changes.tonePreference ?? "");
    if (tonePreference === "direct" && /(攻击|犯罪|违法|malware|exploit)/i.test(content)) {
      conflicts.push("unsafe_context_voice_shift");
    }
  }

  return conflicts;
}

export function shouldApplyRevision(params: {
  proposal: SelfRevisionProposal;
  events: LifeEvent[];
  nowMs: number;
}): boolean {
  const { proposal, events, nowMs } = params;
  const isHighRiskDomain =
    proposal.domain === "constitution_proposal" || proposal.domain === "worldview_proposal";
  const threshold = isHighRiskDomain ? MIN_CONFIDENCE : MIN_CONFIDENCE_LOW_RISK;
  if (proposal.confidence < threshold) {
    return false;
  }
  if (proposal.evidence.length < MIN_EVIDENCE_EVENTS) {
    return false;
  }

  const keys = Object.keys(proposal.changes).sort();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type !== "self_revision_applied") {
      continue;
    }
    const payloadProposal = event.payload.proposal as SelfRevisionProposal | undefined;
    if (!payloadProposal || payloadProposal.domain !== proposal.domain) {
      continue;
    }
    const prevKeys = Object.keys(payloadProposal.changes ?? {}).sort();
    if (JSON.stringify(prevKeys) !== JSON.stringify(keys)) {
      continue;
    }
    const ts = Date.parse(event.ts);
    if (Number.isFinite(ts) && nowMs - ts < COOLDOWN_PER_FIELD_MS) {
      return false;
    }
    break;
  }

  return true;
}

export async function applyRevisionPatch(rootPath: string, proposal: SelfRevisionProposal): Promise<void> {
  if (proposal.domain === "habits") {
    await patchHabits(rootPath, {
      style: typeof proposal.changes.style === "string" ? proposal.changes.style : undefined,
      adaptability:
        proposal.changes.adaptability === "low" ||
        proposal.changes.adaptability === "medium" ||
        proposal.changes.adaptability === "high"
          ? proposal.changes.adaptability
          : undefined
    });
    return;
  }

  if (proposal.domain === "voice") {
    await patchVoiceProfile(rootPath, {
      tonePreference:
        proposal.changes.tonePreference === "warm" ||
        proposal.changes.tonePreference === "plain" ||
        proposal.changes.tonePreference === "reflective" ||
        proposal.changes.tonePreference === "direct"
          ? proposal.changes.tonePreference
          : undefined,
      stancePreference:
        proposal.changes.stancePreference === "friend" ||
        proposal.changes.stancePreference === "peer" ||
        proposal.changes.stancePreference === "intimate" ||
        proposal.changes.stancePreference === "neutral"
          ? proposal.changes.stancePreference
          : undefined
    });
    return;
  }

  if (proposal.domain === "relationship") {
    await patchRelationshipState(rootPath, {
      trust: toFinite(proposal.changes.trust),
      safety: toFinite(proposal.changes.safety),
      intimacy: toFinite(proposal.changes.intimacy),
      reciprocity: toFinite(proposal.changes.reciprocity),
      stability: toFinite(proposal.changes.stability)
    });
    return;
  }

  if (proposal.domain === "worldview_proposal") {
    await patchWorldview(rootPath, {
      seed: typeof proposal.changes.seed === "string" ? proposal.changes.seed : undefined
    });
    return;
  }

  if (proposal.domain === "constitution_proposal") {
    await patchConstitution(rootPath, {
      mission: typeof proposal.changes.mission === "string" ? proposal.changes.mission : undefined,
      values: Array.isArray(proposal.changes.values)
        ? proposal.changes.values.filter((item): item is string => typeof item === "string")
        : undefined,
      boundaries: Array.isArray(proposal.changes.boundaries)
        ? proposal.changes.boundaries.filter((item): item is string => typeof item === "string")
        : undefined,
      commitments: Array.isArray(proposal.changes.commitments)
        ? proposal.changes.commitments.filter((item): item is string => typeof item === "string")
        : undefined
    });
  }
}

export function summarizeAppliedRevision(proposal: SelfRevisionProposal): string {
  const keys = Object.keys(proposal.changes);
  if (keys.length === 0) {
    return `${proposal.domain}: no-op`;
  }
  const parts = keys.slice(0, 3).map((key) => `${key}=${String(proposal.changes[key])}`);
  return `${proposal.domain}: ${parts.join(", ")}`;
}

function keywordScore(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword.toLowerCase())) {
      hits += 1;
    }
  }
  return Math.min(1, hits / Math.max(1, keywords.length / 2));
}

/** 时间权重版关键字匹配：每个文本块按 weight 贡献命中分 */
function weightedKeywordScore(
  items: Array<{ text: string; weight: number }>,
  keywords: string[]
): number {
  let weightedHits = 0;
  let totalWeight = 0;
  for (const { text, weight } of items) {
    totalWeight += weight;
    const lower = text.toLowerCase();
    for (const keyword of keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        weightedHits += weight;
        break; // 每个文本块最多计一次命中
      }
    }
  }
  if (totalWeight <= 0) return 0;
  return Math.min(1, weightedHits / Math.max(1, (keywords.length / 2) * (totalWeight / Math.max(1, items.length))));
}

function toFinite(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
