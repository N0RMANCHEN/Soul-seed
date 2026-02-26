import { existsSync } from "node:fs";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const TEMPORAL_LANDMARKS_FILENAME = "temporal_landmarks.json";
export const TEMPORAL_LANDMARKS_SCHEMA_VERSION = "1.0";

export type TemporalLandmarkType =
  | "birthday"
  | "holiday"
  | "anniversary"
  | "milestone"
  | "custom";

export type TemporalCalendar = "gregorian" | "lunar";

export interface TemporalLandmarkEntry {
  id: string;
  title: string;
  /** For gregorian: YYYY-MM-DD; for lunar: MM-DD */
  date: string;
  calendar?: TemporalCalendar;
  /** Lunar-specific fields (calendar=lunar) */
  lunarMonth?: number;
  lunarDay?: number;
  lunarLeapMonth?: boolean;
  type: TemporalLandmarkType;
  personName?: string;
  recurringYearly: boolean;
  notes?: string;
  createdAt: string;
}

export interface TemporalLandmarks {
  schemaVersion: string;
  entries: TemporalLandmarkEntry[];
  updatedAt: string;
}

export interface UpcomingTemporalLandmark {
  entry: TemporalLandmarkEntry;
  occurrenceDate: string;
  daysFromNow: number;
}

export function createEmptyTemporalLandmarks(): TemporalLandmarks {
  return {
    schemaVersion: TEMPORAL_LANDMARKS_SCHEMA_VERSION,
    entries: [],
    updatedAt: new Date().toISOString()
  };
}

export async function loadTemporalLandmarks(rootPath: string): Promise<TemporalLandmarks> {
  const filePath = path.join(rootPath, TEMPORAL_LANDMARKS_FILENAME);
  if (!existsSync(filePath)) {
    return createEmptyTemporalLandmarks();
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<TemporalLandmarks>;
    return normalizeTemporalLandmarks(parsed);
  } catch {
    return createEmptyTemporalLandmarks();
  }
}

export async function saveTemporalLandmarks(rootPath: string, data: TemporalLandmarks): Promise<void> {
  const filePath = path.join(rootPath, TEMPORAL_LANDMARKS_FILENAME);
  const normalized = normalizeTemporalLandmarks(data);
  normalized.updatedAt = new Date().toISOString();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export async function listTemporalLandmarks(rootPath: string): Promise<TemporalLandmarkEntry[]> {
  const data = await loadTemporalLandmarks(rootPath);
  return data.entries;
}

export async function addTemporalLandmark(
  rootPath: string,
  params: {
    title: string;
    date?: string;
    calendar?: TemporalCalendar;
    lunarMonth?: number;
    lunarDay?: number;
    lunarLeapMonth?: boolean;
    type: TemporalLandmarkType;
    personName?: string;
    recurringYearly?: boolean;
    notes?: string;
  }
): Promise<TemporalLandmarkEntry> {
  const calendar: TemporalCalendar = params.calendar === "lunar" ? "lunar" : "gregorian";
  const data = await loadTemporalLandmarks(rootPath);
  const recurringDefault =
    params.type === "birthday" || params.type === "holiday" || params.type === "anniversary";
  const normalizedDate = resolveNormalizedDate(params, calendar);
  const lunarInfo =
    calendar === "lunar"
      ? {
          lunarMonth: params.lunarMonth!,
          lunarDay: params.lunarDay!,
          lunarLeapMonth: params.lunarLeapMonth === true
        }
      : {};
  const entry: TemporalLandmarkEntry = {
    id: `date_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: params.title.trim().slice(0, 100),
    date: normalizedDate,
    calendar,
    ...lunarInfo,
    type: params.type,
    ...(params.personName?.trim() ? { personName: params.personName.trim().slice(0, 60) } : {}),
    recurringYearly: params.recurringYearly ?? recurringDefault,
    ...(params.notes?.trim() ? { notes: params.notes.trim().slice(0, 240) } : {}),
    createdAt: new Date().toISOString()
  };
  data.entries.push(entry);
  await saveTemporalLandmarks(rootPath, data);
  return entry;
}

export async function removeTemporalLandmark(rootPath: string, id: string): Promise<boolean> {
  const data = await loadTemporalLandmarks(rootPath);
  const before = data.entries.length;
  data.entries = data.entries.filter((entry) => entry.id !== id);
  if (data.entries.length === before) {
    return false;
  }
  await saveTemporalLandmarks(rootPath, data);
  return true;
}

export async function listUpcomingTemporalLandmarks(
  rootPath: string,
  options?: { nowMs?: number; daysAhead?: number; maxItems?: number }
): Promise<UpcomingTemporalLandmark[]> {
  const data = await loadTemporalLandmarks(rootPath);
  return computeUpcomingTemporalLandmarks(data.entries, options);
}

export function computeUpcomingTemporalLandmarks(
  entries: TemporalLandmarkEntry[],
  options?: { nowMs?: number; daysAhead?: number; maxItems?: number }
): UpcomingTemporalLandmark[] {
  const nowMs = Number.isFinite(options?.nowMs) ? Number(options?.nowMs) : Date.now();
  const startDayMs = startOfDay(nowMs);
  const daysAhead = Number.isFinite(options?.daysAhead) ? Math.max(0, Number(options?.daysAhead)) : 60;
  const maxItems = Number.isFinite(options?.maxItems) ? Math.max(1, Number(options?.maxItems)) : 8;
  const endMs = startDayMs + daysAhead * 86400000;

  const upcoming: UpcomingTemporalLandmark[] = [];
  for (const entry of entries) {
    const occurrenceMs = computeNextOccurrenceMs(entry, startDayMs);
    if (occurrenceMs == null) continue;
    if (occurrenceMs < startDayMs || occurrenceMs > endMs) continue;
    const daysFromNow = Math.round((occurrenceMs - startDayMs) / 86400000);
    upcoming.push({
      entry,
      occurrenceDate: formatDateOnly(occurrenceMs),
      daysFromNow
    });
  }

  return upcoming
    .sort((a, b) => a.daysFromNow - b.daysFromNow || a.entry.title.localeCompare(b.entry.title))
    .slice(0, maxItems);
}

export function formatUpcomingTemporalLandmarksBlock(items: UpcomingTemporalLandmark[]): string {
  if (items.length === 0) return "";
  const lines = items.map((item) => {
    const when =
      item.daysFromNow === 0
        ? "今天"
        : item.daysFromNow === 1
          ? "明天"
          : `${item.daysFromNow}天后`;
    const who = item.entry.personName ? ` (${item.entry.personName})` : "";
    const calendarTag = item.entry.calendar === "lunar" ? " [农历]" : "";
    return `- ${item.entry.title}${who}${calendarTag}: ${item.occurrenceDate}（${when}）`;
  });
  return ["## Important Dates", ...lines].join("\n");
}

function normalizeTemporalLandmarks(raw: Partial<TemporalLandmarks>): TemporalLandmarks {
  return {
    schemaVersion:
      typeof raw.schemaVersion === "string" ? raw.schemaVersion : TEMPORAL_LANDMARKS_SCHEMA_VERSION,
    entries: Array.isArray(raw.entries) ? raw.entries.map(normalizeEntry).filter(Boolean) as TemporalLandmarkEntry[] : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeEntry(raw: unknown): TemporalLandmarkEntry | null {
  const r = (raw ?? {}) as Partial<TemporalLandmarkEntry>;
  if (typeof r.title !== "string" || typeof r.date !== "string") return null;
  const calendar: TemporalCalendar = r.calendar === "lunar" ? "lunar" : "gregorian";
  if (calendar === "gregorian" && !isIsoDateOnly(r.date)) return null;
  if (calendar === "lunar" && !isLunarDateOnly(r.date)) return null;
  const type = normalizeType(r.type);
  const lunarInfo =
    calendar === "lunar"
      ? {
          lunarMonth: clampLunarMonth(typeof r.lunarMonth === "number" ? r.lunarMonth : parseLunarDateOnly(r.date)?.month ?? 1),
          lunarDay: clampLunarDay(typeof r.lunarDay === "number" ? r.lunarDay : parseLunarDateOnly(r.date)?.day ?? 1),
          lunarLeapMonth: r.lunarLeapMonth === true
        }
      : {};
  return {
    id: typeof r.id === "string" ? r.id : `date_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: r.title.trim().slice(0, 100),
    date: r.date,
    calendar,
    ...lunarInfo,
    type,
    ...(typeof r.personName === "string" && r.personName.trim() ? { personName: r.personName.trim().slice(0, 60) } : {}),
    recurringYearly: typeof r.recurringYearly === "boolean" ? r.recurringYearly : type === "birthday" || type === "holiday" || type === "anniversary",
    ...(typeof r.notes === "string" && r.notes.trim() ? { notes: r.notes.trim().slice(0, 240) } : {}),
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString()
  };
}

function normalizeType(input: unknown): TemporalLandmarkType {
  const t = typeof input === "string" ? input : "";
  if (t === "birthday" || t === "holiday" || t === "anniversary" || t === "milestone" || t === "custom") {
    return t;
  }
  return "custom";
}

function isIsoDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms);
}

function isLunarDateOnly(value: string): boolean {
  return /^\d{2}-\d{2}$/.test(value);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function computeNextOccurrenceMs(entry: TemporalLandmarkEntry, startDayMs: number): number | null {
  if (entry.calendar === "lunar") {
    const month = clampLunarMonth(entry.lunarMonth ?? parseLunarDateOnly(entry.date)?.month ?? 1);
    const day = clampLunarDay(entry.lunarDay ?? parseLunarDateOnly(entry.date)?.day ?? 1);
    const leap = entry.lunarLeapMonth === true;
    return findNextGregorianDateForLunar(month, day, leap, startDayMs);
  }
  if (!entry.recurringYearly) {
    const ms = Date.parse(`${entry.date}T00:00:00.000Z`);
    return Number.isFinite(ms) ? ms : null;
  }
  const base = new Date(`${entry.date}T00:00:00.000Z`);
  if (!Number.isFinite(base.getTime())) return null;
  const month = base.getUTCMonth();
  const day = base.getUTCDate();
  const currentYear = new Date(startDayMs).getUTCFullYear();
  const thisYear = Date.UTC(currentYear, month, day);
  if (thisYear >= startDayMs) {
    return thisYear;
  }
  return Date.UTC(currentYear + 1, month, day);
}

function formatDateOnly(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function resolveNormalizedDate(
  params: {
    date?: string;
    lunarMonth?: number;
    lunarDay?: number;
    lunarLeapMonth?: boolean;
  },
  calendar: TemporalCalendar
): string {
  if (calendar === "gregorian") {
    if (!params.date || !isIsoDateOnly(params.date)) {
      throw new Error("date must be YYYY-MM-DD");
    }
    return params.date;
  }
  const lunarMonth = clampLunarMonth(params.lunarMonth ?? parseLunarDateOnly(params.date ?? "")?.month ?? NaN);
  const lunarDay = clampLunarDay(params.lunarDay ?? parseLunarDateOnly(params.date ?? "")?.day ?? NaN);
  if (!Number.isFinite(lunarMonth) || !Number.isFinite(lunarDay)) {
    throw new Error("lunar date must be MM-DD (e.g. 01-15) or provide lunarMonth/lunarDay");
  }
  return `${String(lunarMonth).padStart(2, "0")}-${String(lunarDay).padStart(2, "0")}`;
}

function parseLunarDateOnly(value: string): { month: number; day: number } | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!m) return null;
  return {
    month: clampLunarMonth(Number(m[1])),
    day: clampLunarDay(Number(m[2]))
  };
}

function clampLunarMonth(v: number): number {
  return Number.isFinite(v) ? Math.max(1, Math.min(12, Math.floor(v))) : NaN;
}

function clampLunarDay(v: number): number {
  return Number.isFinite(v) ? Math.max(1, Math.min(30, Math.floor(v))) : NaN;
}

function findNextGregorianDateForLunar(
  lunarMonth: number,
  lunarDay: number,
  lunarLeapMonth: boolean,
  startDayMs: number
): number | null {
  const oneDay = 86400000;
  for (let i = 0; i <= 800; i++) {
    const ms = startDayMs + i * oneDay;
    const lunar = extractLunarMonthDay(ms);
    if (!lunar) continue;
    if (lunar.month === lunarMonth && lunar.day === lunarDay && lunar.isLeapMonth === lunarLeapMonth) {
      return ms;
    }
  }
  return null;
}

function extractLunarMonthDay(ms: number): { month: number; day: number; isLeapMonth: boolean } | null {
  try {
    const parts = LUNAR_FORMATTER.formatToParts(new Date(ms));
    const monthRaw = parts.find((p) => p.type === "month")?.value ?? "";
    const dayRaw = parts.find((p) => p.type === "day")?.value ?? "";
    const isLeapMonth = monthRaw.startsWith("闰");
    const monthNum = parseLunarMonthValue(monthRaw.replace(/^闰/u, ""));
    const dayNum = Number(dayRaw);
    if (!Number.isFinite(monthNum) || !Number.isFinite(dayNum)) return null;
    return { month: monthNum, day: dayNum, isLeapMonth };
  } catch {
    return null;
  }
}

function parseLunarMonthValue(raw: string): number {
  const direct = Number(raw);
  if (Number.isFinite(direct)) return clampLunarMonth(direct);
  const map: Record<string, number> = {
    正月: 1,
    一月: 1,
    二月: 2,
    三月: 3,
    四月: 4,
    五月: 5,
    六月: 6,
    七月: 7,
    八月: 8,
    九月: 9,
    十月: 10,
    冬月: 11,
    十一月: 11,
    腊月: 12,
    十二月: 12
  };
  return clampLunarMonth(map[raw] ?? NaN);
}

const LUNAR_FORMATTER = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  month: "numeric",
  day: "numeric",
  timeZone: "UTC"
});
