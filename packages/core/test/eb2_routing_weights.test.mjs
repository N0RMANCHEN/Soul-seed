import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  decideDualProcessRoute,
  DEFAULT_ROUTING_WEIGHTS,
  initPersonaPackage,
  loadPersonaPackage
} from "../dist/index.js";

async function makePersonaPkg() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-eb2-"));
  const personaPath = path.join(tmpDir, "TestEB2.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEB2");
  const personaPkg = await loadPersonaPackage(personaPath);
  return personaPkg;
}

test("EB-2: DEFAULT_ROUTING_WEIGHTS exports valid weights", () => {
  assert.ok(DEFAULT_ROUTING_WEIGHTS.familiarity > 0);
  assert.ok(DEFAULT_ROUTING_WEIGHTS.relationship > 0);
  assert.ok(DEFAULT_ROUTING_WEIGHTS.emotion > 0);
  assert.ok(DEFAULT_ROUTING_WEIGHTS.risk > 0);
  // Weights should sum to a reasonable range
  const sum = DEFAULT_ROUTING_WEIGHTS.familiarity + DEFAULT_ROUTING_WEIGHTS.relationship + DEFAULT_ROUTING_WEIGHTS.emotion;
  assert.ok(sum > 0.5 && sum < 2.0);
});

test("EB-2: decideDualProcessRoute includes routingSignalAssessmentPath", async () => {
  const personaPkg = await makePersonaPkg();
  const result = decideDualProcessRoute({
    userInput: "你好",
    personaPkg,
    lifeEvents: []
  });
  assert.ok("routingSignalAssessmentPath" in result);
  assert.equal(result.routingSignalAssessmentPath, "regex_fallback");
});

test("EB-2: custom routingWeights in cognition_state influence routing", async () => {
  const personaPkg = await makePersonaPkg();
  // Set very high familiarity weight to favor instinct
  const customWeightsPkg = {
    ...personaPkg,
    cognition: {
      ...personaPkg.cognition,
      routingWeights: {
        familiarity: 0.9,  // very high familiarity weight
        relationship: 0.1,
        emotion: 0.1,
        risk: 0.1
      }
    }
  };

  // Provide lots of recalled memories to boost familiarity score
  const manyMemories = new Array(6).fill("some relevant memory");
  const resultCustom = decideDualProcessRoute({
    userInput: "你好",
    personaPkg: customWeightsPkg,
    recalledMemories: manyMemories,
    lifeEvents: []
  });

  // With high familiarity weight and many recalled memories, should prefer instinct
  assert.equal(resultCustom.route, "instinct");
});

test("EB-2: default routing weights used when none configured", async () => {
  const personaPkg = await makePersonaPkg();
  // No routingWeights in cognition state → use defaults
  const result = decideDualProcessRoute({
    userInput: "你好",
    personaPkg,
    lifeEvents: []
  });
  assert.ok(result.route === "instinct" || result.route === "deliberative", "should return valid route");
  assert.ok(result.signalScores.familiarity >= 0);
});

test("EB-2: routingWeights readable from cognition state", async () => {
  const personaPkg = await makePersonaPkg();
  // Default cognition state should have no routingWeights (undefined = use defaults)
  assert.equal(personaPkg.cognition.routingWeights, undefined);
});
