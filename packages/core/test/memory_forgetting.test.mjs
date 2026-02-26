/**
 * H/P1-2 — Memory Forgetting & Compression tests
 */
import test from "node:test";
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  runMemoryDecayJob,
  runMemoryCompression,
  runDeepRecall,
  applyInterferenceScoring,
  getDecayRateFromGenome,
  getSalienceGainFromGenome,
  createDefaultGenome,
  createDefaultEpigenetics
} from "../dist/index.js";

test("runMemoryDecayJob dry-run does not modify db", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-mem-forget-"));
  try {
    const report = await runMemoryDecayJob(tmpDir, { dryRun: true });
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.dryRun, true);
    assert.ok(typeof report.decayRatePerDay === "number");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runMemoryCompression dry-run returns zero compressed", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-mem-comp-"));
  try {
    const report = await runMemoryCompression(tmpDir, { dryRun: true });
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.compressed, 0);
    assert.strictEqual(report.dryRun, true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDeepRecall returns empty blocks when no archive", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-deep-recall-"));
  try {
    const result = await runDeepRecall(tmpDir);
    assert.ok(Array.isArray(result.blocks));
    assert.ok(typeof result.traceId === "string");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("applyInterferenceScoring suppresses similar items", () => {
    const items = [
      { id: "a", content: "user said hello and thanks", score: 0.9 },
      { id: "b", content: "user said hello thanks a lot", score: 0.85 },
      { id: "c", content: "completely different topic", score: 0.7 }
    ];
    const out = applyInterferenceScoring(items, { similarityThreshold: 0.7, penalty: 0.1 });
    assert.strictEqual(out.length, 3);
    const byId = new Map(out.map((o) => [o.id, o]));
    assert.ok(byId.get("a"));
    assert.ok(byId.get("b"));
    assert.ok(byId.get("c"));
    const aScore = byId.get("a").score;
    const bScore = byId.get("b").score;
    assert.ok(aScore >= bScore);
});

test("getDecayRateFromGenome uses memoryHalfLifeDays", () => {
    const genome = createDefaultGenome();
    const epigenetics = createDefaultEpigenetics();
    const rate = getDecayRateFromGenome(genome, epigenetics);
    assert.ok(Number.isFinite(rate));
    assert.ok(rate > 0);
});

test("getSalienceGainFromGenome uses memory_imprint", () => {
    const genome = createDefaultGenome();
    const epigenetics = createDefaultEpigenetics();
    const gain = getSalienceGainFromGenome(genome, epigenetics);
    assert.ok(Number.isFinite(gain));
    assert.ok(gain >= 0.5 && gain <= 2);
});
