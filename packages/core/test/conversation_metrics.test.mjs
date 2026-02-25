import test from "node:test";
import assert from "node:assert/strict";

import { computeConversationMetrics } from "../dist/index.js";

test("computeConversationMetrics tracks style leakage rates", () => {
  const events = [
    {
      type: "assistant_message",
      payload: { text: "你好，我随时准备帮你处理各种事情。有什么需要我做的吗？" }
    },
    {
      type: "assistant_message",
      payload: { text: "上次我们聊到专注和觉察。" }
    },
    {
      type: "assistant_message",
      payload: { text: "我是DeepSeek开发的AI助手。" }
    },
    {
      type: "assistant_message",
      payload: { text: "在呢，今天怎么样？" }
    }
  ].map((item, idx) => ({
    ts: new Date().toISOString(),
    type: item.type,
    payload: item.payload,
    prevHash: String(idx),
    hash: String(idx + 1)
  }));

  const m = computeConversationMetrics(events);
  assert.equal(m.assistantMessageCount, 4);
  assert.equal(m.servicePhraseRate > 0, true);
  assert.equal(m.fabricatedRecallRate > 0, true);
  assert.equal(m.providerLeakRate > 0, true);
  assert.equal(typeof m.l1HitRate, "number");
  assert.equal(typeof m.businessPathRegexRate, "number");
});
