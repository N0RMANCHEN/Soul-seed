/**
 * FA-1: 跨维度 Latent 联动
 *
 * Applies soft cross-influence between the four latent state vectors:
 * moodLatent, relationshipLatent, voiceLatent, beliefLatent.
 *
 * Influence rules (all coefficients are small to prevent over-coupling):
 * - moodLatent[0] (valence) HIGH → voiceLatent[1] (tone warmth) slight increase
 * - moodLatent[1] (arousal) HIGH → voiceLatent[0] (stance intensity) slight increase
 * - relationshipLatent[2] (intimacy) HIGH → voiceLatent[0] (stance) slight increase
 * - moodLatent[0] (valence) SUSTAINED LOW → beliefLatent[0] (epistemic confidence) slight decrease
 *
 * All influence is bounded by MAX_CROSS_INFLUENCE_PER_CALL to prevent runaway drift.
 */

import { VOICE_LATENT_DIM, BELIEF_LATENT_DIM } from "./expression_belief_state.js";
import { RELATIONSHIP_LATENT_DIM } from "./relationship_state.js";
import { MOOD_LATENT_DIM } from "./mood_state.js";

/** Maximum change any single cross-influence call can apply per dimension */
const MAX_CROSS_INFLUENCE_PER_CALL = 0.03;
/** Coupling coefficients for each influence pathway */
const VALENCE_TO_TONE_COEFF = 0.04;
const AROUSAL_TO_STANCE_COEFF = 0.035;
const INTIMACY_TO_STANCE_COEFF = 0.04;
const LOW_VALENCE_TO_EPISTEMIC_COEFF = 0.025;
/** Threshold below which valence is considered "low" */
const LOW_VALENCE_THRESHOLD = 0.3;

export interface LatentCrossInfluenceInput {
  moodLatent: number[];
  relationshipLatent: number[];
  voiceLatent: number[];
  beliefLatent: number[];
}

export interface LatentCrossInfluenceResult {
  voiceLatent: number[];
  beliefLatent: number[];
  appliedInfluences: string[];
}

/**
 * FA-1: Apply cross-dimensional influence between latent vectors.
 * Returns updated voiceLatent and beliefLatent (moodLatent and relationshipLatent are read-only inputs).
 */
export function applyLatentCrossInfluence(
  params: LatentCrossInfluenceInput
): LatentCrossInfluenceResult {
  const { moodLatent, relationshipLatent } = params;
  const voiceLatent = [...params.voiceLatent];
  const beliefLatent = [...params.beliefLatent];
  const appliedInfluences: string[] = [];

  // Validate input dimensions
  if (
    moodLatent.length !== MOOD_LATENT_DIM ||
    relationshipLatent.length !== RELATIONSHIP_LATENT_DIM ||
    voiceLatent.length !== VOICE_LATENT_DIM ||
    beliefLatent.length !== BELIEF_LATENT_DIM
  ) {
    return { voiceLatent: params.voiceLatent, beliefLatent: params.beliefLatent, appliedInfluences: ["skipped_invalid_dims"] };
  }

  const valence = clamp01(moodLatent[0]);
  const arousal = clamp01(moodLatent[1]);
  const intimacy = clamp01(relationshipLatent[2]);

  // 1. moodLatent[0] (valence) HIGH → voiceLatent[1] (tone warmth) slight increase
  if (valence > 0.5) {
    const influence = Math.min(MAX_CROSS_INFLUENCE_PER_CALL, (valence - 0.5) * VALENCE_TO_TONE_COEFF);
    voiceLatent[1] = clamp01(voiceLatent[1] + influence);
    appliedInfluences.push("valence→tone_warmth");
  }

  // 2. moodLatent[1] (arousal) HIGH → voiceLatent[0] (stance intensity) slight increase
  if (arousal > 0.5) {
    const influence = Math.min(MAX_CROSS_INFLUENCE_PER_CALL, (arousal - 0.5) * AROUSAL_TO_STANCE_COEFF);
    voiceLatent[0] = clamp01(voiceLatent[0] + influence);
    appliedInfluences.push("arousal→stance_intensity");
  }

  // 3. relationshipLatent[2] (intimacy) HIGH → voiceLatent[0] (stance) slight increase
  if (intimacy > 0.5) {
    const influence = Math.min(MAX_CROSS_INFLUENCE_PER_CALL, (intimacy - 0.5) * INTIMACY_TO_STANCE_COEFF);
    voiceLatent[0] = clamp01(voiceLatent[0] + influence);
    appliedInfluences.push("intimacy→stance_intensity");
  }

  // 4. moodLatent[0] (valence) SUSTAINED LOW → beliefLatent[0] (epistemic confidence) slight decrease
  if (valence < LOW_VALENCE_THRESHOLD) {
    const influence = Math.min(MAX_CROSS_INFLUENCE_PER_CALL, (LOW_VALENCE_THRESHOLD - valence) * LOW_VALENCE_TO_EPISTEMIC_COEFF);
    beliefLatent[0] = clamp01(beliefLatent[0] - influence);
    appliedInfluences.push("low_valence→epistemic_confidence_down");
  }

  return { voiceLatent, beliefLatent, appliedInfluences };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
