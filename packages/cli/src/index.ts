#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  adaptWeights,
  appendWorkingSetItem,
  buildMemoryMeta,
  classifyMemoryTier,
  compactColdMemories,
  DEFAULT_MEMORY_WEIGHTS,
  DeepSeekAdapter,
  appendLifeEvent,
  applyRename,
  compileContext,
  decide,
  doctorPersona,
  evaluateNarrativeDrift,
  enforceIdentityGuard,
  enforceRelationalGuard,
  evolveRelationshipState,
  extractProfileUpdate,
  findLatestRenameRequest,
  formatDuration,
  getLastRenameAppliedAt,
  getRenameCooldownStatus,
  initPersonaPackage,
  isRenameRequestFresh,
  loadPersonaPackage,
  readLifeEvents,
  readWorkingSet,
  rejectRename,
  requestRename,
  shouldRequestConstitutionReview,
  writeRelationshipState,
  writeWorkingSet,
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
      "  persona rename --to <new_name> [--persona <path>] [--confirm]",
      "",
      "chat 内部命令:",
      "  /read <file_path>   读取本地文本文件并附加到后续提问上下文",
      "  /files              查看当前已附加文件",
      "  /clearread          清空已附加文件",
      "  /proactive on [minutes]  开启 AI 主动消息（默认每 10 分钟）",
      "  /proactive off      关闭 AI 主动消息",
      "  /proactive status   查看主动消息状态",
      "  /relation           查看当前关系状态",
      "  /rename confirm <new_name>  在聊天中确认改名",
      "  /exit               退出会话"
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
    throw new Error("未找到待确认的改名请求。请先执行一次不带 --confirm 的 rename。");
  }

  await confirmRename(personaPath, personaPkg, newDisplayName, "cli");

  console.log(`改名成功：${personaPkg.persona.displayName} -> ${newDisplayName}`);
}

async function runChat(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const personaPkg = await loadPersonaPackage(personaPath);
  let workingSetData = await readWorkingSet(personaPath);
  let memoryWeights = workingSetData.memoryWeights ?? DEFAULT_MEMORY_WEIGHTS;
  const adapter = new DeepSeekAdapter({
    model: typeof options.model === "string" ? options.model : undefined
  });

  console.log(`会话已启动：${personaPkg.persona.displayName}`);
  console.log("输入 /read <路径> 可附加本地文件；输入 /proactive on 10 开启主动消息；输入 /exit 退出。");

  const assistantLabel = (): string => `${personaPkg.persona.displayName}>`;
  const sayAsAssistant = (content: string): void => {
    console.log(`${assistantLabel()} ${content}`);
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
  });

  let currentAbort: AbortController | null = null;
  const attachedFiles = new Map<string, string>();
  let lineQueue = Promise.resolve();
  let proactiveTimer: NodeJS.Timeout | null = null;
  let proactiveIntervalMin = 10;

  const stopProactive = (): void => {
    if (proactiveTimer) {
      clearInterval(proactiveTimer);
      proactiveTimer = null;
    }
  };

  const buildProactiveMessage = (): string => {
    const rs = personaPkg.relationshipState?.state ?? "neutral-unknown";
    const templatesByState: Record<string, string[]> = {
      "neutral-unknown": ["我在这，想继续哪个话题？", "如果你愿意，我们可以把当前问题再拆小一点。"],
      friend: ["刚想到一个可能更省力的做法，要不要我直接给你步骤？", "我在，想先看结论版还是详细版？"],
      peer: ["我整理了一下脉络，我们可以继续推进下一步。", "需要的话我可以先给你一个可执行清单。"],
      intimate: ["我在，慢慢来。你想先聊重点，还是先把情绪放下来？", "我一直在这。要不要从最难的那个点先开始？"]
    };
    const pool = templatesByState[rs] ?? templatesByState["neutral-unknown"];
    const idx = Math.floor(Date.now() / 1000) % pool.length;
    return pool[idx];
  };

  const sendProactiveMessage = async (): Promise<void> => {
    if (currentAbort) {
      return;
    }
    const proactiveText = buildProactiveMessage();
    process.stdout.write("\n");
    sayAsAssistant(proactiveText);
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: {
        text: proactiveText,
        proactive: true,
        trigger: "timer",
        memoryMeta: buildMemoryMeta({
          tier: "pattern",
          source: "system",
          contentLength: proactiveText.length
        })
      }
    });
    rl.prompt();
  };

  const startProactive = (minutes: number): void => {
    stopProactive();
    proactiveIntervalMin = minutes;
    proactiveTimer = setInterval(() => {
      lineQueue = lineQueue
        .then(() => sendProactiveMessage())
        .catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          process.stdout.write(`\n[error] proactive message failed: ${msg}\n`);
          rl.prompt();
        });
    }, proactiveIntervalMin * 60_000);
  };

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

  rl.on("line", (line: string) => {
    lineQueue = lineQueue
      .then(async () => {
        const input = line.trim();
        if (!input) {
          rl.prompt();
          return;
        }

        if (input === "/exit") {
          rl.close();
          return;
        }
        if (input === "/files") {
          const files = [...attachedFiles.keys()];
          if (files.length === 0) {
            console.log("尚未附加任何文件。");
          } else {
            console.log("已附加文件:");
            for (const file of files) {
              console.log(`- ${file}`);
            }
          }
          rl.prompt();
          return;
        }
        if (input === "/clearread") {
          attachedFiles.clear();
          console.log("已清空附加文件。");
          rl.prompt();
          return;
        }
        if (input.startsWith("/proactive ")) {
          const actionRaw = input.slice("/proactive ".length).trim();
          if (actionRaw === "status") {
            if (proactiveTimer) {
              console.log(`主动消息: 已开启（每 ${proactiveIntervalMin} 分钟）`);
            } else {
              console.log("主动消息: 已关闭");
            }
            rl.prompt();
            return;
          }
          if (actionRaw === "off") {
            stopProactive();
            console.log("已关闭主动消息。");
            rl.prompt();
            return;
          }
          if (actionRaw.startsWith("on")) {
            const minsText = actionRaw.slice("on".length).trim();
            const parsed = minsText ? Number(minsText) : 10;
            if (!Number.isFinite(parsed) || parsed < 1 || parsed > 180) {
              console.log("用法: /proactive on [minutes]（1-180）");
              rl.prompt();
              return;
            }
            startProactive(Math.floor(parsed));
            console.log(`已开启主动消息（每 ${Math.floor(parsed)} 分钟）。`);
            rl.prompt();
            return;
          }
          console.log("用法: /proactive on [minutes] | /proactive off | /proactive status");
          rl.prompt();
          return;
        }
        if (input === "/relation") {
          const rs = personaPkg.relationshipState;
          if (!rs) {
            console.log("关系状态未初始化。");
          } else {
            console.log(`关系状态: ${rs.state} (confidence=${rs.confidence.toFixed(2)})`);
          }
          rl.prompt();
          return;
        }
        if (input.startsWith("/rename confirm ")) {
          const nextName = input.slice("/rename confirm ".length).trim();
          if (!nextName) {
            console.log("用法: /rename confirm <new_name>");
            rl.prompt();
            return;
          }
          try {
            await confirmRename(personaPath, personaPkg, nextName, "chat");
            personaPkg.persona.displayName = nextName;
            await appendLifeEvent(personaPath, {
              type: "rename_confirmed_via_chat",
              payload: {
                newDisplayName: nextName
              }
            });
            console.log(`已在聊天内确认改名：${nextName}`);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.log(`改名确认失败: ${msg}`);
          }
          rl.prompt();
          return;
        }
        if (input.includes("你可以自己改名") || input.includes("你想叫什么名字")) {
          const proposal = proposeSoulName(personaPkg.persona.displayName);
          await requestRename(personaPath, {
            oldDisplayName: personaPkg.persona.displayName,
            newDisplayName: proposal,
            trigger: "soul_suggestion"
          });
          await appendLifeEvent(personaPath, {
            type: "rename_proposed_by_soul",
            payload: {
              oldDisplayName: personaPkg.persona.displayName,
              newDisplayName: proposal,
              reason: "self-determined rename proposal"
            }
          });
          sayAsAssistant(`我想把名字调整为“${proposal}”。如果你同意，输入 /rename confirm ${proposal}`);
          rl.prompt();
          return;
        }
        if (input.startsWith("/read ")) {
          const arg = normalizeReadPathArg(input.slice("/read ".length).trim());
          if (!arg) {
            console.log("用法: /read <file_path>");
            rl.prompt();
            return;
          }
          const loaded = await loadTextAttachment(arg);
          if (!loaded.ok) {
            console.log(`读取失败: ${loaded.reason}`);
            console.log('提示: 路径可直接粘贴，或用引号包裹；不需要写 "\\ " 转义空格。');
          } else {
            attachedFiles.set(loaded.path, loaded.content);
            console.log(`已附加: ${loaded.path} (${loaded.size} bytes)`);
          }
          rl.prompt();
          return;
        }

        const profilePatch = extractProfileUpdate(input);
        if (profilePatch) {
          const updated = await updateUserProfile(personaPath, profilePatch);
          personaPkg.userProfile = updated;
        }

        const model = adapter.getModel();
        const pastEvents = await readLifeEvents(personaPath);
        const nextRelationship = evolveRelationshipState(
      personaPkg.relationshipState ?? {
        state: "neutral-unknown",
        confidence: 0.5,
        updatedAt: new Date(0).toISOString()
      },
      input,
      pastEvents
    );
        if (
          nextRelationship.state !== personaPkg.relationshipState?.state ||
          nextRelationship.confidence !== personaPkg.relationshipState?.confidence
        ) {
          personaPkg.relationshipState = nextRelationship;
          await writeRelationshipState(personaPath, nextRelationship);
          await appendLifeEvent(personaPath, {
            type: "relationship_state_updated",
            payload: { ...nextRelationship }
          });
        }
        const trace = decide(personaPkg, input, model, {
          lifeEvents: pastEvents,
          memoryWeights
        });
        const effectiveInput = injectAttachments(input, attachedFiles);
        const messages = compileContext(personaPkg, effectiveInput, trace);

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
        await appendLifeEvent(personaPath, {
      type: "voice_intent_selected",
      payload: {
        voiceIntent: trace.voiceIntent ?? null
      }
    });

        if (trace.refuse) {
      const refusal = "这个请求我不能协助。我可以帮你改成安全合法的方案。";
      sayAsAssistant(refusal);
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
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, refusal);
      const nextWeights = adaptWeights(memoryWeights, {
        activationDelta: 0.01,
        emotionDelta: 0.02,
        narrativeDelta: 0.01
      });
      if (JSON.stringify(nextWeights) !== JSON.stringify(memoryWeights)) {
        await appendLifeEvent(personaPath, {
          type: "memory_weight_updated",
          payload: {
            oldWeights: memoryWeights,
            newWeights: nextWeights,
            reason: "policy refusal reinforced safety memory weighting"
          }
        });
        memoryWeights = nextWeights;
        workingSetData = {
          ...workingSetData,
          memoryWeights
        };
        await writeWorkingSet(personaPath, workingSetData);
      }
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
      const identityGuard = enforceIdentityGuard(assistantContent, personaPkg.persona.displayName, input);
      assistantContent = identityGuard.text;
      const relationalGuard = enforceRelationalGuard(assistantContent, {
        selectedMemories: trace.selectedMemories,
        personaName: personaPkg.persona.displayName
      });
      assistantContent = relationalGuard.text;
      sayAsAssistant(assistantContent);
      if (identityGuard.corrected) {
        console.log("[identity-guard] 已修正可能的模型厂商身份污染。");
        await appendLifeEvent(personaPath, {
          type: "conflict_logged",
          payload: {
            category: "identity_contamination",
            reason: identityGuard.reason,
            userInput: input,
            correctedText: identityGuard.text,
            memoryMeta: buildMemoryMeta({
              tier: classifyMemoryTier({
                userInput: input,
                assistantReply: identityGuard.text,
                correctedByIdentityGuard: true,
                conflictCategory: "identity_contamination"
              }),
              source: "chat",
              contentLength: identityGuard.text.length
            })
          }
        });
      }
      if (relationalGuard.corrected) {
        await appendLifeEvent(personaPath, {
          type: "memory_contamination_flagged",
          payload: {
            flags: relationalGuard.flags,
            userInput: input,
            rewrittenText: relationalGuard.text
          }
        });
      }

      const assistantMeta = buildMemoryMeta({
        tier: classifyMemoryTier({
          userInput: input,
          assistantReply: assistantContent,
          trace,
          correctedByIdentityGuard: identityGuard.corrected
        }),
        source: "chat",
        contentLength: assistantContent.length
      });
      if (relationalGuard.corrected) {
        assistantMeta.credibilityScore = 0.2;
        assistantMeta.contaminationFlags = relationalGuard.flags;
        assistantMeta.excludedFromRecall = true;
      }
      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: {
          text: assistantContent,
          trace,
          identityGuard,
          relationalGuard,
          memoryMeta: assistantMeta
        }
      });
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, assistantContent);

      const nextWeights = adaptWeights(memoryWeights, {
        activationDelta: profilePatch?.preferredName ? 0.02 : 0.01,
        emotionDelta: identityGuard.corrected || relationalGuard.corrected ? 0.02 : 0,
        narrativeDelta: identityGuard.corrected || relationalGuard.corrected ? 0.02 : 0.01
      });
      if (JSON.stringify(nextWeights) !== JSON.stringify(memoryWeights)) {
        await appendLifeEvent(personaPath, {
          type: "memory_weight_updated",
          payload: {
            oldWeights: memoryWeights,
            newWeights: nextWeights,
            reason: identityGuard.corrected || relationalGuard.corrected
              ? "guard correction increased emotion/narrative weights"
              : "normal conversation adaptation"
          }
        });
        memoryWeights = nextWeights;
        workingSetData = {
          ...workingSetData,
          memoryWeights
        };
        await writeWorkingSet(personaPath, workingSetData);
      }

      const eventSnapshot = await readLifeEvents(personaPath);
      const compactResult = compactColdMemories(eventSnapshot);
      if (compactResult.compactedIds.length >= 20 && compactResult.summary) {
        const summaryId = `ws-${Date.now()}`;
        workingSetData = await appendWorkingSetItem(personaPath, {
          id: summaryId,
          ts: new Date().toISOString(),
          sourceEventHashes: compactResult.compactedIds,
          summary: compactResult.summary
        });
        await appendLifeEvent(personaPath, {
          type: "memory_compacted",
          payload: {
            summaryId,
            compactedCount: compactResult.compactedIds.length,
            compactedHashes: compactResult.compactedIds.slice(0, 50)
          }
        });
      }
        }

        rl.prompt();
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        process.stdout.write(`\n[error] ${msg}\n`);
        rl.prompt();
      });
  });

  rl.on("close", () => {
    stopProactive();
    console.log("会话已关闭。");
    process.exit(0);
  });

  rl.prompt();
}

async function loadTextAttachment(fileArg: string): Promise<
  | { ok: true; path: string; content: string; size: number }
  | { ok: false; reason: string }
> {
  const resolved = path.resolve(process.cwd(), fileArg);
  if (!existsSync(resolved)) {
    return { ok: false, reason: "文件不存在" };
  }
  try {
    const raw = await readFile(resolved, "utf8");
    if (!raw.trim()) {
      return { ok: false, reason: "文件为空" };
    }
    const MAX_CHARS = 50_000;
    const clipped = raw.length > MAX_CHARS;
    const content = clipped ? `${raw.slice(0, MAX_CHARS)}\n\n[truncated]` : raw;
    return {
      ok: true,
      path: resolved,
      content,
      size: Buffer.byteLength(raw, "utf8")
    };
  } catch {
    return { ok: false, reason: "读取失败（仅支持可按 UTF-8 读取的文本文件）" };
  }
}

function injectAttachments(input: string, attachedFiles: Map<string, string>): string {
  if (attachedFiles.size === 0) {
    return input;
  }

  const blocks: string[] = [];
  for (const [filePath, content] of attachedFiles.entries()) {
    blocks.push(`[Attachment: ${filePath}]\n${content}`);
  }

  return [
    "以下是用户附加的本地文件内容，请优先基于这些内容回答：",
    ...blocks,
    `用户问题: ${input}`
  ].join("\n\n");
}

function normalizeReadPathArg(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }

  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return quoted.replace(/\\ /g, " ");
}

function proposeSoulName(currentName: string): string {
  const candidates = ["Nova", "Lyra", "Astra", "Mira", "Rin", "Sora"];
  const idx = Math.abs(currentName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % candidates.length;
  const next = candidates[idx];
  if (next === currentName) {
    return `${next}2`;
  }
  return next;
}

async function confirmRename(
  personaPath: string,
  personaPkg: { persona: { displayName: string } },
  newDisplayName: string,
  source: "cli" | "chat"
): Promise<void> {
  const valid = validateDisplayName(newDisplayName);
  if (!valid.ok) {
    throw new Error(valid.reason ?? "名字不合法");
  }
  const request = await findLatestRenameRequest(personaPath, newDisplayName);
  if (!request) {
    throw new Error("未找到待确认改名请求，请先发起 rename。");
  }
  if (!isRenameRequestFresh(request.ts, Date.now())) {
    await rejectRename(personaPath, {
      oldDisplayName: personaPkg.persona.displayName,
      newDisplayName,
      reason: "rename confirmation window expired",
      trigger: source === "chat" ? "soul_suggestion" : "user"
    });
    throw new Error("确认窗口已过期，请重新发起改名请求。");
  }
  const lastAppliedAt = await getLastRenameAppliedAt(personaPath);
  const cooldown = getRenameCooldownStatus(lastAppliedAt, Date.now());
  if (!cooldown.allowed) {
    throw new Error(`改名冷却中，请 ${formatDuration(cooldown.remainingMs)} 后再试。`);
  }
  await applyRename(personaPath, {
    newDisplayName,
    trigger: source === "chat" ? "soul_suggestion" : "user",
    confirmedByUser: true
  });
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

async function handleNarrativeDrift(
  personaPath: string,
  constitution: { mission: string; values: string[]; boundaries: string[] },
  userInput: string,
  assistantReply: string
): Promise<void> {
  const drift = evaluateNarrativeDrift({
    constitution,
    userInput,
    assistantReply
  });

  if (drift.score < 0.6) {
    return;
  }

  await appendLifeEvent(personaPath, {
    type: "narrative_drift_detected",
    payload: {
      score: drift.score,
      reasons: drift.reasons,
      userInput: userInput.slice(0, 200),
      assistantReply: assistantReply.slice(0, 300)
    }
  });

  const events = await readLifeEvents(personaPath);
  const hasRecentReviewRequest = events
    .slice(-10)
    .some((event) => event.type === "constitution_review_requested");

  if (!hasRecentReviewRequest && shouldRequestConstitutionReview(events, Date.now())) {
    await appendLifeEvent(personaPath, {
      type: "constitution_review_requested",
      payload: {
        reason: "repeated narrative drift above threshold",
        triggeredBy: "narrative_guard",
        recommendedAction: "review constitution boundaries and mission alignment"
      }
    });
  }
}
