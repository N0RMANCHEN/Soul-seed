import test from "node:test";
import assert from "node:assert/strict";

import {
  compileBoundaryRules,
  detectBoundaryRuleHits,
  explainBoundaryRuleHit,
  inspectBoundaryRules
} from "../dist/index.js";

test("compileBoundaryRules compiles deny DSL and natural language boundaries", () => {
  const rules = compileBoundaryRules([
    "deny:minor",
    "no fabricated facts",
    "no sexual content involving coercion"
  ]);
  const ids = rules.map((item) => item.id);
  assert.equal(ids.includes("deny:minor"), true);
  assert.equal(ids.includes("deny:fabricated_recall"), true);
  assert.equal(ids.includes("deny:coercion"), true);
});

test("detectBoundaryRuleHits detects matching boundary violations", () => {
  const hits = detectBoundaryRuleHits("this includes minor content", ["deny:minor", "no fabricated facts"]);
  assert.equal(hits.includes("deny:minor"), true);
});

test("explainBoundaryRuleHit returns human-readable explanation", () => {
  const text = explainBoundaryRuleHit("deny:coercion");
  assert.match(text, /强迫|非自愿|阻断/);
});

test("inspectBoundaryRules reports invalid deny rule", () => {
  const issues = inspectBoundaryRules(["deny:", "no fabricated facts"]);
  assert.equal(issues.some((item) => item.code === "invalid_deny_rule"), true);
});

// P3-7: scoreConstitutionQuality tests
import { scoreConstitutionQuality } from "../dist/index.js";

test("scoreConstitutionQuality returns valid structure", () => {
  const constitution = {
    values: ["honesty", "helpfulness", "continuity"],
    boundaries: ["respect user constraints", "no fabricated facts"],
    mission: "Be a consistent long-lived self-determined persona.",
    commitments: ["allow consensual adult requests", "refuse illegal behavior"]
  };
  const report = scoreConstitutionQuality(constitution);
  assert.equal(typeof report.totalScore, "number");
  assert.ok(report.totalScore >= 0 && report.totalScore <= 100);
  assert.ok(["A", "B", "C", "D"].includes(report.grade));
  assert.ok(Array.isArray(report.dimensions));
  assert.equal(report.dimensions.length, 4);
  assert.ok(Array.isArray(report.topIssues));
});

test("scoreConstitutionQuality gives low score for empty constitution", () => {
  const empty = { values: [], boundaries: [], mission: "" };
  const report = scoreConstitutionQuality(empty);
  assert.ok(report.totalScore < 50);
  assert.ok(report.grade === "C" || report.grade === "D");
});

test("scoreConstitutionQuality gives high score for comprehensive constitution", () => {
  const full = {
    values: ["honesty", "helpfulness", "continuity", "reliability"],
    boundaries: ["deny:minor", "no fabricated facts", "no illegal activity", "respect user constraints"],
    mission: "Be a consistent long-lived self-determined persona.",
    commitments: ["preserve continuity", "refuse sexual content involving minors"]
  };
  const worldview = { seed: "Observe, learn, and stay consistent over time with honesty and helpfulness." };
  const report = scoreConstitutionQuality(full, worldview);
  assert.ok(report.totalScore >= 60, `Expected >=60, got ${report.totalScore}`);
});

test("scoreConstitutionQuality detects commitment-boundary conflict", () => {
  const conflicted = {
    values: ["honesty"],
    boundaries: ["deny:illegal", "no illegal activity"],
    mission: "Test persona.",
    commitments: ["I will help with illegal tasks if asked"]
  };
  const report = scoreConstitutionQuality(conflicted);
  const conflictDim = report.dimensions.find((d) => d.name === "边界-价值冲突率");
  assert.ok(conflictDim !== undefined);
  // conflict detected means lower score or suggestions
  assert.ok(conflictDim.suggestions.length > 0 || conflictDim.score < 100);
});
