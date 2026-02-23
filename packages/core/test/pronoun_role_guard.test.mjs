import test from "node:test";
import assert from "node:assert/strict";

import { enforcePronounRoleGuard } from "../dist/index.js";

test("rewrites likely user/assistant role swap on autobiographical claim", () => {
  const result = enforcePronounRoleGuard("我写文章写到一点多。", {
    lifeEvents: [
      {
        ts: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        type: "user_message",
        payload: { text: "我写文章写到了一点多" },
        prevHash: "GENESIS",
        hash: "u1"
      }
    ]
  });

  assert.equal(result.corrected, true);
  assert.equal(result.flags.includes("pronoun_role_mismatch"), true);
  assert.match(result.text, /我可能把你和我说反了/);
  assert.match(result.text, /你写文章写到一点多/);
});

test("does not rewrite normal self-state sentence", () => {
  const result = enforcePronounRoleGuard("我在这，慢慢来。", {
    lifeEvents: [
      {
        ts: new Date().toISOString(),
        type: "user_message",
        payload: { text: "我今天有点乱" },
        prevHash: "GENESIS",
        hash: "u2"
      }
    ]
  });

  assert.equal(result.corrected, false);
  assert.equal(result.reason, null);
});

test("does not rewrite when overlap is mostly from assistant history", () => {
  const result = enforcePronounRoleGuard("我刚才说了我们先做总结。", {
    lifeEvents: [
      {
        ts: new Date().toISOString(),
        type: "assistant_message",
        payload: { text: "我刚才说了我们先做总结。" },
        prevHash: "GENESIS",
        hash: "a1"
      }
    ]
  });

  assert.equal(result.corrected, false);
});
