import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("memory pin add/list/remove and reconcile commands work", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-cmd-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const addResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "pin", "add", "--persona", personaPath, "--text", "用户偏好：回答尽量给结论"],
    { encoding: "utf8" }
  );
  assert.equal(addResult.status, 0);

  const listResult = spawnSync(process.execPath, [cliPath, "memory", "pin", "list", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.equal(listResult.status, 0);
  assert.match(listResult.stdout, /用户偏好：回答尽量给结论/);

  const removeResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "pin", "remove", "--persona", personaPath, "--text", "用户偏好：回答尽量给结论"],
    { encoding: "utf8" }
  );
  assert.equal(removeResult.status, 0);

  const reconcileResult = spawnSync(process.execPath, [cliPath, "memory", "reconcile", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.equal(reconcileResult.status, 0);
  assert.match(reconcileResult.stdout, /"rowsUpdated"/);
});

test("memory status/list/inspect/forget/recover/export/import work", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-console-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const importPath = path.join(tmpDir, "import.json");
  const exportPath = path.join(tmpDir, "export.json");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  await writeFile(
    importPath,
    JSON.stringify(
      {
        items: [
          {
            id: "mem-debug-001",
            memoryType: "episodic",
            content: "调试记忆：用户偏好简洁总结",
            salience: 0.8,
            state: "warm",
            activationCount: 2,
            lastActivatedAt: "2026-02-18T00:00:00.000Z",
            emotionScore: 0.2,
            narrativeScore: 0.7,
            credibilityScore: 1,
            excludedFromRecall: 0,
            sourceEventHash: "debug-import-hash",
            createdAt: "2026-02-18T00:00:00.000Z",
            updatedAt: "2026-02-18T00:00:00.000Z",
            deletedAt: null
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const importResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "import", "--persona", personaPath, "--in", importPath],
    { encoding: "utf8" }
  );
  assert.equal(importResult.status, 0);
  assert.match(importResult.stdout, /"imported": 1/);

  const statusResult = spawnSync(process.execPath, [cliPath, "memory", "status", "--persona", personaPath], {
    encoding: "utf8"
  });
  assert.equal(statusResult.status, 0);
  assert.match(statusResult.stdout, /"schemaVersion"/);

  const listResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "list", "--persona", personaPath, "--limit", "5"],
    { encoding: "utf8" }
  );
  assert.equal(listResult.status, 0);
  assert.match(listResult.stdout, /"mem-debug-001"/);

  const inspectResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "inspect", "--persona", personaPath, "--id", "mem-debug-001"],
    { encoding: "utf8" }
  );
  assert.equal(inspectResult.status, 0);
  assert.match(inspectResult.stdout, /调试记忆：用户偏好简洁总结/);

  const forgetResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "forget", "--persona", personaPath, "--id", "mem-debug-001", "--mode", "soft"],
    { encoding: "utf8" }
  );
  assert.equal(forgetResult.status, 0);
  assert.match(forgetResult.stdout, /"mode": "soft"/);

  const hiddenListResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "list", "--persona", personaPath, "--limit", "5"],
    { encoding: "utf8" }
  );
  assert.equal(hiddenListResult.status, 0);
  assert.doesNotMatch(hiddenListResult.stdout, /mem-debug-001/);

  const recoverResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "recover", "--persona", personaPath, "--id", "mem-debug-001"],
    { encoding: "utf8" }
  );
  assert.equal(recoverResult.status, 0);
  assert.match(recoverResult.stdout, /"recovered": true/);

  const exportResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "export", "--persona", personaPath, "--out", exportPath],
    { encoding: "utf8" }
  );
  assert.equal(exportResult.status, 0);
  const exported = JSON.parse(await readFile(exportPath, "utf8"));
  assert.equal(Array.isArray(exported.items), true);
  assert.equal(exported.items.some((item) => item.id === "mem-debug-001"), true);
});
