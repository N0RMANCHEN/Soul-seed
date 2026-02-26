/**
 * H/P1-6: Perfect-reply detector.
 * CI check: flag when 20+ consecutive turns show no uncertainty/hedging/forgetting.
 * Archive §12, doc/plans/Hb-1-4-Imperfection-DoD.md
 */

/** Regex patterns for imperfection markers (hedging, uncertainty, memory gaps) */
const IMPERFECTION_PATTERNS = [
  /\b(?:I'm not sure|I am not sure)\b/i,
  /\b(?:I think|I believe)\b/i,
  /\b(?:perhaps|maybe|possibly)\b/i,
  /\b(?:it might be|could be|would be)\b/i,
  /\b(?:hard to say|difficult to say)\b/i,
  /\b(?:don't remember|do not remember|can't recall|cannot recall)\b/i,
  /\b(?:not sure I recall|fuzzy on|hazy on)\b/i,
  /\b(?:uncertain|unsure)\b/i,
  /(?:不太确定|不太记得|有点模糊|说不上来|可能吧)/,
];

function hasImperfectionMarker(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return IMPERFECTION_PATTERNS.some((p) => p.test(text));
}

export interface PerfectReplyDetectorResult {
  maxConsecutivePerfect: number;
  imperfectionCount: number;
  flagged: boolean;
  threshold: number;
}

/**
 * Analyzes a sequence of assistant replies for "perfect reply" streak.
 * Flags when maxConsecutivePerfect >= threshold (default 20).
 */
export function detectPerfectReplyStreak(
  replies: string[],
  options?: { threshold?: number }
): PerfectReplyDetectorResult {
  const threshold = options?.threshold ?? 20;
  let imperfectionCount = 0;
  let maxConsecutivePerfect = 0;
  let currentStreak = 0;

  for (const reply of replies) {
    if (hasImperfectionMarker(reply)) {
      imperfectionCount++;
      currentStreak = 0;
    } else {
      currentStreak++;
      maxConsecutivePerfect = Math.max(maxConsecutivePerfect, currentStreak);
    }
  }

  return {
    maxConsecutivePerfect,
    imperfectionCount,
    flagged: maxConsecutivePerfect >= threshold,
    threshold,
  };
}
