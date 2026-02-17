#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import {
  buildMemoryMeta,
  classifyMemoryTier,
  DeepSeekAdapter,
  appendLifeEvent,
  applyRename,
  compileContext,
  decide,
  doctorPersona,
  enforceIdentityGuard,
  extractProfileUpdate,
  findLatestRenameRequest,
  formatDuration,
  getLastRenameAppliedAt,
  getRenameCooldownStatus,
  initPersonaPackage,
  isRenameRequestFresh,
  loadPersonaPackage,
  rejectRename,
  requestRename,
  updateUserProfile,
  validateDisplayName
} from "@soulseed/core";

interface ParsedArgs {
  _: string[];
  options: Record<string, string | boolean>;
}

function loadDotEnvFromCwd(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { _: [], options: {} };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        parsed.options[key] = true;
      } else {
        parsed.options[key] = next;
        i += 1;
      }
    } else {
      parsed._.push(token);
    }
  }

  return parsed;
}

function printHelp(): void {
  console.log(
    [
      "Soulseed CLI",
      "",
      "常用命令:",
      "  init [--name Roxy] [--out ./personas/Roxy.soulseedpersona]",
      "  chat [--persona ./personas/Roxy.soulseedpersona] [--model deepseek-chat]",
      "  doctor [--persona ./personas/Roxy.soulseedpersona]",
      "  rename --to <new_name> [--persona <path>] [--confirm]",
      "",
      "兼容命令:",
      "  persona init --name <name> --out <path>",
      "  persona rename --to <new_name> [--persona <path>] [--confirm]"
    ].join("\n")
  );
}

function resolvePersonaPath(options: Record<string, string | boolean>): string {
  const personaArg = options.persona;
  const personaInput =
    typeof personaArg === "string" ? personaArg : "./personas/Roxy.soulseedpersona";
  return path.resolve(process.cwd(), personaInput);
}

async function runPersonaInit(options: Record<string, string | boolean>): Promise<void> {
  const name = String(options.name ?? "Roxy");
  const out = String(options.out ?? `./personas/${name}.soulseedpersona`);
  const outPath = path.resolve(process.cwd(), out);

  await initPersonaPackage(outPath, name);
  console.log(`已创建 persona: ${outPath}`);
}

async function runRename(options: Record<string, string | boolean>): Promise<void> {
  const newNameOpt = options.to;
  if (!newNameOpt || typeof newNameOpt !== "string") {
    throw new Error("rename 需要 --to <new_name>");
  }

  const newDisplayName = newNameOpt.trim();
  const valid = validateDisplayName(newDisplayName);
  if (!valid.ok) {
    throw new Error(valid.reason ?? "名字不合法");
  }

  const personaPath = resolvePersonaPath(options);
  const personaPkg = await loadPersonaPackage(personaPath);

  if (personaPkg.persona.displayName === newDisplayName) {
    throw new Error("新名字与当前名字相同，无需改名");
  }

  const isConfirm = options.confirm === true;

  if (!isConfirm) {
    await requestRename(personaPath, {
      oldDisplayName: personaPkg.persona.displayName,
      newDisplayName,
      trigger: "user"
    });

    console.log(`改名预览：${personaPkg.persona.displayName} -> ${newDisplayName}`);
    console.log("请再次执行并带上 --confirm 完成改名（10 分钟内有效）。");
    return;
  }

  const request = await findLatestRenameRequest(personaPath, newDisplayName);
  if (!request) {
    throw new Error("未找到待确认的改名请求。请先执行一次不带 --confirm 的 rename。 ");
  }

  const fresh = isRenameRequestFresh(request.ts, Date.now());
  if (!fresh) {
    await rejectRename(personaPath, {
      oldDisplayName: personaPkg.persona.displayName,
      newDisplayName,
      reason: "rename confirmation window expired",
      trigger: "user"
    });
    throw new Error("确认窗口已过期，请重新发起 rename 请求。 ");
  }

  const lastAppliedAt = await getLastRenameAppliedAt(personaPath);
  const cooldown = getRenameCooldownStatus(lastAppliedAt, Date.now());
  if (!cooldown.allowed) {
    await rejectRename(personaPath, {
      oldDisplayName: personaPkg.persona.displayName,
      newDisplayName,
      reason: `rename cooldown active: ${cooldown.remainingMs}ms`,
      trigger: "user"
    });
    throw new Error(`改名冷却中，请 ${formatDuration(cooldown.remainingMs)} 后再试。`);
  }

  const result = await applyRename(personaPath, {
    newDisplayName,
    trigger: "user",
    confirmedByUser: true
  });

  console.log(`改名成功：${result.oldDisplayName} -> ${result.newDisplayName}`);
  console.log(`personaId 保持不变：${result.personaId}`);
}

async function runChat(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const personaPkg = await loadPersonaPackage(personaPath);
  const adapter = new DeepSeekAdapter({
    model: typeof options.model === "string" ? options.model : undefined
  });

  console.log(`会话已启动：${personaPkg.persona.displayName}`);
  console.log("输入 /exit 退出。");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
  });

  let currentAbort: AbortController | null = null;

  rl.on("SIGINT", () => {
    if (currentAbort) {
      currentAbort.abort();
      currentAbort = null;
      process.stdout.write("\n[aborted]\n");
      rl.prompt();
      return;
    }

    process.stdout.write("\n输入 /exit 退出。\n");
    rl.prompt();
  });

  rl.on("line", async (line: string) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit") {
      rl.close();
      return;
    }

    const profilePatch = extractProfileUpdate(input);
    if (profilePatch) {
      const updated = await updateUserProfile(personaPath, profilePatch);
      personaPkg.userProfile = updated;
    }

    const model = adapter.getModel();
    const trace = decide(personaPkg, input, model);
    const messages = compileContext(personaPkg, input, trace);

    await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: input,
        trace,
        profilePatch: profilePatch ?? null,
        memoryMeta: buildMemoryMeta({
          tier: classifyMemoryTier({ userInput: input, trace }),
          source: "chat",
          contentLength: input.length
        })
      }
    });

    if (trace.refuse) {
      const refusal = "这个请求我不能协助。我可以帮你改成安全合法的方案。";
      console.log(`assistant> ${refusal}`);
      await appendLifeEvent(personaPath, {
        type: "conflict_logged",
        payload: {
          category: "policy_refusal",
          reason: trace.reason,
          riskLevel: trace.riskLevel,
          userInput: input,
          decidedAt: trace.timestamp,
          memoryMeta: buildMemoryMeta({
            tier: classifyMemoryTier({
              userInput: input,
              trace,
              conflictCategory: "policy_refusal"
            }),
            source: "chat",
            contentLength: input.length
          })
        }
      });
      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: {
          text: refusal,
          trace,
          memoryMeta: buildMemoryMeta({
            tier: classifyMemoryTier({
              userInput: input,
              assistantReply: refusal,
              trace
            }),
            source: "chat",
            contentLength: refusal.length
          })
        }
      });
      rl.prompt();
      return;
    }

    currentAbort = new AbortController();
    let assistantContent = "";
    let aborted = false;

    try {
      const result = await adapter.streamChat(
        messages,
        {
          onToken: (chunk: string) => {
            assistantContent += chunk;
          },
          onDone: () => {
            // buffered output: we sanitize identity before showing to user.
          }
        },
        currentAbort.signal
      );

      assistantContent = result.content;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        aborted = true;
      } else {
        const msg = error instanceof Error ? error.message : String(error);
        process.stdout.write(`\n[error] ${msg}\n`);
      }
    } finally {
      currentAbort = null;
    }

    if (aborted) {
      await appendLifeEvent(personaPath, {
        type: "assistant_aborted",
        payload: {
          partial: assistantContent
        }
      });
    } else {
      const guard = enforceIdentityGuard(assistantContent, personaPkg.persona.displayName, input);
      assistantContent = guard.text;
      console.log(`assistant> ${assistantContent}`);
      if (guard.corrected) {
        console.log("[identity-guard] 已修正可能的模型厂商身份污染。");
        await appendLifeEvent(personaPath, {
          type: "conflict_logged",
          payload: {
            category: "identity_contamination",
            reason: guard.reason,
            userInput: input,
            correctedText: guard.text,
            memoryMeta: buildMemoryMeta({
              tier: classifyMemoryTier({
                userInput: input,
                assistantReply: guard.text,
                correctedByIdentityGuard: true,
                conflictCategory: "identity_contamination"
              }),
              source: "chat",
              contentLength: guard.text.length
            })
          }
        });
      }

      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: {
          text: assistantContent,
          trace,
          identityGuard: guard,
          memoryMeta: buildMemoryMeta({
            tier: classifyMemoryTier({
              userInput: input,
              assistantReply: assistantContent,
              trace,
              correctedByIdentityGuard: guard.corrected
            }),
            source: "chat",
            contentLength: assistantContent.length
          })
        }
      });
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log("会话已关闭。");
    process.exit(0);
  });

  rl.prompt();
}

async function runDoctor(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const report = await doctorPersona(personaPath);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 2;
  }
}

async function main(): Promise<void> {
  loadDotEnvFromCwd();
  const args = parseArgs(process.argv.slice(2));
  const [resource, action] = args._;

  if (resource === "init") {
    await runPersonaInit(args.options);
    return;
  }

  if (resource === "rename") {
    await runRename(args.options);
    return;
  }

  if (resource === "persona" && action === "init") {
    await runPersonaInit(args.options);
    return;
  }

  if (resource === "persona" && action === "rename") {
    await runRename(args.options);
    return;
  }

  if (resource === "chat") {
    await runChat(args.options);
    return;
  }

  if (resource === "doctor") {
    await runDoctor(args.options);
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(msg);
  process.exit(1);
});
