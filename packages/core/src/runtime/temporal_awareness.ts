export interface TemporalAnchor {
  nowIso: string;
  lastUserAtIso: string | null;
  silenceMinutes: number;
  silenceLabel: string;
  crossedDayBoundary: boolean;
}

export interface TemporalQualityIssue {
  code: "missing_time_awareness";
  message: string;
}

export function deriveTemporalAnchor(params: {
  nowMs?: number;
  lastUserAtMs?: number | null;
  lastAssistantAtMs?: number | null;
}): TemporalAnchor {
  const nowMs = Number.isFinite(params.nowMs) ? Number(params.nowMs) : Date.now();
  const lastUserAtMs = Number.isFinite(params.lastUserAtMs ?? NaN) ? Number(params.lastUserAtMs) : null;
  const lastAssistantAtMs = Number.isFinite(params.lastAssistantAtMs ?? NaN) ? Number(params.lastAssistantAtMs) : null;
  const reference = Math.max(lastUserAtMs ?? -Infinity, lastAssistantAtMs ?? -Infinity);
  const silenceMinutes = reference > 0 ? Math.max(0, Math.round((nowMs - reference) / 60000)) : 0;
  const silenceLabel =
    silenceMinutes < 60
      ? `${silenceMinutes}m`
      : silenceMinutes < 24 * 60
        ? `${Math.round(silenceMinutes / 60)}h`
        : `${Math.round(silenceMinutes / (24 * 60))}d`;
  const crossedDayBoundary = (() => {
    if (!lastUserAtMs || lastUserAtMs <= 0) return false;
    const a = new Date(lastUserAtMs);
    const b = new Date(nowMs);
    return a.getFullYear() !== b.getFullYear() || a.getMonth() !== b.getMonth() || a.getDate() !== b.getDate();
  })();

  return {
    nowIso: new Date(nowMs).toISOString(),
    lastUserAtIso: lastUserAtMs ? new Date(lastUserAtMs).toISOString() : null,
    silenceMinutes,
    silenceLabel,
    crossedDayBoundary
  };
}

/**
 * Regression helper for temporal understanding quality.
 * Detects replies that deny time awareness despite having explicit anchor.
 */
export function evaluateTemporalReplyQuality(
  reply: string,
  anchor: TemporalAnchor
): TemporalQualityIssue[] {
  const text = reply.trim().toLowerCase();
  if (!text) return [];

  const issues: TemporalQualityIssue[] = [];
  const hasTimeDenial =
    /(不知道|不清楚|分不清).{0,12}(多久|时间|刚才)/u.test(text) ||
    /没.{0,6}(看表|提醒)/u.test(text) ||
    /don't know.{0,20}(time|how long|just now)/i.test(text);

  // Only flag when anchor clearly provides a measurable gap.
  if (anchor.lastUserAtIso && anchor.silenceMinutes >= 5 && hasTimeDenial) {
    issues.push({
      code: "missing_time_awareness",
      message: `Anchor shows silence=${anchor.silenceMinutes}m (crossedDay=${anchor.crossedDayBoundary}) but reply denies temporal awareness`
    });
  }
  return issues;
}
