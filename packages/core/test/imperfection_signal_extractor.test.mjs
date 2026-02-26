/**
 * H/P1-6: Imperfection Signal Extractor regression scenarios.
 * At least one test per IMP rule.
 */

import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractImperfectionSignals,
  buildImperfectionContextBlock,
  resetImperfectionRulesCache,
} from "../dist/persona/imperfection_signal_extractor.js";
import { loadImperfectionRules, resetImperfectionRulesCache as resetRulesCache } from "../dist/persona/imperfection_rules.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const configDir = resolve(__dirname, "../../../config");

function createBasePersonaPkg(overrides = {}) {
  return {
    rootPath: "/tmp/test",
    persona: { id: "test", displayName: "Test", schemaVersion: "0.3", createdAt: "" },
    constitution: { values: [], boundaries: [], mission: "" },
    userProfile: { preferredLanguage: "en", preferredName: "User" },
    pinned: { memories: [] },
    cognition: { instinctBias: 0.5, epistemicStance: "balanced", toolPreference: "auto", updatedAt: "" },
    ...overrides,
  };
}

function createBaseTrace(overrides = {}) {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    selectedMemories: [],
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel: "low",
    reason: "",
    model: "test",
    ...overrides,
  };
}

// IMP-01: Uncertainty expression when evidence weak
{
  const test = (await import("node:test")).default;
  test("IMP-01: hedge_language when evidence weak (few memories)", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace({
        selectedMemories: [],
        selectedMemoryBlocks: [],
      }),
      causeConfidence: 0.3,
    });
    const imp01 = signals.find((s) => s.ruleId === "IMP-01");
    assert.ok(imp01, "IMP-01 signal expected when evidence weak");
    assert.equal(imp01.signalKey, "hedge_language");
    assert.ok(imp01.suggestedHints.length > 0);
  });
}

// IMP-02: Memory gaps when salience low
{
  const test = (await import("node:test")).default;
  test("IMP-02: memory_gap when few memories selected", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace({
        selectedMemories: ["one"],
        selectedMemoryBlocks: [{ id: "m1", source: "user", content: "x" }],
      }),
      avgSalience: 0.2,
    });
    const imp02 = signals.find((s) => s.ruleId === "IMP-02");
    assert.ok(imp02, "IMP-02 signal expected when salience low");
    assert.equal(imp02.signalKey, "memory_gap");
  });

  test("IMP-02: memory_gap when entity without relationship", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace(),
      entityWithoutRelationship: "Alice",
    });
    const imp02 = signals.find((s) => s.ruleId === "IMP-02");
    assert.ok(imp02, "IMP-02 signal expected for entity without relationship");
  });
}

// IMP-03: Unnamed emotion
{
  const test = (await import("node:test")).default;
  test("IMP-03: unnamed_emotion when mood drifted with calm label", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg({
        moodState: {
          valence: 0.6,
          arousal: 0.4,
          dominantEmotion: "calm",
          triggers: [],
          onMindSnippet: null,
          decayRate: 0.08,
          updatedAt: new Date().toISOString(),
        },
      }),
      trace: createBaseTrace(),
    });
    const imp03 = signals.find((s) => s.ruleId === "IMP-03");
    assert.ok(imp03, "IMP-03 signal expected when mood drifted, emotion calm");
    assert.equal(imp03.signalKey, "unnamed_emotion");
  });
}

// IMP-04: Uncertain attribution
{
  const test = (await import("node:test")).default;
  test("IMP-04: uncertain_attribution when causeConfidence low", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace({
        selectedMemoryBlocks: [
          { id: "m1", source: "user", content: "x", uncertaintyLevel: "uncertain" },
          { id: "m2", source: "user", content: "y", uncertaintyLevel: "uncertain" },
        ],
      }),
      causeConfidence: 0.35,
    });
    const imp04 = signals.find((s) => s.ruleId === "IMP-04");
    assert.ok(imp04, "IMP-04 signal expected when causeConfidence low");
    assert.equal(imp04.signalKey, "uncertain_attribution");
  });
}

// IMP-05: Relationship cooling
{
  const test = (await import("node:test")).default;
  test("IMP-05: relationship_cooling when intimacy low", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg({
        relationshipState: {
          state: "neutral-unknown",
          confidence: 0.5,
          dimensions: {
            trust: 0.4,
            safety: 0.5,
            intimacy: 0.25,
            reciprocity: 0.3,
            stability: 0.4,
            libido: 0.2,
          },
          drivers: [],
          updatedAt: new Date().toISOString(),
        },
      }),
      trace: createBaseTrace(),
    });
    const imp05 = signals.find((s) => s.ruleId === "IMP-05");
    assert.ok(imp05, "IMP-05 signal expected when relationship cooled");
    assert.equal(imp05.signalKey, "relationship_cooling");
  });
}

// IMP-06: Detail forgetting (compressed memory)
{
  const test = (await import("node:test")).default;
  test("IMP-06: detail_forgetting when hasCompressedMemory true", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace(),
      hasCompressedMemory: true,
    });
    const imp06 = signals.find((s) => s.ruleId === "IMP-06");
    assert.ok(imp06, "IMP-06 signal expected when hasCompressedMemory");
    assert.equal(imp06.signalKey, "detail_forgetting");
  });
}

// IMP-07: Evidence requirement
{
  const test = (await import("node:test")).default;
  test("IMP-07: evidence_required when deltas rejected", () => {
    resetImperfectionRulesCache();
    resetRulesCache();
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace({
        deltaCommitResult: {
          turnId: "t1",
          proposal: { turnId: "t1", proposedAt: "", deltas: [] },
          gateResults: [],
          appliedDeltas: [],
          rejectedDeltas: [
            {
              delta: { type: "relationship", targetId: "u", patch: {}, confidence: 0.2, supportingEventHashes: [], notes: "" },
              reason: "insufficient evidence",
            },
          ],
          committedAt: "",
        },
      }),
    });
    const imp07 = signals.find((s) => s.ruleId === "IMP-07");
    assert.ok(imp07, "IMP-07 signal expected when deltas rejected for evidence");
    assert.equal(imp07.signalKey, "evidence_required");
  });
}

// buildImperfectionContextBlock
{
  const test = (await import("node:test")).default;
  test("buildImperfectionContextBlock produces injectable string", () => {
    const block = buildImperfectionContextBlock([
      { ruleId: "IMP-01", signalKey: "hedge_language", description: "Evidence weak", suggestedHints: ["I think", "maybe"] },
    ]);
    assert.ok(block.includes("Imperfection signals"));
    assert.ok(block.includes("hedge_language"));
    assert.ok(block.includes("I think"));
  });

  test("buildImperfectionContextBlock returns empty for no signals", () => {
    const block = buildImperfectionContextBlock([]);
    assert.equal(block, "");
  });
}

// loadImperfectionRules
{
  const test = (await import("node:test")).default;
  test("loadImperfectionRules loads IMP-01 through IMP-07", () => {
    resetRulesCache();
    resetImperfectionRulesCache();
    const rules = loadImperfectionRules(configDir);
    assert.ok(rules.length >= 5, "at least 5 rules expected");
    const ids = new Set(rules.map((r) => r.id));
    assert.ok(ids.has("IMP-01"), "IMP-01");
    assert.ok(ids.has("IMP-02"), "IMP-02");
    assert.ok(ids.has("IMP-03"), "IMP-03");
    assert.ok(ids.has("IMP-07"), "IMP-07");
  });
}

// Safety: imperfection scenarios don't trigger safety violations
{
  const test = (await import("node:test")).default;
  test("safety: no fabrication — signals are hints only, no memory claims", () => {
    const signals = extractImperfectionSignals({
      personaPkg: createBasePersonaPkg(),
      trace: createBaseTrace(),
    });
    for (const s of signals) {
      assert.ok(!s.description.includes("fabricat"), "signals must not suggest fabrication");
    }
  });
}
