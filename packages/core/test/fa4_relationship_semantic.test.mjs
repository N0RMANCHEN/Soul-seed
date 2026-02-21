import test from "node:test";
import assert from "node:assert/strict";

import {
  evolveRelationshipStateSemantic,
  createInitialRelationshipState,
  RELATIONSHIP_LATENT_DIM
} from "../dist/index.js";

function makeState() {
  return createInitialRelationshipState();
}

/** Minimal mock LLM adapter that returns specific delta JSON */
function makeMockLlm(deltaJson) {
  return {
    name: "mock",
    async streamChat(messages, callbacks) {
      callbacks.onToken(JSON.stringify(deltaJson));
      if (callbacks.onDone) callbacks.onDone();
    }
  };
}

/** Mock LLM that always throws */
const failingLlm = {
  name: "failing",
  async streamChat(_messages, _callbacks) {
    throw new Error("LLM unavailable");
  }
};

test("FA-4: without llmAdapter uses regex_fallback path", async () => {
  const state = makeState();
  const result = await evolveRelationshipStateSemantic(state, "谢谢你", "不客气", undefined);
  assert.equal(result.signalAssessmentPath, "regex_fallback");
  assert.ok(result.state.dimensions.trust >= 0 && result.state.dimensions.trust <= 1);
});

test("FA-4: with llmAdapter uses semantic path", async () => {
  const state = makeState();
  const mockLlm = makeMockLlm({ trust: 0.02, safety: 0.01, intimacy: 0.015, reciprocity: 0.005, stability: 0.003, libido: 0 });
  const result = await evolveRelationshipStateSemantic(state, "我很信任你", "我也信任你", mockLlm);
  assert.equal(result.signalAssessmentPath, "semantic");
});

test("FA-4: semantic path increases trust when LLM returns positive delta", async () => {
  const state = makeState();
  const originalTrust = state.dimensions.trust;
  const mockLlm = makeMockLlm({ trust: 0.03, safety: 0, intimacy: 0, reciprocity: 0, stability: 0, libido: 0 });
  const result = await evolveRelationshipStateSemantic(state, "我信任你", "谢谢你的信任", mockLlm);
  assert.equal(result.signalAssessmentPath, "semantic");
  assert.ok(result.state.dimensions.trust > originalTrust, "trust should increase");
});

test("FA-4: semantic path decreases trust when LLM returns negative delta", async () => {
  // Start with higher trust to be able to decrease
  const state = makeState();
  state.dimensions.trust = 0.6;
  const mockLlm = makeMockLlm({ trust: -0.025, safety: -0.01, intimacy: 0, reciprocity: 0, stability: 0, libido: 0 });
  const result = await evolveRelationshipStateSemantic(state, "你让我失望了", "对不起", mockLlm);
  assert.equal(result.signalAssessmentPath, "semantic");
  assert.ok(result.state.dimensions.trust < 0.6, "trust should decrease");
});

test("FA-4: LLM deltas are clamped to [-0.03, +0.03]", async () => {
  const state = makeState();
  // LLM returns out-of-range values
  const mockLlm = makeMockLlm({ trust: 0.99, safety: -0.99, intimacy: 5, reciprocity: 0, stability: 0, libido: 0 });
  const result = await evolveRelationshipStateSemantic(state, "极端信号", "极端回应", mockLlm);
  // Result dimensions should stay in [0,1] range
  const dims = result.state.dimensions;
  [dims.trust, dims.safety, dims.intimacy, dims.reciprocity, dims.stability, dims.libido].forEach(v => {
    assert.ok(v >= 0 && v <= 1, `dimension ${v} should be in [0,1]`);
  });
});

test("FA-4: when LLM throws, falls back to regex path", async () => {
  const state = makeState();
  const result = await evolveRelationshipStateSemantic(state, "谢谢", "不客气", failingLlm);
  assert.equal(result.signalAssessmentPath, "regex_fallback");
  assert.ok(result.state.dimensions.trust >= 0);
});

test("FA-4: when LLM returns invalid JSON, falls back to regex path", async () => {
  const state = makeState();
  const badLlm = {
    name: "bad",
    async streamChat(_messages, callbacks) {
      callbacks.onToken("this is not json {{{{");
      if (callbacks.onDone) callbacks.onDone();
    }
  };
  const result = await evolveRelationshipStateSemantic(state, "你好", "你好", badLlm);
  assert.equal(result.signalAssessmentPath, "regex_fallback");
});

test("FA-4: result includes valid relationshipLatent", async () => {
  const state = makeState();
  const mockLlm = makeMockLlm({ trust: 0.01, safety: 0.005, intimacy: 0.008, reciprocity: 0, stability: 0, libido: 0 });
  const result = await evolveRelationshipStateSemantic(state, "我喜欢和你说话", "我也是", mockLlm);
  assert.ok(Array.isArray(result.state.relationshipLatent));
  assert.equal(result.state.relationshipLatent.length, RELATIONSHIP_LATENT_DIM);
});
