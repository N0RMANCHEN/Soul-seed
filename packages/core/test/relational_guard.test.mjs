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
