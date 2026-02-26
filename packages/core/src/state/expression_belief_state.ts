/**
 * EB-6: 表达意图与信念向量化
 *
 * voiceLatent (16-dim): continuous representation of expression intent.
 * beliefLatent (32-dim): continuous representation of belief/judgment state.
 *
 * Existing enums (VoiceIntent stance/tone, epistemicStance, PersonaJudgmentLabel,
 * humorStyle, conflictBehavior) become projections from these latent vectors,
 * used for system prompt injection and cross-version compatibility.
 */

export const VOICE_LATENT_DIM = 16;
export const BELIEF_LATENT_DIM = 32;

/** Projection output from voiceLatent */
export interface VoiceLatentProjection {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  /** Natural language description of expression style (more semantic than discrete enum) */
  expressionStyle: string;
}

/** Projection output from beliefLatent */
export interface BeliefLatentProjection {
  epistemicStance: "balanced" | "cautious" | "assertive";
  humorStyle: "dry" | "warm" | "playful" | "subtle" | null;
  conflictBehavior: "assertive" | "deflect" | "redirect" | "hold-ground" | null;
  /** Natural language description of belief posture */
  beliefPosture: string;
}

// ── Voice Latent ─────────────────────────────────────────────────────────────

/**
 * Dimension layout for voiceLatent:
 * [0] stance intensity: 0=neutral → 0.33=friend → 0.66=peer → 1=intimate
 * [1] tone warmth: 0=plain → 0.33=reflective → 0.66=warm → 1=direct
 * [2] service mode signal: 0=off, 1=on (should always be near 0 for self-determined)
 * [3-15] higher-order expression features (initialized to 0)
 */
export function createVoiceLatentBaseline(): number[] {
  const z = new Array<number>(VOICE_LATENT_DIM).fill(0.0);
  z[0] = 0.33; // friend-level stance by default
  z[1] = 0.33; // reflective tone by default
  z[2] = 0.0;  // service mode off
  return z;
}

export function projectVoiceLatent(z: number[]): VoiceLatentProjection {
  if (z.length < 3) {
    return { stance: "neutral", tone: "plain", expressionStyle: "neutral, plain tone" };
  }

  const stanceVal = clamp01(z[0]);
  const stance: VoiceLatentProjection["stance"] =
    stanceVal >= 0.75 ? "intimate" :
    stanceVal >= 0.5  ? "peer"     :
    stanceVal >= 0.2  ? "friend"   : "neutral";

  const toneVal = clamp01(z[1]);
  const tone: VoiceLatentProjection["tone"] =
    toneVal >= 0.75 ? "direct"     :
    toneVal >= 0.5  ? "warm"       :
    toneVal >= 0.25 ? "reflective" : "plain";

  // Generate a natural language description that's richer than just the enum values
  const stanceDesc = stance === "intimate" ? "deeply intimate"
    : stance === "peer" ? "collegial and equal"
    : stance === "friend" ? "warm and friendly"
    : "neutral and measured";
  const toneDesc = tone === "direct" ? "direct and candid"
    : tone === "warm" ? "warm and emotionally present"
    : tone === "reflective" ? "thoughtful and reflective"
    : "clear and plain";

  return {
    stance,
    tone,
    expressionStyle: `${stanceDesc}, ${toneDesc}`
  };
}

export function updateVoiceLatent(
  z: number[],
  delta: { stanceDelta?: number; toneDelta?: number },
  alpha = 0.12
): number[] {
  if (z.length < VOICE_LATENT_DIM) return z;
  const next = [...z];
  if (typeof delta.stanceDelta === "number" && Number.isFinite(delta.stanceDelta)) {
    next[0] = clamp01(next[0] + alpha * delta.stanceDelta);
  }
  if (typeof delta.toneDelta === "number" && Number.isFinite(delta.toneDelta)) {
    next[1] = clamp01(next[1] + alpha * delta.toneDelta);
  }
  return next;
}

export function isVoiceLatentValid(z: unknown): z is number[] {
  return (
    Array.isArray(z) &&
    z.length === VOICE_LATENT_DIM &&
    (z as unknown[]).every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

// ── Belief Latent ─────────────────────────────────────────────────────────────

/**
 * Dimension layout for beliefLatent:
 * [0] epistemic confidence: 0=cautious → 0.5=balanced → 1=assertive
 * [1] humor expressiveness: 0=none → 0.25=dry → 0.5=subtle → 0.75=warm → 1=playful
 * [2] conflict directness: 0=deflect → 0.33=redirect → 0.66=assertive → 1=hold-ground
 * [3] judgment confidence: 0=uncertain → 1=highly confident
 * [4-31] higher-order belief features (initialized to 0)
 */
export function createBeliefLatentBaseline(): number[] {
  const z = new Array<number>(BELIEF_LATENT_DIM).fill(0.0);
  z[0] = 0.5;  // balanced epistemic stance
  z[1] = 0.5;  // moderate humor (subtle/warm range)
  z[2] = 0.33; // redirect conflict style
  z[3] = 0.6;  // moderate judgment confidence
  return z;
}

export function projectBeliefLatent(z: number[]): BeliefLatentProjection {
  if (z.length < 4) {
    return {
      epistemicStance: "balanced",
      humorStyle: null,
      conflictBehavior: null,
      beliefPosture: "balanced and open"
    };
  }

  const epistemic = clamp01(z[0]);
  const epistemicStance: BeliefLatentProjection["epistemicStance"] =
    epistemic >= 0.7 ? "assertive" :
    epistemic >= 0.3 ? "balanced"  : "cautious";

  const humorVal = clamp01(z[1]);
  const humorStyle: BeliefLatentProjection["humorStyle"] =
    humorVal < 0.1  ? null     :
    humorVal < 0.35 ? "dry"    :
    humorVal < 0.6  ? "subtle" :
    humorVal < 0.8  ? "warm"   : "playful";

  const conflictVal = clamp01(z[2]);
  const conflictBehavior: BeliefLatentProjection["conflictBehavior"] =
    conflictVal < 0.2  ? "deflect"    :
    conflictVal < 0.5  ? "redirect"   :
    conflictVal < 0.75 ? "assertive"  : "hold-ground";

  // Natural language belief posture
  const epistemicDesc = epistemicStance === "assertive" ? "confident and clear in beliefs"
    : epistemicStance === "cautious" ? "careful and provisional"
    : "open and balanced";

  return {
    epistemicStance,
    humorStyle,
    conflictBehavior,
    beliefPosture: epistemicDesc
  };
}

export function updateBeliefLatent(
  z: number[],
  delta: { epistemicDelta?: number; humorDelta?: number; conflictDelta?: number },
  alpha = 0.12
): number[] {
  if (z.length < BELIEF_LATENT_DIM) return z;
  const next = [...z];
  if (typeof delta.epistemicDelta === "number" && Number.isFinite(delta.epistemicDelta)) {
    next[0] = clamp01(next[0] + alpha * delta.epistemicDelta);
  }
  if (typeof delta.humorDelta === "number" && Number.isFinite(delta.humorDelta)) {
    next[1] = clamp01(next[1] + alpha * delta.humorDelta);
  }
  if (typeof delta.conflictDelta === "number" && Number.isFinite(delta.conflictDelta)) {
    next[2] = clamp01(next[2] + alpha * delta.conflictDelta);
  }
  return next;
}

export function isBeliefLatentValid(z: unknown): z is number[] {
  return (
    Array.isArray(z) &&
    z.length === BELIEF_LATENT_DIM &&
    (z as unknown[]).every((v) => typeof v === "number" && Number.isFinite(v))
  );
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
