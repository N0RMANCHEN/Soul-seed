import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("memory compact command migrates persona storage and prints report", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-compact-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const compactResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "compact", "--persona", personaPath],
    { encoding: "utf8" }
  );
  assert.equal(compactResult.status, 0);

  const report = JSON.parse(compactResult.stdout);
  assert.equal(report.ok, true);
  assert.equal(typeof report.backupDir, "string");
  assert.equal(typeof report.reportPath, "string");
});
