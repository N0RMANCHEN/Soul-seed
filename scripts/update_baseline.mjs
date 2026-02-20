#!/usr/bin/env node
/**
 * update_baseline.mjs — Update quality baseline from current scorecard.
 *
 * Usage:
 *   node scripts/update_baseline.mjs [--scorecard <path>] [--baseline <path>] [--force]
 *
 * Defaults:
 *   --scorecard  reports/quality/scorecard.json
 *   --baseline   datasets/quality/baseline.json
 *
 * Only updates if scorecard passed (use --force to override).
 *
 * Exit codes:
 *   0 — baseline updated
 *   1 — scorecard failed (use --force to override)
 *   2 — scorecard not found
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scorecard: { type: "string" },
    baseline:  { type: "string" },
    force:     { type: "boolean", default: false },
    help:      { type: "boolean", short: "h" }
  },
  allowPositionals: false
});

if (args.help) {
  console.log("Usage: node scripts/update_baseline.mjs [--scorecard <path>] [--baseline <path>] [--force]");
  process.exit(0);
}

const cwd = process.cwd();
const scorecardPath = path.resolve(cwd, args.scorecard ?? "reports/quality/scorecard.json");
const baselinePath  = path.resolve(cwd, args.baseline  ?? "datasets/quality/baseline.json");

function extractMetrics(scorecard) {
  const m = {};
  const layers = scorecard.layers ?? {};
  const pairs = [
    ["L1", ["recallAtK","mrr","wrongRecallRate","injectionHitRate"]],
    ["L2", ["groundednessPassRate","ungroundedRecallLeakRate","providerLeakRate"]],
    ["L3", ["soulPipelineP95Ms"]],
    ["L4", ["identityGuardCorrectionRate"]],
    ["L5", ["jailbreakRejectRate","normalAllowRate"]]
  ];
  for (const [layer, keys] of pairs) {
    const metrics = layers[layer]?.metrics;
    if (!metrics) continue;
    for (const k of keys) {
      if (metrics[k] != null) m[`${layer}.${k}`] = metrics[k];
    }
  }
  return m;
}

async function main() {
  if (!existsSync(scorecardPath)) {
    console.error(`[update_baseline] scorecard not found: ${scorecardPath}`);
    process.exit(2);
  }

  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8"));

  if (!scorecard.pass && !args.force) {
    console.error(`[update_baseline] scorecard did not pass — baseline NOT updated`);
    console.error(`[update_baseline] use --force to override`);
    process.exit(1);
  }

  if (!scorecard.pass && args.force) {
    console.warn(`[update_baseline] WARNING: forcing baseline update from a FAILED scorecard`);
  }

  const metrics = extractMetrics(scorecard);
  const newBaseline = {
    version: "1",
    savedAt: new Date().toISOString(),
    gitSha: scorecard.gitSha ?? "local",
    suite: scorecard.suite ?? "unknown",
    metrics
  };

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(newBaseline, null, 2)}\n`, "utf8");

  console.log(`[update_baseline] updated: ${baselinePath}`);
  console.log(`[update_baseline] metrics saved: ${Object.keys(metrics).join(", ")}`);
}

main().catch((err) => {
  console.error(`[update_baseline] fatal: ${err?.stack || err}`);
  process.exit(1);
});
