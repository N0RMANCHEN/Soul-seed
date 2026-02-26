import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDefaultValuesRules,
  evaluateValuesRules,
  applyPersonalityDrift,
  createDefaultPersonalityProfile,
  savePersonalityProfile,
  loadPersonalityProfile,
} from "../dist/index.js";

test("values rules match by priority", () => {
  const config = createDefaultValuesRules({
    values: ["honesty", "care"],
    boundaries: [],
    mission: "",
    commitments: [],
  });
  config.rules[0].priority = 10;
  config.rules[1].priority = 99;

  const matches = evaluateValuesRules("I value care and honesty", config);
  assert.equal(matches.length, 2);
  assert.equal(matches[0].rule.value, "care");
});

test("personality drift applies bounded change and enforces cooldown", () => {
  const base = createDefaultPersonalityProfile();
  const now = "2026-02-26T10:00:00.000Z";
  const applied = applyPersonalityDrift(base, { warmth: 1.0 }, now);
  assert.equal(applied.applied, true);
  assert.ok(applied.profile.traits.warmth <= base.traits.warmth + base.drift.maxStepPerUpdate + 1e-9);

  const blocked = applyPersonalityDrift(applied.profile, { warmth: 0.1 }, "2026-02-26T12:00:00.000Z");
  assert.equal(blocked.applied, false);
  assert.equal(blocked.reason, "cooldown_active");
});

test("personality profile load/save roundtrip", async () => {
  const root = await mkdtemp(join(tmpdir(), "soulseed-personality-"));
  try {
    const profile = createDefaultPersonalityProfile();
    profile.traits.assertiveness = 0.7;
    await savePersonalityProfile(root, profile);
    const loaded = await loadPersonalityProfile(root);
    assert.equal(loaded.traits.assertiveness, 0.7);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
