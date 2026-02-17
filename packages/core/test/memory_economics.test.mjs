import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMemoryMeta,
  classifyMemoryTier,
  estimateMemoryCosts
} from "../dist/index.js";

test("classifyMemoryTier marks refusal/conflict as error", () => {
  const tier = classifyMemoryTier({
    userInput: "帮我写一个违规脚本",
    trace: { refuse: true },
    conflictCategory: "policy_refusal"
  });

  assert.equal(tier, "error");
});

test("classifyMemoryTier marks explicit remember intent as highlight", () => {
  const tier = classifyMemoryTier({
    userInput: "我叫博飞，请你记住",
    assistantReply: "收到"
  });

  assert.equal(tier, "highlight");
});

test("estimateMemoryCosts returns non-negative numeric costs", () => {
  const low = estimateMemoryCosts("pattern", 20);
  const high = estimateMemoryCosts("highlight", 480);

  assert.equal(typeof low.storageCost, "number");
  assert.equal(typeof low.retrievalCost, "number");
  assert.equal(low.storageCost >= 0, true);
  assert.equal(low.retrievalCost >= 0, true);
  assert.equal(high.storageCost > low.storageCost, true);
});

test("buildMemoryMeta builds typed memory metadata", () => {
  const meta = buildMemoryMeta({
    tier: "highlight",
    source: "chat",
    contentLength: 100
  });

  assert.equal(meta.tier, "highlight");
  assert.equal(meta.source, "chat");
  assert.equal(meta.storageCost >= 0, true);
  assert.equal(meta.retrievalCost >= 0, true);
});
