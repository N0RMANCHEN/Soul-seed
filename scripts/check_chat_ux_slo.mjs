#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const out = {
    persona: "",
    minSamples: Number(process.env.SOULSEED_UX_MIN_SAMPLES ?? 10),
    p95TtftMs: Number(process.env.SOULSEED_SLO_P95_TTFT_MS ?? 700),
    p95TtfsMs: Number(process.env.SOULSEED_SLO_P95_TTFS_MS ?? 1800),
    p95TtfrMs: Number(process.env.SOULSEED_SLO_P95_TTFR_MS ?? 4500)
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = String(argv[i + 1] ?? "");
    if (arg === "--persona") {
      out.persona = value;
      i += 1;
    } else if (arg === "--min-samples") {
      out.minSamples = Number(value);
      i += 1;
    } else if (arg === "--p95-ttft-ms") {
      out.p95TtftMs = Number(value);
      i += 1;
    } else if (arg === "--p95-ttfs-ms") {
      out.p95TtfsMs = Number(value);
      i += 1;
    } else if (arg === "--p95-ttfr-ms") {
      out.p95TtfrMs = Number(value);
      i += 1;
    }
  }
  return out;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function collectLifeLogPath(personaPath) {
  const candidates = ["life.log.jsonl", "life.log"].map((name) => path.join(personaPath, name));
  return candidates.find((filePath) => fs.existsSync(filePath)) ?? "";
}

const args = parseArgs(process.argv);
if (!args.persona) {
  console.error("usage: node scripts/check_chat_ux_slo.mjs --persona <persona-path> [--min-samples N]");
  process.exit(1);
}

const lifeLogPath = collectLifeLogPath(args.persona);
if (!lifeLogPath) {
  console.error(`life log not found under: ${args.persona}`);
  process.exit(1);
}

const lines = fs.readFileSync(lifeLogPath, "utf8").split(/\r?\n/).filter(Boolean);
const ttft = [];
const ttfs = [];
const ttfr = [];

for (const line of lines) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    continue;
  }
  if (event?.type !== "turn_latency_profiled") continue;
  const payload = event.payload ?? {};
  const ttftMs = Number(payload.ttftMs);
  const ttfsMs = Number(payload.ttfsMs);
  const ttfrMs = Number(payload.ttfrMs);
  if (Number.isFinite(ttftMs) && ttftMs >= 0) ttft.push(ttftMs);
  if (Number.isFinite(ttfsMs) && ttfsMs >= 0) ttfs.push(ttfsMs);
  if (Number.isFinite(ttfrMs) && ttfrMs >= 0) ttfr.push(ttfrMs);
}

const sampleCount = ttfr.length;
if (sampleCount < Math.max(1, Math.floor(args.minSamples))) {
  console.error(`[ux-slo] insufficient samples: got=${sampleCount}, required=${args.minSamples}`);
  process.exit(1);
}

const p95Ttft = percentile(ttft, 95);
const p95Ttfs = percentile(ttfs, 95);
const p95Ttfr = percentile(ttfr, 95);

console.log(JSON.stringify({
  sampleCount,
  p95: {
    ttftMs: p95Ttft,
    ttfsMs: p95Ttfs,
    ttfrMs: p95Ttfr
  },
  thresholds: {
    ttftMs: args.p95TtftMs,
    ttfsMs: args.p95TtfsMs,
    ttfrMs: args.p95TtfrMs
  }
}, null, 2));

const failures = [];
if (ttft.length > 0 && p95Ttft > args.p95TtftMs) failures.push(`P95 TTFT ${p95Ttft}ms > ${args.p95TtftMs}ms`);
if (ttfs.length > 0 && p95Ttfs > args.p95TtfsMs) failures.push(`P95 TTFS ${p95Ttfs}ms > ${args.p95TtfsMs}ms`);
if (p95Ttfr > args.p95TtfrMs) failures.push(`P95 TTFR ${p95Ttfr}ms > ${args.p95TtfrMs}ms`);

if (failures.length > 0) {
  console.error(`[ux-slo] failed: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("[ux-slo] pass");
