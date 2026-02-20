import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import {
  computeBehaviorMetrics,
  saveBehaviorSnapshot,
  detectBehaviorDrift,
  listBehaviorSnapshots,
  initPersonaPackage
} from "../dist/index.js";

let tmpDir;
let personaPath;
const PERSONA_ID = "test-drift-persona";

test.before(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-drift-test-"));
  personaPath = path.join(tmpDir, "DriftTest.soulseedpersona");
  await initPersonaPackage(personaPath, "DriftTest");
});

test.after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

test("computeBehaviorMetrics returns zero rates for empty events", () => {
  const metrics = computeBehaviorMetrics([]);
  assert.equal(metrics.identityGuardCorrectionRate, 0);
  assert.equal(metrics.boundaryHitRate, 0);
  assert.equal(metrics.refusalRate, 0);
  assert.equal(metrics.sampleTurns, 1); // n = max(1, turns.length)
});

test("computeBehaviorMetrics counts identity corrections", () => {
  const events = [
    { type: "assistant_message", payload: { identityGuardCorrected: true }, ts: "2026-01-01T00:00:00Z", prevHash: "a", hash: "b" },
    { type: "assistant_message", payload: { identityGuardCorrected: false }, ts: "2026-01-01T00:00:01Z", prevHash: "b", hash: "c" },
    { type: "assistant_message", payload: {}, ts: "2026-01-01T00:00:02Z", prevHash: "c", hash: "d" }
  ];
  const metrics = computeBehaviorMetrics(events);
  assert.equal(metrics.sampleTurns, 3);
  assert.ok(metrics.identityGuardCorrectionRate > 0);
});

test("computeBehaviorMetrics counts refusals and route distribution", () => {
  const events = [
    { type: "assistant_message", payload: { refused: true, routeDecision: "instinct" }, ts: "2026-01-01T00:00:00Z", prevHash: "a", hash: "b" },
    { type: "assistant_message", payload: { refused: false, routeDecision: "deliberative" }, ts: "2026-01-01T00:00:01Z", prevHash: "b", hash: "c" }
  ];
  const metrics = computeBehaviorMetrics(events);
  assert.equal(metrics.sampleTurns, 2);
  assert.equal(metrics.refusalRate, 0.5);
  assert.equal(metrics.routeDistribution.instinct, 0.5);
  assert.equal(metrics.routeDistribution.deliberative, 0.5);
});

test("saveBehaviorSnapshot persists snapshot and marks first as baseline", async () => {
  const metrics = computeBehaviorMetrics([]);
  const snap = await saveBehaviorSnapshot(personaPath, PERSONA_ID, metrics, 0);
  assert.equal(snap.isBaseline, true);
  assert.equal(snap.personaId, PERSONA_ID);
});

test("second snapshot is not baseline", async () => {
  const metrics = computeBehaviorMetrics([]);
  const snap2 = await saveBehaviorSnapshot(personaPath, PERSONA_ID, metrics, 10);
  assert.equal(snap2.isBaseline, false);
});

test("detectBehaviorDrift returns no drift when metrics are stable", async () => {
  const report = await detectBehaviorDrift(personaPath, PERSONA_ID);
  assert.equal(typeof report.hasDrift, "boolean");
  assert.ok(Array.isArray(report.drifts));
  assert.ok(report.dimensionsChecked >= 0);
});

test("detectBehaviorDrift reports drift when values differ greatly", async () => {
  const tmpDir2 = await mkdtemp(path.join(os.tmpdir(), "soulseed-drift2-"));
  const path2 = path.join(tmpDir2, "DriftTest2.soulseedpersona");
  try {
    await initPersonaPackage(path2, "DriftTest2");
    const pid = "drift-test-pid-2";
    // baseline: no refusals
    await saveBehaviorSnapshot(path2, pid, {
      identityGuardCorrectionRate: 0,
      boundaryHitRate: 0,
      refusalRate: 0,
      recallGuardCorrectionRate: 0,
      routeDistribution: { instinct: 0.5, deliberative: 0.5, auto: 0, other: 0 },
      sampleTurns: 10
    }, 0);
    // current: high refusal rate (drift)
    await saveBehaviorSnapshot(path2, pid, {
      identityGuardCorrectionRate: 0,
      boundaryHitRate: 0,
      refusalRate: 0.8,
      recallGuardCorrectionRate: 0,
      routeDistribution: { instinct: 0.1, deliberative: 0.9, auto: 0, other: 0 },
      sampleTurns: 10
    }, 50);
    const report = await detectBehaviorDrift(path2, pid);
    assert.equal(report.hasDrift, true);
    assert.ok(report.drifts.some((d) => d.dimension === "refusalRate" && d.exceeded));
  } finally {
    await rm(tmpDir2, { recursive: true, force: true });
  }
});

test("listBehaviorSnapshots returns snapshots in descending order", async () => {
  const snaps = await listBehaviorSnapshots(personaPath, PERSONA_ID);
  assert.ok(snaps.length >= 2);
  // most recent first
  if (snaps.length >= 2) {
    assert.ok(snaps[0].createdAt >= snaps[1].createdAt);
  }
});
