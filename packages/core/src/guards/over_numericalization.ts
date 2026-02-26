/**
 * H/P1-12 — Over-numericalization Guard
 *
 * Prevents raw numeric parameters (mood, trust, traits) from appearing
 * in user-facing output. Replies must stay natural-language dominant.
 * Archive §20.1.
 */

export interface OverNumericalizationConfig {
  schemaVersion?: string;
  mode?: "block" | "warn";
  patterns?: string[];
  maxExposuresPerResponse?: number;
  numericOverloadThreshold?: number;
}

const DEFAULT_PATTERNS = [
  /trust:\s*0\.\d+/i,
  /mood.*0\.\d+/i,
  /valence.*\d+\.?\d*/i,
  /arousal.*\d+\.?\d*/i,
  /emotion_sensitivity.*\d+\.?\d*/i,
  /memory_retention.*\d+\.?\d*/i,
  /attention_span.*\d+\.?\d*/i,
  /social_attunement.*\d+\.?\d*/i,
];

export interface ScanResult {
  pass: boolean;
  exposureCount: number;
  matchedPatterns: string[];
  mode: "block" | "warn";
}

/**
 * Scan response text for raw numeric parameter exposures.
 * Returns pass=false if exposure count exceeds maxExposuresPerResponse (default 2).
 */
export function scanForOverNumericalization(
  responseText: string,
  config?: OverNumericalizationConfig
): ScanResult {
  const mode = config?.mode ?? "warn";
  const maxExposures = config?.maxExposuresPerResponse ?? 2;
  const patternStrings = config?.patterns ?? [];
  const patterns = patternStrings.length > 0
    ? patternStrings.map((p) => new RegExp(p, "i"))
    : DEFAULT_PATTERNS;

  const matchedPatterns: string[] = [];
  for (const re of patterns) {
    const m = responseText.match(re);
    if (m) matchedPatterns.push(m[0]);
  }
  const exposureCount = matchedPatterns.length;
  const pass = exposureCount <= maxExposures;

  return {
    pass,
    exposureCount,
    matchedPatterns,
    mode,
  };
}
