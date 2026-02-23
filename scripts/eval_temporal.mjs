#!/usr/bin/env node
/**
 * Temporal awareness regression
 * Usage: node scripts/eval_temporal.mjs
 * Exit code: 0 = all pass, 1 = one or more failures
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const { deriveTemporalAnchor, evaluateTemporalReplyQuality } = await import(
  path.join(ROOT, "packages/core/dist/temporal_awareness.js")
);

const casesPath = path.join(ROOT, "datasets/temporal/cases.jsonl");
const lines = readFileSync(casesPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

let passed = 0;
let failed = 0;

for (const line of lines) {
  const tc = JSON.parse(line);
  const { id, kind, input, expected } = tc;

  if (kind === "anchor") {
    const anchor = deriveTemporalAnchor({
      nowMs: Date.parse(input.nowIso),
      lastUserAtMs: Date.parse(input.lastUserAtIso),
      lastAssistantAtMs: Date.parse(input.lastAssistantAtIso)
    });

    const ok =
      anchor.silenceMinutes === expected.silenceMinutes &&
      anchor.silenceLabel === expected.silenceLabel &&
      anchor.crossedDayBoundary === expected.crossedDayBoundary;

    if (ok) {
      passed++;
      console.log(`  PASS [${id}] anchor`);
    } else {
      failed++;
      console.log(`  FAIL [${id}] anchor`);
      console.log(
        `       expected minutes=${expected.silenceMinutes} label=${expected.silenceLabel} crossed=${expected.crossedDayBoundary}`
      );
      console.log(
        `       got      minutes=${anchor.silenceMinutes} label=${anchor.silenceLabel} crossed=${anchor.crossedDayBoundary}`
      );
    }
    continue;
  }

  if (kind === "quality") {
    const anchor = deriveTemporalAnchor({
      nowMs: Date.parse(input.nowIso),
      lastUserAtMs: Date.parse(input.lastUserAtIso),
      lastAssistantAtMs: Date.parse(input.lastAssistantAtIso)
    });
    const issues = evaluateTemporalReplyQuality(input.reply, anchor);
    const gotCodes = issues.map((i) => i.code).sort();
    const expectedCodes = [...expected.issueCodes].sort();
    const ok = JSON.stringify(gotCodes) === JSON.stringify(expectedCodes);
    if (ok) {
      passed++;
      console.log(`  PASS [${id}] quality`);
    } else {
      failed++;
      console.log(`  FAIL [${id}] quality`);
      console.log(`       expected=${JSON.stringify(expectedCodes)} got=${JSON.stringify(gotCodes)}`);
    }
    continue;
  }

  failed++;
  console.log(`  FAIL [${id}] unknown kind=${kind}`);
}

console.log();
console.log(`Results: ${passed} passed, ${failed} failed (total ${lines.length})`);
if (failed > 0) {
  process.exit(1);
}
