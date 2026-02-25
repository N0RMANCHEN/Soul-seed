import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { runMemoryStoreSql } from "./memory_store.js";
import type {
  LifeEvent,
  ModelAdapter,
  RelationshipDimensions,
  RelationshipDriver,
  RelationshipState,
  VoiceProfile
} from "./types.js";

/** EB-5: Relationship latent vector dimensionality */
export const RELATIONSHIP_LATENT_DIM = 64;

const RELATIONSHIP_IDLE_GRACE_MS = 20 * 60 * 1000;
const RELATIONSHIP_DECAY_INTERVAL_MS = 60 * 60 * 1000;
const RELATIONSHIP_DECAY_PER_IDLE_INTERVAL = 0.004; // 原 0.002，提高2倍，防止维度长期饱和
const RELATIONSHIP_LIBIDO_DECAY_MULTIPLIER = 2.6;
// 软上限衰减：维度超过此值时，每轮对话额外施加小幅向基线靠近的惩罚，防止饱和
const RELATIONSHIP_SOFT_CEILING = 0.88;
const RELATIONSHIP_SOFT_CEILING_DECAY_PER_TURN = 0.003;
const RELATIONSHIP_AROUSAL_IMPRINT_DECAY_MULTIPLIER = 0.24;
const MAX_DELTA_PER_DIMENSION = 0.03;
const MAX_DRIVERS = 5;
const LIBIDO_AROUSAL_START = 0.52;
const LIBIDO_AROUSAL_MIN_START = 0.22;
const AROUSAL_IMPRINT_GAIN_ON_CLIMAX = 0.04;
const AROUSAL_IMPRINT_MAX = 0.36;
const LIBIDO_EXTREME_PROACTIVE_START = 0.86;

/**
 * EB-5: Create the baseline 64-dim relationship latent vector.
 * Dims 0-5 correspond to named relationship dimensions; rest are 0.
 */
export function createRelationshipLatentBaseline(): number[] {
  const z = new Array<number>(RELATIONSHIP_LATENT_DIM).fill(0.0);
  // Seed from dimension baselines so latent is not cold-start zero
  z[0] = 0.45; // trust
  z[1] = 0.48; // safety
  z[2] = 0.25; // intimacy
  z[3] = 0.35; // reciprocity
  z[4] = 0.45; // stability
  z[5] = 0.35; // libido
  return z;
}

/**
 * EB-5: Project latent vector to named RelationshipDimensions (dims 0-5).
 * Backward compatible — named dimensions are still the projection interface.
 */
export function projectRelationshipLatent(z: number[]): RelationshipDimensions {
  if (z.length < 6) {
    return {
      trust: 0.45, safety: 0.48, intimacy: 0.25,
      reciprocity: 0.35, stability: 0.45, libido: 0.35
    };
  }
  return {
    trust: clamp01(z[0]),
    safety: clamp01(z[1]),
    intimacy: clamp01(z[2]),
    reciprocity: clamp01(z[3]),
    stability: clamp01(z[4]),
    libido: clamp01(z[5])
  };
}

/**
 * EB-5: Apply a delta update to the latent vector (small-step lerp, dims 0-5 only).
 * Uses alpha to prevent large jumps.
 */
export function updateRelationshipLatent(
  z: number[],
  delta: Partial<RelationshipDimensions>,
  alpha = 0.15
): number[] {
  if (z.length < RELATIONSHIP_LATENT_DIM) {
    return z;
  }
  const next = [...z];
  const keys: (keyof RelationshipDimensions)[] = ["trust", "safety", "intimacy", "reciprocity", "stability", "libido"];
  const dimIdx = [0, 1, 2, 3, 4, 5];
  for (let i = 0; i < keys.length; i++) {
    const d = delta[keys[i]];
    if (typeof d === "number" && Number.isFinite(d)) {
      next[dimIdx[i]] = clamp01(next[dimIdx[i]] + alpha * d);
    }
  }
  return next;
}

/**
 * EB-5: Validate a relationship latent vector.
 */
export function isRelationshipLatentValid(z: unknown): z is number[] {
  return (
    Array.isArray(z) &&
    z.length === RELATIONSHIP_LATENT_DIM &&
    (z as unknown[]).every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

const RELATIONSHIP_DIMENSION_BASELINE: RelationshipDimensions = {
  trust: 0.45,
  safety: 0.48,
  intimacy: 0.25,
  reciprocity: 0.35,
  stability: 0.45,
  libido: 0.35
};

export const DEFAULT_RELATIONSHIP_STATE: RelationshipState = createInitialRelationshipState();

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  baseStance: "self-determined",
  serviceModeAllowed: false,
  languagePolicy: "follow_user_language",
  forbiddenSelfLabels: ["personal assistant", "local runtime role", "为你服务", "你的助手"],
  thinkingPreview: {
    enabled: true,
    thresholdMs: 1000,
    phrasePool: [],
    allowFiller: true
  }
};

export async function ensureRelationshipArtifacts(rootPath: string): Promise<{
  relationshipState: RelationshipState;
  voiceProfile: VoiceProfile;
}> {
  const relationshipPath = path.join(rootPath, "relationship_state.json");
  const voicePath = path.join(rootPath, "voice_profile.json");
  const hadRelationship = existsSync(relationshipPath);
  const hadVoiceProfile = existsSync(voicePath);

  const rawRelationship = await readOrInitJson<Record<string, unknown>>(
    relationshipPath,
    DEFAULT_RELATIONSHIP_STATE as unknown as Record<string, unknown>
  );
  const rawVoice = await readOrInitJson<Record<string, unknown>>(
    voicePath,
    DEFAULT_VOICE_PROFILE as unknown as Record<string, unknown>
  );

  const relationshipState = normalizeRelationshipState(rawRelationship);
  const voiceProfile = normalizeVoiceProfile(rawVoice);

  await writeJson(relationshipPath, relationshipState);
  await writeJson(voicePath, voiceProfile);

  if (!hadRelationship || !hadVoiceProfile) {
    await writeMigrationBackup(rootPath, {
      createdRelationshipState: !hadRelationship,
      createdVoiceProfile: !hadVoiceProfile
    });
  }

  return { relationshipState, voiceProfile };
}

export async function writeRelationshipState(rootPath: string, state: RelationshipState): Promise<void> {
  const relationshipPath = path.join(rootPath, "relationship_state.json");
  await writeJson(relationshipPath, normalizeRelationshipState(state as unknown as Record<string, unknown>));
}

export function createInitialRelationshipState(updatedAt?: string): RelationshipState {
  return buildRelationshipState({
    dimensions: RELATIONSHIP_DIMENSION_BASELINE,
    drivers: [],
    updatedAt: updatedAt && validIso(updatedAt) ? updatedAt : new Date(0).toISOString()
  });
}

export function deriveVoiceIntent(params: {
  relationshipState: RelationshipState;
  userInput: string;
  preferredLanguage?: string;
}): {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  serviceMode: false;
  language: "zh" | "en" | "mixed";
} {
  const input = params.userInput.trim();
  const looksZh = /[\u4e00-\u9fa5]/u.test(input);
  const looksEn = /[A-Za-z]/.test(input);
  const language =
    looksZh && looksEn
      ? "mixed"
      : looksZh
        ? "zh"
        : looksEn
          ? "en"
          : params.preferredLanguage?.startsWith("zh")
            ? "zh"
            : "en";
  const question = /[?？]/.test(input);
  const stance =
    params.relationshipState.state === "neutral-unknown" ? "neutral" : params.relationshipState.state;
  const arousal = deriveCognitiveBalanceFromLibido(params.relationshipState);
  const extremeProactive = isExtremeProactiveWindowActive(params.relationshipState);
  if (extremeProactive) {
    return {
      stance: "intimate",
      tone: "direct",
      serviceMode: false,
      language
    };
  }
  const tone = question ? "plain" : stance === "intimate" || arousal.arousalState !== "low" ? "warm" : "reflective";
  return {
    stance,
    tone,
    serviceMode: false,
    language
  };
}

export function isExtremeProactiveWindowActive(relationshipState: RelationshipState): boolean {
  const libido = clamp01(relationshipState.dimensions.libido);
  const intimacy = clamp01(relationshipState.dimensions.intimacy);
  const arousal = deriveCognitiveBalanceFromLibido(relationshipState);
  return libido >= LIBIDO_EXTREME_PROACTIVE_START && intimacy >= 0.52 && arousal.arousalState !== "low";
}

export function deriveCognitiveBalanceFromLibido(relationshipState: RelationshipState): {
  arousalState: "low" | "rising" | "aroused" | "overridden";
  rationalControl: number;
  emotionalDrive: number;
} {
  const libido = clamp01(relationshipState.dimensions.libido);
  const arousalStart = getLibidoArousalStart(relationshipState);
  const arousedStart = Math.min(0.95, arousalStart + 0.08);
  const overriddenStart = Math.min(0.98, arousalStart + 0.22);
  if (libido < arousalStart) {
    return {
      arousalState: "low",
      rationalControl: 1,
      emotionalDrive: 1
    };
  }
  const intensity = clamp01((libido - arousalStart) / (1 - arousalStart));
  const rationalControl = roundTo4(clamp01(1 - intensity * 0.45));
  const emotionalDrive = roundTo4(1 + intensity * 0.7);
  return {
    arousalState: libido >= overriddenStart ? "overridden" : libido >= arousedStart ? "aroused" : "rising",
    rationalControl,
    emotionalDrive
  };
}

export function applyArousalBiasToMemoryWeights(
  weights: { activation: number; emotion: number; narrative: number; relational: number },
  relationshipState: RelationshipState
): { activation: number; emotion: number; narrative: number; relational: number } {
  const balance = deriveCognitiveBalanceFromLibido(relationshipState);
  if (balance.arousalState === "low") {
    return weights;
  }
  const arousalStart = getLibidoArousalStart(relationshipState);
  const intensity = clamp01((relationshipState.dimensions.libido - arousalStart) / (1 - arousalStart));
  const rationalPenalty = 0.4 * intensity;
  const emotionBoost = 0.5 * intensity;

  const next = {
    activation: Math.max(0, weights.activation * (1 - rationalPenalty)),
    emotion: Math.max(0, weights.emotion * (1 + emotionBoost)),
    narrative: Math.max(0, weights.narrative * (1 - rationalPenalty)),
    relational: Math.max(0, weights.relational * (1 + emotionBoost * 0.6))
  };

  const sum = next.activation + next.emotion + next.narrative + next.relational;
  if (!Number.isFinite(sum) || sum <= 0) {
    return weights;
  }
  return {
    activation: roundTo4(next.activation / sum),
    emotion: roundTo4(next.emotion / sum),
    narrative: roundTo4(next.narrative / sum),
    relational: roundTo4(next.relational / sum)
  };
}

function getLibidoArousalStart(relationshipState: RelationshipState): number {
  const intimacy = clamp01(relationshipState.dimensions.intimacy);
  const intimacyShift = intimacy * 0.34;
  const imprint = clamp01(relationshipState.arousalImprint ?? 0);
  const imprintShift = imprint * 0.24;
  return Math.max(LIBIDO_AROUSAL_MIN_START, LIBIDO_AROUSAL_START - intimacyShift - imprintShift);
}

export function isImpulseWindowActive(relationshipState: RelationshipState): boolean {
  const balance = deriveCognitiveBalanceFromLibido(relationshipState);
  if (balance.arousalState === "overridden") {
    return true;
  }
  if (balance.arousalState !== "aroused") {
    return false;
  }
  return relationshipState.dimensions.intimacy >= 0.38 || relationshipState.dimensions.trust >= 0.62;
}

export function evolveRelationshipState(
  current: RelationshipState,
  userInput: string,
  _events: LifeEvent[]
): RelationshipState {
  const normalizedCurrent = normalizeRelationshipState(current as unknown as Record<string, unknown>);
  const deltas: Partial<RelationshipDimensions> = {};
  const signals: string[] = [];
  const text = userInput.trim();
  const lowered = text.toLowerCase();

  const positivePattern =
    /谢谢|感谢|辛苦|喜欢|信任|支持|懂你|good|great|thanks|trust|appreciate|cooperate|together/i;
  const negativePattern = /笨|傻|讨厌|烦|失望|滚|闭嘴|hate|stupid|annoy|useless|worst/i;
  const intimatePattern = /亲密|最懂我|爱你|老婆|宝贝|intimate|love you|dear/i;
  const peerPattern = /伙伴|搭子|并肩|peer|teammate/i;
  const friendPattern = /朋友|friend/i;
  const libidoUpPattern = /性欲|想要你|欲望|发情|sex|sexual|horny|aroused/i;
  const libidoDownPattern = /别碰我|不想要|拒绝|stop|no sex|turn off/i;
  const moodPattern = /情调|氛围|暧昧|挑逗|耳语|烛光|romantic|tease|seduce|foreplay/i;
  const resolutionPattern = /满足了|结束了|冷静了|贤者时间|finished|satisfied|came|orgasm|release/i;

  if (positivePattern.test(text)) {
    addDelta(deltas, "trust", 0.015);
    addDelta(deltas, "safety", 0.01);
    addDelta(deltas, "reciprocity", 0.012);
    signals.push("user_positive_affect");
  }
  if (negativePattern.test(text)) {
    addDelta(deltas, "safety", -0.02);
    addDelta(deltas, "trust", -0.015);
    addDelta(deltas, "stability", -0.008);
    signals.push("user_negative_affect");
  }
  if (intimatePattern.test(text)) {
    addDelta(deltas, "intimacy", 0.018);
    addDelta(deltas, "trust", 0.006);
    addDelta(deltas, "libido", 0.012);
    signals.push("user_intimacy_signal");
  } else if (peerPattern.test(text)) {
    addDelta(deltas, "reciprocity", 0.014);
    addDelta(deltas, "stability", 0.01);
    signals.push("user_peer_signal");
  } else if (friendPattern.test(text)) {
    addDelta(deltas, "trust", 0.01);
    addDelta(deltas, "intimacy", 0.01);
    signals.push("user_friend_signal");
  }
  if (/[?？]/.test(text)) {
    addDelta(deltas, "safety", 0.004);
    signals.push("user_clarifying_question");
  }
  if (libidoUpPattern.test(text)) {
    addDelta(deltas, "libido", 0.02);
    signals.push("user_libido_up_signal");
  }
  if (moodPattern.test(text)) {
    addDelta(deltas, "intimacy", 0.01);
    addDelta(deltas, "libido", 0.018);
    signals.push("user_mood_signal");
  }
  if (libidoDownPattern.test(text)) {
    addDelta(deltas, "libido", -0.03);
    signals.push("user_libido_down_signal");
  }
  if (resolutionPattern.test(text)) {
    addDelta(deltas, "libido", -0.05);
    signals.push("user_resolution_signal");
  }
  if (text.length <= 2 || /^嗯|ok|好的|好吧$/i.test(lowered)) {
    signals.push("user_low_information_turn");
  }

  return evolveWithSignal(normalizedCurrent, "user", signals, deltas);
}

export function evolveRelationshipStateFromAssistant(
  current: RelationshipState,
  assistantOutput: string,
  events: LifeEvent[]
): RelationshipState {
  const normalizedCurrent = normalizeRelationshipState(current as unknown as Record<string, unknown>);
  const deltas: Partial<RelationshipDimensions> = {};
  const signals: string[] = [];
  const text = assistantOutput.trim();

  if (/[?？]/.test(text) || /你是指|让我确认一下|to clarify|do you mean/i.test(text)) {
    addDelta(deltas, "safety", 0.012);
    addDelta(deltas, "stability", 0.01);
    signals.push("assistant_clarification");
  }
  if (/谢谢|感谢|理解你|我在这|I understand|thank you|I am here/i.test(text)) {
    addDelta(deltas, "trust", 0.008);
    addDelta(deltas, "intimacy", 0.006);
    signals.push("assistant_empathic_response");
  }
  if (/想你|想抱你|亲密|desire|want you|sexual/i.test(text)) {
    addDelta(deltas, "libido", 0.014);
    signals.push("assistant_libido_up_signal");
  }
  if (/氛围|情调|romantic|tease|whisper|candlelight/i.test(text)) {
    addDelta(deltas, "intimacy", 0.008);
    addDelta(deltas, "libido", 0.014);
    signals.push("assistant_mood_signal");
  }
  if (/尊重你的边界|不做这个|stop here|respect your boundary/i.test(text)) {
    addDelta(deltas, "libido", -0.018);
    signals.push("assistant_libido_down_signal");
  }
  if (/慢慢平复|冷静下来|结束吧|we are done|you can rest now/i.test(text)) {
    addDelta(deltas, "libido", -0.04);
    signals.push("assistant_resolution_signal");
  }
  if (/对不起|抱歉|sorry/i.test(text)) {
    addDelta(deltas, "safety", 0.004);
    addDelta(deltas, "trust", 0.003);
    signals.push("assistant_repair_attempt");
  }
  if (text.length < 16) {
    signals.push("assistant_short_response");
  }

  const recentEvents = events.slice(-4);
  if (recentEvents.some((event) => event.type === "conflict_logged")) {
    addDelta(deltas, "trust", -0.02);
    addDelta(deltas, "safety", -0.02);
    signals.push("conflict_penalty");
  }
  if (recentEvents.some((event) => event.type === "assistant_aborted")) {
    addDelta(deltas, "stability", -0.012);
    signals.push("abort_penalty");
  }

  return evolveWithSignal(normalizedCurrent, "assistant", signals, deltas);
}

export interface RelationshipSemanticEvolutionResult {
  state: RelationshipState;
  signalAssessmentPath: "semantic" | "regex_fallback";
}

/**
 * EC-4: 关系状态语义演化
 * 使用 LLM 评估对话对中的关系信号强度，输出各维度 delta[-0.03, +0.03]。
 * LLM 不可用时 fallback 到现有正则路径。
 */
export async function evolveRelationshipStateSemantic(
  state: RelationshipState,
  userInput: string,
  assistantOutput: string,
  llmAdapter?: ModelAdapter
): Promise<RelationshipSemanticEvolutionResult> {
  if (!llmAdapter) {
    // Fallback: run both regex functions and return
    const afterUser = evolveRelationshipState(state, userInput, []);
    const afterBoth = evolveRelationshipStateFromAssistant(afterUser, assistantOutput, []);
    return { state: afterBoth, signalAssessmentPath: "regex_fallback" };
  }

  try {
    const prompt = `Analyze this conversation exchange and evaluate how it affects the relationship between the user and persona. Output a JSON object with delta values for each relationship dimension. Each delta must be in the range [-0.03, +0.03] where positive = strengthened, negative = weakened, 0 = no change.

Dimensions:
- trust: reliability, honesty, following through
- safety: emotional safety, non-judgment, comfort
- intimacy: closeness, personal sharing, warmth
- reciprocity: mutual engagement, balance, giving/receiving
- stability: consistency, predictability
- libido: romantic/sexual tension (0 if not applicable)

User message: "${userInput.slice(0, 300)}"
Assistant response: "${assistantOutput.slice(0, 300)}"

Respond with ONLY valid JSON. Example: {"trust":0.01,"safety":0.008,"intimacy":0.015,"reciprocity":0.005,"stability":0.003,"libido":0}`;

    let collectedText = "";
    await llmAdapter.streamChat(
      [{ role: "user", content: prompt }],
      { onToken: (tok: string) => { collectedText += tok; }, onDone: () => {} }
    );

    const parsed = JSON.parse(collectedText.trim()) as Record<string, unknown>;
    const clampDelta = (v: unknown): number => Math.max(-0.03, Math.min(0.03, Number(v ?? 0)));

    const deltas: Partial<RelationshipDimensions> = {
      trust:       clampDelta(parsed.trust),
      safety:      clampDelta(parsed.safety),
      intimacy:    clampDelta(parsed.intimacy),
      reciprocity: clampDelta(parsed.reciprocity),
      stability:   clampDelta(parsed.stability),
      libido:      clampDelta(parsed.libido)
    };
    const signals = ["semantic_assessment"];
    const normalizedCurrent = normalizeRelationshipState(state as unknown as Record<string, unknown>);
    const evolved = evolveWithSignal(normalizedCurrent, "user", signals, deltas);
    return { state: evolved, signalAssessmentPath: "semantic" };
  } catch {
    // LLM call failed → fallback to regex
    const afterUser = evolveRelationshipState(state, userInput, []);
    const afterBoth = evolveRelationshipStateFromAssistant(afterUser, assistantOutput, []);
    return { state: afterBoth, signalAssessmentPath: "regex_fallback" };
  }
}

function evolveWithSignal(
  current: RelationshipState,
  source: RelationshipDriver["source"],
  signals: string[],
  deltas: Partial<RelationshipDimensions>
): RelationshipState {
  const now = new Date();
  const decayAmount = computeIdleDecayAmount(current.updatedAt, now);
  const decayed: RelationshipDimensions = {
    trust: decayTowardBaseline(current.dimensions.trust, RELATIONSHIP_DIMENSION_BASELINE.trust, decayAmount),
    safety: decayTowardBaseline(current.dimensions.safety, RELATIONSHIP_DIMENSION_BASELINE.safety, decayAmount),
    intimacy: decayTowardBaseline(current.dimensions.intimacy, RELATIONSHIP_DIMENSION_BASELINE.intimacy, decayAmount),
    reciprocity: decayTowardBaseline(current.dimensions.reciprocity, RELATIONSHIP_DIMENSION_BASELINE.reciprocity, decayAmount),
    stability: decayTowardBaseline(current.dimensions.stability, RELATIONSHIP_DIMENSION_BASELINE.stability, decayAmount),
    libido: decayTowardBaseline(
      current.dimensions.libido,
      RELATIONSHIP_DIMENSION_BASELINE.libido,
      decayAmount * RELATIONSHIP_LIBIDO_DECAY_MULTIPLIER
    )
  };

  const bounded = boundDeltas(deltas);

  // 软上限信号阻尼：当维度已超过 SOFT_CEILING 时，正向信号按过冲比例压制
  // 当前值越接近 1.0，正向信号越接近被完全屏蔽；负向信号（惩罚）不受影响
  const dampSignal = (currentVal: number, delta: number): number => {
    if (delta <= 0 || currentVal <= RELATIONSHIP_SOFT_CEILING) return delta;
    const overshoot = (currentVal - RELATIONSHIP_SOFT_CEILING) / (1 - RELATIONSHIP_SOFT_CEILING);
    return delta * Math.max(0, 1 - overshoot);
  };

  // 软上限衰减：对超过 SOFT_CEILING 的维度，每轮额外向基线拉一点
  const softDecay = (val: number, baseline: number): number => {
    if (val > RELATIONSHIP_SOFT_CEILING) {
      return Math.max(baseline, val - RELATIONSHIP_SOFT_CEILING_DECAY_PER_TURN);
    }
    return val;
  };

  const nextDimensions: RelationshipDimensions = {
    trust: clamp01(softDecay(decayed.trust + dampSignal(decayed.trust, bounded.trust ?? 0), RELATIONSHIP_DIMENSION_BASELINE.trust)),
    safety: clamp01(softDecay(decayed.safety + dampSignal(decayed.safety, bounded.safety ?? 0), RELATIONSHIP_DIMENSION_BASELINE.safety)),
    intimacy: clamp01(softDecay(decayed.intimacy + dampSignal(decayed.intimacy, bounded.intimacy ?? 0), RELATIONSHIP_DIMENSION_BASELINE.intimacy)),
    reciprocity: clamp01(softDecay(decayed.reciprocity + dampSignal(decayed.reciprocity, bounded.reciprocity ?? 0), RELATIONSHIP_DIMENSION_BASELINE.reciprocity)),
    stability: clamp01(softDecay(decayed.stability + dampSignal(decayed.stability, bounded.stability ?? 0), RELATIONSHIP_DIMENSION_BASELINE.stability)),
    libido: clamp01(softDecay(decayed.libido + dampSignal(decayed.libido, bounded.libido ?? 0), RELATIONSHIP_DIMENSION_BASELINE.libido))
  };
  const climaxSignal = signals.some((signal) => /resolution_signal/.test(signal));
  const climaxReached = climaxSignal && current.dimensions.libido >= 0.82;
  const nextArousalImprint = computeNextArousalImprint(current, decayAmount, climaxReached);

  const hasSignal =
    signals.length > 0 &&
    (bounded.trust ?? 0) +
      (bounded.safety ?? 0) +
      (bounded.intimacy ?? 0) +
      (bounded.reciprocity ?? 0) +
      (bounded.stability ?? 0) +
      (bounded.libido ?? 0) !==
      0;
  const drivers = hasSignal
    ? appendDriver(current.drivers, {
        ts: now.toISOString(),
        source,
        signal: signals.join("+"),
        deltaSummary: compactDeltaSummary(bounded)
      })
    : current.drivers;

  // EB-5: Update latent vector with applied deltas (small-step)
  const currentLatent = isRelationshipLatentValid(current.relationshipLatent)
    ? current.relationshipLatent
    : undefined;
  const nextLatent = currentLatent !== undefined
    ? updateRelationshipLatent(currentLatent, bounded)
    : undefined;

  return buildRelationshipState({
    dimensions: nextDimensions,
    arousalImprint: nextArousalImprint,
    drivers,
    updatedAt: now.toISOString(),
    relationshipLatent: nextLatent
  });
}

function buildRelationshipState(params: {
  dimensions: RelationshipDimensions;
  arousalImprint?: number;
  drivers: RelationshipDriver[];
  updatedAt: string;
  relationshipLatent?: number[];
}): RelationshipState {
  const normalizedDimensions = normalizeDimensions(params.dimensions);
  const overall = computeOverall(normalizedDimensions);

  // EB-5: Initialize or sync latent from named dimensions
  let relationshipLatent = params.relationshipLatent;
  if (!isRelationshipLatentValid(relationshipLatent)) {
    // Cold start: initialize from named dimension values
    const z = createRelationshipLatentBaseline();
    z[0] = normalizedDimensions.trust;
    z[1] = normalizedDimensions.safety;
    z[2] = normalizedDimensions.intimacy;
    z[3] = normalizedDimensions.reciprocity;
    z[4] = normalizedDimensions.stability;
    z[5] = normalizedDimensions.libido;
    relationshipLatent = z;
  } else {
    // Keep latent dims 0-5 in sync with named dimensions (latent is authoritative,
    // but on build we sync to ensure consistency)
    const synced = [...relationshipLatent];
    synced[0] = normalizedDimensions.trust;
    synced[1] = normalizedDimensions.safety;
    synced[2] = normalizedDimensions.intimacy;
    synced[3] = normalizedDimensions.reciprocity;
    synced[4] = normalizedDimensions.stability;
    synced[5] = normalizedDimensions.libido;
    relationshipLatent = synced;
  }

  return {
    state: mapOverallToState(overall),
    confidence: roundTo2(overall),
    overall,
    dimensions: normalizedDimensions,
    arousalImprint: roundTo4(clamp01(params.arousalImprint ?? 0)),
    drivers: params.drivers.slice(-MAX_DRIVERS),
    version: "3",
    updatedAt: params.updatedAt,
    relationshipLatent
  };
}

function normalizeRelationshipState(raw: Record<string, unknown>): RelationshipState {
  const state = raw.state;
  const confidence = Number(raw.confidence ?? NaN);
  const overall = Number(raw.overall ?? NaN);
  const updatedAt = typeof raw.updatedAt === "string" && validIso(raw.updatedAt)
    ? raw.updatedAt
    : new Date().toISOString();
  const legacyState =
    state === "neutral-unknown" || state === "friend" || state === "peer" || state === "intimate"
      ? state
      : "neutral-unknown";
  const fallbackScore = clamp01(Number.isFinite(confidence) ? confidence : 0.5);
  const resolvedOverall = clamp01(Number.isFinite(overall) ? overall : fallbackScore);
  const dimensions = normalizeDimensionsFromRaw(raw.dimensions, legacyState, resolvedOverall);
  const arousalImprint = normalizeArousalImprint(raw.arousalImprint);
  const drivers = normalizeDrivers(raw.drivers);
  // EB-5: Preserve existing latent if valid
  const rawLatent = Array.isArray(raw.relationshipLatent) ? raw.relationshipLatent as unknown[] : undefined;
  const relationshipLatent = rawLatent !== undefined && rawLatent.length === RELATIONSHIP_LATENT_DIM &&
    rawLatent.every((v) => typeof v === "number" && Number.isFinite(v))
    ? rawLatent as number[]
    : undefined;
  return buildRelationshipState({
    dimensions,
    arousalImprint,
    drivers,
    updatedAt,
    relationshipLatent
  });
}

function normalizeDimensionsFromRaw(
  raw: unknown,
  state: RelationshipState["state"],
  overall: number
): RelationshipDimensions {
  if (!isRecord(raw)) {
    return inferDimensionsFromLegacy(state, overall);
  }
  const trust = Number(raw.trust ?? NaN);
  const safety = Number(raw.safety ?? NaN);
  const intimacy = Number(raw.intimacy ?? NaN);
  const reciprocity = Number(raw.reciprocity ?? NaN);
  const stability = Number(raw.stability ?? NaN);
  const libido = Number(raw.libido ?? NaN);
  if ([trust, safety, intimacy, reciprocity, stability].every((value) => Number.isFinite(value))) {
    return normalizeDimensions({
      trust,
      safety,
      intimacy,
      reciprocity,
      stability,
      libido: Number.isFinite(libido) ? libido : RELATIONSHIP_DIMENSION_BASELINE.libido
    });
  }
  return inferDimensionsFromLegacy(state, overall);
}

function inferDimensionsFromLegacy(
  state: RelationshipState["state"],
  overall: number
): RelationshipDimensions {
  const blend = clamp01(overall);
  const boost =
    state === "intimate" ? 0.18 : state === "peer" ? 0.1 : state === "friend" ? 0.06 : 0;
  return normalizeDimensions({
    trust: RELATIONSHIP_DIMENSION_BASELINE.trust * (1 - blend) + blend + boost,
    safety: RELATIONSHIP_DIMENSION_BASELINE.safety * (1 - blend) + blend * 0.9 + boost * 0.7,
    intimacy: RELATIONSHIP_DIMENSION_BASELINE.intimacy * (1 - blend) + blend * 0.85 + boost,
    reciprocity: RELATIONSHIP_DIMENSION_BASELINE.reciprocity * (1 - blend) + blend * 0.88 + boost * 0.6,
    stability: RELATIONSHIP_DIMENSION_BASELINE.stability * (1 - blend) + blend * 0.8 + boost * 0.5,
    libido: RELATIONSHIP_DIMENSION_BASELINE.libido
  });
}

function normalizeDimensions(dimensions: RelationshipDimensions): RelationshipDimensions {
  return {
    trust: roundTo4(clamp01(dimensions.trust)),
    safety: roundTo4(clamp01(dimensions.safety)),
    intimacy: roundTo4(clamp01(dimensions.intimacy)),
    reciprocity: roundTo4(clamp01(dimensions.reciprocity)),
    stability: roundTo4(clamp01(dimensions.stability)),
    libido: roundTo4(clamp01(dimensions.libido))
  };
}

function normalizeDrivers(raw: unknown): RelationshipDriver[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => isRecord(item))
    .map((item) => {
      const source: RelationshipDriver["source"] =
        item.source === "user" || item.source === "assistant" || item.source === "event"
          ? item.source
          : "event";
      const ts = typeof item.ts === "string" && validIso(item.ts) ? item.ts : new Date().toISOString();
      const signal = typeof item.signal === "string" && item.signal ? item.signal : "unknown";
      const deltaSummary = isRecord(item.deltaSummary)
        ? compactDeltaSummary({
            trust: toFinite(item.deltaSummary.trust),
            safety: toFinite(item.deltaSummary.safety),
            intimacy: toFinite(item.deltaSummary.intimacy),
            reciprocity: toFinite(item.deltaSummary.reciprocity),
            stability: toFinite(item.deltaSummary.stability),
            libido: toFinite(item.deltaSummary.libido)
          })
        : {};
      return {
        ts,
        source,
        signal,
        deltaSummary
      };
    })
    .slice(-MAX_DRIVERS);
}

function normalizeArousalImprint(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return roundTo4(clamp01(num));
}

function computeNextArousalImprint(
  current: RelationshipState,
  decayAmount: number,
  climaxReached: boolean
): number {
  const currentImprint = clamp01(current.arousalImprint ?? 0);
  const decayed = decayTowardBaseline(
    currentImprint,
    0,
    decayAmount * RELATIONSHIP_AROUSAL_IMPRINT_DECAY_MULTIPLIER
  );
  if (!climaxReached) {
    return roundTo4(clamp01(decayed));
  }
  return roundTo4(Math.min(AROUSAL_IMPRINT_MAX, decayed + AROUSAL_IMPRINT_GAIN_ON_CLIMAX));
}

function normalizeVoiceProfile(raw: Record<string, unknown>): VoiceProfile {
  const forbiddenSelfLabels = Array.isArray(raw.forbiddenSelfLabels)
    ? raw.forbiddenSelfLabels.filter((v): v is string => typeof v === "string")
    : DEFAULT_VOICE_PROFILE.forbiddenSelfLabels;
  const tonePreference =
    raw.tonePreference === "warm" ||
    raw.tonePreference === "plain" ||
    raw.tonePreference === "reflective" ||
    raw.tonePreference === "direct"
      ? raw.tonePreference
      : undefined;
  const stancePreference =
    raw.stancePreference === "friend" ||
    raw.stancePreference === "peer" ||
    raw.stancePreference === "intimate" ||
    raw.stancePreference === "neutral"
      ? raw.stancePreference
      : undefined;
  const thinkingRaw = isRecord(raw.thinkingPreview) ? raw.thinkingPreview : {};
  const thinkingEnabled =
    typeof thinkingRaw.enabled === "boolean"
      ? thinkingRaw.enabled
      : DEFAULT_VOICE_PROFILE.thinkingPreview?.enabled ?? true;
  const thinkingThresholdRaw = Number(thinkingRaw.thresholdMs);
  const thinkingThresholdMs = Number.isFinite(thinkingThresholdRaw)
    ? Math.max(500, Math.min(4000, Math.round(thinkingThresholdRaw)))
    : DEFAULT_VOICE_PROFILE.thinkingPreview?.thresholdMs ?? 1000;
  const phrasePool = Array.isArray(thinkingRaw.phrasePool)
    ? thinkingRaw.phrasePool
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 24)
    : [];
  const allowFiller =
    typeof thinkingRaw.allowFiller === "boolean"
      ? thinkingRaw.allowFiller
      : DEFAULT_VOICE_PROFILE.thinkingPreview?.allowFiller ?? true;
  return {
    baseStance: "self-determined",
    serviceModeAllowed: false,
    languagePolicy: "follow_user_language",
    forbiddenSelfLabels,
    thinkingPreview: {
      enabled: thinkingEnabled,
      thresholdMs: thinkingThresholdMs,
      phrasePool,
      allowFiller
    },
    ...(tonePreference ? { tonePreference } : {}),
    ...(stancePreference ? { stancePreference } : {})
  };
}

// P0-1：亲密度权重校准（intimacy 0.18→0.28，safety 0.22→0.18，trust 0.30→0.28，reciprocity 0.18→0.14）
// 旧权重导致 intimacy=0.82 时仍被判定为 "peer"；新权重使高亲密度正确反映关系状态。
function computeOverall(dimensions: RelationshipDimensions): number {
  const score =
    dimensions.trust * 0.28 +
    dimensions.safety * 0.18 +
    dimensions.intimacy * 0.28 +
    dimensions.reciprocity * 0.14 +
    dimensions.stability * 0.12;
  return roundTo4(clamp01(score));
}

// P0-1：状态阈值对应校准（intimate 0.78→0.70，peer 0.62→0.55，friend 0.45→0.40）
function mapOverallToState(overall: number): RelationshipState["state"] {
  if (overall >= 0.70) {
    return "intimate";
  }
  if (overall >= 0.55) {
    return "peer";
  }
  if (overall >= 0.40) {
    return "friend";
  }
  return "neutral-unknown";
}

function decayTowardBaseline(value: number, baseline: number, amount: number): number {
  if (amount <= 0) {
    return value;
  }
  if (value > baseline) {
    return Math.max(baseline, value - amount);
  }
  if (value < baseline) {
    return Math.min(baseline, value + amount);
  }
  return value;
}

function computeIdleDecayAmount(updatedAt: string, now: Date): number {
  const lastTs = Date.parse(updatedAt);
  if (!Number.isFinite(lastTs)) {
    return 0;
  }
  const elapsedMs = now.getTime() - lastTs;
  if (elapsedMs <= RELATIONSHIP_IDLE_GRACE_MS) {
    return 0;
  }
  const decayIntervals = Math.floor((elapsedMs - RELATIONSHIP_IDLE_GRACE_MS) / RELATIONSHIP_DECAY_INTERVAL_MS);
  if (decayIntervals <= 0) {
    return 0;
  }
  return decayIntervals * RELATIONSHIP_DECAY_PER_IDLE_INTERVAL;
}

function boundDeltas(delta: Partial<RelationshipDimensions>): Partial<RelationshipDimensions> {
  return {
    trust: boundDelta(delta.trust),
    safety: boundDelta(delta.safety),
    intimacy: boundDelta(delta.intimacy),
    reciprocity: boundDelta(delta.reciprocity),
    stability: boundDelta(delta.stability),
    libido: boundDelta(delta.libido)
  };
}

function boundDelta(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(-MAX_DELTA_PER_DIMENSION, Math.min(MAX_DELTA_PER_DIMENSION, value));
}

function appendDriver(current: RelationshipDriver[], driver: RelationshipDriver): RelationshipDriver[] {
  return [...current, driver].slice(-MAX_DRIVERS);
}

function compactDeltaSummary(delta: Partial<RelationshipDimensions>): Partial<RelationshipDimensions> {
  const next: Partial<RelationshipDimensions> = {};
  if (typeof delta.trust === "number" && delta.trust !== 0) {
    next.trust = roundTo4(delta.trust);
  }
  if (typeof delta.safety === "number" && delta.safety !== 0) {
    next.safety = roundTo4(delta.safety);
  }
  if (typeof delta.intimacy === "number" && delta.intimacy !== 0) {
    next.intimacy = roundTo4(delta.intimacy);
  }
  if (typeof delta.reciprocity === "number" && delta.reciprocity !== 0) {
    next.reciprocity = roundTo4(delta.reciprocity);
  }
  if (typeof delta.stability === "number" && delta.stability !== 0) {
    next.stability = roundTo4(delta.stability);
  }
  if (typeof delta.libido === "number" && delta.libido !== 0) {
    next.libido = roundTo4(delta.libido);
  }
  return next;
}

function addDelta(
  target: Partial<RelationshipDimensions>,
  key: keyof RelationshipDimensions,
  value: number
): void {
  const current = target[key] ?? 0;
  target[key] = current + value;
}

function toFinite(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function roundTo4(value: number): number {
  return Number(value.toFixed(4));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readOrInitJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) {
    await writeJson(filePath, fallback);
    return fallback;
  }
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try {
      await rename(filePath, backup);
    } catch {
      // ignore backup failure
    }
    await writeJson(filePath, fallback);
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

const RECONCILE_GAP_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 小时
const RECONCILE_MIN_MEMORY_COUNT = 3;
const RECONCILE_MIN_AVG_EMOTION = 0.5;
const RECONCILE_MAX_RECOVERY_FRACTION = 0.6; // 最多恢复 60% 的已衰减量

export interface RelationshipReconcileResult {
  reconciled: boolean;
  reason: string;
  gapMs?: number;
  recoveryDelta?: { intimacy: number; trust: number };
}

/**
 * 重连时关系状态记忆对齐：
 * 若距上次更新 > 48h，且 memory.db 中存在足够的高亲密度 relational 记忆，
 * 则部分恢复因空闲衰减而降低的 intimacy 和 trust 维度。
 *
 * 设计为独立导出函数，由会话启动逻辑显式调用，不内嵌到 loadPersonaPackage。
 */
export async function reconcileRelationshipWithMemory(
  rootPath: string,
  options?: { gapThresholdMs?: number; minMemoryCount?: number }
): Promise<RelationshipReconcileResult> {
  const gapThreshold = options?.gapThresholdMs ?? RECONCILE_GAP_THRESHOLD_MS;
  const minMemoryCount = options?.minMemoryCount ?? RECONCILE_MIN_MEMORY_COUNT;

  const { relationshipState } = await ensureRelationshipArtifacts(rootPath);
  const lastUpdate = Date.parse(relationshipState.updatedAt);
  const gapMs = Date.now() - lastUpdate;

  if (!Number.isFinite(gapMs) || gapMs < gapThreshold) {
    return { reconciled: false, reason: "gap_below_threshold", gapMs };
  }

  // 查询最近热/温 relational 记忆的情感强度
  const queryResult = await runMemoryStoreSql(
    rootPath,
    `SELECT CAST(AVG(emotion_score) AS TEXT), CAST(AVG(salience) AS TEXT), CAST(COUNT(*) AS TEXT)
     FROM memories
     WHERE memory_type='relational'
       AND deleted_at IS NULL
       AND excluded_from_recall = 0
       AND state IN ('hot','warm')
     LIMIT 20;`
  ).catch(() => "");

  const parts = queryResult.trim().split("|");
  const avgEmotion = Number(parts[0] ?? NaN);
  const avgSalience = Number(parts[1] ?? NaN);
  const count = Number(parts[2] ?? NaN);

  if (!Number.isFinite(count) || count < minMemoryCount) {
    return { reconciled: false, reason: "insufficient_relational_memory", gapMs };
  }
  if (!Number.isFinite(avgEmotion) || avgEmotion < RECONCILE_MIN_AVG_EMOTION) {
    return { reconciled: false, reason: "low_emotion_score", gapMs };
  }

  // 计算衰减量和恢复量
  const decayIntervals = Math.floor(
    Math.max(0, gapMs - RELATIONSHIP_IDLE_GRACE_MS) / RELATIONSHIP_DECAY_INTERVAL_MS
  );
  const totalDecay = decayIntervals * RELATIONSHIP_DECAY_PER_IDLE_INTERVAL;
  const recoveryFraction = Math.min(RECONCILE_MAX_RECOVERY_FRACTION, avgEmotion * 0.7);
  const salienceBoost = Number.isFinite(avgSalience) ? Math.min(1.2, 0.8 + avgSalience * 0.4) : 1;
  const recoveryAmount = roundTo4(totalDecay * recoveryFraction * salienceBoost);

  if (recoveryAmount <= 0) {
    return { reconciled: false, reason: "no_decay_to_recover", gapMs };
  }

  // 直接写入恢复后的状态（绕过 ±0.02 增量约束，因为这是批量修正）
  const current = relationshipState.dimensions;
  const nextDimensions: RelationshipDimensions = {
    ...current,
    intimacy: clamp01(Math.min(RELATIONSHIP_SOFT_CEILING, current.intimacy + recoveryAmount)),
    trust: clamp01(Math.min(RELATIONSHIP_SOFT_CEILING, current.trust + recoveryAmount * 0.5))
  };
  const nextState = buildRelationshipState({
    dimensions: nextDimensions,
    arousalImprint: relationshipState.arousalImprint,
    drivers: appendDriver(relationshipState.drivers, {
      ts: new Date().toISOString(),
      source: "event",
      signal: `memory_reconcile:gap=${Math.round(gapMs / 3600000)}h,count=${count},emotion=${avgEmotion.toFixed(2)}`,
      deltaSummary: {
        intimacy: roundTo4(nextDimensions.intimacy - current.intimacy),
        trust: roundTo4(nextDimensions.trust - current.trust)
      }
    }),
    updatedAt: new Date().toISOString(),
    relationshipLatent: relationshipState.relationshipLatent
  });

  await writeRelationshipState(rootPath, nextState);

  const recoveryDelta = {
    intimacy: roundTo4(nextDimensions.intimacy - current.intimacy),
    trust: roundTo4(nextDimensions.trust - current.trust)
  };

  return { reconciled: true, reason: "memory_informed_restore", gapMs, recoveryDelta };
}

async function writeMigrationBackup(
  rootPath: string,
  details: { createdRelationshipState: boolean; createdVoiceProfile: boolean }
): Promise<void> {
  const ts = new Date().toISOString().replaceAll(":", "-");
  const backupDir = path.join(rootPath, "migration-backups", ts);
  await mkdir(backupDir, { recursive: true });

  const personaPath = path.join(rootPath, "persona.json");
  const constitutionPath = path.join(rootPath, "constitution.json");
  if (existsSync(personaPath)) {
    await copyFile(personaPath, path.join(backupDir, "persona.json.bak"));
  }
  if (existsSync(constitutionPath)) {
    await copyFile(constitutionPath, path.join(backupDir, "constitution.json.bak"));
  }

  const note = {
    migratedAt: new Date().toISOString(),
    details
  };
  await writeFile(path.join(backupDir, "migration-note.json"), `${JSON.stringify(note, null, 2)}\n`, "utf8");
}

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}
