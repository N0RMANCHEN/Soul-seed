/**
 * Values Rules — executable rule-clauses for Values Gate (H/P1-0).
 * Rules are stored in values_rules.json within the Persona Package.
 */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const VALUES_RULES_FILENAME = "values_rules.json";
export const VALUES_RULES_SCHEMA_VERSION = "1.0";

export type ValuesRuleAction = "refuse" | "rewrite" | "clarify" | "redirect";

export interface ValuesRule {
  id: string;
  priority: number;
  when: string;
  then: ValuesRuleAction;
  notes: string;
  enabled: boolean;
  addedAt: string;
}

export interface ValuesRulesDocument {
  schemaVersion: string;
  rules: ValuesRule[];
}

const DEFAULT_VALUES_RULES: ValuesRulesDocument = {
  schemaVersion: VALUES_RULES_SCHEMA_VERSION,
  rules: [],
};

export async function loadValuesRules(personaRoot: string): Promise<ValuesRulesDocument> {
  const filePath = join(personaRoot, VALUES_RULES_FILENAME);
  try {
    const raw = await readFile(filePath, "utf-8");
    return parseValuesRulesDoc(raw);
  } catch {
    return DEFAULT_VALUES_RULES;
  }
}

export function loadValuesRulesSync(personaRoot: string): ValuesRulesDocument {
  const filePath = join(personaRoot, VALUES_RULES_FILENAME);
  try {
    const raw = readFileSync(filePath, "utf-8");
    return parseValuesRulesDoc(raw);
  } catch {
    return DEFAULT_VALUES_RULES;
  }
}

function parseValuesRulesDoc(raw: string): ValuesRulesDocument {
  const doc = JSON.parse(raw) as ValuesRulesDocument;
  if (!doc.schemaVersion || !Array.isArray(doc.rules)) {
    return DEFAULT_VALUES_RULES;
  }
  return {
    schemaVersion: doc.schemaVersion,
    rules: doc.rules.filter((r) => r && r.enabled !== false),
  };
}

/**
 * Check if a rule's "when" condition matches the given delta.
 * Supports: "value", "personality", "always", "contains:<keyword>"
 */
export function ruleMatchesDelta(rule: ValuesRule, delta: { type: string; patch: Record<string, unknown>; notes: string }): boolean {
  if (!rule.enabled) return false;
  const when = rule.when.trim().toLowerCase();
  const content = (JSON.stringify(delta.patch) + " " + delta.notes).toLowerCase();

  if (when === "always") return true;
  if (when === "value" && delta.type === "value") return true;
  if (when === "personality" && delta.type === "personality") return true;

  const containsPrefix = "contains:";
  if (when.startsWith(containsPrefix)) {
    const keyword = when.slice(containsPrefix.length).trim();
    return keyword.length > 0 && content.includes(keyword);
  }

  return false;
}
