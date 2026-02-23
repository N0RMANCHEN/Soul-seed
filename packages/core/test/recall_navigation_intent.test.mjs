import test from "node:test";
import assert from "node:assert/strict";

import { detectRecallNavigationIntent } from "../dist/index.js";

test("detectRecallNavigationIntent returns strong for explicit recall-navigation query", () => {
  const intent = detectRecallNavigationIntent("再往前一点，上一句你说了什么？");
  assert.equal(intent.enabled, true);
  assert.equal(intent.strength, "strong");
});

test("detectRecallNavigationIntent returns soft for recall verb + conversation object", () => {
  const intent = detectRecallNavigationIntent("我在回想我们聊天前面的那段");
  assert.equal(intent.enabled, true);
  assert.equal(intent.strength, "soft");
});

test("detectRecallNavigationIntent avoids false positive for physical direction only", () => {
  const intent = detectRecallNavigationIntent("我们继续往前走吧");
  assert.equal(intent.enabled, false);
  assert.equal(intent.strength, "none");
});
