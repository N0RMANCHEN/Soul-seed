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
    "你可以自己改名",
    "/exit"
  ]);

  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /主动消息: 已关闭/);
  assert.match(chatResult.stdout, /overall=/);
  assert.match(chatResult.stdout, /dimensions: trust=/);
  assert.match(chatResult.stdout, /已开启主动消息（每 1 分钟）/);
  assert.match(chatResult.stdout, /主动消息: 已开启（每 1 分钟）/);
  assert.match(chatResult.stdout, /已关闭主动消息/);
  assert.match(chatResult.stdout, /Roxy> 我想把名字调整为“Astra”/);
  assert.match(chatResult.stdout, /已在聊天内确认改名：Astra/);
  assert.match(chatResult.stdout, /Astra> 我想把名字调整为“Mira”/);
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
