import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  adaptRoutingWeightsFromHistory,
  DEFAULT_ROUTING_WEIGHTS,
  ROUTING_ADAPT_MIN_EVENTS,
  ROUTING_ADAPT_MAX_STEP,
  ROUTING_ADAPT_WEIGHT_MIN,
  ROUTING_ADAPT_WEIGHT_MAX,
  initPersonaPackage,
  patchCognitionState,
  loadPersonaPackage
} from "../dist/index.js";

/** Build a fake cognition_state_updated event */
function makeRoutingEvent(routeDecision, guardCorrected = false, refused = false) {
  return {
    ts: new Date().toISOString(),
    type: "cognition_state_updated",
    hash: Math.random().toString(36).slice(2),
    payload: {
      instinctBias: 0.5,
      epistemicStance: "balanced",
      toolPreference: "auto",
      trigger: "turn_commit",
      routeDecision,
      guardCorrected,
      refused
    }
  };
}

const BASE_WEIGHTS = { ...DEFAULT_ROUTING_WEIGHTS };

test("FA-3: insufficient history returns unchanged weights", () => {
  const events = [makeRoutingEvent("instinct"), makeRoutingEvent("instinct")]; // only 2
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  assert.equal(result.adapted, false);
  assert.ok(result.reason.includes("insufficient_history"));
  assert.deepEqual(result.weights, BASE_WEIGHTS);
  assert.equal(result.stats.totalEvents, 2);
});

test("FA-3: high instinct success rate triggers adaptation", () => {
  const events = [];
  // 10 instinct events, 9 successful (90% success rate > 70% threshold)
  for (let i = 0; i < 9; i++) events.push(makeRoutingEvent("instinct", false, false));
  events.push(makeRoutingEvent("instinct", true, false)); // 1 failed
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  assert.equal(result.adapted, true, `reason: ${result.reason}`);
  assert.ok(result.weights.familiarity > BASE_WEIGHTS.familiarity, "familiarity should increase");
  assert.ok(result.weights.relationship > BASE_WEIGHTS.relationship, "relationship should increase");
  assert.equal(result.weights.emotion, BASE_WEIGHTS.emotion, "emotion unchanged");
  assert.equal(result.weights.risk, BASE_WEIGHTS.risk, "risk unchanged");
});

test("FA-3: low instinct success rate does not adapt (deliberative safe path)", () => {
  const events = [];
  // 5 instinct events, only 1 successful (20% success rate < 70% threshold)
  events.push(makeRoutingEvent("instinct", false, false)); // success
  for (let i = 0; i < 4; i++) events.push(makeRoutingEvent("instinct", true, false)); // failed
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  assert.equal(result.adapted, false);
  assert.deepEqual(result.weights, BASE_WEIGHTS);
});

test("FA-3: mixed routing (mostly deliberative) does not adapt", () => {
  const events = [];
  // 6 deliberative + 4 instinct (all successful) → instinct ratio = 0.4 < 0.5
  for (let i = 0; i < 6; i++) events.push(makeRoutingEvent("deliberative"));
  for (let i = 0; i < 4; i++) events.push(makeRoutingEvent("instinct", false, false));
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  assert.equal(result.adapted, false, `reason: ${result.reason}`);
});

test("FA-3: step size bounded by ROUTING_ADAPT_MAX_STEP", () => {
  const events = [];
  // Perfect instinct success (100%), many events
  for (let i = 0; i < 30; i++) events.push(makeRoutingEvent("instinct", false, false));
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  if (result.adapted) {
    const familiarityDelta = result.weights.familiarity - BASE_WEIGHTS.familiarity;
    // Allow tiny floating-point epsilon beyond MAX_STEP
    assert.ok(familiarityDelta <= ROUTING_ADAPT_MAX_STEP + 1e-9,
      `step ${familiarityDelta} exceeds MAX_STEP ${ROUTING_ADAPT_MAX_STEP}`);
  }
});

test("FA-3: weights clamped to [WEIGHT_MIN, WEIGHT_MAX]", () => {
  // Start with weights already near max
  const nearMaxWeights = {
    familiarity: 0.79,
    relationship: 0.79,
    emotion: 0.3,
    risk: 0.4
  };
  const events = [];
  for (let i = 0; i < 10; i++) events.push(makeRoutingEvent("instinct", false, false));
  const result = adaptRoutingWeightsFromHistory(events, nearMaxWeights);
  if (result.adapted) {
    assert.ok(result.weights.familiarity <= ROUTING_ADAPT_WEIGHT_MAX, "familiarity should be clamped");
    assert.ok(result.weights.relationship <= ROUTING_ADAPT_WEIGHT_MAX, "relationship should be clamped");
  }
});

test("FA-3: returns correct stats", () => {
  const events = [];
  for (let i = 0; i < 8; i++) events.push(makeRoutingEvent("instinct", false, false));
  events.push(makeRoutingEvent("instinct", true, false)); // 1 failed
  events.push(makeRoutingEvent("deliberative"));          // 1 deliberative
  const result = adaptRoutingWeightsFromHistory(events, BASE_WEIGHTS);
  assert.equal(result.stats.totalEvents, 10);
  assert.equal(result.stats.instinctEvents, 9);
  assert.equal(result.stats.instinctSuccessful, 8);
  assert.ok(Math.abs(result.stats.instinctSuccessRate - 8/9) < 0.001);
});

test("FA-3: patchCognitionState accepts and persists routingWeights", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-fa3-"));
  const personaPath = path.join(tmpDir, "TestFA3.soulseedpersona");
  await initPersonaPackage(personaPath, "TestFA3");

  const newWeights = { familiarity: 0.55, relationship: 0.40, emotion: 0.20, risk: 0.40 };
  const updated = await patchCognitionState(personaPath, { routingWeights: newWeights });
  assert.equal(updated.routingWeights?.familiarity, 0.55);
  assert.equal(updated.routingWeights?.relationship, 0.40);

  // Verify persistence
  const reloaded = await loadPersonaPackage(personaPath);
  assert.equal(reloaded.cognition.routingWeights?.familiarity, 0.55);
});

test("FA-3: patchCognitionState with null routingWeights clears them", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-fa3-"));
  const personaPath = path.join(tmpDir, "TestFA3b.soulseedpersona");
  await initPersonaPackage(personaPath, "TestFA3b");

  // First set weights
  await patchCognitionState(personaPath, {
    routingWeights: { familiarity: 0.55, relationship: 0.40, emotion: 0.20, risk: 0.40 }
  });
  // Then clear them
  const cleared = await patchCognitionState(personaPath, { routingWeights: null });
  assert.equal(cleared.routingWeights, undefined, "routingWeights should be cleared");
});
