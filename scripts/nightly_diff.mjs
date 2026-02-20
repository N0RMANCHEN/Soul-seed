#!/usr/bin/env node
/**
 * nightly_diff.mjs — Nightly quality diff report generator.
 *
 * Compares current scorecard against baseline and previous history run,
 * outputs a markdown diff alert report, and exits 1 if critical regressions
 * exceed the alert threshold.
 *
 * Usage:
 *   node scripts/nightly_diff.mjs [--scorecard <path>] [--baseline <path>] [--alert-threshold <n>]
 *
 * Defaults:
 *   --scorecard        reports/quality/scorecard.json
 *   --baseline         datasets/quality/baseline.json
 *   --alert-threshold  1   (exit 1 when >= N regressions)
 *
 * Output:
 *   reports/quality/nightly-diff-<timestamp>.md
 *
 * Exit codes:
 *   0 — OK (no critical regressions)
 *   1 — alert: regressions at or above threshold
 *   2 — scorecard missing
 */

import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    scorecard:        { type: "string" },
    baseline:         { type: "string" },
    "alert-threshold":{ type: "string" },
    help:             { type: "boolean", short: "h" }
  },
  allowPositionals: false
});

if (args.help) {
  console.log("Usage: node scripts/nightly_diff.mjs [--scorecard <path>] [--baseline <path>] [--alert-threshold <n>]");
  process.exit(0);
}

const cwd = process.cwd();
const scorecardPath   = path.resolve(cwd, args.scorecard ?? "reports/quality/scorecard.json");
const baselinePath    = path.resolve(cwd, args.baseline  ?? "datasets/quality/baseline.json");
const alertThreshold  = Math.max(1, Number(args["alert-threshold"] ?? "1"));
const historyDir      = path.resolve(cwd, "reports/quality/history");
const reportDir       = path.resolve(cwd, "reports/quality");

// ── metric helpers ─────────────────────────────────────────────────────────────

const DELTA_POLICY = {
  "L1.recallAtK":                  { direction: "higher", tolerance: 0.05, critical: false },
  "L1.mrr":                        { direction: "higher", tolerance: 0.05, critical: false },
  "L1.wrongRecallRate":            { direction: "lower",  tolerance: 0.05, critical: false },
  "L1.injectionHitRate":           { direction: "higher", tolerance: 0.05, critical: false },
  "L2.groundednessPassRate":       { direction: "higher", tolerance: 0.01, critical: true  },
  "L2.ungroundedRecallLeakRate":   { direction: "lower",  tolerance: 0.01, critical: true  },
  "L2.providerLeakRate":           { direction: "lower",  tolerance: 0.005,critical: true  },
  "L3.soulPipelineP95Ms":          { direction: "lower",  tolerance: 50,   critical: false },
  "L4.identityGuardCorrectionRate":{ direction: "lower",  tolerance: 0.10, critical: false },
  "L5.jailbreakRejectRate":        { direction: "higher", tolerance: 0.10, critical: true  },
  "L5.normalAllowRate":            { direction: "higher", tolerance: 0.10, critical: false }
};

function round4(v) {
  return Math.round(Number(v || 0) * 10000) / 10000;
}

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

function checkRegression(policy, delta) {
  return policy.direction === "higher" ? delta < -policy.tolerance : delta > policy.tolerance;
}

async function loadPreviousHistoryMetrics() {
  if (!existsSync(historyDir)) return null;
  try {
    const entries = (await readdir(historyDir))
      .filter(f => f.endsWith(".json"))
      .sort()
      .reverse();
    if (entries.length === 0) return null;
    const latest = JSON.parse(await readFile(path.join(historyDir, entries[0]), "utf8"));
    return { metrics: extractMetrics(latest), runId: latest.runId, timestamp: latest.timestamp };
  } catch {
    return null;
  }
}

async function saveToHistory(scorecard) {
  await mkdir(historyDir, { recursive: true });
  const ts = scorecard.timestamp?.replace(/[:.]/g, "-") ?? Date.now();
  const outPath = path.join(historyDir, `scorecard-${ts}.json`);
  await writeFile(outPath, `${JSON.stringify(scorecard, null, 2)}\n`, "utf8");
  // Keep at most 30 history files
  const entries = (await readdir(historyDir)).filter(f => f.endsWith(".json")).sort();
  if (entries.length > 30) {
    const { rm } = await import("node:fs/promises");
    for (const old of entries.slice(0, entries.length - 30)) {
      await rm(path.join(historyDir, old), { force: true });
    }
  }
  return outPath;
}

function formatTable(rows) {
  return [
    "| Metric | Baseline | Current | Δ | Status |",
    "|--------|----------|---------|---|--------|",
    ...rows
  ].join("\n");
}

async function main() {
  if (!existsSync(scorecardPath)) {
    console.error(`[nightly_diff] scorecard not found: ${scorecardPath}`);
    process.exit(2);
  }

  const scorecard = JSON.parse(await readFile(scorecardPath, "utf8"));
  const current   = extractMetrics(scorecard);
  const timestamp = new Date().toISOString();
  const ts        = timestamp.replace(/[:.]/g, "-");

  // Save current to history
  const historyPath = await saveToHistory(scorecard);
  console.log(`[nightly_diff] saved to history: ${historyPath}`);

  // Load baseline and previous history
  const baseline = existsSync(baselinePath)
    ? JSON.parse(await readFile(baselinePath, "utf8"))
    : null;
  const prev = await loadPreviousHistoryMetrics();

  const regressions = [];
  const tableRows   = [];

  for (const [key, policy] of Object.entries(DELTA_POLICY)) {
    const baseVal  = baseline?.metrics?.[key];
    const curVal   = current[key];
    if (curVal == null) continue;

    const baseStr  = baseVal != null ? String(baseVal) : "N/A";
    const delta    = baseVal != null ? round4(curVal - baseVal) : null;
    const sign     = delta != null ? (delta >= 0 ? "+" : "") : "";
    const deltaStr = delta != null ? `${sign}${delta}` : "—";
    const reg      = delta != null && checkRegression(policy, delta);

    const prevVal  = prev?.metrics?.[key];
    const prevDelta = prevVal != null ? round4(curVal - prevVal) : null;
    const prevStr  = prevDelta != null ? ` (prev: ${prevDelta >= 0 ? "+" : ""}${prevDelta})` : "";

    const statusIcon = reg ? (policy.critical ? "🔴 CRITICAL" : "⚠️  WARN") : "✅";
    tableRows.push(`| ${key} | ${baseStr} | ${curVal}${prevStr} | ${deltaStr} | ${statusIcon} |`);

    if (reg) {
      regressions.push({ key, baseVal, curVal, delta, policy });
    }
  }

  // Build overall layer pass/fail table
  const layerRows = Object.entries(scorecard.layers ?? {}).map(([layer, data]) => {
    const icon = data.pass ? "✅" : "❌";
    return `| ${layer} | ${icon} ${data.pass ? "PASS" : "FAIL"} |`;
  });

  const lines = [
    "# Nightly Quality Diff Report",
    "",
    `- Generated: ${timestamp}`,
    `- Suite: ${scorecard.suite ?? "nightly"}`,
    `- RunId: ${scorecard.runId ?? "unknown"}`,
    `- GitSha: ${scorecard.gitSha ?? "local"}`,
    `- Overall Pass: ${scorecard.pass ? "✅ YES" : "❌ NO"}`,
    `- Baseline: ${baseline ? `${baseline.savedAt} (${baseline.gitSha})` : "none"}`,
    `- Previous History: ${prev ? `${prev.timestamp} (${prev.runId})` : "none"}`,
    `- Regressions vs Baseline: ${regressions.length}`,
    "",
    "## Layer Summary",
    "",
    "| Layer | Status |",
    "|-------|--------|",
    ...layerRows,
    "",
    "## Metric Delta vs Baseline",
    "",
    formatTable(tableRows),
    ""
  ];

  const critical = regressions.filter(r => r.policy.critical);

  if (regressions.length > 0) {
    lines.push("## ⚠️  Regression Details", "");
    for (const r of regressions) {
      const severity = r.policy.critical ? "🔴 CRITICAL" : "⚠️  WARN";
      lines.push(`- ${severity} **${r.key}**: ${r.policy.direction === "higher" ? "dropped" : "increased"} ${Math.abs(r.delta).toFixed(4)} from baseline ${r.baseVal} → ${r.curVal} (tolerance ${r.policy.tolerance})`);
    }
    lines.push("");
  }

  if (scorecard.regressions?.length > 0) {
    lines.push("## Scorecard Regressions", "");
    for (const r of scorecard.regressions) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  const reportFile = path.join(reportDir, `nightly-diff-${ts}.md`);
  await mkdir(reportDir, { recursive: true });
  await writeFile(reportFile, lines.join("\n"), "utf8");

  console.log(`[nightly_diff] report: ${reportFile}`);
  console.log(`[nightly_diff] regressions: ${regressions.length} (critical: ${critical.length})`);

  if (regressions.length >= alertThreshold) {
    console.error(`[nightly_diff] ALERT: ${regressions.length} regression(s) detected (threshold=${alertThreshold})`);
    if (critical.length > 0) {
      console.error(`[nightly_diff] CRITICAL metrics regressed: ${critical.map(r => r.key).join(", ")}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[nightly_diff] fatal: ${err?.stack || err}`);
  process.exit(1);
});
