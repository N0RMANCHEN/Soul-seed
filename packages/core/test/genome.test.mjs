import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";

import {
  GENOME_TRAIT_NAMES,
  GENOME_SCHEMA_VERSION,
  createDefaultGenome,
  createDefaultEpigenetics,
  validateGenome,
  validateEpigenetics,
  loadGenome,
  saveGenome,
  loadEpigenetics,
  saveEpigenetics,
  clamp,
  clampTraitValue,
  computeDerivedParams,
  getDefaultDerivedParams,
  resolveTraitValue,
  FORMULA_TABLE,
  computeRawJitter,
  computeDailyJitter,
  computeJitterSeries,
  MAX_JITTER_AMPLITUDE,
  initPersonaPackage,
  loadPersonaPackage,
} from "../dist/index.js";

// ─── Genome basics ─────────────────────────────────────────────────────────────

test("createDefaultGenome produces all 6 traits at 0.5", () => {
  const g = createDefaultGenome();
  assert.equal(g.schemaVersion, GENOME_SCHEMA_VERSION);
  assert.equal(Object.keys(g.traits).length, 6);
  for (const name of GENOME_TRAIT_NAMES) {
    assert.equal(g.traits[name].value, 0.5, `trait ${name} should be 0.5`);
  }
  assert.equal(g.locked, false);
  assert.ok(typeof g.seed === "number");
  assert.equal(g.parentGenomeHash, null);
  assert.deepEqual(g.mutationLog, []);
});

test("createDefaultGenome accepts custom seed and source", () => {
  const g = createDefaultGenome({ seed: 42, source: "preset" });
  assert.equal(g.seed, 42);
  assert.equal(g.source, "preset");
});

test("createDefaultEpigenetics has empty adjustments", () => {
  const e = createDefaultEpigenetics();
  assert.deepEqual(e.adjustments, {});
  assert.ok(e.updatedAt);
});

// ─── Validation ────────────────────────────────────────────────────────────────

test("validateGenome passes for default genome", () => {
  const g = createDefaultGenome();
  const issues = validateGenome(g);
  assert.equal(issues.length, 0);
});

test("validateGenome catches missing trait", () => {
  const g = createDefaultGenome();
  delete g.traits.emotion_sensitivity;
  const issues = validateGenome(g);
  assert.ok(issues.some((i) => i.code === "missing_trait"));
});

test("validateGenome catches extra trait", () => {
  const g = createDefaultGenome();
  g.traits["bogus_trait"] = { value: 0.5 };
  const issues = validateGenome(g);
  assert.ok(issues.some((i) => i.code === "extra_trait"));
});

test("validateGenome catches out-of-range trait", () => {
  const g = createDefaultGenome();
  g.traits.attention_span.value = 1.5;
  const issues = validateGenome(g);
  assert.ok(issues.some((i) => i.code === "trait_out_of_range"));
});

test("validateEpigenetics passes for default", () => {
  const e = createDefaultEpigenetics();
  assert.equal(validateEpigenetics(e).length, 0);
});

// ─── Clamp ─────────────────────────────────────────────────────────────────────

test("clamp respects min/max", () => {
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(3, 0, 1), 1);
  assert.equal(clamp(0.5, 0, 1), 0.5);
});

test("clampTraitValue keeps [0,1]", () => {
  assert.equal(clampTraitValue(-0.1), 0);
  assert.equal(clampTraitValue(1.2), 1);
  assert.equal(clampTraitValue(0.7), 0.7);
});

// ─── Persistence ───────────────────────────────────────────────────────────────

test("save + load genome round-trips correctly", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "genome-"));
  const g = createDefaultGenome({ seed: 999 });
  g.traits.emotion_sensitivity.value = 0.8;
  await saveGenome(tmp, g);
  const loaded = await loadGenome(tmp);
  assert.equal(loaded.seed, 999);
  assert.equal(loaded.traits.emotion_sensitivity.value, 0.8);
});

test("loadGenome returns default when file missing", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "genome-empty-"));
  const g = await loadGenome(tmp);
  assert.equal(g.traits.attention_span.value, 0.5);
  assert.equal(g.source, "inferred_legacy");
});

test("loadGenome clamps out-of-range values on load", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "genome-clamp-"));
  const g = createDefaultGenome();
  g.traits.emotion_sensitivity.value = 1.5;
  await writeFile(
    path.join(tmp, "genome.json"),
    JSON.stringify(g, null, 2),
    "utf-8"
  );
  const loaded = await loadGenome(tmp);
  assert.equal(loaded.traits.emotion_sensitivity.value, 1);
});

test("save + load epigenetics round-trips", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "epi-"));
  const e = createDefaultEpigenetics();
  e.adjustments.emotion_sensitivity = {
    value: 0.02,
    min: -0.05,
    max: 0.05,
    evidence: ["hash1"],
  };
  await saveEpigenetics(tmp, e);
  const loaded = await loadEpigenetics(tmp);
  assert.equal(loaded.adjustments.emotion_sensitivity.value, 0.02);
});

// ─── Derived Params ────────────────────────────────────────────────────────────

test("default genome (all 0.5) produces legacy-compatible derived params", () => {
  const g = createDefaultGenome();
  const e = createDefaultEpigenetics();
  const d = computeDerivedParams(g, e);
  const expected = getDefaultDerivedParams();
  for (const [key, val] of Object.entries(expected)) {
    assert.equal(d[key], val, `${key}: expected ${val}, got ${d[key]}`);
  }
});

test("high attention_span increases recallTopK", () => {
  const g = createDefaultGenome();
  g.traits.attention_span.value = 0.9;
  const e = createDefaultEpigenetics();
  const d = computeDerivedParams(g, e);
  assert.ok(d.recallTopK > 6, "recallTopK should increase above legacy default");
});

test("low emotion_recovery slows baseline regression", () => {
  const g = createDefaultGenome();
  g.traits.emotion_recovery.value = 0.1;
  const e = createDefaultEpigenetics();
  const d = computeDerivedParams(g, e);
  assert.ok(d.baselineRegressionSpeed < 0.08, "should be slower than legacy default 0.08");
});

test("high emotion_sensitivity amplifies mood delta", () => {
  const g = createDefaultGenome();
  g.traits.emotion_sensitivity.value = 0.9;
  const e = createDefaultEpigenetics();
  const d = computeDerivedParams(g, e);
  assert.ok(d.moodDeltaScale > 1.0);
});

test("epigenetic adjustment shifts derived param", () => {
  const g = createDefaultGenome();
  const e = createDefaultEpigenetics();
  e.adjustments.attention_span = {
    value: 0.2,
    min: -0.1,
    max: 0.3,
    evidence: ["hash1", "hash2"],
  };
  const d = computeDerivedParams(g, e);
  assert.ok(d.recallTopK > 6, "epigenetic boost should increase recallTopK above legacy default");
});

test("epigenetic adjustment is clamped by its own min/max", () => {
  const g = createDefaultGenome();
  const e = createDefaultEpigenetics();
  e.adjustments.attention_span = {
    value: 0.5,
    min: -0.05,
    max: 0.05,
    evidence: ["hash1", "hash2"],
  };
  const effective = resolveTraitValue(g, e, "attention_span");
  assert.ok(effective <= 0.55, "should be clamped to genome + max(0.05)");
});

test("derived params stay within clamp ranges for extreme traits", () => {
  const g = createDefaultGenome();
  for (const name of GENOME_TRAIT_NAMES) {
    g.traits[name].value = 1.0;
  }
  const e = createDefaultEpigenetics();
  const d = computeDerivedParams(g, e);

  for (const entry of FORMULA_TABLE) {
    const val = d[entry.param];
    assert.ok(
      val >= entry.clampMin && val <= entry.clampMax,
      `${entry.param}: ${val} outside [${entry.clampMin}, ${entry.clampMax}]`
    );
  }

  for (const name of GENOME_TRAIT_NAMES) {
    g.traits[name].value = 0.0;
  }
  const d0 = computeDerivedParams(g, e);
  for (const entry of FORMULA_TABLE) {
    const val = d0[entry.param];
    assert.ok(
      val >= entry.clampMin && val <= entry.clampMax,
      `min: ${entry.param}: ${val} outside [${entry.clampMin}, ${entry.clampMax}]`
    );
  }
});

// ─── Daily Jitter ──────────────────────────────────────────────────────────────

test("computeRawJitter is deterministic", () => {
  const a = computeRawJitter(42, "2026-02-25", "emotion_sensitivity");
  const b = computeRawJitter(42, "2026-02-25", "emotion_sensitivity");
  assert.equal(a, b);
});

test("computeRawJitter stays within ±MAX_JITTER_AMPLITUDE", () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const trait of GENOME_TRAIT_NAMES) {
      const j = computeRawJitter(seed, "2026-03-01", trait);
      assert.ok(
        Math.abs(j) <= MAX_JITTER_AMPLITUDE + 1e-10,
        `seed ${seed}, trait ${trait}: jitter ${j} out of bounds`
      );
    }
  }
});

test("different dates produce different jitter", () => {
  const a = computeRawJitter(42, "2026-02-25", "attention_span");
  const b = computeRawJitter(42, "2026-02-26", "attention_span");
  assert.notEqual(a, b);
});

test("different traits produce different jitter", () => {
  const a = computeRawJitter(42, "2026-02-25", "attention_span");
  const b = computeRawJitter(42, "2026-02-25", "emotion_sensitivity");
  assert.notEqual(a, b);
});

test("computeDailyJitter applies inertial smoothing", () => {
  const raw = computeRawJitter(42, "2026-02-25", "attention_span");
  const smoothed = computeDailyJitter(42, "2026-02-25", "attention_span", 0);
  assert.ok(Math.abs(smoothed) <= Math.abs(raw) + 1e-10);
});

test("computeJitterSeries returns correct length", () => {
  const dates = ["2026-02-25", "2026-02-26", "2026-02-27"];
  const series = computeJitterSeries(42, dates, "attention_span");
  assert.equal(series.length, 3);
  series.forEach((j) => {
    assert.ok(Math.abs(j) <= MAX_JITTER_AMPLITUDE + 1e-10);
  });
});

// ─── Integration: persona init/load ────────────────────────────────────────────

test("initPersonaPackage creates genome.json and epigenetics.json", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "persona-genome-init-"));
  const personaPath = path.join(tmp, "TestGenome.soulseedpersona");
  await initPersonaPackage(personaPath, "TestGenome");

  const genomeRaw = await readFile(
    path.join(personaPath, "genome.json"),
    "utf-8"
  );
  const genome = JSON.parse(genomeRaw);
  assert.equal(genome.schemaVersion, "1.0");
  assert.equal(genome.source, "preset");
  assert.equal(Object.keys(genome.traits).length, 6);

  const epiRaw = await readFile(
    path.join(personaPath, "epigenetics.json"),
    "utf-8"
  );
  const epi = JSON.parse(epiRaw);
  assert.equal(epi.schemaVersion, "1.0");
  assert.deepEqual(epi.adjustments, {});
});

test("loadPersonaPackage includes genome and epigenetics", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "persona-genome-load-"));
  const personaPath = path.join(tmp, "TestLoad.soulseedpersona");
  await initPersonaPackage(personaPath, "TestLoad");
  const pkg = await loadPersonaPackage(personaPath);
  assert.ok(pkg.genome, "genome should be present");
  assert.ok(pkg.epigenetics, "epigenetics should be present");
  assert.equal(pkg.genome.traits.emotion_sensitivity.value, 0.5);
});

test("loadPersonaPackage falls back to defaults for legacy persona (no genome.json)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "persona-genome-legacy-"));
  const personaPath = path.join(tmp, "Legacy.soulseedpersona");
  await initPersonaPackage(personaPath, "Legacy");

  const { unlink } = await import("node:fs/promises");
  await unlink(path.join(personaPath, "genome.json"));
  await unlink(path.join(personaPath, "epigenetics.json"));

  const pkg = await loadPersonaPackage(personaPath);
  assert.ok(pkg.genome, "should auto-create default genome");
  assert.equal(pkg.genome.source, "inferred_legacy");
  assert.equal(pkg.genome.traits.emotion_sensitivity.value, 0.5);

  const d = computeDerivedParams(pkg.genome, pkg.epigenetics);
  const expected = getDefaultDerivedParams();
  for (const [key, val] of Object.entries(expected)) {
    assert.equal(d[key], val, `legacy ${key}: expected ${val}, got ${d[key]}`);
  }
});
