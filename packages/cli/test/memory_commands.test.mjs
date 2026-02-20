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

test("memory consolidate command works in cli layer", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-consolidate-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const consolidateResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "consolidate", "--persona", personaPath, "--mode", "light", "--timeout-ms", "1200"],
    { encoding: "utf8" }
  );
  assert.equal(consolidateResult.status, 0);
  assert.match(consolidateResult.stdout, /"ok":/);
  assert.match(consolidateResult.stdout, /"trigger": "cli_manual"/);
});

test("memory index/search/eval commands work", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-hybrid-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const datasetPath = path.join(tmpDir, "recall-dataset.json");
  const reportPath = path.join(tmpDir, "recall-report.json");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const importPath = path.join(tmpDir, "import-hybrid.json");
  await writeFile(
    importPath,
    JSON.stringify(
      {
        items: [
          {
            id: "mem-hybrid-001",
            memoryType: "semantic",
            content: "用户偏好：先给结论再给步骤",
            salience: 0.91,
            state: "warm",
            activationCount: 1,
            lastActivatedAt: "2026-02-18T00:00:00.000Z",
            credibilityScore: 0.98,
            sourceEventHash: "seed:hybrid",
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

  const indexBuild = spawnSync(
    process.execPath,
    [cliPath, "memory", "index", "build", "--persona", personaPath, "--provider", "local", "--batch-size", "8"],
    { encoding: "utf8" }
  );
  assert.equal(indexBuild.status, 0);
  assert.match(indexBuild.stdout, /"ok": true/);

  const search = spawnSync(
    process.execPath,
    [cliPath, "memory", "search", "--persona", personaPath, "--query", "先给结论", "--debug-trace"],
    { encoding: "utf8" }
  );
  assert.equal(search.status, 0);
  assert.match(search.stdout, /"traceId"/);
  assert.match(search.stdout, /"mem-hybrid-001"/);

  await writeFile(
    datasetPath,
    JSON.stringify(
      {
        name: "smoke",
        k: 5,
        cases: [
          {
            id: "q1",
            query: "你记得我的回答偏好吗",
            expectedTerms: ["先给结论再给步骤"]
          }
        ]
      },
      null,
      2
    ),
    "utf8"
  );

  const evalRecall = spawnSync(
    process.execPath,
    [
      cliPath,
      "memory",
      "eval",
      "recall",
      "--persona",
      personaPath,
      "--dataset",
      datasetPath,
      "--k",
      "5",
      "--out",
      reportPath
    ],
    { encoding: "utf8" }
  );
  assert.equal(evalRecall.status, 0);
  assert.match(evalRecall.stdout, /"recallAtK"/);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(typeof report.metrics.recallAtK, "number");
});

test("memory archive command archives cold memories into segment file", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-archive-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const importPath = path.join(tmpDir, "import-archive.json");
  const oldIso = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    items.push({
      id: `archive-cold-${i}`,
      memoryType: "episodic",
      content: `cold archive memory ${i}`,
      salience: 0.2,
      state: "cold",
      activationCount: 1,
      lastActivatedAt: oldIso,
      credibilityScore: 0.95,
      sourceEventHash: `seed:archive:${i}`,
      createdAt: oldIso,
      updatedAt: oldIso,
      deletedAt: null
    });
  }
  await writeFile(importPath, JSON.stringify({ items }, null, 2), "utf8");

  const importResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "import", "--persona", personaPath, "--in", importPath],
    { encoding: "utf8" }
  );
  assert.equal(importResult.status, 0);

  const archiveResult = spawnSync(
    process.execPath,
    [
      cliPath,
      "memory",
      "archive",
      "--persona",
      personaPath,
      "--min-items",
      "10",
      "--min-cold-ratio",
      "0.5",
      "--idle-days",
      "14"
    ],
    { encoding: "utf8" }
  );
  assert.equal(archiveResult.status, 0);
  assert.match(archiveResult.stdout, /"archived": 12/);
  assert.match(archiveResult.stdout, /"segmentKey": "memory_archive:/);
});

test("memory budget command returns projection fields", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-budget-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const budgetResult = spawnSync(
    process.execPath,
    [cliPath, "memory", "budget", "--persona", personaPath, "--target-mb", "300"],
    { encoding: "utf8" }
  );
  assert.equal(budgetResult.status, 0);
  assert.match(budgetResult.stdout, /"underTarget":/);
  assert.match(budgetResult.stdout, /"projectedYearDbMb":/);
  assert.match(budgetResult.stdout, /"recallCache":/);
  assert.match(budgetResult.stdout, /"under64Mb":/);
});

test("memory eval budget command outputs growth curve and can write report", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-memory-eval-budget-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const reportPath = path.join(tmpDir, "budget-report.json");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const evalBudget = spawnSync(
    process.execPath,
    [
      cliPath,
      "memory",
      "eval",
      "budget",
      "--persona",
      personaPath,
      "--days",
      "14",
      "--events-per-day",
      "4",
      "--recall-queries",
      "10",
      "--growth-checkpoints",
      "4",
      "--out",
      reportPath
    ],
    { encoding: "utf8" }
  );
  assert.equal(evalBudget.status, 0);
  assert.match(evalBudget.stdout, /"growthCurve":/);
  assert.match(evalBudget.stdout, /"cache":/);

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(Array.isArray(report.storage.growthCurve), true);
  assert.equal(typeof report.cache.hitRate, "number");
});
