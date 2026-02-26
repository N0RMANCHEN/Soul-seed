import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  appendLifeEvent,
  eventHash,
  initPersonaPackage,
  verifyLifeLogChain
} from "../dist/index.js";

test("life log chain stays valid after append", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: { text: "hi" }
  });
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: { text: "hello" }
  });

  const verify = await verifyLifeLogChain(personaPath);
  assert.equal(verify.ok, true);

  const logRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const lines = logRaw.trim().split("\n");
  assert.equal(lines.length, 2);
  const userEvent = JSON.parse(lines[0]);
  const assistantEvent = JSON.parse(lines[1]);
  assert.equal(userEvent.payload?.speaker?.role, "user");
  assert.equal(assistantEvent.payload?.speaker?.role, "assistant");
});

test("append keeps compatibility with legacy life.log entries without speaker", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-core-test-legacy-lifelog-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  const lifeLogPath = path.join(personaPath, "life.log.jsonl");

  await initPersonaPackage(personaPath, "Aster");

  const legacyEventWithoutHash = {
    ts: "2026-02-01T00:00:00.000Z",
    type: "user_message",
    payload: { text: "legacy user event without speaker field" },
    prevHash: "GENESIS"
  };
  const legacyHash = eventHash("GENESIS", legacyEventWithoutHash);
  await writeFile(lifeLogPath, `${JSON.stringify({ ...legacyEventWithoutHash, hash: legacyHash })}\n`, "utf8");

  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: { text: "new assistant event should include speaker" }
  });

  const raw = await readFile(lifeLogPath, "utf8");
  const events = raw.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(events.length, 2);
  assert.equal(events[0]?.payload?.speaker, undefined);
  assert.equal(events[1]?.payload?.speaker?.role, "assistant");

  const verify = await verifyLifeLogChain(personaPath);
  assert.equal(verify.ok, true);
});
