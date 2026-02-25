import test from "node:test";
import assert from "node:assert/strict";
import {
  loadInvariantTable,
  resetInvariantTableCache,
  checkDeltaInvariants,
  checkInvariantCompleteness,
  getInvariantCoverage,
} from "../dist/index.js";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const configDir = resolve(__dirname, "../../../config/h0");

test("loadInvariantTable — loads from config", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length >= 10, `expected at least 10 rules, got ${rules.length}`);
});

test("checkDeltaInvariants — relationship pass", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "relationship",
    targetId: "user-1",
    patch: { trust: 0.05 },
    confidence: 0.9,
    supportingEventHashes: ["h1", "h2"],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  assert.ok(results.length > 0);
  assert.ok(
    results.every((r) => r.passed),
    `expected all relationship rules to pass, got: ${results.map((r) => r.message).join("; ")}`
  );
});

test("checkDeltaInvariants — relationship fail (max delta)", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "relationship",
    targetId: "user-1",
    patch: { trust: 0.15 },
    confidence: 0.9,
    supportingEventHashes: ["h1", "h2"],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  const failed = results.filter((r) => !r.passed);
  const relMaxDelta = failed.find((r) => r.rule.id === "rel-max-delta-per-turn");
  assert.ok(relMaxDelta, `expected rel-max-delta-per-turn to fail, got: ${results.map((r) => r.message).join("; ")}`);
});

test("checkDeltaInvariants — mood pass", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "mood",
    targetId: "self",
    patch: { valence: 0.10, arousal: 0 },
    confidence: 0.9,
    supportingEventHashes: [],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  assert.ok(results.length > 0);
  assert.ok(
    results.every((r) => r.passed),
    `expected all mood rules to pass, got: ${results.map((r) => r.message).join("; ")}`
  );
});

test("checkDeltaInvariants — mood fail", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "mood",
    targetId: "self",
    patch: { valence: 0.25, arousal: 0 },
    confidence: 0.9,
    supportingEventHashes: [],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  const failed = results.filter((r) => !r.passed);
  const moodMaxDelta = failed.find((r) => r.rule.id === "mood-max-delta");
  assert.ok(moodMaxDelta, `expected mood-max-delta to fail, got: ${results.map((r) => r.message).join("; ")}`);
});

test("checkDeltaInvariants — belief pass", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "belief",
    targetId: "b1",
    patch: { strength: 0.05 },
    confidence: 0.5,
    supportingEventHashes: [],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  assert.ok(results.length > 0);
  assert.ok(
    results.every((r) => r.passed),
    `expected all belief rules to pass, got: ${results.map((r) => r.message).join("; ")}`
  );
});

test("checkDeltaInvariants — belief fail confidence", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "belief",
    targetId: "b1",
    patch: { strength: 0.05 },
    confidence: 0.2,
    supportingEventHashes: [],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  const failed = results.filter((r) => !r.passed);
  const beliefMinConf = failed.find((r) => r.rule.id === "belief-min-confidence");
  assert.ok(beliefMinConf, `expected belief-min-confidence to fail, got: ${results.map((r) => r.message).join("; ")}`);
});

test("checkDeltaInvariants — epigenetics fail (not enough evidence)", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const delta = {
    type: "epigenetics",
    targetId: "self",
    patch: { emotion_sensitivity: 0.02 },
    confidence: 0.9,
    supportingEventHashes: ["h1"],
    notes: "",
  };
  const results = checkDeltaInvariants(delta, rules);
  const failed = results.filter((r) => !r.passed);
  const epiEvidence = failed.find((r) => r.rule.id === "epi-evidence-required");
  assert.ok(epiEvidence, `expected epi-evidence-required to fail, got: ${results.map((r) => r.message).join("; ")}`);
});

test("checkInvariantCompleteness — full table is complete", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const { complete, missingDomains } = checkInvariantCompleteness(rules);
  assert.ok(complete, `expected complete, missingDomains: ${missingDomains.join(", ")}`);
  assert.deepEqual(missingDomains, []);
});

test("checkInvariantCompleteness — missing domain", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir).filter((r) => r.domain !== "belief");
  const { complete, missingDomains } = checkInvariantCompleteness(rules);
  assert.ok(!complete);
  assert.ok(missingDomains.includes("belief"), `expected belief in missingDomains, got: ${missingDomains.join(", ")}`);
});

test("getInvariantCoverage — returns correct domains", () => {
  resetInvariantTableCache();
  const rules = loadInvariantTable(configDir);
  const coverage = getInvariantCoverage(rules);
  assert.ok(coverage.has("relationship"));
  assert.ok(coverage.has("mood"));
  assert.ok(coverage.has("belief"));
  assert.ok(coverage.has("epigenetics"));
});
