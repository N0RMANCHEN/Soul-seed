import type { TemporalAnchor } from "./temporal_awareness.js";

export interface TemporalPhraseGuardResult {
  text: string;
  corrected: boolean;
  flags: string[];
}

export function enforceTemporalPhraseGuard(
  text: string,
  options: { anchor: TemporalAnchor }
): TemporalPhraseGuardResult {
  const original = text;
  let next = text;
  const flags: string[] = [];
  const anchor = options.anchor;

  if (!next.trim() || !anchor.lastUserAtIso) {
    return { text: original, corrected: false, flags: [] };
  }

  if (shouldDownscopeImmediate(anchor)) {
    const replacement = chooseEarlierWord(anchor);
    const zhImmediateHits = countHits(next, IMMEDIATE_ZH);
    const enImmediateHits = countHits(next, IMMEDIATE_EN);
    if (zhImmediateHits > 0) {
      next = replaceAllPhrases(next, IMMEDIATE_ZH, replacement.zh);
      flags.push("immediate_word_downscoped");
    }
    if (enImmediateHits > 0) {
      next = replaceAllPhrases(next, IMMEDIATE_EN, replacement.en);
      if (!flags.includes("immediate_word_downscoped")) {
        flags.push("immediate_word_downscoped");
      }
    }
  }

  if (shouldDownscopeDistant(anchor)) {
    const replacement = chooseNotTooDistantWord(anchor);
    const zhDistantHits = countHits(next, DISTANT_ZH);
    const enDistantHits = countHits(next, DISTANT_EN);
    if (zhDistantHits > 0) {
      next = replaceAllPhrases(next, DISTANT_ZH, replacement.zh);
      flags.push("distant_word_downscoped");
    }
    if (enDistantHits > 0) {
      next = replaceAllPhrases(next, DISTANT_EN, replacement.en);
      if (!flags.includes("distant_word_downscoped")) {
        flags.push("distant_word_downscoped");
      }
    }
  }

  const elapsedZh = formatElapsedZh(anchor.silenceMinutes);
  const hardTimeDenialMap: Array<{ from: string; to: string }> = [
    {
      from: "你刚才没让我看表",
      to: `按时间看，距离你上一次发言大约${elapsedZh}。`
    },
    {
      from: "你之前没让我看表",
      to: `按时间看，距离你上一次发言大约${elapsedZh}。`
    },
    {
      from: "我不知道时间",
      to: `我能按时间锚判断间隔：距离你上一次发言大约${elapsedZh}。`
    },
    {
      from: "我不清楚时间",
      to: `我能按时间锚判断间隔：距离你上一次发言大约${elapsedZh}。`
    }
  ];
  let denialFixed = false;
  for (const item of hardTimeDenialMap) {
    if (next.includes(item.from)) {
      next = replaceAllLiteral(next, item.from, item.to);
      denialFixed = true;
    }
  }
  if (denialFixed) {
    flags.push("time_denial_rewritten");
  }

  return {
    text: next,
    corrected: next !== original,
    flags
  };
}

const IMMEDIATE_ZH: readonly string[] = ["刚才", "刚刚", "方才", "刚刚才"];
const IMMEDIATE_EN: readonly string[] = ["just now", "a moment ago", "moments ago"];

const DISTANT_ZH: readonly string[] = ["很久之前", "很久以前", "老早之前", "很早之前", "很早以前"];
const DISTANT_EN: readonly string[] = ["a long time ago", "long ago", "way earlier"];

function shouldDownscopeImmediate(anchor: TemporalAnchor): boolean {
  if (!anchor.lastUserAtIso) return false;
  return anchor.silenceMinutes >= 25 || anchor.crossedDayBoundary;
}

function shouldDownscopeDistant(anchor: TemporalAnchor): boolean {
  if (!anchor.lastUserAtIso) return false;
  return anchor.silenceMinutes <= 360;
}

function chooseEarlierWord(anchor: TemporalAnchor): { zh: string; en: string } {
  if (anchor.crossedDayBoundary && anchor.silenceMinutes >= 6 * 60 && anchor.silenceMinutes < 30 * 60) {
    return { zh: "昨晚", en: "last night" };
  }
  if (anchor.crossedDayBoundary && anchor.silenceMinutes >= 30 * 60 && anchor.silenceMinutes < 60 * 60) {
    return { zh: "昨天", en: "yesterday" };
  }
  if (anchor.silenceMinutes >= 60 * 60) {
    return { zh: "前几天", en: "a few days ago" };
  }
  return { zh: "之前", en: "earlier" };
}

function chooseNotTooDistantWord(anchor: TemporalAnchor): { zh: string; en: string } {
  if (anchor.silenceMinutes <= 3) {
    return { zh: "刚刚", en: "just now" };
  }
  if (anchor.silenceMinutes <= 30) {
    return { zh: "刚才", en: "just now" };
  }
  if (anchor.silenceMinutes <= 6 * 60) {
    return { zh: "之前", en: "earlier" };
  }
  if (anchor.crossedDayBoundary) {
    return { zh: "昨天", en: "yesterday" };
  }
  return { zh: "之前", en: "earlier" };
}

function formatElapsedZh(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))}分钟`;
  }
  if (minutes < 24 * 60) {
    return `${Math.max(1, Math.round(minutes / 60))}小时`;
  }
  return `${Math.max(1, Math.round(minutes / (24 * 60)))}天`;
}

function countHits(text: string, phrases: readonly string[]): number {
  let total = 0;
  for (const phrase of phrases) {
    if (!phrase) continue;
    if (text.includes(phrase)) total += 1;
  }
  return total;
}

function replaceAllPhrases(text: string, phrases: readonly string[], replacement: string): string {
  let next = text;
  for (const phrase of phrases) {
    next = replaceAllLiteral(next, phrase, replacement);
  }
  return next;
}

function replaceAllLiteral(text: string, from: string, to: string): string {
  if (!from || from === to || !text.includes(from)) {
    return text;
  }
  return text.split(from).join(to);
}
