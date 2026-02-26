import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  InvariantRule,
  InvariantCheckResult,
  StateDelta,
} from "./state_delta.js";

export interface InvariantTableConfig {
  version: string;
  updatedAt: string;
  rules: InvariantRule[];
}

const PERMISSIVE_DEFAULTS: InvariantRule[] = [];

let _cachedTable: InvariantRule[] | null = null;

export function loadInvariantTable(configDir?: string): InvariantRule[] {
  if (_cachedTable) return _cachedTable;

  const dir = configDir ?? join(process.cwd(), "config", "h0");
  const filePath = join(dir, "invariant_table.json");

  try {
    const raw = readFileSync(filePath, "utf-8");
    const config: InvariantTableConfig = JSON.parse(raw);
    _cachedTable = config.rules.filter((r) => r.enabled);
    return _cachedTable;
  } catch {
    _cachedTable = PERMISSIVE_DEFAULTS;
    return _cachedTable;
  }
}

export function resetInvariantTableCache(): void {
  _cachedTable = null;
}

export function checkDeltaInvariants(
  delta: StateDelta,
  rules: InvariantRule[]
): InvariantCheckResult[] {
  const applicable = rules.filter((r) => r.domain === delta.type);
  return applicable.map((rule) => checkRule(rule, delta));
}

export function checkAllInvariants(
  deltas: StateDelta[],
  rules: InvariantRule[]
): InvariantCheckResult[] {
  const results: InvariantCheckResult[] = [];
  for (const delta of deltas) {
    results.push(...checkDeltaInvariants(delta, rules));
  }
  return results;
}

export function getInvariantCoverage(rules: InvariantRule[]): Set<string> {
  return new Set(rules.map((r) => r.domain));
}

const REQUIRED_DOMAINS: string[] = [
  "relationship",
  "mood",
  "belief",
  "epigenetics",
];

export function checkInvariantCompleteness(
  rules: InvariantRule[]
): { complete: boolean; missingDomains: string[] } {
  const covered = getInvariantCoverage(rules);
  const missing = REQUIRED_DOMAINS.filter((d) => !covered.has(d));
  return { complete: missing.length === 0, missingDomains: missing };
}

function checkRule(rule: InvariantRule, delta: StateDelta): InvariantCheckResult {
  const actual = extractMetricValue(rule.metric, delta);
  const passed = compare(actual, rule.comparator, rule.threshold);
  const message = passed
    ? `${rule.id}: ${rule.metric} = ${actual} (${rule.comparator} ${rule.threshold}) ✓`
    : `${rule.id}: ${rule.metric} = ${actual} violates ${rule.comparator} ${rule.threshold}`;
  return { rule, actual, passed, message };
}

function extractMetricValue(metric: string, delta: StateDelta): number {
  if (metric === "max_abs_delta") {
    let maxAbs = 0;
    for (const val of Object.values(delta.patch)) {
      if (typeof val === "number") maxAbs = Math.max(maxAbs, Math.abs(val));
      if (typeof val === "string" && /^[+-]/.test(val)) {
        const n = parseFloat(val);
        if (!isNaN(n)) maxAbs = Math.max(maxAbs, Math.abs(n));
      }
    }
    return maxAbs;
  }

  if (metric === "confidence") return delta.confidence;
  if (metric === "evidence_count") return delta.supportingEventHashes.length;

  if (metric.startsWith("patch.")) {
    const key = metric.slice(6);
    const v = delta.patch[key];
    if (typeof v === "number") return v;
    if (typeof v === "string") return parseFloat(v) || 0;
    return 0;
  }

  return 0;
}

function compare(
  actual: number,
  comparator: InvariantRule["comparator"],
  threshold: number
): boolean {
  switch (comparator) {
    case "lte":
      return actual <= threshold;
    case "gte":
      return actual >= threshold;
    case "eq":
      return actual === threshold;
    case "lt":
      return actual < threshold;
    case "gt":
      return actual > threshold;
  }
}
