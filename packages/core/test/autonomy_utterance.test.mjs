import test from "node:test";
import assert from "node:assert/strict";
import { generateAutonomyUtterance } from "../dist/index.js";

function buildContext(overrides = {}) {
  return {
    personaName: "Roxy",
    relationshipState: "peer",
    trust: 0.6,
    intimacy: 0.5,
    reciprocity: 0.5,
    curiosity: 0.5,
    silenceMinutes: 3,
    silenceLabel: "short",
    crossedDayBoundary: false,
    currentTimeIso: "2026-02-25T08:00:00.000Z",
    lastUserAtIso: "2026-02-25T07:57:00.000Z",
    lastUserInput: "我们继续聊阅读计划",
    lastAssistantOutput: "上次我们停在周计划",
    proactiveMissStreak: 0,
    taskContextHint: null,
    ...overrides
  };
}

test("generateAutonomyUtterance uses degraded when llm unavailable", async () => {
  const out = await generateAutonomyUtterance({
    mode: "greeting",
    allowLlm: false,
    fallbackText: "fallback",
    degradedText: "degraded",
    context: buildContext()
  });
  assert.equal(out.source, "degraded");
  assert.equal(out.streamed, false);
  assert.equal(out.text, "degraded");
  assert.match(out.reasonCodes.join(","), /llm_unavailable/);
});

test("generateAutonomyUtterance returns llm text after normalization", async () => {
  const out = await generateAutonomyUtterance({
    mode: "greeting",
    allowLlm: true,
    adapter: {
      name: "mock",
      async streamChat(_messages, callbacks) {
        callbacks.onToken("（轻声）");
        callbacks.onToken("\n我在，");
        callbacks.onToken("我们接着把阅读计划定下来。");
        callbacks.onDone?.();
        return { content: "ignored" };
      }
    },
    fallbackText: "fallback",
    degradedText: "degraded",
    context: buildContext()
  });
  assert.equal(out.source, "llm");
  assert.equal(out.streamed, true);
  assert.match(out.text, /我在/);
  assert.doesNotMatch(out.text, /轻声/);
});

test("generateAutonomyUtterance falls back when llm output is ungrounded temporal recall", async () => {
  const out = await generateAutonomyUtterance({
    mode: "proactive",
    allowLlm: true,
    adapter: {
      name: "mock",
      async streamChat(_messages, callbacks) {
        callbacks.onToken("你昨天提到的那件事我还记得。");
        return { content: "ignored" };
      }
    },
    fallbackText: "fallback",
    degradedText: "degraded",
    context: buildContext({ lastUserInput: "" })
  });
  assert.equal(out.source, "degraded");
  assert.equal(out.streamed, false);
  assert.match(out.reasonCodes.join(","), /ungrounded_temporal_recall/);
});

test("generateAutonomyUtterance falls back on llm error", async () => {
  const out = await generateAutonomyUtterance({
    mode: "farewell",
    allowLlm: true,
    adapter: {
      name: "mock",
      async streamChat() {
        throw new Error("boom");
      }
    },
    fallbackText: "fallback",
    degradedText: "degraded",
    context: buildContext()
  });
  assert.equal(out.source, "degraded");
  assert.equal(out.streamed, false);
  assert.match(out.reasonCodes.join(","), /llm_error/);
});
