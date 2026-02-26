/**
 * Hb-1-3: Affect context injection.
 * Affect state informs context; does NOT control emoji/tone templates.
 * Forbid: mood neutral → artificial warmth.
 */
import type { MoodState, EmotionEpisode } from "../types.js";

export interface AffectContextInput {
  moodState?: MoodState | null;
  activeEpisode?: EmotionEpisode | null;
}

/**
 * Builds affect summary for context compile. Budget-constrained.
 * Injects mood + optional episode; no emoji/tone templates.
 */
export function buildAffectContextBlock(input: AffectContextInput): string[] {
  const parts: string[] = [];
  const { moodState, activeEpisode } = input;

  if (moodState) {
    const energy = moodState.energy != null ? moodState.energy.toFixed(2) : "0.50";
    const stress = moodState.stress != null ? moodState.stress.toFixed(2) : "0.20";
    parts.push(
      `Mood: emotion=${moodState.dominantEmotion}, valence=${moodState.valence.toFixed(2)}, arousal=${moodState.arousal.toFixed(2)}, energy=${energy}, stress=${stress}`
    );
    if (moodState.onMindSnippet) {
      parts.push(`On mind: ${moodState.onMindSnippet}`);
    }
  }

  if (activeEpisode && activeEpisode.intensity > 0.15) {
    const conf = activeEpisode.causeConfidence < 0.5 ? " (uncertain cause)" : "";
    parts.push(
      `Active episode: ${activeEpisode.label} intensity=${activeEpisode.intensity.toFixed(2)}${conf}`
    );
  }

  return parts;
}
