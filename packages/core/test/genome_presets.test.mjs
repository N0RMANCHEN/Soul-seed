import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GENOME_TRAIT_NAMES,
  loadGenomePresets,
  createGenomeFromPreset,
  validateGenome,
} from "../dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_PATH = path.resolve(__dirname, "../../../config/genome_presets.json");

test("loadGenomePresets loads presets from config file", () => {
  const config = loadGenomePresets(PRESETS_PATH);
  assert.equal(config.version, "genome_presets/v1");
  assert.ok(config.presets.balanced);
  assert.ok(config.presets.empathetic);
  assert.ok(config.presets.analytical);
  assert.ok(config.presets.social);
  assert.equal(Object.keys(config.presets).length, 4);
});

test("loadGenomePresets returns empty presets for missing file", () => {
  const config = loadGenomePresets("/nonexistent/path.json");
  assert.equal(Object.keys(config.presets).length, 0);
});

test("createGenomeFromPreset('balanced') returns all traits at 0.5", () => {
  const presets = loadGenomePresets(PRESETS_PATH);
  const genome = createGenomeFromPreset("balanced", presets, 42);
  assert.equal(genome.source, "preset");
  assert.equal(genome.seed, 42);
  for (const name of GENOME_TRAIT_NAMES) {
    assert.equal(genome.traits[name].value, 0.5, `${name} should be 0.5`);
  }
});

test("createGenomeFromPreset('empathetic') returns correct emotion_sensitivity", () => {
  const presets = loadGenomePresets(PRESETS_PATH);
  const genome = createGenomeFromPreset("empathetic", presets);
  assert.equal(genome.traits.emotion_sensitivity.value, 0.85);
  assert.equal(genome.traits.social_attunement.value, 0.8);
});

test("createGenomeFromPreset('nonexistent') throws", () => {
  const presets = loadGenomePresets(PRESETS_PATH);
  assert.throws(
    () => createGenomeFromPreset("nonexistent", presets),
    /Unknown genome preset/
  );
});

test("genome created from preset passes validateGenome", () => {
  const presets = loadGenomePresets(PRESETS_PATH);
  for (const name of Object.keys(presets.presets)) {
    const genome = createGenomeFromPreset(name, presets);
    const issues = validateGenome(genome);
    assert.equal(issues.length, 0, `preset "${name}" should pass validation: ${JSON.stringify(issues)}`);
  }
});
