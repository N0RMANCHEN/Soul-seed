export const DEFAULT_RENAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_RENAME_CONFIRM_WINDOW_MS = 10 * 60 * 1000;

export interface CooldownStatus {
  allowed: boolean;
  remainingMs: number;
}

export interface NameValidation {
  ok: boolean;
  reason?: string;
}

export function validateDisplayName(name: string): NameValidation {
  const value = name.trim();
  if (!value) {
    return { ok: false, reason: "名字不能为空" };
  }

  if (value.length < 1 || value.length > 32) {
    return { ok: false, reason: "名字长度必须在 1 到 32 之间" };
  }

  const allowed = /^[\u4e00-\u9fa5A-Za-z0-9_-]+$/u;
  if (!allowed.test(value)) {
    return { ok: false, reason: "名字只允许中英文、数字、下划线、连字符" };
  }

  return { ok: true };
}

export function getRenameCooldownStatus(
  lastRenameAppliedAt: string | null,
  now: number,
  cooldownMs: number = DEFAULT_RENAME_COOLDOWN_MS
): CooldownStatus {
  if (!lastRenameAppliedAt) {
    return { allowed: true, remainingMs: 0 };
  }

  const last = new Date(lastRenameAppliedAt).getTime();
  if (Number.isNaN(last)) {
    return { allowed: true, remainingMs: 0 };
  }

  const diff = now - last;
  if (diff >= cooldownMs) {
    return { allowed: true, remainingMs: 0 };
  }

  return { allowed: false, remainingMs: cooldownMs - diff };
}

export function isRenameRequestFresh(
  requestedAt: string,
  now: number,
  windowMs: number = DEFAULT_RENAME_CONFIRM_WINDOW_MS
): boolean {
  const requestTs = new Date(requestedAt).getTime();
  if (Number.isNaN(requestTs)) {
    return false;
  }

  return now - requestTs <= windowMs;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }

  const totalMinutes = Math.ceil(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) {
    return `${m}m`;
  }

  return `${h}h ${m}m`;
}
