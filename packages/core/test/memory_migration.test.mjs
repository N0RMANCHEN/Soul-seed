import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  appendLifeEvent,
  initPersonaPackage,
  migrateLifeLogAndWorkingSet,
  runMemoryStoreSql,
  verifyLifeLogChain
} from "../dist/index.js";

test("migrateLifeLogAndWorkingSet compacts payload and preserves audit trail", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-memory-migration-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");

  const first = await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: "你好",
      trace: {
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        selectedMemories: new Array(20).fill("memory").map((item, idx) => `${item}-${idx}`),
        askClarifyingQuestion: false,
        refuse: false,
        riskLevel: "low",
        reason: "test",
        model: "deepseek-chat"
      }
    }
  });

  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "hi",
      identityGuard: { text: "hi", corrected: false, reason: null },
      relationalGuard: { text: "hi", corrected: false, reason: null, flags: [] }
    }
  });

  await appendLifeEvent(personaPath, {
    type: "memory_compacted",
    payload: {
      summaryId: "ws-test",
      compactedCount: 30,
      compactedHashes: new Array(30).fill(first.hash)
    }
  });

  const workingSetPath = path.join(personaPath, "summaries", "working_set.json");
  await writeFile(
    workingSetPath,
    `${JSON.stringify(
      {
        items: [
          {
            id: "ws-1",
            ts: new Date().toISOString(),
            summary: "test",
            sourceEventHashes: new Array(600).fill(first.hash)
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const report = await migrateLifeLogAndWorkingSet(personaPath);
  assert.equal(report.ok, true);
  assert.equal(report.lifeLog.totalEvents >= 3, true);
  assert.equal(report.lifeLog.changedEvents >= 2, true);
  assert.equal(report.archive.rowsWritten > 0, true);

  const chain = await verifyLifeLogChain(personaPath);
  assert.equal(chain.ok, true);

  const lifeRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const events = lifeRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const compacted = events.find((event) => event.type === "memory_compacted");
  assert.equal(Array.isArray(compacted.payload.compactedHashes), true);
  assert.equal(compacted.payload.compactedHashes.length <= 12, true);
  assert.equal(typeof compacted.payload.payloadArchiveRef?.segmentKey, "string");

  const wsRaw = await readFile(workingSetPath, "utf8");
  const ws = JSON.parse(wsRaw);
  assert.equal(ws.items[0].sourceEventHashes.length <= 256, true);
  assert.equal(typeof ws.items[0].sourceEventHashDigest, "string");
  assert.equal(typeof ws.items[0].sourceEventHashCount, "number");

  const countRaw = await runMemoryStoreSql(
    personaPath,
    "SELECT COUNT(*) FROM archive_segments WHERE segment_key LIKE 'life_payload_full:%';"
  );
  assert.equal(Number.parseInt(countRaw, 10) > 0, true);
});
