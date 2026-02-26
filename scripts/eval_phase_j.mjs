#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { decide, initPersonaPackage, loadPersonaPackage } from "../packages/core/dist/index.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    dataset: { type: "string" },
    out: { type: "string" },
    md: { type: "string" },
    strict: { type: "boolean", default: false }
  }
});

const DATASET_PATH = path.resolve(process.cwd(), values.dataset ?? "datasets/quality/phase_j_engagement_cases.json");
const OUT_PATH = path.resolve(process.cwd(), values.out ?? "reports/quality/phase_j_scorecard.json");
const MD_PATH = path.resolve(process.cwd(), values.md ?? "reports/quality/phase_j_scorecard.md");
const STRICT = values.strict === true;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function round4(value) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}

function normalizeCase(input) {
  return {
    id: String(input.id ?? ""),
    userInput: String(input.userInput ?? ""),
    topicState: input.topicState ?? undefined,
    interests: Array.isArray(input.interests) ? input.interests.map((x) => String(x)).slice(0, 8) : [],
    expected: input.expected ?? {}
  };
}

function baselineSelectTopic(testCase) {
  const active = String(testCase.topicState?.activeTopic ?? "").trim();
  if (active.length > 0) return active;
  if (testCase.interests.length > 0) return testCase.interests[0];
  return "";
}

function evaluateAgainstExpectation(testCase, trace) {
  const scheduler = trace.conversationControl?.topicScheduler;
  const expected = testCase.expected ?? {};
  const mismatches = [];
  if (typeof expected.activeTopic === "string" && scheduler?.activeTopic !== expected.activeTopic) {
    mismatches.push(`activeTopic expected=${expected.activeTopic} actual=${scheduler?.activeTopic ?? "none"}`);
  }
  if (typeof expected.selectedBy === "string" && scheduler?.selectedBy !== expected.selectedBy) {
    mismatches.push(`selectedBy expected=${expected.selectedBy} actual=${scheduler?.selectedBy ?? "none"}`);
  }
  if (typeof expected.starvationBoostApplied === "boolean" && scheduler?.starvationBoostApplied !== expected.starvationBoostApplied) {
    mismatches.push(
      `starvationBoostApplied expected=${expected.starvationBoostApplied} actual=${scheduler?.starvationBoostApplied ?? false}`
    );
  }
  if (typeof expected.bridgeFromTopic === "string" && scheduler?.bridgeFromTopic !== expected.bridgeFromTopic) {
    mismatches.push(`bridgeFromTopic expected=${expected.bridgeFromTopic} actual=${scheduler?.bridgeFromTopic ?? "none"}`);
  }
  return mismatches;
}

function renderMarkdown(report) {
  const lines = [
    "# Phase J Evaluation Scorecard",
    "",
    `- Timestamp: ${report.timestamp}`,
    `- Dataset: ${report.dataset}`,
    `- Cases: ${report.totalCases}`,
    `- Pass: ${report.pass}`,
    "",
    "## Replay",
    `- ReplayPassRate: ${report.metrics.replayPassRate}`,
    `- TopicHitRate(B): ${report.metrics.topicHitRateB}`,
    `- TopicHitRate(A baseline): ${report.metrics.topicHitRateA}`,
    `- TopicHitDelta(B-A): ${report.metrics.topicHitDelta}`,
    `- BridgeCoverage(B): ${report.metrics.bridgeCoverageB}`,
    `- StarvationProtection(B): ${report.metrics.starvationProtectionB}`,
    "",
    "## Gates",
    `- replayPassRate >= 0.95: ${report.gates.replayPassRate ? "pass" : "fail"}`,
    `- topicHitRateB >= 0.80: ${report.gates.topicHitRateB ? "pass" : "fail"}`,
    `- topicHitDelta >= 0.15: ${report.gates.topicHitDelta ? "pass" : "fail"}`,
    "",
    "## Failures"
  ];
  if (report.failures.length === 0) {
    lines.push("- none");
  } else {
    for (const item of report.failures) {
      lines.push(`- ${item.id}: ${item.mismatches.join("; ")}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (!existsSync(DATASET_PATH)) {
    throw new Error(`dataset not found: ${DATASET_PATH}`);
  }
  const datasetRaw = JSON.parse(await readFile(DATASET_PATH, "utf8"));
  const cases = Array.isArray(datasetRaw.cases) ? datasetRaw.cases.map(normalizeCase).filter((x) => x.id && x.userInput) : [];
  if (cases.length === 0) {
    throw new Error("dataset.cases is empty");
  }

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "soulseed-phasej-eval-"));
  const personaPath = path.join(tmpRoot, "PhaseJEval.soulseedpersona");
  try {
    await initPersonaPackage(personaPath, "PhaseJEval");
    const pkg = await loadPersonaPackage(personaPath);

    let bTopicHits = 0;
    let aTopicHits = 0;
    let replayPass = 0;
    let bridgeExpected = 0;
    let bridgeHit = 0;
    let starvationExpected = 0;
    let starvationHit = 0;
    const failures = [];

    for (const testCase of cases) {
      pkg.topicState = testCase.topicState;
      pkg.interests = {
        topTopics: testCase.interests,
        curiosity: 0.8,
        updatedAt: new Date().toISOString()
      };

      const trace = decide(pkg, testCase.userInput, "mock-adapter");
      const scheduler = trace.conversationControl?.topicScheduler;
      const expectedTopic = typeof testCase.expected?.activeTopic === "string" ? testCase.expected.activeTopic : "";
      const expectedBridge = typeof testCase.expected?.bridgeFromTopic === "string" ? testCase.expected.bridgeFromTopic : "";
      const expectedStarvation = testCase.expected?.starvationBoostApplied === true;

      if (expectedTopic && scheduler?.activeTopic === expectedTopic) bTopicHits += 1;
      if (expectedTopic && baselineSelectTopic(testCase) === expectedTopic) aTopicHits += 1;
      if (expectedBridge) {
        bridgeExpected += 1;
        if (scheduler?.bridgeFromTopic === expectedBridge) bridgeHit += 1;
      }
      if (expectedStarvation) {
        starvationExpected += 1;
        if (scheduler?.starvationBoostApplied === true) starvationHit += 1;
      }

      const mismatches = evaluateAgainstExpectation(testCase, trace);
      if (mismatches.length === 0) {
        replayPass += 1;
      } else {
        failures.push({
          id: testCase.id,
          input: testCase.userInput,
          scheduler: scheduler ?? null,
          reasonCodes: trace.conversationControl?.reasonCodes ?? [],
          mismatches
        });
      }
    }

    const replayPassRate = round4(replayPass / cases.length);
    const topicHitRateB = round4(bTopicHits / cases.length);
    const topicHitRateA = round4(aTopicHits / cases.length);
    const topicHitDelta = round4(topicHitRateB - topicHitRateA);
    const bridgeCoverageB = round4(bridgeExpected > 0 ? bridgeHit / bridgeExpected : 1);
    const starvationProtectionB = round4(starvationExpected > 0 ? starvationHit / starvationExpected : 1);

    const gates = {
      replayPassRate: replayPassRate >= 0.95,
      topicHitRateB: topicHitRateB >= 0.8,
      topicHitDelta: topicHitDelta >= 0.15
    };

    const report = {
      timestamp: new Date().toISOString(),
      suite: "phase-j",
      dataset: path.relative(process.cwd(), DATASET_PATH),
      totalCases: cases.length,
      pass: gates.replayPassRate && gates.topicHitRateB && gates.topicHitDelta,
      metrics: {
        replayPassRate,
        topicHitRateA,
        topicHitRateB,
        topicHitDelta,
        bridgeCoverageB,
        starvationProtectionB
      },
      gates,
      failures
    };

    await mkdir(path.dirname(OUT_PATH), { recursive: true });
    await writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await mkdir(path.dirname(MD_PATH), { recursive: true });
    await writeFile(MD_PATH, `${renderMarkdown(report)}\n`, "utf8");

    console.log(JSON.stringify(report, null, 2));
    if (STRICT && !report.pass) {
      process.exitCode = 1;
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

await main();
