import test from "node:test";
import assert from "node:assert/strict";
import { composeDegradedPersonaReply, createInitialRelationshipState } from "../dist/index.js";

test("composeDegradedPersonaReply returns non-system text in reply mode", () => {
  const text = composeDegradedPersonaReply({
    mode: "reply",
    lastUserInput: "你刚才说到回忆预算",
    temporalHint: "just_now"
  });
  assert.ok(text.length > 0);
  assert.equal(/系统提示|执行状态|adapter|provider/i.test(text), false);
});

test("composeDegradedPersonaReply adapts greeting tone by relationship", () => {
  const relationship = createInitialRelationshipState();
  relationship.state = "intimate";
  const text = composeDegradedPersonaReply({
    mode: "greeting",
    relationshipState: relationship,
    lastUserInput: "我有点乱"
  });
  assert.ok(/我在呢|陪你|慢慢/.test(text));
});

test("composeDegradedPersonaReply gives concise farewell", () => {
  const text = composeDegradedPersonaReply({
    mode: "farewell",
    lastUserInput: "我先走了"
  });
  assert.ok(text.length > 0);
  assert.equal(text.includes("系统"), false);
});

test("composeDegradedPersonaReply keeps exit confirm phrase contract", () => {
  const text = composeDegradedPersonaReply({
    mode: "exit_confirm"
  });
  assert.match(text, /回复“确认退出”/);
});
