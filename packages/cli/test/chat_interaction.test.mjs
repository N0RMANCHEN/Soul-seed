import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

const cliPath = path.resolve("dist/index.js");

test("chat supports proactive controls and dynamic AI label after rename", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    "/proactive status",
    "/relation detail",
    "/proactive on 1",
    "/proactive status",
    "/proactive off",
    "/proactive status",
    "你可以自己改名",
    "/rename confirm Astra",
    "/reproduce force LabKid",
    "你可以自己改名",
    "/exit",
    "确认退出"
  ]);

  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /主动消息: 人格自决模式/);
  assert.match(chatResult.stdout, /overall=/);
  assert.match(chatResult.stdout, /dimensions: trust=/);
  assert.match(chatResult.stdout, /我会按自己的状态决定主动节奏/);
  assert.match(chatResult.stdout, /Roxy> 我想把名字调整为“Astra”/);
  assert.match(chatResult.stdout, /已在聊天内确认改名：Astra/);
  assert.match(chatResult.stdout, /已强制繁衍:/);
  assert.match(chatResult.stdout, /Astra> 我想把名字调整为“Mira”/);
  assert.match(chatResult.stdout, /回复“确认退出”我就先安静退下/);
});

test("chat exits when /exit is repeated during exit confirmation", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, ["/exit", "/exit"]);
  assert.equal(chatResult.status, 0);

  const promptMatches = chatResult.stdout.match(/回复“确认退出”我就先安静退下/g) ?? [];
  assert.equal(promptMatches.length, 1);
});

function runChatScript(personaPath, lines) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "chat", "--persona", personaPath], {
      env: {
        ...process.env,
        DEEPSEEK_API_KEY: "test-key"
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
    child.on("error", reject);

    let idx = 0;
    const timer = setInterval(() => {
      if (idx >= lines.length) {
        clearInterval(timer);
        child.stdin.end();
        return;
      }
      child.stdin.write(`${lines[idx]}\n`);
      idx += 1;
    }, 80);

    child.on("close", (code) => {
      clearInterval(timer);
      resolve({
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}
