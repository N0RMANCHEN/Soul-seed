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
  assert.match(result.text, /我不确定我们之前是否聊过这个细节/);
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
  assert.match(result.text, /我不确定我们之前是否聊过这个细节/);
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
