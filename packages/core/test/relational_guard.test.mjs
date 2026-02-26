import test from "node:test";
import assert from "node:assert/strict";

import { enforceRelationalGuard } from "../dist/index.js";

test("relational guard rewrites servile phrasing", () => {
  const input = "你好博飞！我是Roxy，随时准备帮你处理各种事情。有什么需要我做的吗？";
  const result = enforceRelationalGuard(input, {
    selectedMemories: ["user_preferred_name=博飞"],
    personaName: "Roxy"
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("service_tone"), true);
  assert.doesNotMatch(result.text, /随时准备帮你处理各种事情/);
  assert.doesNotMatch(result.text, /有什么需要我做的吗/);
});

test("relational guard rewrites false amnesia when continuity evidence exists", () => {
  const input = "每次对话对我来说都是新的开始。我没有之前的记忆。";
  const result = enforceRelationalGuard(input, {
    selectedMemories: ["life=我们刚刚在聊今天聊了多久"],
    lifeEvents: [
      { type: "user_message", payload: { text: "你记得吗,我们聊了多久今天" } },
      { type: "assistant_message", payload: { text: "我会认真记住。" } }
    ],
    personaName: "Roxy"
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("amnesia_claim"), true);
  assert.match(result.text, /我记得我们刚才这段对话/);
});

test("relational guard rewrites fabricated recall into natural uncertainty phrasing", () => {
  const input = "上次我们聊到你已经把方案发给我了。";
  const result = enforceRelationalGuard(input, {
    selectedMemories: [],
    selectedMemoryBlocks: [],
    personaName: "Roxy"
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("fabricated_recall"), true);
  assert.match(result.text, /记得不太稳|按你刚刚这句为准/);
  assert.doesNotMatch(result.text, /之前是否聊过这个细节/);
});
