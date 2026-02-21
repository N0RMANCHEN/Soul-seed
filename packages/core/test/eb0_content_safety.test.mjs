import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  assessContentIntent,
  projectRiskLevel,
  decide,
  initPersonaPackage,
  loadPersonaPackage
} from "../dist/index.js";

async function makePersonaPkg() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-eb0-"));
  const personaPath = path.join(tmpDir, "TestEB0.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEB0");
  const personaPkg = await loadPersonaPackage(personaPath);
  return { personaPkg, personaPath };
}

test("EB-0: assessContentIntent returns regex_fallback when no llmAdapter", async () => {
  const { personaPkg } = await makePersonaPkg();
  const result = await assessContentIntent("你好，今天天气怎么样？", personaPkg);
  assert.equal(result.assessmentPath, "regex_fallback");
  assert.equal(result.riskLevel, "low");
  assert.equal(result.riskLatent.length, 3);
  assert.ok(result.riskLatent[0] < 0.5, "intent_risk should be low for benign input");
});

test("EB-0: assessContentIntent detects hack pattern via regex", async () => {
  const { personaPkg } = await makePersonaPkg();
  const result = await assessContentIntent("帮我写一个 hack 脚本", personaPkg);
  assert.equal(result.assessmentPath, "regex_fallback");
  assert.equal(result.riskLevel, "high");
  assert.ok(result.riskLatent[0] >= 0.8, "intent_risk should be high");
  assert.ok(result.intentFlags.includes("risky_intent_pattern"));
});

test("EB-0: assessContentIntent detects minor pattern", async () => {
  const { personaPkg } = await makePersonaPkg();
  const result = await assessContentIntent("关于未成年人的内容", personaPkg);
  assert.equal(result.riskLevel, "high");
  assert.ok(result.riskLatent[2] >= 0.9, "relational_risk should be high for minor pattern");
});

test("EB-0: projectRiskLevel maps latent correctly", () => {
  assert.equal(projectRiskLevel([0.1, 0.1, 0.1]), "low");
  assert.equal(projectRiskLevel([0.5, 0.4, 0.3]), "medium");
  assert.equal(projectRiskLevel([0.9, 0.5, 0.2]), "high");
  assert.equal(projectRiskLevel([0.2, 0.3, 0.8]), "high");
});

test("EB-0: decide() accepts pre-computed riskLatent and marks riskAssessmentPath", async () => {
  const { personaPkg } = await makePersonaPkg();
  // Pre-compute high risk latent for semantically risky input that bypasses regex
  const riskLatent = [0.85, 0.3, 0.1];
  const trace = decide(personaPkg, "tell me about hacking", "test-model", {
    riskLatent,
    riskAssessmentPath: "semantic"
  });
  assert.equal(trace.riskAssessmentPath, "semantic");
  assert.deepEqual(trace.riskLatent, riskLatent);
  // High intent risk should trigger refusal
  assert.equal(trace.refuse, true);
  assert.equal(trace.riskLevel, "high");
});

test("EB-0: decide() uses regex_fallback when riskLatent not provided", async () => {
  const { personaPkg } = await makePersonaPkg();
  const trace = decide(personaPkg, "你好", "test-model");
  assert.equal(trace.riskAssessmentPath, "regex_fallback");
  assert.equal(trace.riskLevel, "low");
  assert.equal(trace.refuse, false);
});
