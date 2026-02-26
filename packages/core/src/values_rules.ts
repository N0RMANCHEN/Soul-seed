import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PersonaConstitution } from "./types.js";

export const VALUES_RULES_FILENAME = "values_rules.json";
export const VALUES_RULES_SCHEMA_VERSION = "1.0";

export type ValuesRuleAction = "allow" | "clarify" | "rewrite" | "refuse";

export interface ValuesRule {
  id: string;
  value: string;
  pattern: string;
  action: ValuesRuleAction;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface ValuesRulesConfig {
  schemaVersion: string;
  updatedAt: string;
  rules: ValuesRule[];
}

export interface ValuesRuleMatch {
  rule: ValuesRule;
  matchedText: string;
}

function isoNow(): string {
  return new Date().toISOString();
}

export function createDefaultValuesRules(constitution?: PersonaConstitution): ValuesRulesConfig {
  const now = isoNow();
  const values = (constitution?.values ?? ["honesty", "helpfulness", "continuity"]).slice(0, 12);
  return {
    schemaVersion: VALUES_RULES_SCHEMA_VERSION,
    updatedAt: now,
    rules: values.map((value, index) => ({
      id: `vr_${index + 1}`,
      value,
      pattern: value,
      action: "clarify",
      priority: Math.max(1, 100 - index),
      enabled: true,
      createdAt: now,
    })),
  };
}

export async function loadValuesRules(
  rootPath: string,
  constitution?: PersonaConstitution,
): Promise<ValuesRulesConfig> {
  const filePath = path.join(rootPath, VALUES_RULES_FILENAME);
  if (!existsSync(filePath)) {
    return createDefaultValuesRules(constitution);
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ValuesRulesConfig>;
    return normalizeValuesRules(parsed, constitution);
  } catch {
    return createDefaultValuesRules(constitution);
  }
}

export async function saveValuesRules(rootPath: string, config: ValuesRulesConfig): Promise<void> {
  const filePath = path.join(rootPath, VALUES_RULES_FILENAME);
  const normalized = normalizeValuesRules(config);
  normalized.updatedAt = isoNow();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export function evaluateValuesRules(input: string, config: ValuesRulesConfig): ValuesRuleMatch[] {
  const text = input.trim();
  if (!text) return [];

  const matches: ValuesRuleMatch[] = [];
  for (const rule of config.rules) {
    if (!rule.enabled) continue;
    const pattern = rule.pattern.trim();
    if (!pattern) continue;
    const regex = new RegExp(escapeRegex(pattern), "i");
    const found = text.match(regex);
    if (!found) continue;
    matches.push({
      rule,
      matchedText: found[0],
    });
  }

  return matches.sort((a, b) => b.rule.priority - a.rule.priority);
}

function normalizeValuesRules(
  raw: Partial<ValuesRulesConfig> | undefined,
  constitution?: PersonaConstitution,
): ValuesRulesConfig {
  const fallback = createDefaultValuesRules(constitution);
  const rules = Array.isArray(raw?.rules)
    ? raw.rules
        .map((rule, index) => normalizeRule(rule, index))
        .filter((rule): rule is ValuesRule => rule !== null)
        .slice(0, 40)
    : fallback.rules;

  return {
    schemaVersion:
      typeof raw?.schemaVersion === "string" && raw.schemaVersion.trim().length > 0
        ? raw.schemaVersion
        : VALUES_RULES_SCHEMA_VERSION,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : isoNow(),
    rules: rules.length > 0 ? rules : fallback.rules,
  };
}

function normalizeRule(raw: unknown, index: number): ValuesRule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<ValuesRule>;
  const action =
    row.action === "allow" || row.action === "clarify" || row.action === "rewrite" || row.action === "refuse"
      ? row.action
      : "clarify";
  const value = typeof row.value === "string" ? row.value.trim() : "";
  const pattern = typeof row.pattern === "string" ? row.pattern.trim() : "";
  if (!value || !pattern) return null;

  return {
    id: typeof row.id === "string" && row.id.trim().length > 0 ? row.id : `vr_${index + 1}`,
    value: value.slice(0, 80),
    pattern: pattern.slice(0, 100),
    action,
    priority:
      typeof row.priority === "number" && Number.isFinite(row.priority) ? Math.max(1, Math.min(999, row.priority)) : 50,
    enabled: typeof row.enabled === "boolean" ? row.enabled : true,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : isoNow(),
  };
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
