import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  appendLifeEvent,
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
  assert.equal(logRaw.trim().split("\n").length, 2);
});
