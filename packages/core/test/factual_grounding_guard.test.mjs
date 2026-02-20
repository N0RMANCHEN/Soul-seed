import test from "node:test";
import assert from "node:assert/strict";

import { enforceFactualGroundingGuard } from "../dist/index.js";

test("factual grounding guard rewrites ungrounded real-world personal action", () => {
  const input = "今天路过花店时看到雏菊开得特别好，突然就想起你了。";
  const result = enforceFactualGroundingGuard(input, { mode: "greeting" });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("ungrounded_personal_action"), true);
  assert.equal(result.reason, "ungrounded_personal_action");
  assert.equal(result.text, "我在这。你刚才那句没说完的话，想从哪里接上？");
});

test("factual grounding guard keeps grounded neutral text unchanged", () => {
  const input = "我在这。你想从刚才没说完的那句继续吗？";
  const result = enforceFactualGroundingGuard(input, { mode: "proactive" });

  assert.equal(result.corrected, false);
  assert.equal(result.text, input);
});
