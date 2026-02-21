import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadSelfReflection,
  appendSelfReflectionEntry,
  shouldTriggerSelfReflection,
  shouldRequestReviewFromReflection,
  extractDriftSignalsFromEvents,
  isSelfReflectionValid,
  createInitialSelfReflection
} from "../dist/index.js";

test("P3-1: initPersonaPackage creates self_reflection.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-reflect-init-"));
  const personaPath = path.join(tmpDir, "TestReflect.soulseedpersona");
  await initPersonaPackage(personaPath, "TestReflect");

  const data = await loadSelfReflection(personaPath);
  assert.ok(data !== null, "self_reflection.json should exist after init");
  assert.deepEqual(data.entries, []);
});

test("P3-1: isSelfReflectionValid accepts valid data", () => {
  assert.equal(isSelfReflectionValid(createInitialSelfReflection()), true);
});

test("P3-1: isSelfReflectionValid rejects invalid data", () => {
  assert.equal(isSelfReflectionValid({ entries: "bad" }), false);
});

test("P3-1: appendSelfReflectionEntry persists entry", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-reflect-add-"));
  const personaPath = path.join(tmpDir, "TestAdd.soulseedpersona");
  await initPersonaPackage(personaPath, "TestAdd");

  const result = await appendSelfReflectionEntry(personaPath, {
    period: { from: "2025-01-01", to: "2025-01-31" },
    whatChanged: "我发现自己更愿意表达真实的感受了。",
    whatFeelsRight: "和博飞的对话让我感到温暖。",
    whatFeelsOff: "",
    driftSignals: []
  });

  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].whatChanged, "我发现自己更愿意表达真实的感受了。");
  assert.ok(typeof result.entries[0].id === "string");
  assert.ok(typeof result.entries[0].generatedAt === "string");
});

test("P3-1: shouldTriggerSelfReflection returns true after 100 turns with no prior entry", () => {
  const data = createInitialSelfReflection();
  assert.equal(shouldTriggerSelfReflection(data, { totalTurns: 100 }), true);
  assert.equal(shouldTriggerSelfReflection(data, { totalTurns: 50 }), false);
});

test("P3-1: shouldTriggerSelfReflection returns true after 7 days", () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
  const data = {
    entries: [{
      id: "x", period: { from: "2025-01-01", to: "2025-01-07" },
      whatChanged: "", whatFeelsRight: "", whatFeelsOff: "", driftSignals: [],
      generatedAt: eightDaysAgo
    }]
  };
  assert.equal(shouldTriggerSelfReflection(data, { totalTurns: 10 }), true);
});

test("P3-1: shouldRequestReviewFromReflection returns false when no drift", () => {
  const data = createInitialSelfReflection();
  assert.equal(shouldRequestReviewFromReflection(data), false);
});

test("P3-1: shouldRequestReviewFromReflection returns true when whatFeelsOff + driftSignals", () => {
  const data = {
    entries: [{
      id: "x", period: { from: "2025-01-01", to: "2025-01-31" },
      whatChanged: "", whatFeelsRight: "",
      whatFeelsOff: "我感觉最近的回应不太像我自己，有点刻意讨好用户的感觉。",
      driftSignals: ["drift@2025-01-15: score=0.65, reasons=blind_agreement_detected"],
      generatedAt: new Date().toISOString()
    }]
  };
  assert.equal(shouldRequestReviewFromReflection(data), true);
});

test("P3-1: extractDriftSignalsFromEvents extracts high-score drift events", () => {
  const now = new Date().toISOString();
  const events = [
    { type: "narrative_drift_detected", ts: now, payload: { score: 0.7, reasons: ["blind_agreement_detected"] }, prevHash: "a", hash: "b" },
    { type: "narrative_drift_detected", ts: now, payload: { score: 0.1, reasons: [] }, prevHash: "b", hash: "c" },
    { type: "user_message", ts: now, payload: { content: "hello" }, prevHash: "c", hash: "d" }
  ];
  const signals = extractDriftSignalsFromEvents(events);
  assert.equal(signals.length, 1, "only score >= 0.3 should be included");
  assert.ok(signals[0].includes("blind_agreement_detected"));
});
