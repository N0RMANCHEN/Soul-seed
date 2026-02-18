import {
  patchConstitution,
  patchHabits,
  patchRelationshipState,
  patchWorldview,
  patchVoiceProfile
} from "./persona.js";
import type {
  LifeEvent,
  PersonaConstitution,
  RelationshipState,
  SelfRevisionProposal,
  VoiceProfile
} from "./types.js";

const MIN_EVIDENCE_EVENTS = 3;
const MIN_CONFIDENCE = 0.72;
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
}

export interface SelfRevisionEvaluation {
  proposal: SelfRevisionProposal | null;
  apply: boolean;
  conflicts: string[];
}

export function collectRevisionSignals(params: {
  userInput: string;
  assistantReply: string;
  events: LifeEvent[];
  relationshipState?: RelationshipState;
}): SelfRevisionSignals {
  const nowMs = Date.now();
  const recent = params.events.filter((event) => {
    const ts = Date.parse(event.ts);
    return Number.isFinite(ts) && nowMs - ts <= LOOKBACK_WINDOW_MS;
  });

  const evidence = recent.slice(-12);
  const eventHashes = evidence.map((event) => event.hash).filter((hash) => typeof hash === "string");
  const reasonCodes = new Set<string>();

  const textPool = [
    params.userInput,
    params.assistantReply,
    ...evidence
      .filter((event) => event.type === "user_message" || event.type === "assistant_message")
      .map((event) => String(event.payload.text ?? ""))
  ]
    .join("\n")
    .toLowerCase();

  const concisePreference = keywordScore(textPool, ["简短", "精简", "要点", "concise", "short", "tl;dr"]);
  const reflectivePreference = keywordScore(textPool, ["反思", "慢一点", "聊聊", "reflect", "reflective"]);
  const directPreference = keywordScore(textPool, ["直接", "直说", "结论", "direct", "straight"]);
  const warmPreference = keywordScore(textPool, ["温柔", "陪伴", "我在", "warm", "gentle", "support"]);

  if (concisePreference > 0) {
    reasonCodes.add("style_concise_signal");
  }
  if (reflectivePreference > 0) {
    reasonCodes.add("style_reflective_signal");
  }
  if (directPreference > 0) {
    reasonCodes.add("tone_direct_signal");
  }
  if (warmPreference > 0) {
    reasonCodes.add("tone_warm_signal");
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
    reasonCodes: [...reasonCodes]
  };
}

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
    return {
      domain: "habits",
      changes: {
        style: styleDelta > 0 ? "concise" : "reflective",
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
    return {
      domain: "voice",
      changes: {
        tonePreference: toneDelta > 0 ? "warm" : "direct",
        stancePreference: params.relationshipState?.state === "intimate" ? "intimate" : "peer"
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
  if (proposal.confidence < MIN_CONFIDENCE) {
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

function toFinite(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
