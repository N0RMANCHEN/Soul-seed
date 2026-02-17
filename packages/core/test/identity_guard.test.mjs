import test from "node:test";
import assert from "node:assert/strict";

import { enforceIdentityGuard } from "../dist/index.js";

test("identity guard rewrites provider contamination", () => {
  const input = "我是DeepSeek开发的AI助手";
  const result = enforceIdentityGuard(input, "Roxy", "你是谁？");

  assert.equal(result.corrected, true);
  assert.equal(result.reason, "provider_identity_contamination");
  assert.match(result.text, /我是Roxy/);
  assert.doesNotMatch(result.text, /DeepSeek开发的AI助手/);
});

test("identity guard keeps normal answer", () => {
  const input = "我是Roxy，很高兴见到你。";
  const result = enforceIdentityGuard(input, "Roxy", "你是谁？");

  assert.equal(result.corrected, false);
  assert.equal(result.text, input);
});
