/**
 * Hb-1-3 Layer 2: Emotion Episodes (fast, minutes).
 * Episode lifecycle: trigger → decay → archival.
 * "Not knowing why" is a feature — causeConfidence can be low.
 */
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { EmotionEpisode } from "../types.js";

export const EMOTION_EPISODES_FILENAME = "emotion_episodes.jsonl";
const EPISODE_DECAY_RATE_PER_MIN = 0.05;
const EPISODE_ARCHIVE_THRESHOLD = 0.1;
const MAX_ACTIVE_EPISODES = 5;

export function createEpisodeId(): string {
  return `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmotionEpisode(params: {
  trigger: string;
  label: string;
  intensity: number;
  causeText?: string;
  causeConfidence: number;
}): EmotionEpisode {
  const now = new Date().toISOString();
  return {
    episodeId: createEpisodeId(),
    at: now,
    trigger: params.trigger,
    label: params.label,
    intensity: Math.max(0, Math.min(1, params.intensity)),
    decay: EPISODE_DECAY_RATE_PER_MIN,
    causeText: params.causeText,
    causeConfidence: Math.max(0, Math.min(1, params.causeConfidence)),
  };
}

export async function loadActiveEpisodes(personaRoot: string): Promise<EmotionEpisode[]> {
  const path = join(personaRoot, EMOTION_EPISODES_FILENAME);
  if (!existsSync(path)) return [];

  const raw = await readFile(path, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const episodes: EmotionEpisode[] = [];
  for (const line of lines) {
    try {
      const ep = JSON.parse(line) as EmotionEpisode;
      if (!ep.archivedAt && ep.intensity > EPISODE_ARCHIVE_THRESHOLD) {
        episodes.push(ep);
      }
    } catch {
      /* skip malformed lines */
    }
  }
  return episodes.slice(-MAX_ACTIVE_EPISODES);
}

export async function appendEpisode(
  personaRoot: string,
  episode: EmotionEpisode
): Promise<void> {
  const path = join(personaRoot, EMOTION_EPISODES_FILENAME);
  const line = JSON.stringify(episode) + "\n";
  await appendFile(path, line, "utf-8");
}

/**
 * Decay episode intensity over time. Returns updated episode; if below threshold, marks archived.
 */
export function decayEpisode(
  episode: EmotionEpisode,
  minutesElapsed: number
): EmotionEpisode {
  const decayFactor = Math.exp(-episode.decay * minutesElapsed);
  const newIntensity = episode.intensity * decayFactor;
  if (newIntensity < EPISODE_ARCHIVE_THRESHOLD) {
    return { ...episode, intensity: newIntensity, archivedAt: new Date().toISOString() };
  }
  return { ...episode, intensity: newIntensity };
}

/**
 * Process episodes: decay active ones, archive expired, persist updates.
 */
export async function processEpisodeDecay(personaRoot: string): Promise<EmotionEpisode[]> {
  const path = join(personaRoot, EMOTION_EPISODES_FILENAME);
  if (!existsSync(path)) return [];

  const raw = await readFile(path, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);
  const now = Date.now();
  const updated: EmotionEpisode[] = [];
  const toWrite: string[] = [];

  for (const line of lines) {
    try {
      const ep = JSON.parse(line) as EmotionEpisode;
      if (ep.archivedAt) {
        toWrite.push(line.trim());
        continue;
      }
      const atMs = new Date(ep.at).getTime();
      const minutesElapsed = (now - atMs) / 60_000;
      const decayed = decayEpisode(ep, minutesElapsed);
      toWrite.push(JSON.stringify(decayed));
      if (!decayed.archivedAt && decayed.intensity > EPISODE_ARCHIVE_THRESHOLD) {
        updated.push(decayed);
      }
    } catch {
      /* skip */
    }
  }

  if (toWrite.length > 0) {
    await writeFile(path, toWrite.join("\n") + "\n", "utf-8");
  }
  return updated.slice(-MAX_ACTIVE_EPISODES);
}

/**
 * Cue Extraction integration: create episode from Stage1 cue.
 * Call when semantic/cue extraction detects an emotion trigger.
 */
export async function triggerEpisodeFromCue(
  personaRoot: string,
  cue: { trigger: string; label: string; intensity?: number; causeText?: string; causeConfidence?: number }
): Promise<EmotionEpisode> {
  const episode = createEmotionEpisode({
    trigger: cue.trigger,
    label: cue.label,
    intensity: cue.intensity ?? 0.5,
    causeText: cue.causeText,
    causeConfidence: cue.causeConfidence ?? 0.5,
  });
  await appendEpisode(personaRoot, episode);
  return episode;
}

/**
 * Get the most active (highest intensity) episode for context injection.
 */
export function getActiveEpisode(episodes: EmotionEpisode[]): EmotionEpisode | null {
  if (episodes.length === 0) return null;
  return episodes.reduce((a, b) => (a.intensity >= b.intensity ? a : b));
}
