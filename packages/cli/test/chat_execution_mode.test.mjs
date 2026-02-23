import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("chat supports execution-mode=agent and records goal lifecycle trace", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-agent-mode-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runInteractive(
    [cliPath, "chat", "--persona", personaPath, "--execution-mode", "agent"],
    ["请帮我制定一个可执行计划", "/exit", "确认退出"],
    { intervalMs: 420 }
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /Roxy>/);

  const lifeLog = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  assert.match(lifeLog, /"type":"goal_updated"/);
  assert.match(lifeLog, /"type":"consistency_checked"/);
});

test("persona root command runs task execution without mode switch and keeps persona label", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-root-unified-"));
  const personasDir = path.join(tmpDir, "personas");
  const personaPath = path.join(personasDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    cwd: tmpDir,
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runInteractive(
    [cliPath, "Roxy"],
    ["请帮我制定一个执行计划并分步完成", "/exit", "确认退出"],
    { cwd: tmpDir, intervalMs: 420 }
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /Roxy>/);
  assert.doesNotMatch(chatResult.stdout, /execution-mode/i);

  const lifeLog = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  assert.match(lifeLog, /"type":"goal_updated"/);
  assert.match(lifeLog, /"type":"consistency_checked"/);
});

test("chat can resume last goal and report progress without creating a new goal", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-goal-resume-"));
  const personasDir = path.join(tmpDir, "personas");
  const personaPath = path.join(personasDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    cwd: tmpDir,
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runInteractive(
    [cliPath, "Roxy"],
    ["请帮我制定一个执行计划", "继续上次任务", "做到哪一步", "/exit", "确认退出"],
    { cwd: tmpDir }
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /当前任务「[\s\S]*」状态：/);

  const indexRaw = await readFile(path.join(personaPath, "goals", "index.json"), "utf8");
  const index = JSON.parse(indexRaw);
  assert.equal(Array.isArray(index.goals), true);
  assert.equal(index.goals.length, 1);
});

function runInteractive(args, lines, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(20, Math.floor(options.intervalMs)) : 80;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "test-key",
        ...(options.env ?? {})
      }
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    let index = 0;
    const timer = setInterval(() => {
      if (index >= lines.length) {
        clearInterval(timer);
        return;
      }
      if (!child.killed) {
        child.stdin.write(`${lines[index]}\n`);
      }
      index += 1;
    }, intervalMs);

    child.on("error", (error) => {
      clearInterval(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearInterval(timer);
      resolve({ status, stdout, stderr });
    });
  });
}
