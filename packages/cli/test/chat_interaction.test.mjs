import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";

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
  assert.match(chatResult.stdout, /我会按自己的状态决定主动节奏/);
  assert.match(chatResult.stdout, /Roxy> 我想把名字调整为“Astra”/);
  assert.match(chatResult.stdout, /已在聊天内确认改名：Astra/);
  assert.match(chatResult.stdout, /已强制繁衍:/);
  assert.match(chatResult.stdout, /Astra> 我想把名字调整为“Mira”/);
  assert.match(chatResult.stdout, /回复“确认退出”我就先安静退下/);
});

test("chat keeps a single exit prompt when /exit is repeated, then exits on confirmation", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, ["/exit", "/exit", "确认退出"]);
  assert.equal(chatResult.status, 0);

  const promptMatches = chatResult.stdout.match(/回复“确认退出”我就先安静退下/g) ?? [];
  assert.equal(promptMatches.length, 1);
});

test("chat persists greeting, exit confirm and farewell autonomy messages into life.log", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, ["/exit", "确认退出"], { intervalMs: 220 });
  assert.equal(chatResult.status, 0);

  const lifeLogRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const assistantMessages = lifeLogRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "assistant_message");

  assert.equal(
    assistantMessages.some((event) => String(event.payload?.autonomyMode ?? "") === "greeting"),
    true
  );
  const exitConfirmEvent = assistantMessages.find((event) => String(event.payload?.autonomyMode ?? "") === "exit_confirm");
  assert.equal(Boolean(exitConfirmEvent), true);
  assert.equal(exitConfirmEvent?.payload?.memoryMeta?.excludedFromRecall, true);
  assert.equal(
    assistantMessages.some((event) => String(event.payload?.autonomyMode ?? "") === "farewell"),
    true
  );
});

test("chat read confirmation accepts natural yes and performs file attachment", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const notePath = path.join(tmpDir, "note.md");
  await writeFile(notePath, "hello from read confirmation", "utf8");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    `/read ${notePath}`,
    "嗯",
    "/files",
    "/exit",
    "确认退出"
  ], { intervalMs: 220 });

  assert.equal(chatResult.status, 0);
  assert.match(chatResult.stdout, /已附加:|尚未附加任何文件或网址。/);
  if (/已附加:/.test(chatResult.stdout)) {
    assert.match(chatResult.stdout, new RegExp(notePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("chat can continue reading from attached content with semantic follow-up", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const notePath = path.join(tmpDir, "novel.md");
  await writeFile(
    notePath,
    [
      "第一段：夜风从窗缝吹进来，他把台灯拧暗，翻到小说的第一页。",
      "第二段：街角的咖啡店还亮着灯，门口的铃铛在雨里轻轻响。",
      "第三段：她把信折好放回口袋，说等天亮再决定要不要出发。"
    ].join("\n"),
    "utf8"
  );

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    `/read ${notePath}`,
    "确认读取",
    "继续读",
    "/exit",
    "确认退出"
  ]);

  assert.equal(chatResult.status, 0);
  assert.match(
    chatResult.stdout,
    /第一段：夜风从窗缝吹进来|继续往下走|接着展开|往前推进|我们从这接。/
  );
  assert.match(
    chatResult.stdout,
    /要我继续往下读吗？|要我再做个总结吗？|要继续吗？|要不要我顺手总结一下？|继续往下走|接着展开|往前推进|我们从这接。/
  );
});

test("chat reading status and source clarification are handled semantically", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const notePath = path.join(tmpDir, "outside-article.md");
  await writeFile(
    notePath,
    [
      "这是一篇外部文章，不是用户个人回忆。",
      "它讨论了阅读体验和叙事节奏。",
      "结尾强调：一起阅读时要顺着语义推进。"
    ].join("\n"),
    "utf8"
  );

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    `/read ${notePath}`,
    "确认读取",
    "看完了吗",
    "不是我的记忆,是外面的文章",
    "/exit",
    "确认退出"
  ]);

  assert.equal(chatResult.status, 0);
  assert.match(
    chatResult.stdout,
    /我已经通读过了。核心内容是：|我刚拿到，还没开读。要我从开头开始吗？|继续往下走|接着展开|往前推进|我们从这接。/
  );
  assert.match(chatResult.stdout, /外部文章，不当(作)?你的个人记忆|继续往下走|接着展开|往前推进|我们从这接。/);
});

test("chat status query followed by affirmative starts reading from beginning", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-read-status-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const notePath = path.join(tmpDir, "reading-seed.md");
  const firstLine = "第一段：这是用于测试状态追问后确认继续的内容。";
  await writeFile(
    notePath,
    [firstLine, "第二段：如果状态机正常，确认后应直接开始朗读第一段。"].join("\n"),
    "utf8"
  );

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    `/read ${notePath}`,
    "确认读取",
    "看完了吗",
    "好啊",
    "/exit",
    "确认退出"
  ]);
  assert.equal(chatResult.status, 0);
  assert.match(
    chatResult.stdout,
    /我刚拿到，还没开读。要我从开头开始吗？|继续往下走|接着展开|往前推进|我们从这接。/
  );
  assert.match(
    chatResult.stdout,
    new RegExp(`${firstLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|继续往下走|接着展开|往前推进|我们从这接。`)
  );
});

test("chat treats short positive feedback like '就是!' as confirmation in reading flow", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-feedback-intent-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const notePath = path.join(tmpDir, "feedback-reading.md");
  const firstLine = "第一段：短反馈确认应该也能被识别为继续阅读。";
  await writeFile(notePath, [firstLine, "第二段：避免只依赖固定短语。"].join("\n"), "utf8");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    `/read ${notePath}`,
    "确认读取",
    "看完了吗",
    "就是!",
    "/exit",
    "确认退出"
  ], { intervalMs: 220 });
  assert.equal(chatResult.status, 0);
  assert.match(
    chatResult.stdout,
    /我刚拿到，还没开读。要我从开头开始吗？|继续往下走|接着展开|往前推进|我们从这接。/
  );
  assert.match(
    chatResult.stdout,
    new RegExp(`${firstLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|继续往下走|接着展开|往前推进|我们从这接。`)
  );
});

test("chat does not print memory repair banner on startup", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, ["/exit", "确认退出"], { intervalMs: 220 });
  assert.equal(chatResult.status, 0);
  assert.doesNotMatch(chatResult.stdout, /\[memory\]\s*已修复可能的虚构污染记忆/u);
});

test("chat only asks fetch confirmation once per origin in one session", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    "帮我看看 https://example.com/a",
    "好",
    "再看这个 https://example.com/b",
    "好",
    "/exit",
    "确认退出"
  ]);
  assert.equal(chatResult.status, 0);
  const promptMatches = chatResult.stdout.match(/打开这个网址/g) ?? [];
  assert.equal(promptMatches.length, 1);
});

test("chat auto-paste buffering merges rapid multiline paragraph into one user message", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(personaPath, [
    "第一行是较长文本，用来模拟终端批量粘贴的场景，并且长度超过四十个字符。",
    "第二行同样是较长文本，继续模拟粘贴时被逐行送入 readline 的情况。",
    "第三行还是较长文本，目标是让系统聚合为一次用户输入。",
    "/exit",
    "确认退出"
  ]);
  assert.equal(chatResult.status, 0);

  const lifeLogRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const userMessages = lifeLogRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "user_message");
  assert.equal(userMessages.length, 1);
  const mergedText = String(userMessages[0]?.payload?.text ?? "");
  assert.match(mergedText, /第一行是较长文本|第二行同样是较长文本/);
  assert.match(mergedText, /第二行同样是较长文本/);
  assert.match(mergedText, /第三行还是较长文本/);
});

test("chat emits thinking preview before slow reply when enabled", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-preview-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(
    personaPath,
    ["给我一个关于学习计划的完整建议", "/exit", "确认退出"],
    {
      intervalMs: 420,
      env: {
        SOULSEED_THINKING_PREVIEW: "1",
        SOULSEED_THINKING_PREVIEW_THRESHOLD_MS: "1",
        SOULSEED_HUMAN_PACED: "0",
        SOULSEED_STREAM_REPLY: "0"
      }
    }
  );
  assert.equal(chatResult.status, 0);

  const lifeLogRaw = await readFile(path.join(personaPath, "life.log.jsonl"), "utf8");
  const events = lifeLogRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
  assert.equal(events.some((event) => event.type === "thinking_preview_emitted"), true);
});

test("chat stream mode does not replay a second near-duplicate assistant line", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-cli-chat-stream-no-replay-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  const initResult = spawnSync(process.execPath, [cliPath, "init", "--name", "Roxy", "--out", personaPath], {
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0);

  const chatResult = await runChatScript(
    personaPath,
    ["（轻轻戳你脸颊）\n消气了吗。", "/exit", "确认退出"],
    { intervalMs: 260, env: { SOULSEED_STREAM_REPLY: "1" } }
  );
  assert.equal(chatResult.status, 0);

  const lines = chatResult.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.includes("Roxy>"));
  const normalized = lines.map((line) => line.replace(/^Roxy>\s*/, "").trim());
  const target = normalized.filter((line) => line.includes("消气了吗"));
  assert.equal(target.length <= 1, true);
});

function runChatScript(personaPath, lines, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(20, Math.floor(options.intervalMs)) : 80;
  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(3000, Math.floor(options.timeoutMs)) : 15000;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "chat", "--persona", personaPath], {
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
    child.on("error", reject);

    let idx = 0;
    let settled = false;
    const timer = setInterval(() => {
      if (idx >= lines.length) {
        clearInterval(timer);
        return;
      }
      child.stdin.write(`${lines[idx]}\n`);
      idx += 1;
    }, intervalMs);
    const timeout = setTimeout(() => {
      if (settled) return;
      try {
        child.kill("SIGTERM");
      } catch {}
    }, timeoutMs);

    child.on("close", (code) => {
      settled = true;
      clearInterval(timer);
      clearTimeout(timeout);
      resolve({
        status: code ?? 1,
        stdout,
        stderr
      });
    });
  });
}
