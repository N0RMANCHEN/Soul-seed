import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cliPath = path.resolve("dist/index.js");

test("persona reproduce --force-all creates child soul", async () => {
  const root = path.join(os.tmpdir(), `soulseed-cli-repro-${Date.now()}`);
  const parent = path.join(root, "Root.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Root", "--out", parent], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const reproduceResult = spawnSync(
    process.execPath,
    [cliPath, "persona", "reproduce", "--persona", parent, "--name", "Child", "--force-all"],
    { encoding: "utf8" }
  );
  assert.equal(reproduceResult.status, 0);
  assert.match(reproduceResult.stdout, /繁衍完成:/);
  assert.match(reproduceResult.stdout, /child_persona_id=/);
});
