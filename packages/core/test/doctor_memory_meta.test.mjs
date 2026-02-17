import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor accepts valid memoryMeta", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-valid-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "你好",
      memoryMeta: {
        tier: "pattern",
        storageCost: 1,
        retrievalCost: 1,
        source: "chat"
      }
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, true);
});

test("doctor reports invalid memoryMeta", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-memory-invalid-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: "你好",
      memoryMeta: {
        tier: "unknown",
        storageCost: -1,
        retrievalCost: 1,
        source: "chat"
      }
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((issue) => issue.code === "invalid_memory_meta"), true);
});
