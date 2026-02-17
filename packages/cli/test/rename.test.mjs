import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("rename requires confirm before apply", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-rename-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const step1 = spawnSync(process.execPath, [cliPath, "rename", "--persona", personaPath, "--to", "Nova"], {
    encoding: "utf8"
  });
  assert.equal(step1.status, 0);
  assert.match(step1.stdout, /请再次执行并带上 --confirm/);

  const personaAfterStep1 = JSON.parse(await readFile(path.join(personaPath, "persona.json"), "utf8"));
  assert.equal(personaAfterStep1.displayName, "Roxy");

  const step2 = spawnSync(
    process.execPath,
    [cliPath, "rename", "--persona", personaPath, "--to", "Nova", "--confirm"],
    {
      encoding: "utf8"
    }
  );
  assert.equal(step2.status, 0);
  assert.match(step2.stdout, /改名成功/);

  const personaAfterStep2 = JSON.parse(await readFile(path.join(personaPath, "persona.json"), "utf8"));
  assert.equal(personaAfterStep2.displayName, "Nova");
});
