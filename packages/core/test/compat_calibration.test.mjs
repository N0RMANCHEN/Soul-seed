import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  getDefaultCalibrationBaseline,
  getDefaultDerivedParams,
  inferCalibrationFromEvents,
  loadCalibrationConfig,
  saveCalibrationConfig,
  lockCalibration,
  validateCalibration,
} from "../dist/index.js";

function makeAssistantEvent(text, index = 0) {
  return {
    ts: new Date(Date.now() + index * 1000).toISOString(),
    type: "assistant_message",
    payload: { text },
    prevHash: "0".repeat(64),
    hash: (index + 1).toString(16).padStart(64, "0"),
  };
}

// ─── getDefaultCalibrationBaseline ──────────────────────────────────────────

test("getDefaultCalibrationBaseline matches getDefaultDerivedParams for shared fields", () => {
  const baseline = getDefaultCalibrationBaseline();
  const dp = getDefaultDerivedParams();
  assert.equal(baseline.moodDeltaScale, dp.moodDeltaScale);
  assert.equal(baseline.baselineRegressionSpeed, dp.baselineRegressionSpeed);
  assert.equal(baseline.recallTopK, dp.recallTopK);
});

// ─── inferCalibrationFromEvents ─────────────────────────────────────────────

test("inferCalibrationFromEvents with empty array returns defaults", () => {
  const result = inferCalibrationFromEvents([]);
  const defaults = getDefaultCalibrationBaseline();
  assert.deepEqual(result, defaults);
});

test("inferCalibrationFromEvents with 20 events computes avgReplyLength", () => {
  const events = Array.from({ length: 20 }, (_, i) =>
    makeAssistantEvent("a".repeat(100), i)
  );
  const result = inferCalibrationFromEvents(events);
  assert.equal(result.avgReplyLength, 100);
  assert.equal(result.avgValence, 0.0);
  assert.equal(result.avgArousal, 0.3);
});

// ─── loadCalibrationConfig ──────────────────────────────────────────────────

test("loadCalibrationConfig returns defaults when no file exists", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "calib-load-"));
  const config = await loadCalibrationConfig(tmp);
  assert.equal(config.version, "1.0");
  assert.equal(config.locked, false);
  assert.equal(config.turnsSampled, 0);
  assert.ok(config.baseline.recallTopK > 0);
});

// ─── save + load round-trip ─────────────────────────────────────────────────

test("saveCalibrationConfig + loadCalibrationConfig round-trips", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "calib-rt-"));
  const config = {
    version: "1.0",
    calibratedAt: new Date().toISOString(),
    locked: false,
    turnsSampled: 50,
    baseline: getDefaultCalibrationBaseline(),
  };
  const saved = await saveCalibrationConfig(tmp, config);
  assert.equal(saved, true);
  const loaded = await loadCalibrationConfig(tmp);
  assert.equal(loaded.turnsSampled, 50);
  assert.deepEqual(loaded.baseline, config.baseline);
});

// ─── lockCalibration ────────────────────────────────────────────────────────

test("lockCalibration sets locked=true, subsequent save returns false", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "calib-lock-"));
  const config = {
    version: "1.0",
    calibratedAt: new Date().toISOString(),
    locked: false,
    turnsSampled: 10,
    baseline: getDefaultCalibrationBaseline(),
  };
  await saveCalibrationConfig(tmp, config);
  const locked = await lockCalibration(tmp);
  assert.equal(locked.locked, true);

  const update = { ...locked, turnsSampled: 99 };
  const saved = await saveCalibrationConfig(tmp, update);
  assert.equal(saved, false);
});

// ─── validateCalibration ────────────────────────────────────────────────────

test("validateCalibration returns valid for default config", () => {
  const config = {
    version: "1.0",
    calibratedAt: new Date().toISOString(),
    locked: false,
    turnsSampled: 0,
    baseline: getDefaultCalibrationBaseline(),
  };
  const result = validateCalibration(config);
  assert.equal(result.valid, true);
  assert.equal(result.missing.length, 0);
});

test("validateCalibration catches missing fields", () => {
  const config = {
    version: "1.0",
    calibratedAt: new Date().toISOString(),
    locked: false,
    turnsSampled: 0,
    baseline: {
      avgReplyLength: 500,
      avgValence: 0.0,
    },
  };
  const result = validateCalibration(config);
  assert.equal(result.valid, false);
  assert.ok(result.missing.includes("avgArousal"));
  assert.ok(result.missing.includes("moodDeltaScale"));
  assert.ok(result.missing.includes("baselineRegressionSpeed"));
  assert.ok(result.missing.includes("recallTopK"));
});
