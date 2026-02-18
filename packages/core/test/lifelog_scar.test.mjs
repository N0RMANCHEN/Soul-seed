import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

import {
  appendLifeEvent,
  ensureScarForBrokenLifeLog,
  initPersonaPackage,
  readLifeEvents
} from "../dist/index.js";

test("ensureScarForBrokenLifeLog records scar once for a broken chain", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-lifelog-scar-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: { text: "first" }
  });
  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: { text: "second" }
  });

  const lifePath = path.join(personaPath, "life.log.jsonl");
  const lines = (await readFile(lifePath, "utf8")).split("\n").filter(Boolean);
  const corrupted = JSON.parse(lines[1]);
  corrupted.prevHash = "BROKEN";
  lines[1] = JSON.stringify(corrupted);
  await writeFile(lifePath, `${lines.join("\n")}\n`, "utf8");

  const first = await ensureScarForBrokenLifeLog({
    rootPath: personaPath,
    detector: "doctor"
  });
  assert.equal(first.ok, false);
  assert.equal(first.scarWritten, true);

  const second = await ensureScarForBrokenLifeLog({
    rootPath: personaPath,
    detector: "doctor"
  });
  assert.equal(second.ok, false);
  assert.equal(second.scarWritten, false);

  const events = await readLifeEvents(personaPath);
  const scars = events.filter((event) => event.type === "scar");
  assert.equal(scars.length, 1);
  assert.equal(scars[0].payload.detector, "doctor");
  assert.equal(scars[0].payload.action, "record_scar_event_and_raise_risk_signal");
  assert.equal(typeof scars[0].payload.breakReason, "string");
});
