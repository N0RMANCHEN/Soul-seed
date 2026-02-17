import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const cliPath = path.resolve("dist/index.js");

test("prints help when no args", () => {
  const result = spawnSync(process.execPath, [cliPath], {
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Soulseed CLI/);
});
