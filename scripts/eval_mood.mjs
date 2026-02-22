#!/usr/bin/env node
/**
 * P0-15: Mood latent regression test
 * Loads datasets/mood/cases.jsonl, runs projectMoodLatent + inferDominantEmotion,
 * compares against expected values, prints pass/fail report.
 *
 * Usage: node scripts/eval_mood.mjs
 * Exit code: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load compiled core (requires npm run build first)
const { projectMoodLatent, inferDominantEmotion } = await import(
  path.join(ROOT, "packages/core/dist/mood_state.js")
);

const casesPath = path.join(ROOT, "datasets/mood/cases.jsonl");
const lines = readFileSync(casesPath, "utf8")
  .split("\n")
  .filter((l) => l.trim().length > 0);

let passed = 0;
let failed = 0;
const failures = [];

for (const line of lines) {
  const tc = JSON.parse(line);
  const { id, desc, moodLatent, expected } = tc;

  const result = projectMoodLatent(moodLatent);

  const valenceDiff = Math.abs(result.valence - expected.valence);
  const arousalDiff = Math.abs(result.arousal - expected.arousal);
  const emotionMatch = result.dominantEmotion === expected.dominantEmotion;

  const ok = valenceDiff < 0.001 && arousalDiff < 0.001 && emotionMatch;

  if (ok) {
    passed++;
    console.log(`  PASS [${id}] ${desc}`);
  } else {
    failed++;
    const details = [];
    if (valenceDiff >= 0.001) details.push(`valence: expected=${expected.valence} got=${result.valence.toFixed(4)}`);
    if (arousalDiff >= 0.001) details.push(`arousal: expected=${expected.arousal} got=${result.arousal.toFixed(4)}`);
    if (!emotionMatch) details.push(`emotion: expected=${expected.dominantEmotion} got=${result.dominantEmotion}`);
    console.log(`  FAIL [${id}] ${desc}`);
    console.log(`       ${details.join(", ")}`);
    failures.push({ id, desc, details });
  }
}

console.log();
console.log(`Results: ${passed} passed, ${failed} failed (total ${lines.length})`);

if (failed > 0) {
  console.error(`\n${failed} regression(s) failed. Review datasets/mood/cases.jsonl and mood_state.ts.`);
  process.exit(1);
}
