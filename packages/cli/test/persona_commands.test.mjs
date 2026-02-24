import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("persona lint and compile commands work", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-persona-cmd-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const outPath = path.join(tmpDir, "compiled_snapshot.json");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const lintResult = spawnSync(process.execPath, [cliPath, "persona", "lint", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.equal(lintResult.status, 0);
  assert.match(lintResult.stdout, /persona lint: OK/);

  const compileResult = spawnSync(
    process.execPath,
    [cliPath, "persona", "compile", "--persona", personaPath, "--out", outPath],
    { encoding: "utf8" }
  );
  assert.equal(compileResult.status, 0);
  const payload = JSON.parse(compileResult.stdout);
  assert.equal(payload.ok, true);
  assert.equal(typeof payload.hash, "string");

  const snapshot = JSON.parse(await readFile(outPath, "utf8"));
  assert.equal(snapshot.schemaVersion, "compiled_snapshot/v1");
  assert.equal(snapshot.personaId.length > 0, true);
});

test("persona lint reports failure for invalid persona fields", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-persona-lint-fail-"));
  const personaPath = path.join(tmpDir, "Mila.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Mila", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const personaJsonPath = path.join(personaPath, "persona.json");
  const personaJson = JSON.parse(await readFile(personaJsonPath, "utf8"));
  personaJson.displayName = "";
  await writeFile(personaJsonPath, `${JSON.stringify(personaJson, null, 2)}\n`, "utf8");

  const lintResult = spawnSync(process.execPath, [cliPath, "persona", "lint", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.notEqual(lintResult.status, 0);
  assert.match(lintResult.stderr, /persona lint failed/);
});
