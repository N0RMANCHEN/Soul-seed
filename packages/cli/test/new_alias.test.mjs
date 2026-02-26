import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("new --quick creates persona with initProfile and no defaultModel", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-new-test-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");

  const result = spawnSync(
    process.execPath,
    [cliPath, "new", "Teddy", "--quick", "--template", "peer", "--model", "deepseek-reasoner", "--out", personaPath],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 0);
  assert.match(result.stdout, /已创建 persona:/);

  const persona = JSON.parse(await readFile(path.join(personaPath, "persona.json"), "utf8"));
  assert.equal(Object.prototype.hasOwnProperty.call(persona, "defaultModel"), false);
  assert.equal(persona.initProfile.template, "peer");
});

test("persona name as root command starts chat directly", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-alias-chat-test-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "new", "Teddy", "--quick", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runInteractive(
    [cliPath, "Teddy", "--persona", personaPath],
    ["/exit", "确认退出"],
    { intervalMs: 220, timeoutMs: 30000 }
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /Teddy>/);
});

test("persona alias can create missing persona after confirmation", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-alias-create-test-"));
  const personaPath = path.join(tmpDir, "Nova.soulseedpersona");
  const chatResult = await runInteractive(
    [cliPath, "Nova", "--quick", "--persona", personaPath],
    ["y", "/exit", "确认退出"],
    { intervalMs: 220 }
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /是否现在创建并进入聊天/);
  assert.match(chatResult.stdout, /已创建 persona:/);
  assert.match(chatResult.stdout, /Nova>/);
});

function runInteractive(args, lines, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(20, Math.floor(options.intervalMs)) : 80;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, Math.floor(options.timeoutMs)) : 15000;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
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
    let settled = false;
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
    const timeout = setTimeout(() => {
      if (settled) return;
      try {
        child.kill("SIGTERM");
      } catch {}
    }, timeoutMs);

    child.on("error", (error) => {
      settled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (status) => {
      settled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      resolve({
        status,
        stdout,
        stderr
      });
    });
  });
}
