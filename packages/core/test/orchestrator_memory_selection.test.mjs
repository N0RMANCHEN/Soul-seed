import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  appendLifeEvent,
  decide,
  initPersonaPackage,
  loadPersonaPackage,
  readLifeEvents
} from "../dist/index.js";

test("decide includes retrieval breakdown and budget", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-orchestrator-memory-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "我叫博飞",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        activationCount: 2,
        lastActivatedAt: new Date().toISOString(),
        emotionScore: 0.4,
        narrativeScore: 0.8
      }
    }
  });
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "我们聊过专注和觉察",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        activationCount: 3,
        lastActivatedAt: new Date().toISOString(),
        emotionScore: 0.4,
        narrativeScore: 0.8
      }
    }
  });

  const pkg = await loadPersonaPackage(personaPath);
  const events = await readLifeEvents(personaPath);
  const trace = decide(pkg, "你还记得我吗", "deepseek-chat", { lifeEvents: events });

  assert.equal(typeof trace.memoryBudget?.maxItems, "number");
  assert.equal(typeof trace.retrievalBreakdown?.lifeEvents, "number");
  assert.equal(typeof trace.memoryWeights?.activation, "number");
  assert.equal(trace.selectedMemories.length > 0, true);
  assert.equal(trace.selectedMemories.some((item) => item.includes("我叫博飞")), true);
  assert.equal(trace.selectedMemories.some((item) => item.includes("专注和觉察")), false);
});
