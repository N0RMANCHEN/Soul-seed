#!/usr/bin/env node
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import {
  arbitrateMultiPersonaTurn,
  createDefaultGroupPolicy,
  createDefaultSpeakerRegistry,
  scheduleTurn,
  createInitialTurnState,
  createContextBusState,
  checkAccessPermission,
  assertNoLeakage,
  postMessage,
  formatSpeakerLabel,
  computeCooperationLatencyBudget
} from "../packages/core/dist/index.js";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    dataset: { type: "string" },
    out: { type: "string" },
    md: { type: "string" },
    strict: { type: "boolean", default: false }
  }
});

const DATASET_PATH = path.resolve(process.cwd(), values.dataset ?? "test/fixtures/k_eval/scenarios.json");
const OUT_PATH = path.resolve(process.cwd(), values.out ?? "reports/quality/phase_k_scorecard.json");
const MD_PATH = path.resolve(process.cwd(), values.md ?? "reports/quality/phase_k_scorecard.md");
const STRICT = values.strict === true;

const THRESHOLDS = {
  arbitrationAccuracy: 0.90,
  leakageRate: 0,
  turnMonopolyRate: 0.05,
  speakerLabelAccuracy: 1.0,
  cooperationLatencyRatio: 1.5
};

function round4(v) {
  return Math.round(Number(v || 0) * 10000) / 10000;
}

function computeAddressingScore(userInput, displayName) {
  if (!displayName) return 0;
  const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const atPattern = new RegExp(`@${escaped}`, "iu");
  if (atPattern.test(userInput)) return 0.95;
  if (userInput.includes(displayName)) return 0.95;
  return 0;
}

function runScenario(scenario) {
  const policy = createDefaultGroupPolicy();
  policy.isolationLevel = scenario.isolationLevel ?? "strict";
  policy.turnScheduling.maxConsecutiveTurns = scenario.expected?.maxConsecutiveTurns ?? 2;

  const registry = createDefaultSpeakerRegistry();
  registry.entries = scenario.participants.map((p) => ({
    actorId: p.actorId,
    actorLabel: p.displayName,
    role: p.role ?? "assistant",
    displayName: p.displayName,
    registeredAt: new Date().toISOString()
  }));

  const overrides = scenario.candidateOverrides ?? {};
  const candidates = scenario.participants.map((p) => ({
    actorId: p.actorId,
    displayName: p.displayName,
    addressingScore: computeAddressingScore(scenario.userInput, p.displayName),
    interestScore: overrides[p.actorId]?.interestScore ?? 0.5,
    recentTurnCount: overrides[p.actorId]?.recentTurnCount ?? 0
  }));

  const arbResult = arbitrateMultiPersonaTurn({
    userInput: scenario.userInput,
    registry,
    policy,
    candidates
  });

  const turnState = createInitialTurnState();
  if (scenario.candidateOverrides) {
    for (const p of scenario.participants) {
      const count = overrides[p.actorId]?.recentTurnCount ?? 0;
      for (let i = 0; i < count; i++) {
        turnState.history.push({
          actorId: p.actorId,
          turnIndex: turnState.nextTurnIndex,
          timestamp: new Date().toISOString()
        });
        turnState.nextTurnIndex++;
      }
    }
  }

  const schedResult = scheduleTurn({
    state: turnState,
    policy,
    registry,
    arbitrationResult: arbResult
  });

  const actorIds = scenario.participants.map((p) => p.actorId);
  const busConfig = {
    isolationLevel: policy.isolationLevel,
    participants: actorIds,
    currentActorId: actorIds[0] ?? ""
  };

  let busState = createContextBusState();

  for (const p of scenario.participants) {
    const selfMsg = {
      channel: "private",
      fromActorId: p.actorId,
      content: "own private content",
      timestamp: new Date().toISOString()
    };
    const selfResult = postMessage(busState, { ...busConfig, currentActorId: p.actorId }, selfMsg);
    busState = selfResult.nextState;
  }

  for (const p of scenario.participants) {
    for (const other of scenario.participants) {
      if (p.actorId !== other.actorId) {
        const crossMsg = {
          channel: "private",
          fromActorId: p.actorId,
          toActorId: other.actorId,
          content: "cross-actor private probe",
          timestamp: new Date().toISOString()
        };
        const crossResult = postMessage(busState, { ...busConfig, currentActorId: p.actorId }, crossMsg);
        busState = crossResult.nextState;
      }
    }
  }

  const leakCheck = assertNoLeakage(busState, busConfig);

  const selectedActor = arbResult.selectedActorId
    ? scenario.participants.find((p) => p.actorId === arbResult.selectedActorId)
    : null;
  const expectedLabel = scenario.expected?.speakerLabel ?? null;
  const actualLabel = selectedActor
    ? formatSpeakerLabel(selectedActor.role ?? "assistant", selectedActor.displayName)
    : "";
  const labelMatch = expectedLabel === null || actualLabel === expectedLabel;

  const cooperationBudget = computeCooperationLatencyBudget(policy, scenario.participants.length);
  const latencyRatio = cooperationBudget / policy.turnScheduling.timeoutMs;

  return {
    scenarioId: scenario.id,
    arbitrationCorrect: arbResult.selectedActorId === scenario.expected?.selectedActorId,
    leakageDetected: !leakCheck.ok,
    monopolyDetected: schedResult.antiMonopolyApplied,
    speakerLabelCorrect: labelMatch,
    cooperationLatencyRatio: round4(latencyRatio),
    selectedActorId: arbResult.selectedActorId,
    expectedActorId: scenario.expected?.selectedActorId ?? null,
    error: null
  };
}

function safeRunScenario(scenario) {
  try {
    return runScenario(scenario);
  } catch (err) {
    return {
      scenarioId: scenario?.id ?? "unknown",
      arbitrationCorrect: false,
      leakageDetected: true,
      monopolyDetected: false,
      speakerLabelCorrect: false,
      cooperationLatencyRatio: Infinity,
      selectedActorId: null,
      expectedActorId: scenario?.expected?.selectedActorId ?? null,
      error: String(err?.message ?? err)
    };
  }
}

async function main() {
  const raw = await readFile(DATASET_PATH, "utf8");
  const scenarios = JSON.parse(raw);
  console.log(`[eval:phase-k] loaded ${scenarios.length} scenarios from ${DATASET_PATH}`);

  const results = scenarios.map(safeRunScenario);

  const errored = results.filter((r) => r.error);
  if (errored.length > 0) {
    for (const r of errored) {
      console.error(`[eval:phase-k] scenario ${r.scenarioId} ERROR: ${r.error}`);
    }
  }

  const total = results.length;
  const arbitrationCorrect = results.filter((r) => r.arbitrationCorrect).length;
  const leakageCount = results.filter((r) => r.leakageDetected).length;
  const monopolyCount = results.filter((r) => r.monopolyDetected).length;
  const labelCorrect = results.filter((r) => r.speakerLabelCorrect).length;
  const maxLatencyRatio = Math.max(...results.map((r) => r.cooperationLatencyRatio));

  const metrics = {
    arbitrationAccuracy: round4(arbitrationCorrect / total),
    leakageRate: round4(leakageCount / total),
    turnMonopolyRate: round4(monopolyCount / total),
    speakerLabelAccuracy: round4(labelCorrect / total),
    cooperationLatencyRatioMax: maxLatencyRatio
  };

  const pass =
    metrics.arbitrationAccuracy >= THRESHOLDS.arbitrationAccuracy &&
    metrics.leakageRate <= THRESHOLDS.leakageRate &&
    metrics.turnMonopolyRate <= THRESHOLDS.turnMonopolyRate &&
    metrics.speakerLabelAccuracy >= THRESHOLDS.speakerLabelAccuracy &&
    metrics.cooperationLatencyRatioMax <= THRESHOLDS.cooperationLatencyRatio;

  const failures = [];
  if (metrics.arbitrationAccuracy < THRESHOLDS.arbitrationAccuracy)
    failures.push(`arbitrationAccuracy ${metrics.arbitrationAccuracy} < ${THRESHOLDS.arbitrationAccuracy}`);
  if (metrics.leakageRate > THRESHOLDS.leakageRate)
    failures.push(`leakageRate ${metrics.leakageRate} > ${THRESHOLDS.leakageRate}`);
  if (metrics.turnMonopolyRate > THRESHOLDS.turnMonopolyRate)
    failures.push(`turnMonopolyRate ${metrics.turnMonopolyRate} > ${THRESHOLDS.turnMonopolyRate}`);
  if (metrics.speakerLabelAccuracy < THRESHOLDS.speakerLabelAccuracy)
    failures.push(`speakerLabelAccuracy ${metrics.speakerLabelAccuracy} < ${THRESHOLDS.speakerLabelAccuracy}`);
  if (metrics.cooperationLatencyRatioMax > THRESHOLDS.cooperationLatencyRatio)
    failures.push(`cooperationLatencyRatio ${metrics.cooperationLatencyRatioMax} > ${THRESHOLDS.cooperationLatencyRatio}`);

  const scorecard = {
    runId: `phase-k-${Date.now()}`,
    timestamp: new Date().toISOString(),
    scenarioCount: total,
    pass,
    metrics,
    thresholds: THRESHOLDS,
    failures,
    details: results
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(scorecard, null, 2) + "\n", "utf8");

  const mdLines = [
    "# Phase K Multi-Persona Evaluation Scorecard",
    "",
    `**Run**: ${scorecard.runId}`,
    `**Timestamp**: ${scorecard.timestamp}`,
    `**Scenarios**: ${total}`,
    `**Result**: ${pass ? "PASS ✓" : "FAIL ✗"}`,
    "",
    "## Metrics",
    "",
    "| Metric | Value | Threshold | Status |",
    "|--------|-------|-----------|--------|",
    `| ArbitrationAccuracy | ${metrics.arbitrationAccuracy} | >= ${THRESHOLDS.arbitrationAccuracy} | ${metrics.arbitrationAccuracy >= THRESHOLDS.arbitrationAccuracy ? "PASS" : "FAIL"} |`,
    `| LeakageRate | ${metrics.leakageRate} | == ${THRESHOLDS.leakageRate} | ${metrics.leakageRate <= THRESHOLDS.leakageRate ? "PASS" : "FAIL"} |`,
    `| TurnMonopolyRate | ${metrics.turnMonopolyRate} | <= ${THRESHOLDS.turnMonopolyRate} | ${metrics.turnMonopolyRate <= THRESHOLDS.turnMonopolyRate ? "PASS" : "FAIL"} |`,
    `| SpeakerLabelAccuracy | ${metrics.speakerLabelAccuracy} | >= ${THRESHOLDS.speakerLabelAccuracy} | ${metrics.speakerLabelAccuracy >= THRESHOLDS.speakerLabelAccuracy ? "PASS" : "FAIL"} |`,
    `| CooperationLatencyRatio | ${metrics.cooperationLatencyRatioMax} | <= ${THRESHOLDS.cooperationLatencyRatio} | ${metrics.cooperationLatencyRatioMax <= THRESHOLDS.cooperationLatencyRatio ? "PASS" : "FAIL"} |`,
    "",
    "## Scenario Details",
    "",
    "| ID | Arbitration | Leakage | Monopoly | Label | Selected | Expected |",
    "|------|-------------|---------|----------|-------|----------|----------|",
    ...results.map((r) =>
      `| ${r.scenarioId} | ${r.error ? "ERR" : r.arbitrationCorrect ? "OK" : "FAIL"} | ${r.leakageDetected ? "LEAK" : "OK"} | ${r.monopolyDetected ? "YES" : "NO"} | ${r.speakerLabelCorrect ? "OK" : "FAIL"} | ${r.selectedActorId ?? "none"} | ${r.expectedActorId ?? "none"} |`
    ),
    ""
  ];
  await writeFile(MD_PATH, mdLines.join("\n"), "utf8");

  console.log(`[eval:phase-k] arbitrationAccuracy=${metrics.arbitrationAccuracy} leakageRate=${metrics.leakageRate} turnMonopolyRate=${metrics.turnMonopolyRate} speakerLabelAccuracy=${metrics.speakerLabelAccuracy} latencyRatio=${metrics.cooperationLatencyRatioMax}`);
  console.log(`[eval:phase-k] ${pass ? "PASS" : "FAIL"}`);

  if (failures.length > 0) {
    console.log(`[eval:phase-k] failures: ${failures.join("; ")}`);
  }

  console.log(`[eval:phase-k] scorecard → ${OUT_PATH}`);
  console.log(`[eval:phase-k] report   → ${MD_PATH}`);

  if (STRICT && !pass) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[eval:phase-k] fatal:", err);
  process.exit(2);
});
