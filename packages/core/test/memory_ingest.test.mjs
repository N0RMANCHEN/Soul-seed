import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, initPersonaPackage } from "../dist/index.js";

function sqlite(dbPath, sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

test("appendLifeEvent ingests conversation event into memory.db with source_event_hash", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-ingest-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");
  const event = await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "请给我一个清晰步骤来完成这个任务。"
    }
  });

  const row = sqlite(
    dbPath,
    "SELECT memory_type || '|' || source_event_hash FROM memories ORDER BY created_at DESC LIMIT 1;"
  );
  assert.equal(row, `procedural|${event.hash}`);
});

test("ingest classifier can write all four memory classes", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-ingest-classes-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "昨晚我在车站听到一段很好听的钢琴。"
    }
  });
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "我通常偏好英文回复，你记住这个偏好。"
    }
  });
  await appendLifeEvent(personaPath, {
    type: "relationship_state_updated",
    payload: {
      state: "friend",
      confidence: 0.88
    }
  });
  await appendLifeEvent(personaPath, {
    type: "conflict_logged",
    payload: {
      category: "policy_refusal",
      reason: "safety"
    }
  });

  const types = sqlite(dbPath, "SELECT GROUP_CONCAT(memory_type, ',') FROM (SELECT DISTINCT memory_type FROM memories ORDER BY memory_type);");
  assert.equal(types, "episodic,procedural,relational,semantic");
});

test("ingest persists memory meta signals into memory.db v2 columns", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-ingest-signals-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "我记住了你偏好结构化回答。",
      memoryMeta: {
        tier: "highlight",
        storageCost: 3,
        retrievalCost: 2,
        source: "chat",
        activationCount: 7,
        lastActivatedAt: "2026-02-17T00:00:00.000Z",
        emotionScore: 0.6,
        narrativeScore: 0.7,
        credibilityScore: 0.9,
        excludedFromRecall: true
      }
    }
  });

  const row = sqlite(
    dbPath,
    "SELECT activation_count || '|' || last_activated_at || '|' || emotion_score || '|' || narrative_score || '|' || credibility_score || '|' || excluded_from_recall FROM memories ORDER BY created_at DESC LIMIT 1;"
  );
  assert.equal(row, "7|2026-02-17T00:00:00.000Z|0.6|0.7|0.9|1");
});

test("ingest reinforces user emphasis into high-priority memory channel", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-ingest-emphasis-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "请务必记住：我对青霜过敏，这个非常重要。"
    }
  });

  const row = sqlite(
    dbPath,
    "SELECT state || '|' || activation_count || '|' || printf('%.2f', salience) FROM memories ORDER BY created_at DESC LIMIT 1;"
  );
  const [state, activationCount, salience] = row.split("|");
  assert.equal(state, "hot");
  assert.equal(Number(activationCount) >= 3, true);
  assert.equal(Number(salience) >= 0.9, true);
});

test("ingest writes speaker relation labels for user and assistant turns", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-ingest-speaker-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const dbPath = path.join(personaPath, "memory.db");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: { text: "我今天想聊计划安排。" }
  });
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: { text: "好，我来帮你拆解步骤。" }
  });

  const rows = sqlite(
    dbPath,
    "SELECT origin_role || '|' || speaker_relation FROM memories ORDER BY created_at ASC LIMIT 2;"
  ).split("\n");
  assert.equal(rows[0], "user|you");
  assert.equal(rows[1], "assistant|me");
});
