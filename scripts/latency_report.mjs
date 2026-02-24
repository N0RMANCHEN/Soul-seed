#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const STAGES = ["routing", "recall", "planning", "llm_primary", "llm_meta", "guard", "rewrite", "emit"];

function parseArgs(argv) {
  const out = { persona: "", out: "" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--persona") out.persona = String(argv[i + 1] ?? "");
    if (arg === "--out") out.out = String(argv[i + 1] ?? "");
    if (arg === "--persona" || arg === "--out") i += 1;
  }
  return out;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

const args = parseArgs(process.argv);
if (!args.persona) {
  console.error("usage: node scripts/latency_report.mjs --persona <path> [--out report.json]");
  process.exit(1);
}

const lifeLogPath = path.join(args.persona, "life.log");
if (!fs.existsSync(lifeLogPath)) {
  console.error(`life.log not found: ${lifeLogPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(lifeLogPath, "utf8").split(/\r?\n/).filter(Boolean);
const totals = [];
const stageBuckets = new Map(STAGES.map((s) => [s, []]));

for (const line of lines) {
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    continue;
  }
  const payload = parsed?.payload;
  if (!payload || parsed?.type !== "turn_latency_profiled") continue;
  const total = Number(payload.totalMs);
  if (Number.isFinite(total) && total >= 0) totals.push(total);
  const breakdown = payload.breakdown && typeof payload.breakdown === "object" ? payload.breakdown : {};
  for (const stage of STAGES) {
    const n = Number(breakdown[stage]);
    if (Number.isFinite(n) && n >= 0) stageBuckets.get(stage).push(n);
  }
}

const result = {
  sampleCount: totals.length,
  totalMs: {
    avg: Number(mean(totals).toFixed(2)),
    p50: percentile([...totals].sort((a, b) => a - b), 50),
    p95: percentile([...totals].sort((a, b) => a - b), 95)
  },
  stages: Object.fromEntries(
    STAGES.map((stage) => {
      const values = stageBuckets.get(stage);
      return [
        stage,
        {
          avg: Number(mean(values).toFixed(2)),
          p50: percentile([...values].sort((a, b) => a - b), 50),
          p95: percentile([...values].sort((a, b) => a - b), 95),
          shareOfTotal: totals.length > 0 ? Number((mean(values) / Math.max(1, mean(totals))).toFixed(4)) : 0
        }
      ];
    })
  )
};

if (args.out) {
  fs.writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(result, null, 2));
