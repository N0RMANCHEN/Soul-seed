import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("new --quick creates persona with defaultModel and initProfile", async () => {
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
  assert.equal(persona.defaultModel, "deepseek-reasoner");
  assert.equal(persona.initProfile.template, "peer");
});

test("persona name as root command starts chat directly", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-alias-chat-test-"));
  const personaPath = path.join(tmpDir, "Teddy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "new", "Teddy", "--quick", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runInteractive([cliPath, "Teddy", "--persona", personaPath], ["/exit", "确认退出"]);
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /Teddy>/);
});

test("persona alias can create missing persona after confirmation", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-alias-create-test-"));
  const personaPath = path.join(tmpDir, "Nova.soulseedpersona");
  const chatResult = await runInteractive(
    [cliPath, "Nova", "--quick", "--persona", personaPath],
    ["y", "/exit", "确认退出"]
  );
  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /是否现在创建并进入聊天/);
  assert.match(chatResult.stdout, /已创建 persona:/);
  assert.match(chatResult.stdout, /Nova>/);
});

function runInteractive(args, lines, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(20, Math.floor(options.intervalMs)) : 80;
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
      resolve({
        status,
        stdout,
        stderr
      });
    });
  });
}
