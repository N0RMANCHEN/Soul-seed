import test from "node:test";
import assert from "node:assert/strict";

import { enforceRecallGroundingGuard } from "../dist/index.js";

test("rewrites ungrounded recall assertions in strict mode", () => {
  const result = enforceRecallGroundingGuard("上次我们聊到你在东京工作，所以这次按那个来。", {
    selectedMemories: [],
    selectedMemoryBlocks: [],
    lifeEvents: [],
    strictMemoryGrounding: true
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("ungrounded_recall"), true);
  assert.match(result.text, /记得不太稳|拿不准|go with what you just said/i);
  assert.doesNotMatch(result.text, /可核对|记忆证据/);
});

test("rewrites ungrounded temporal recall assertions like '你昨天说的'", () => {
  const result = enforceRecallGroundingGuard("你昨天说的那个游戏我试了。", {
    selectedMemories: [],
    selectedMemoryBlocks: [],
    lifeEvents: [],
    strictMemoryGrounding: true
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("ungrounded_recall"), true);
  assert.match(result.text, /记得不太稳|拿不准|go with what you just said/i);
  assert.doesNotMatch(result.text, /可核对|记忆证据/);
});

test("keeps recall assertions when grounded by memory evidence", () => {
  const result = enforceRecallGroundingGuard("你之前提到过 Soulseed memory grounding 规则，我会沿用这个上下文。", {
    selectedMemoryBlocks: [
      {
        id: "m1",
        source: "user",
        content: "我的项目是 Soulseed，memory grounding 规则请继续保持"
      }
    ],
    strictMemoryGrounding: true
  });

  assert.equal(result.corrected, false);
  assert.equal(result.reason, null);
  assert.match(result.text, /你之前提到过/);
});

test("rewrites immediate-time cue when matched memory is stale", () => {
  const oldTs = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const result = enforceRecallGroundingGuard("不是昨天，是刚才。你说“我先热个饭，虽然都九点半了”。", {
    lifeEvents: [
      {
        ts: oldTs,
        type: "user_message",
        payload: { text: "我先热个饭，虽然都九点半了" },
        prevHash: "GENESIS",
        hash: "h1"
      }
    ],
    strictMemoryGrounding: true
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("temporal_deictic_mismatch"), true);
  assert.match(result.text, /之前/);
  assert.doesNotMatch(result.text, /刚才/);
});

test("keeps immediate-time cue when matched memory is recent", () => {
  const recentTs = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const result = enforceRecallGroundingGuard("你刚才说“我先热个饭，虽然都九点半了”这句我记得。", {
    lifeEvents: [
      {
        ts: recentTs,
        type: "user_message",
        payload: { text: "我先热个饭，虽然都九点半了" },
        prevHash: "GENESIS",
        hash: "h2"
      }
    ],
    strictMemoryGrounding: true
  });

  assert.equal(result.corrected, false);
  assert.equal(result.reason, null);
  assert.match(result.text, /刚才/);
});
