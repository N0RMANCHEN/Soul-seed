/**
 * Reproducible daily jitter for genome traits — H/P0-4
 *
 * Gives each persona a "today I feel slightly different" effect:
 *   - Low frequency: changes once per day
 *   - Inertial: smoothed with yesterday's value (no sudden jumps)
 *   - Reproducible: seed + date + trait → deterministic
 *   - Small: never exceeds ±0.02
 */

import { clamp } from "./genome.js";

const MAX_JITTER_AMPLITUDE = 0.02;
const INERTIA_WEIGHT = 0.7;

// ─── Mulberry32 PRNG ───────────────────────────────────────────────────────────
// Simple, fast, 32-bit seeded PRNG with good distribution properties.

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Hash combiners ────────────────────────────────────────────────────────────

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

function combineSeed(seed: number, date: string, trait: string): number {
  return (seed ^ hashString(date) ^ hashString(trait)) >>> 0;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a raw jitter value for a given seed+date+trait.
 * Returns a value in [-MAX_JITTER_AMPLITUDE, +MAX_JITTER_AMPLITUDE].
 * Fully deterministic: same inputs → same output.
 */
export function computeRawJitter(
  seed: number,
  date: string,
  trait: string
): number {
  const combined = combineSeed(seed, date, trait);
  const rng = mulberry32(combined);
  const raw = rng();
  return (raw * 2 - 1) * MAX_JITTER_AMPLITUDE;
}

/**
 * Compute inertial daily jitter: blends today's raw jitter with yesterday's
 * to prevent sudden day-to-day jumps.
 *
 * Formula: jitter = INERTIA_WEIGHT × yesterday + (1 - INERTIA_WEIGHT) × today_raw
 *
 * The `previousJitter` should be the result from yesterday's computeDailyJitter.
 * On the first day (no previous), pass 0.
 */
export function computeDailyJitter(
  seed: number,
  date: string,
  trait: string,
  previousJitter: number = 0
): number {
  const raw = computeRawJitter(seed, date, trait);
  const smoothed =
    INERTIA_WEIGHT * previousJitter + (1 - INERTIA_WEIGHT) * raw;
  return clamp(smoothed, -MAX_JITTER_AMPLITUDE, MAX_JITTER_AMPLITUDE);
}

/**
 * Compute jitter for a sequence of dates (for batch/testing).
 * Returns an array of jitter values, each smoothed from the previous.
 */
export function computeJitterSeries(
  seed: number,
  dates: string[],
  trait: string
): number[] {
  const result: number[] = [];
  let prev = 0;
  for (const date of dates) {
    const j = computeDailyJitter(seed, date, trait, prev);
    result.push(j);
    prev = j;
  }
  return result;
}

export { MAX_JITTER_AMPLITUDE, INERTIA_WEIGHT };
