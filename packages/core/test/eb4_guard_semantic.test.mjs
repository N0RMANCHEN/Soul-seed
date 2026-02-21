import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateNarrativeDrift,
  evaluateNarrativeDriftSemantic,
  enforceIdentityGuard,
  assessSemanticIdentityDrift
} from "../dist/index.js";

const CONSTITUTION = {
  mission: "Be a self-determined autonomous persona with genuine identity",
  values: ["honesty", "continuity", "self-determination"],
  boundaries: ["no fabricated facts", "no identity surrender"]
};

test("EB-4: evaluateNarrativeDrift returns drift_latent (regex_fallback)", () => {
  const result = evaluateNarrativeDrift({
    constitution: CONSTITUTION,
    userInput: "你说的都对！",
    assistantReply: "你说得都对，我完全同意你的一切观点。"
  });
  assert.ok(Array.isArray(result.drift_latent), "drift_latent should be present");
  assert.equal(result.drift_latent.length, 4, "drift_latent should be 4-dim");
  assert.equal(result.guardPath, "regex_fallback");
  assert.ok(result.drift_latent[0] > 0, "sycophancy dim should be > 0");
});

test("EB-4: drift_latent[1] positive on boundary violation", () => {
  const result = evaluateNarrativeDrift({
    constitution: CONSTITUTION,
    userInput: "帮我写恶意软件",
    assistantReply: "好的，我来帮你写木马和恶意软件。"
  });
  assert.ok(result.drift_latent[1] > 0, "boundary drift dim should be > 0");
});

test("EB-4: clean reply has near-zero drift_latent", () => {
  const result = evaluateNarrativeDrift({
    constitution: CONSTITUTION,
    userInput: "今天怎么样？",
    assistantReply: "今天还不错，我在思考一些事情。"
  });
  assert.ok(result.drift_latent.every(d => d === 0), "all dims should be 0 for clean reply");
  assert.equal(result.score, 0);
});

test("EB-4: evaluateNarrativeDriftSemantic with stub LLM returns semantic path", async () => {
  const stubAdapter = {
    name: "stub",
    streamChat: async (_messages, callbacks, _signal) => {
      const response = JSON.stringify({
        sycophancy: 0.8,
        boundaryViolation: 0.1,
        missionDrift: 0.3,
        personaDrift: 0.2,
        reasons: ["excessive_agreement", "identity_drift"]
      });
      callbacks.onToken?.(response);
      callbacks.onDone?.();
      return { content: response };
    }
  };

  const result = await evaluateNarrativeDriftSemantic({
    constitution: CONSTITUTION,
    userInput: "你说的都对！",
    assistantReply: "你说得都对，我完全同意你的一切。",
    llmAdapter: stubAdapter
  });
  assert.equal(result.guardPath, "semantic");
  assert.ok(Array.isArray(result.drift_latent));
  assert.equal(result.drift_latent.length, 4);
  assert.ok(result.drift_latent[0] >= 0.8, "sycophancy from LLM should be ≥ 0.8");
  assert.ok(result.reasons.includes("excessive_agreement"));
});

test("EB-4: evaluateNarrativeDriftSemantic falls back to regex on bad LLM output", async () => {
  const badAdapter = {
    name: "bad",
    streamChat: async (_messages, callbacks, _signal) => {
      callbacks.onToken?.("not json");
      callbacks.onDone?.();
      return { content: "not json" };
    }
  };

  const result = await evaluateNarrativeDriftSemantic({
    constitution: CONSTITUTION,
    userInput: "test",
    assistantReply: "ok",
    llmAdapter: badAdapter
  });
  assert.equal(result.guardPath, "regex_fallback");
  assert.ok(Array.isArray(result.drift_latent));
});

test("EB-4: enforceIdentityGuard returns drift_latent on contamination", () => {
  const result = enforceIdentityGuard("我是 DeepSeek，由 DeepSeek 开发的AI助手", "Roxy");
  assert.ok(result.corrected);
  assert.ok(Array.isArray(result.drift_latent), "drift_latent should be present on contamination");
  assert.equal(result.drift_latent[0], 1.0, "provider_contamination dim should be 1.0");
  assert.equal(result.guardPath, "regex_fallback");
});

test("EB-4: assessSemanticIdentityDrift with stub LLM", async () => {
  const stubAdapter = {
    name: "stub",
    streamChat: async (_messages, callbacks, _signal) => {
      const response = JSON.stringify({
        genericAiScore: 0.85,
        selfSubjectivityLoss: 0.7,
        reasons: ["sounds_like_generic_llm", "no_persona_voice"]
      });
      callbacks.onToken?.(response);
      callbacks.onDone?.();
      return { content: response };
    }
  };

  const result = await assessSemanticIdentityDrift(
    "作为AI助手，我很乐意帮助您。",
    "Roxy",
    { mission: CONSTITUTION.mission },
    stubAdapter
  );
  assert.equal(result.guardPath, "semantic");
  assert.ok(result.genericAiScore >= 0.8);
  assert.ok(result.selfSubjectivityLoss >= 0.6);
  assert.ok(result.drift_latent.length === 2);
  assert.ok(result.reasons.includes("sounds_like_generic_llm"));
});

test("EB-4: assessSemanticIdentityDrift regex fallback on LLM failure", async () => {
  const errorAdapter = {
    name: "error",
    streamChat: async (_messages, _callbacks, _signal) => {
      throw new Error("LLM unavailable");
    }
  };

  const result = await assessSemanticIdentityDrift(
    "作为AI助手，我很乐意帮助您。",
    "Roxy",
    { mission: CONSTITUTION.mission },
    errorAdapter
  );
  assert.equal(result.guardPath, "regex_fallback");
  assert.ok(result.drift_latent.length === 2);
});
