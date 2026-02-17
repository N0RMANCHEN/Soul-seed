import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";

import { initPersonaPackage, readWorkingSet } from "../dist/index.js";

test("readWorkingSet recovers from truncated json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-working-set-recovery-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const summariesPath = path.join(personaPath, "summaries");
  const workingSetPath = path.join(summariesPath, "working_set.json");

  await initPersonaPackage(personaPath, "Roxy");
  await writeFile(workingSetPath, '{\n  "items": [\n', "utf8");

  const data = await readWorkingSet(personaPath);
  assert.deepEqual(data.items, []);

  const saved = JSON.parse(await readFile(workingSetPath, "utf8"));
  assert.deepEqual(saved.items, []);

  const files = await readdir(summariesPath);
  assert.equal(files.some((name) => name.startsWith("working_set.json.corrupt-")), true);
  assert.equal(existsSync(workingSetPath), true);
});
