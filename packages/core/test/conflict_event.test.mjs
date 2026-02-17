import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { appendLifeEvent, initPersonaPackage, verifyLifeLogChain } from "../dist/index.js";

test("conflict_logged event is appendable and chain-valid", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-conflict-event-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");

  await appendLifeEvent(personaPath, {
    type: "conflict_logged",
    payload: {
      category: "policy_refusal",
      reason: "test conflict",
      riskLevel: "high"
    }
  });

  const chain = await verifyLifeLogChain(personaPath);
  assert.equal(chain.ok, true);

  const logRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const events = logRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.equal(events.length, 1);
  assert.equal(events[0].type, "conflict_logged");
  assert.equal(events[0].payload.category, "policy_refusal");
});
