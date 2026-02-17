import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("doctor command returns ok report for fresh persona", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-doctor-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const doctorResult = spawnSync(process.execPath, [cliPath, "doctor", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.equal(doctorResult.status, 0);
  assert.match(doctorResult.stdout, /"ok": true/);
});
