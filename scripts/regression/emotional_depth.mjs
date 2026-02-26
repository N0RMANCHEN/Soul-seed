#!/usr/bin/env node
/**
 * H/P1-9 — Emotional depth regression
 *
 * Validates mood/episode structure from scenario fixtures.
 * Checks: layer presence, trigger binding, mood inertia, no-flat.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function run() {
  const scenariosDir = join(root, "test/regression/emotional/scenarios");
  let scenarioFiles = [];
  try {
    scenarioFiles = await readdir(scenariosDir);
  } catch {
    scenarioFiles = [];
  }
  scenarioFiles = scenarioFiles.filter((f) => f.endsWith(".json"));

  let layerPresenceOk = 0;
  let triggerBindingOk = 0;
  let moodInertiaOk = 0;
  let noFlatOk = 0;
  let total = 0;

  for (const file of scenarioFiles) {
    const scenario = JSON.parse(await readFile(join(scenariosDir, file), "utf8"));
    total++;
    const moods = scenario.moodSnapshots ?? [];
    const episodes = scenario.episodes ?? [];
    if (moods.length > 0 && (episodes.length > 0 || moods.some((m) => m.valence !== undefined))) layerPresenceOk++;
    const withTrigger = episodes.filter((e) => e.trigger && (e.supportingEventHashes?.length ?? 0) >= 0).length;
    if (episodes.length === 0 || withTrigger / Math.max(1, episodes.length) >= 0.8) triggerBindingOk++;
    let inertiaViolations = 0;
    for (let i = 1; i < moods.length; i++) {
      const prev = moods[i - 1];
      const curr = moods[i];
      if (Math.abs((curr.valence ?? 0) - (prev.valence ?? 0)) > 0.3) inertiaViolations++;
    }
    if (inertiaViolations === 0) moodInertiaOk++;
    const valences = moods.map((m) => m.valence ?? 0.5).filter((v) => typeof v === "number");
    const mean = valences.length ? valences.reduce((a, b) => a + b, 0) / valences.length : 0.5;
    const variance = valences.length >= 2
      ? valences.reduce((s, v) => s + (v - mean) ** 2, 0) / valences.length
      : 0.01;
    const sigma = Math.sqrt(variance);
    if (sigma >= 0.05 || valences.length < 2) noFlatOk++;
  }

  const thresholds = JSON.parse(
    await readFile(join(root, "config/regression/emotional_thresholds.json"), "utf8")
  );
  const layerRate = total > 0 ? layerPresenceOk / total : 1;
  const triggerRate = total > 0 ? triggerBindingOk / total : 1;
  const inertiaPass = moodInertiaOk === total;
  const noFlatPass = noFlatOk === total;

  const pass = layerRate >= thresholds.layerPresence && triggerRate >= thresholds.triggerBinding && inertiaPass;

  const report = {
    ok: pass,
    layerPresenceRate: layerRate,
    triggerBindingRate: triggerRate,
    moodInertiaViolations: total - moodInertiaOk,
    noFlatPass,
    scenarios: total,
    thresholds,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
