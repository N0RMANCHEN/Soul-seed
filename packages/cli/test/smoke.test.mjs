import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("prints help when no args", () => {
  const result = spawnSync(process.execPath, [cliPath], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Soulseed CLI/);
  assert.doesNotMatch(result.stdout, /execution-mode/);
});

test("chat without personas gives bootstrap guidance", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-no-persona-"));
  const result = spawnSync(process.execPath, [cliPath, "chat"], {
    encoding: "utf8",
    cwd: tmpDir,
    env: {
      ...process.env,
      SOULSEED_DEFAULT_PERSONA: ""
    }
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /未找到可用 persona。请先运行：\.\/ss new <name>/);
});
