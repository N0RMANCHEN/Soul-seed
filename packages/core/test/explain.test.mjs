import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

import { explainLastDecision } from "../dist/index.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCompactTrace(overrides = {}) {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    askClarifyingQuestion: false,
    refuse: false,
    riskLevel: "low",
    reason: "normal reply",
    model: "test-model",
    selectedMemories: ["memory A", "memory B"],
    selectedMemoriesCount: 2,
    memoryBudget: { maxItems: 20, usedItems: 2 },
    retrievalBreakdown: { profile: 1, pinned: 0, lifeEvents: 1, summaries: 0 },
    memoryWeights: { activation: 0.5, emotion: 0.3, narrative: 0.1, relational: 0.1 },
    voiceIntent: { stance: "friend", tone: "warm", serviceMode: false, language: "zh" },
    executionMode: "soul",
    consistencyVerdict: "allow",
    consistencyRuleHits: [],
    goalId: null,
    ...overrides
  };
}

async function makePersonaDir(events = []) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "explain-test-"));
  const lines = events.map((e) => JSON.stringify(e));
  await writeFile(path.join(dir, "life.log.jsonl"), lines.join("\n") + "\n", "utf8");
  return dir;
}

function makeLifeEvent(type, payload, ts) {
  return {
    ts: ts ?? new Date().toISOString(),
    type,
    payload,
    prevHash: "GENESIS",
    hash: "testhash"
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

test("explainLastDecision returns null when no life.log exists", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "explain-empty-"));
  try {
    const result = await explainLastDecision(dir);
    assert.equal(result, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explainLastDecision returns null when no assistant_message with trace", async () => {
  const dir = await makePersonaDir([
    makeLifeEvent("user_message", { text: "hello" })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.equal(result, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explainLastDecision returns explanation for soul+deliberative turn", async () => {
  const trace = makeCompactTrace();
  const dir = await makePersonaDir([
    makeLifeEvent("user_message", { text: "hello" }),
    makeLifeEvent("assistant_message", { text: "hi there", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null, "should return an explanation");
    assert.equal(typeof result.routeExplanation, "string");
    assert.equal(typeof result.memoryExplanation, "string");
    assert.equal(typeof result.boundaryExplanation, "string");
    assert.equal(typeof result.voiceExplanation, "string");
    assert.equal(typeof result.summary, "string");
    assert.equal(typeof result.coveredDimensions, "number");
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explainLastDecision covers at least 3 of 4 dimensions for a full trace", async () => {
  const trace = makeCompactTrace();
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "response", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    assert.ok(result.coveredDimensions >= 3, `Expected >=3 dimensions, got ${result.coveredDimensions}`);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explainLastDecision skips proactive assistant_message", async () => {
  const trace = makeCompactTrace();
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "proactive msg", proactive: true, trace }),
    makeLifeEvent("user_message", { text: "user says hi" })
  ]);
  try {
    // The only assistant_message is proactive, and user_message has no trace → null
    const result = await explainLastDecision(dir);
    assert.equal(result, null);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explainLastDecision picks the LAST non-proactive assistant_message", async () => {
  const oldTrace = makeCompactTrace({ memoryBudget: { maxItems: 20, usedItems: 5 } });
  const newTrace = makeCompactTrace({ memoryBudget: { maxItems: 20, usedItems: 3 } });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "first", trace: oldTrace }),
    makeLifeEvent("user_message", { text: "again" }),
    makeLifeEvent("assistant_message", { text: "second", trace: newTrace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    // Should reference 3 memories (from newTrace), not 5
    assert.match(result.memoryExplanation, /3/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("routeExplanation describes instinct path when usedItems=0", async () => {
  const trace = makeCompactTrace({
    memoryBudget: { maxItems: 20, usedItems: 0 },
    selectedMemories: [],
    selectedMemoriesCount: 0
  });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "instinct reply", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    assert.match(result.routeExplanation, /直觉/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("routeExplanation describes agent mode", async () => {
  const trace = makeCompactTrace({ executionMode: "agent", goalId: "goal-abc123" });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "agent reply", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    assert.match(result.routeExplanation, /目标执行模式|代理模式/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("boundaryExplanation describes rewrite verdict", async () => {
  const trace = makeCompactTrace({ consistencyVerdict: "rewrite", consistencyRuleHits: ["deny:coercion"] });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "rewritten reply", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    assert.match(result.boundaryExplanation, /修正|调整/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("voiceExplanation includes stance and tone labels", async () => {
  const trace = makeCompactTrace({
    voiceIntent: { stance: "intimate", tone: "reflective", serviceMode: false, language: "zh" }
  });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "intimate reply", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    assert.match(result.voiceExplanation, /亲密/);
    assert.match(result.voiceExplanation, /深思/);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test("explanation contains no raw technical terms", async () => {
  const trace = makeCompactTrace({
    consistencyVerdict: "reject",
    consistencyRuleHits: ["deny:minor", "deny:coercion"],
    consistencyTraceId: "ct-abc123"
  });
  const dir = await makePersonaDir([
    makeLifeEvent("assistant_message", { text: "refused", trace })
  ]);
  try {
    const result = await explainLastDecision(dir);
    assert.ok(result !== null);
    const fullText = [
      result.routeExplanation,
      result.memoryExplanation,
      result.boundaryExplanation,
      result.voiceExplanation,
      result.summary
    ].join(" ");
    // Should NOT expose raw ruleId or kernelVerdict
    assert.ok(!fullText.includes("deny:minor"), "should not expose raw rule ID");
    assert.ok(!fullText.includes("deny:coercion"), "should not expose raw rule ID");
    assert.ok(!fullText.includes("consistencyVerdict"), "should not expose field names");
    assert.ok(!fullText.includes("ct-abc123"), "should not expose trace IDs");
  } finally {
    await rm(dir, { recursive: true });
  }
});
