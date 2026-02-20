import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("goal and agent commands basic workflow", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-goal-agent-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const init = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(init.status, 0);

  const created = spawnSync(
    process.execPath,
    [cliPath, "goal", "create", "--persona", personaPath, "--title", "整理实施清单"],
    { encoding: "utf8" }
  );
  assert.equal(created.status, 0);
  const createdJson = JSON.parse(created.stdout);
  assert.equal(typeof createdJson.id, "string");

  const listed = spawnSync(
    process.execPath,
    [cliPath, "goal", "list", "--persona", personaPath, "--limit", "10"],
    { encoding: "utf8" }
  );
  assert.equal(listed.status, 0);
  const listJson = JSON.parse(listed.stdout);
  assert.equal(Array.isArray(listJson), true);
  assert.equal(listJson.length >= 1, true);

  const goalId = createdJson.id;
  const ran = spawnSync(
    process.execPath,
    [cliPath, "agent", "run", "--persona", personaPath, "--input", "请读取文件并总结", "--goal-id", goalId, "--max-steps", "2"],
    { encoding: "utf8" }
  );
  assert.equal(ran.status, 0);
  const runJson = JSON.parse(ran.stdout);
  assert.equal(runJson.goalId, goalId);
  assert.equal(Array.isArray(runJson.traceIds), true);

  const canceled = spawnSync(
    process.execPath,
    [cliPath, "goal", "cancel", "--persona", personaPath, "--id", goalId],
    { encoding: "utf8" }
  );
  assert.equal(canceled.status, 0);
  const canceledJson = JSON.parse(canceled.stdout);
  assert.equal(canceledJson.found, true);
});
