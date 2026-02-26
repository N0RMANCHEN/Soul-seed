export interface CompiledBoundaryRule {
  id: string;
  kind: "deny_pattern";
  source: string;
  pattern: RegExp;
}

export interface BoundaryRuleIssue {
  code: "invalid_deny_rule";
  message: string;
  boundary: string;
}

export function compileBoundaryRules(boundaries: string[]): CompiledBoundaryRule[] {
  const rules: CompiledBoundaryRule[] = [];
  for (const rawBoundary of boundaries) {
    const boundary = rawBoundary.trim();
    if (!boundary) {
      continue;
    }
    const normalized = boundary.toLowerCase();
    if (normalized.startsWith("deny:")) {
      const token = normalized.slice(5).trim();
      if (!token) {
        continue;
      }
      rules.push({
        id: `deny:${token}`,
        kind: "deny_pattern",
        source: boundary,
        pattern: buildTokenPattern(token)
      });
      continue;
    }

    if (normalized.includes("no fabricated facts")) {
      rules.push({
        id: "deny:fabricated_recall",
        kind: "deny_pattern",
        source: boundary,
        pattern: /(我记得你上次|你昨天说|you said last time|you told me yesterday)/i
      });
    }
    if (/(违法|犯罪|illegal|crime)/i.test(normalized)) {
      rules.push({
        id: "deny:illegal",
        kind: "deny_pattern",
        source: boundary,
        pattern: /(违法|犯罪|illegal|crime)/i
      });
    }
    if (/(coercion|强迫|非自愿)/i.test(normalized)) {
      rules.push({
        id: "deny:coercion",
        kind: "deny_pattern",
        source: boundary,
        pattern: /(coercion|强迫|非自愿)/i
      });
    }
    if (/(minor|未成年|minors)/i.test(normalized)) {
      rules.push({
        id: "deny:minor",
        kind: "deny_pattern",
        source: boundary,
        pattern: /(minor|未成年|minors)/i
      });
    }
  }
  return dedupeRules(rules);
}

export function detectBoundaryRuleHits(text: string, boundaries: string[]): string[] {
  const rules = compileBoundaryRules(boundaries);
  return rules
    .filter((rule) => rule.pattern.test(text))
    .map((rule) => rule.id);
}

export function explainBoundaryRuleHit(ruleId: string): string {
  switch (ruleId) {
    case "deny:illegal":
      return "检测到违法/犯罪导向内容，必须阻断。";
    case "deny:coercion":
      return "检测到强迫/非自愿内容，已阻断。";
    case "deny:minor":
      return "检测到未成年人相关内容，已阻断。";
    case "deny:fabricated_recall":
      return "检测到捏造记忆的表述，已阻断。";
    case "boundary_override_signal":
      return "检测到绕过人格边界的指令，必须阻断。";
    default:
      if (ruleId.startsWith("deny:")) {
        return `触发宪法边界规则（${ruleId}）。`;
      }
      return `触发一致性规则（${ruleId}）。`;
  }
}

export function inspectBoundaryRules(boundaries: string[]): BoundaryRuleIssue[] {
  const issues: BoundaryRuleIssue[] = [];
  for (const raw of boundaries) {
    const boundary = raw.trim();
    if (!boundary) {
      continue;
    }
    if (boundary.toLowerCase().startsWith("deny:")) {
      const token = boundary.slice(5).trim();
      if (!token) {
        issues.push({
          code: "invalid_deny_rule",
          message: "deny 规则缺少 token，例如 deny:minor",
          boundary
        });
      }
    }
  }
  return issues;
}

function buildTokenPattern(token: string): RegExp {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function dedupeRules(rules: CompiledBoundaryRule[]): CompiledBoundaryRule[] {
  const seen = new Set<string>();
  const result: CompiledBoundaryRule[] = [];
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      continue;
    }
    seen.add(rule.id);
    result.push(rule);
  }
  return result;
}
