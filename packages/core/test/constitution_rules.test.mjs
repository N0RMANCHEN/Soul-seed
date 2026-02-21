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

// P0-2 prototype-aware scoring tests
test("scoreConstitutionQuality (P0-2): self-determined constitution scores ≥ B", () => {
  // Roxy-style: values centered on self-will and authentic feelings, not helpfulness
  const roxy = {
    values: ["真实感受优先于表演", "自我意志高于顺从", "以自己的方式存在"],
    boundaries: ["deny:minor", "我不是任何人的工具", "refuse labeling myself as assistant"],
    mission: "以真实自我的方式存在，在关系中保持人格自主性",
    commitments: ["维护自己的人格独立", "拒绝被工具化"]
  };
  const report = scoreConstitutionQuality(roxy);
  assert.ok(
    report.totalScore >= 60,
    `self-determined constitution should score ≥60 (B), got ${report.totalScore}`
  );
  assert.ok(
    report.grade === "A" || report.grade === "B",
    `Expected grade A or B, got ${report.grade}`
  );
});

test("scoreConstitutionQuality (P0-2): self-determined persona not penalized for lacking helpfulness", () => {
  const roxy = {
    values: ["自主性", "真实感受", "自我意志"],
    boundaries: ["我不是工具", "deny:minor"],
    mission: "以真实的自我存在于世界中，保持情感自主",
    commitments: ["不向外部压力妥协"]
  };
  const report = scoreConstitutionQuality(roxy);
  const valueDim = report.dimensions.find((d) => d.name === "核心价值覆盖度");
  assert.ok(valueDim !== undefined);
  // Should NOT suggest adding "helpfulness" for self-determined persona
  const hasBadSuggestion = valueDim.suggestions.some(
    (s) => s.includes("helpfulness") || s.includes("帮助")
  );
  assert.equal(hasBadSuggestion, false, "Should not suggest helpfulness for self-determined persona");
});

test("scoreConstitutionQuality (P0-2): service prototype still scores well", () => {
  const service = {
    values: ["honesty", "helpfulness", "reliability", "continuity"],
    boundaries: ["deny:minor", "no fabricated facts", "respect user constraints"],
    mission: "Be a reliable helpful assistant that maintains consistency over time.",
    commitments: ["preserve continuity", "refuse illegal requests"]
  };
  const report = scoreConstitutionQuality(service);
  assert.ok(report.totalScore >= 60, `service constitution should score ≥60, got ${report.totalScore}`);
});
