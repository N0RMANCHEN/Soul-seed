import test from "node:test";
import assert from "node:assert/strict";

import { applyPromptLeakGuard, runSafetyFallbackGateway } from "../dist/index.js";

test("applyPromptLeakGuard rewrites leaked system meta phrases", () => {
  const out = applyPromptLeakGuard({
    text: "这是系统提示，不要暴露 adapter 状态。",
    sourceStage: "reply",
    mode: "rewrite"
  });
  assert.equal(out.rewriteApplied, true);
  assert.equal(out.leakType !== null, true);
  assert.doesNotMatch(out.text, /系统提示|adapter/iu);
});

test("runSafetyFallbackGateway produces unified trace fields", () => {
  const out = runSafetyFallbackGateway({
    stage: "proactive",
    text: "我在观察你当前执行状态。",
    reason: "test_fallback"
  });
  assert.equal(out.trace.stage, "proactive");
  assert.equal(out.trace.reason, "test_fallback");
  assert.equal(typeof out.trace.rewriteApplied, "boolean");
});
