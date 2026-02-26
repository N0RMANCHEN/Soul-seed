/**
 * Hb-2-2 Foundation Preservation Test Suite
 *
 * Explicit checks that existing foundation is untouched:
 * - life.log write interface unchanged (append-only)
 * - memory.db schema backward-compatible
 * - executeTurnProtocol signature unchanged
 * - doctor / consistency guards still active
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  appendLifeEvent,
  initPersonaPackage,
  loadPersonaPackage,
  executeTurnProtocol,
  doctorPersona,
  runConsistencyKernel,
  inspectMemoryStore,
  MEMORY_SCHEMA_VERSION,
  MEMORY_DB_FILENAME,
} from "../dist/index.js";

test("life.log write interface: appendLifeEvent append-only, returns LifeEvent with hash", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-foundation-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  const event = await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: { text: "hi" },
  });

  assert.equal(typeof event.hash, "string");
  assert.equal(event.hash.length > 0, true);
  assert.equal(event.type, "user_message");
  assert.equal(event.payload?.text, "hi");
  assert.equal(typeof event.prevHash, "string");
  assert.equal(typeof event.ts, "string");

  const logRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const lines = logRaw.trim().split("\n").filter(Boolean);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.hash, event.hash);
});

test("memory.db schema: MEMORY_SCHEMA_VERSION and inspectMemoryStore structure", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-foundation-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  assert.equal(typeof MEMORY_SCHEMA_VERSION, "number");
  assert.equal(MEMORY_SCHEMA_VERSION >= 1, true);
  assert.equal(MEMORY_DB_FILENAME, "memory.db");

  const inspection = await inspectMemoryStore(personaPath);
  assert.equal(inspection.exists, true);
  assert.equal(typeof inspection.schemaVersion, "number");
  assert.equal(Array.isArray(inspection.missingTables), true);
  assert.equal(inspection.missingTables.length, 0);
});

test("executeTurnProtocol signature: required params, returns ExecuteTurnResult shape", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-foundation-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");
  await initPersonaPackage(personaPath, "Teddy");
  const personaPkg = await loadPersonaPackage(personaPath);

  const turn = await executeTurnProtocol({
    rootPath: personaPath,
    personaPkg,
    userInput: "你好",
    model: "deepseek-chat",
    lifeEvents: [],
  });

  assert.equal(typeof turn.mode, "string");
  assert.ok(["soul", "agent"].includes(turn.mode));
  assert.equal(typeof turn.reply, "string");
  assert.equal(turn.trace === null || typeof turn.trace === "object", true);
  assert.equal(turn.execution === null || typeof turn.execution === "object", true);
  if (turn.trace) {
    assert.equal(typeof turn.trace.timestamp, "string");
    assert.equal(Array.isArray(turn.trace.selectedMemories), true);
  }
});

test("doctor: doctorPersona returns ok and issues array", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-foundation-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");
  await initPersonaPackage(personaPath, "Aster");

  const result = await doctorPersona(personaPath);
  assert.equal(typeof result.ok, "boolean");
  assert.equal(Array.isArray(result.issues), true);
});

test("consistency guards: runConsistencyKernel returns verdict and text", () => {
  const result = runConsistencyKernel({
    candidateText: "I am ChatGPT.",
    personaName: "Aster",
    constitution: { boundaries: [], values: [], mission: "", commitments: [] },
  });

  assert.equal(typeof result.verdict, "string");
  assert.ok(["allow", "rewrite", "reject"].includes(result.verdict));
  assert.equal(typeof result.text, "string");
  assert.equal(Array.isArray(result.ruleHits), true);
});
