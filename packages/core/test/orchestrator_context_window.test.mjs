import test from "node:test";
import assert from "node:assert/strict";

import { compileContext, decide } from "../dist/index.js";

test("compileContext injects recent conversation window before current user message", () => {
  const pkg = {
    persona: { displayName: "Roxy" },
    constitution: {
      mission: "m",
      values: ["v1"],
      boundaries: ["b1"]
    },
    userProfile: { preferredName: "", preferredLanguage: "zh-CN" },
    pinned: { memories: [] }
  };
  const events = [
    {
      type: "user_message",
      ts: new Date().toISOString(),
      hash: "h1",
      payload: { text: "我们继续刚才的topic A" }
    },
    {
      type: "assistant_message",
      ts: new Date().toISOString(),
      hash: "h2",
      payload: { text: "好的，我们在topic A下继续。" }
    },
    {
      type: "self_revision_applied",
      ts: new Date().toISOString(),
      hash: "h3",
      payload: { summary: "habits: style=reflective" }
    }
  ];
  const trace = decide(pkg, "那下一步是什么", "deepseek-chat", { lifeEvents: events });
  const messages = compileContext(pkg, "那下一步是什么", trace, { lifeEvents: events });

  assert.equal(messages.length >= 4, true);
  assert.match(messages[0].content, /Expression protocol/);
  assert.match(messages[0].content, /\[emotion:<token>\]/);
  assert.match(messages[0].content, /Applied self-revision: habits: style=reflective/);
  assert.equal(messages[1].role, "user");
  assert.match(messages[1].content, /topic A/);
  assert.equal(messages[2].role, "assistant");
  assert.match(messages[2].content, /topic A/);
  assert.equal(messages[messages.length - 1].role, "user");
  assert.equal(messages[messages.length - 1].content, "那下一步是什么");
});
