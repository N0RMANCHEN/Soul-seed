/**
 * H/P1-6: Imperfection rules loader.
 * Loads imperfection_rules.json with IMP-01 through IMP-07.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface ImperfectionRule {
  id: string;
  type: string;
  description: string;
  trigger: Record<string, unknown>;
  expectedBehavior: string;
  signalKey: string;
  enabled: boolean;
  stub?: string;
}

export interface ImperfectionRulesConfig {
  version: string;
  updatedAt: string;
  rules: ImperfectionRule[];
}

let _cachedRules: ImperfectionRule[] | null = null;

/** Fallback when config file not found (e.g. tests run from packages/core) */
const DEFAULT_RULES: ImperfectionRule[] = [
  { id: "IMP-01", type: "uncertainty_expression", description: "Express uncertainty when evidence weak", trigger: {}, expectedBehavior: "hedge", signalKey: "hedge_language", enabled: true },
  { id: "IMP-02", type: "memory_gaps", description: "Acknowledge memory gaps", trigger: {}, expectedBehavior: "memory gap", signalKey: "memory_gap", enabled: true },
  { id: "IMP-03", type: "unnamed_emotion", description: "Mood drifts", trigger: {}, expectedBehavior: "unnamed", signalKey: "unnamed_emotion", enabled: true },
  { id: "IMP-04", type: "uncertain_attribution", description: "Uncertain attribution", trigger: {}, expectedBehavior: "maybe", signalKey: "uncertain_attribution", enabled: true },
  { id: "IMP-05", type: "relationship_cooling", description: "Relationship cooling", trigger: {}, expectedBehavior: "cooling", signalKey: "relationship_cooling", enabled: true },
  { id: "IMP-06", type: "detail_forgetting", description: "Detail forgetting", trigger: {}, expectedBehavior: "summaries", signalKey: "detail_forgetting", enabled: true },
  { id: "IMP-07", type: "evidence_requirement", description: "Evidence required", trigger: {}, expectedBehavior: "reject", signalKey: "evidence_required", enabled: true },
];

export function loadImperfectionRules(configDir?: string): ImperfectionRule[] {
  if (_cachedRules) return _cachedRules;

  const dir = configDir ?? join(process.cwd(), "config");
  const filePath = join(dir, "imperfection_rules.json");

  try {
    const raw = readFileSync(filePath, "utf-8");
    const config: ImperfectionRulesConfig = JSON.parse(raw);
    _cachedRules = config.rules.filter((r) => r.enabled);
    return _cachedRules;
  } catch {
    _cachedRules = DEFAULT_RULES;
    return _cachedRules;
  }
}

export function resetImperfectionRulesCache(): void {
  _cachedRules = null;
}
