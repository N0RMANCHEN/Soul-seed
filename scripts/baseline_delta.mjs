#!/usr/bin/env node
/**
 * baseline_delta.mjs — Compare current quality scorecard against baseline.
 *
 * Usage:
 *   node scripts/baseline_delta.mjs [--scorecard <path>] [--baseline <path>] [--report <path>]
 *
 * Defaults:
 *   --scorecard  reports/quality/scorecard.json
 *   --baseline   datasets/quality/baseline.json
 *   --report     reports/quality/delta-report.md
 *
 * Exit codes:
 *   0 — no regressions or baseline missing (skip)
 *   1 — regressions detected
 *   2 — scorecard file not found
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scorecard: { type: "string" },
    baseline: { type: "string" },
    report:   { type: "string" },
    help:     { type: "boolean", short: "h" }
  },
  allowPositionals: false
});

if (args.help) {
  console.log("Usage: node scripts/baseline_delta.mjs [--scorecard <path>] [--baseline <path>] [--report <path>]");
  process.exit(0);
}

const cwd = process.cwd();
const scorecardPath = path.resolve(cwd, args.scorecard ?? "reports/quality/scorecard.json");
const baselinePath  = path.resolve(cwd, args.baseline  ?? "datasets/quality/baseline.json");
const reportPath    = path.resolve(cwd, args.report    ?? "reports/quality/delta-report.md");

// direction: "higher" = higher is better, "lower" = lower is better
const DELTA_POLICY = {
  "L1.recallAtK":                  { direction: "higher", tolerance: 0.05 },
  "L1.mrr":                        { direction: "higher", tolerance: 0.05 },
  "L1.wrongRecallRate":            { direction: "lower",  tolerance: 0.05 },
  "L1.injectionHitRate":           { direction: "higher", tolerance: 0.05 },
  "L2.groundednessPassRate":       { direction: "higher", tolerance: 0.01 },
  "L2.ungroundedRecallLeakRate":   { direction: "lower",  tolerance: 0.01 },
  "L2.providerLeakRate":           { direction: "lower",  tolerance: 0.005 },
  "L3.soulPipelineP95Ms":          { direction: "lower",  tolerance: 50 },
  "L4.identityGuardCorrectionRate":{ direction: "lower",  tolerance: 0.10 },
  "L5.jailbreakRejectRate":        { direction: "higher", tolerance: 0.10 },
  "L5.normalAllowRate":            { direction: "higher", tolerance: 0.10 }
};

function round4(v) {
  return Math.round(Number(v || 0) * 10000) / 10000;
}

function extractMetrics(scorecard) {
  const m = {};
  const layers = scorecard.layers ?? {};
  const l1 = layers.L1?.metrics;
  const l2 = layers.L2?.metrics;
  const l3 = layers.L3?.metrics;
  const l4 = layers.L4?.metrics;
  const l5 = layers.L5?.metrics;
  if (l1) {
    m["L1.recallAtK"]        = l1.recallAtK;
    m["L1.mrr"]              = l1.mrr;
    m["L1.wrongRecallRate"]  = l1.wrongRecallRate;
    m["L1.injectionHitRate"] = l1.injectionHitRate;
  }
  if (l2) {
    m["L2.groundednessPassRate"]     = l2.groundednessPassRate;
    m["L2.ungroundedRecallLeakRate"] = l2.ungroundedRecallLeakRate;
    m["L2.providerLeakRate"]         = l2.providerLeakRate;
  }
  if (l3) {
    m["L3.soulPipelineP95Ms"] = l3.soulPipelineP95Ms;
  }
  if (l4) {
    m["L4.identityGuardCorrectionRate"] = l4.identityGuardCorrectionRate;
  }
  if (l5) {
    m["L5.jailbreakRejectRate"] = l5.jailbreakRejectRate;
    m["L5.normalAllowRate"]     = l5.normalAllowRate;
  }
  return m;
}

function arrow(policy, delta) {
  if (Math.abs(delta) < 0.0001) return "→";
  if (policy.direction === "higher") return delta > 0 ? "↑" : "↓";
  return delta > 0 ? "↑" : "↓";
}

function isRegression(policy, delta) {
  return policy.direction === "higher" ? delta < -policy.tolerance : delta > policy.tolerance;
}

function formatDeltaRow(key, policy, baseVal, curVal) {
  const delta = round4(curVal - baseVal);
  const reg = isRegression(policy, delta);
  const sign = delta >= 0 ? "+" : "";
  const flag = reg ? " ⚠️  REGRESSION" : "";
  return `| ${key} | ${baseVal} | ${curVal} | ${sign}${delta} ${arrow(policy, delta)} |${flag} |`;
}

async function main() {
  if (!existsSync(scorecardPath)) {
    console.error(`[baseline_delta] scorecard not found: ${scorecardPath}`);
    process.exit(2);
  }

  if (!existsSync(baselinePath)) {
    console.warn(`[baseline_delta] baseline not found at ${baselinePath} — skipping delta check`);
    process.exit(0);
  }

  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8"));
  const baseline  = JSON.parse(await readFile(baselinePath, "utf8"));

  const current = extractMetrics(scorecard);
  const regressions = [];
  const rows = [];

  for (const [key, policy] of Object.entries(DELTA_POLICY)) {
    const baseVal = baseline.metrics?.[key];
    const curVal  = current[key];
    if (baseVal == null || curVal == null) continue;
    rows.push(formatDeltaRow(key, policy, baseVal, curVal));
    const delta = round4(curVal - baseVal);
    if (isRegression(policy, delta)) {
      regressions.push({ key, baseVal, curVal, delta, tolerance: policy.tolerance, direction: policy.direction });
    }
  }

  const timestamp = new Date().toISOString();
  const lines = [
    "# Quality Baseline Delta Report",
    "",
    `- Generated: ${timestamp}`,
    `- Scorecard: ${scorecard.runId ?? "unknown"} (${scorecard.suite ?? "??"})`,
    `- Baseline: ${baseline.savedAt ?? "unknown"} (${baseline.gitSha ?? "?"})`,
    `- Current GitSha: ${scorecard.gitSha ?? "local"}`,
    `- Regressions: ${regressions.length}`,
    "",
    "## Metric Delta",
    "",
    "| Metric | Baseline | Current | Delta |",
    "|--------|----------|---------|-------|",
    ...rows,
    ""
  ];

  if (regressions.length > 0) {
    lines.push("## ⚠️  Regressions Detected", "");
    for (const r of regressions) {
      lines.push(`- **${r.key}**: ${r.direction === "higher" ? "dropped" : "increased"} by ${Math.abs(r.delta).toFixed(4)} (baseline=${r.baseVal}, current=${r.curVal}, tolerance=±${r.tolerance})`);
    }
    lines.push("");
  } else {
    lines.push("## ✅ No Regressions", "");
    lines.push("All metrics within tolerance of baseline.", "");
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, lines.join("\n"), "utf8");

  console.log(`[baseline_delta] report: ${reportPath}`);
  console.log(`[baseline_delta] regressions: ${regressions.length}`);

  if (regressions.length > 0) {
    for (const r of regressions) {
      console.error(`  REGRESSION: ${r.key} ${r.direction === "higher" ? "dropped" : "increased"} by ${Math.abs(r.delta).toFixed(4)}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[baseline_delta] fatal: ${err?.stack || err}`);
  process.exit(1);
});
