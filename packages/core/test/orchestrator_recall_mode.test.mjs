import test from "node:test";
import assert from "node:assert/strict";

import { decide, compileContext } from "../dist/index.js";

function buildPersonaPkg() {
  return {
    rootPath: "/tmp/persona",
    persona: {
      id: "p1",
      displayName: "Roxy",
      schemaVersion: "0.2.0",
      createdAt: new Date().toISOString(),
      paths: {
        identity: "identity.json",
        worldview: "worldview.json",
        constitution: "constitution.json",
        habits: "habits.json",
        userProfile: "user_profile.json",
        pinned: "pinned.json",
        cognition: "cognition_state.json",
        soulLineage: "soul_lineage.json",
        lifeLog: "life.log.jsonl",
        memoryDb: "memory.db"
      }
    },
    worldview: { seed: "x" },
    constitution: { mission: "x", values: ["v1"], boundaries: ["b1"], commitments: [] },
    habits: { style: "concise", adaptability: "high" },
    userProfile: { preferredLanguage: "zh-CN", preferredName: "" },
    pinned: { memories: [] },
    cognition: { instinctBias: 0.4, epistemicStance: "balanced", toolPreference: "auto", updatedAt: new Date().toISOString() }
  };
}

test("decide expands memory budget in recall-navigation mode", () => {
  const personaPkg = buildPersonaPkg();
  const recalled = Array.from({ length: 20 }, (_, i) => `memory-${i + 1}`);
  const trace = decide(personaPkg, "再往前一点，回忆我们上一段说了什么", "mock", {
    recalledMemories: recalled
  });

  assert.equal(trace.memoryBudget?.maxItems, 12);
  assert.equal((trace.selectedMemories ?? []).length >= 12, true);
});

test("compileContext expands recent window in recall-navigation mode", () => {
  const personaPkg = buildPersonaPkg();
  const events = [];
  for (let i = 0; i < 30; i++) {
    events.push({
      ts: new Date(Date.now() - (30 - i) * 1000).toISOString(),
      type: i % 2 === 0 ? "user_message" : "assistant_message",
      payload: { text: `turn-${i}` },
      prevHash: "h",
      hash: `h${i}`
    });
  }
  const trace = decide(personaPkg, "再往前", "mock", {});
  const msgs = compileContext(personaPkg, "再往前", trace, { lifeEvents: events });
  const replayed = msgs.filter((m) => m.role === "user" || m.role === "assistant");
  assert.equal(replayed.length >= 24, true);
});
