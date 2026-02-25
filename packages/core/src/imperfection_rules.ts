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
    _cachedRules = [];
    return _cachedRules;
  }
}

export function resetImperfectionRulesCache(): void {
  _cachedRules = null;
}
