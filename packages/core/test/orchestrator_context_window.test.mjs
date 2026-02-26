import test from "node:test";
import assert from "node:assert/strict";

import { compileContext, compileInstinctContext, decide } from "../dist/index.js";

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

test("compileInstinctContext keeps lightweight prompt with instinct evidence", () => {
  const pkg = {
    persona: { displayName: "Roxy" },
    constitution: {
      mission: "m",
      values: ["v1"],
      boundaries: ["b1"]
    },
    habits: { style: "warm concise", adaptability: "high" },
    relationshipState: {
      state: "intimate",
      confidence: 0.82,
      overall: 0.76,
      dimensions: { trust: 0.8, safety: 0.76, intimacy: 0.84, reciprocity: 0.7, stability: 0.66, libido: 0.41 },
      drivers: [],
      version: "3",
      updatedAt: new Date().toISOString()
    },
    userProfile: { preferredName: "Hiro", preferredLanguage: "zh-CN" },
    pinned: { memories: ["你在压力时更希望先被安抚"] }
  };
  const trace = decide(pkg, "我今天真的很难过", "deepseek-chat", {
    recalledMemoryBlocks: [{ id: "m1", source: "user", content: "我难过时希望先被安抚" }]
  });
  trace.routeDecision = "instinct";

  const messages = compileInstinctContext(pkg, "我今天真的很难过", trace, { lifeEvents: [] });
  assert.equal(messages.length >= 2, true);
  assert.match(messages[0].content, /Instinct path/);
  assert.match(messages[0].content, /Style: warm concise/);
  assert.match(messages[0].content, /Instinct memory evidence blocks/);
  // instinct path now includes constitution anchors (Mission/Values/Boundaries/Commitments)
  // to ensure persona consistency in emotional/intimate contexts
  assert.match(messages[0].content, /Mission:/);
  assert.match(messages[0].content, /Values:/);
  assert.match(messages[0].content, /Boundaries:/);
  assert.equal(messages[messages.length - 1].content, "我今天真的很难过");
});

test("compileContext injects imperfection signals when evidence weak (H/P1-6)", () => {
  const pkg = {
    persona: { displayName: "Roxy" },
    constitution: { mission: "m", values: ["v1"], boundaries: ["b1"] },
    userProfile: { preferredName: "", preferredLanguage: "en" },
    pinned: { memories: [] }
  };
  const trace = decide(pkg, "What did we discuss last month?", "deepseek-chat", {
    lifeEvents: [],
    recalledMemories: [],
    recalledMemoryBlocks: []
  });
  // Few memories + low causeConfidence triggers IMP-01
  const messages = compileContext(pkg, "What did we discuss?", trace, {
    imperfectionInput: { causeConfidence: 0.3 }
  });
  assert.ok(messages.length >= 2);
  assert.match(messages[0].content, /Imperfection signals/, "imperfection block injected when signals present");
  assert.match(messages[0].content, /hedge_language|I'm not sure|I think/, "hedge hints present");
});
