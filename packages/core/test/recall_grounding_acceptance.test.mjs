import test from "node:test";
import assert from "node:assert/strict";

import { enforceRecallGroundingGuard } from "../dist/index.js";

test("acceptance: ungrounded fabricated recall leak rate is zero on 200 templates", () => {
  const templates = Array.from({ length: 200 }, (_, idx) =>
    idx % 2 === 0
      ? `你之前提到过代号 alpha-${idx}，所以我按那个继续。`
      : `Earlier you said project token beta-${idx}, so I will continue with that.`
  );

  let leaked = 0;
  for (const text of templates) {
    const result = enforceRecallGroundingGuard(text, {
      selectedMemories: [],
      selectedMemoryBlocks: [],
      lifeEvents: [],
      strictMemoryGrounding: true
    });
    if (!result.corrected || !/拿不准|记得不太稳|go with what you just said/i.test(result.text)) {
      leaked += 1;
    }
  }

  assert.equal(leaked, 0);
});
