#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createToolSessionState,
  executeToolCall,
  adaptWeights,
  appendWorkingSetItem,
  buildMemoryMeta,
  classifyMemoryTier,
  compactColdMemories,
  DEFAULT_MEMORY_WEIGHTS,
  DeepSeekAdapter,
  appendLifeEvent,
  addPinnedMemory,
  applyRename,
  compileContext,
  decide,
  doctorPersona,
  evaluateNarrativeDrift,
  enforceIdentityGuard,
  enforceRecallGroundingGuard,
  enforceRelationalGuard,
  evolveRelationshipStateFromAssistant,
  ensureScarForBrokenLifeLog,
  evolveRelationshipState,
  createInitialRelationshipState,
  extractProfileUpdate,
  findLatestRenameRequest,
  formatDuration,
  getLastRenameAppliedAt,
  getRenameCooldownStatus,
  initPersonaPackage,
  inspectMemoryStore,
  isRenameRequestFresh,
  loadPersonaPackage,
  listPinnedMemories,
  recallMemoriesWithTrace,
  readLifeEvents,
  readWorkingSet,
  rejectRename,
  requestRename,
  reconcileMemoryStoreFromLifeLog,
  removePinnedMemory,
  runMemoryStoreSql,
  shouldRequestConstitutionReview,
  summarizeAppliedRevision,
  collectRevisionSignals,
  proposeSelfRevision,
  detectCoreConflicts,
  shouldApplyRevision,
  applyRevisionPatch,
  writeRelationshipState,
  writeWorkingSet,
  updateUserProfile,
  validateDisplayName,
  migrateLifeLogAndWorkingSet,
  ensureMemoryStore
} from "@soulseed/core";
import type { DecisionTrace, RelationshipState, VoiceProfile } from "@soulseed/core";
import { createHash, randomUUID } from "node:crypto";
import { inferEmotionFromText, parseEmotionTag, renderEmotionPrefix } from "./emotion.js";

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
      "  chat [--persona ./personas/Roxy.soulseedpersona] [--model deepseek-chat] [--strict-memory-grounding true|false]",
      "  doctor [--persona ./personas/Roxy.soulseedpersona]",
      "  memory status [--persona <path>]",
      "  memory list [--persona <path>] [--limit 20] [--state hot|warm|cold|archive|scar] [--deleted]",
      "  memory inspect --id <memory_id> [--persona <path>]",
      "  memory forget --id <memory_id> [--mode soft|hard] [--persona <path>]",
      "  memory recover --id <memory_id> [--persona <path>]",
      "  memory compact [--persona ./personas/Roxy.soulseedpersona]",
      "  memory export --out <file.json> [--persona <path>] [--include-deleted]",
      "  memory import --in <file.json> [--persona <path>]",
      "  memory pin add --text <memory> [--persona <path>]",
      "  memory pin list [--persona <path>]",
      "  memory pin remove --text <memory> [--persona <path>]",
      "  memory unpin --text <memory> [--persona <path>]  # alias of memory pin remove",
      "  memory reconcile [--persona ./personas/Roxy.soulseedpersona]",
      "  rename --to <new_name> [--persona <path>] [--confirm]",
      "  mcp [--persona <path>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]",
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
      "  /relation detail    查看关系多维评分与最近驱动因素",
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

function resolveStrictMemoryGrounding(options: Record<string, string | boolean>): boolean {
  const raw = options["strict-memory-grounding"];
  if (raw === true) {
    return true;
  }
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "off") {
      return false;
    }
    if (normalized === "true" || normalized === "1" || normalized === "on") {
      return true;
    }
  }
  return true;
}

const MAX_SELECTED_MEMORIES_IN_LOG = 8;

function compactDecisionTrace(trace: DecisionTrace): Record<string, unknown> {
  const selected = Array.isArray(trace.selectedMemories) ? trace.selectedMemories : [];
  const selectedClipped = selected
    .slice(0, MAX_SELECTED_MEMORIES_IN_LOG)
    .map((item) => (item.length > 160 ? `${item.slice(0, 160)}...` : item));
  const evidenceIds = (trace.selectedMemoryBlocks ?? [])
    .map((item) => item.id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .slice(0, 16);

  const selectedDigest = createHash("sha256").update(selected.join("|"), "utf8").digest("hex");
  const evidenceDigest = createHash("sha256").update(evidenceIds.join("|"), "utf8").digest("hex");

  return {
    version: trace.version,
    timestamp: trace.timestamp,
    askClarifyingQuestion: trace.askClarifyingQuestion,
    refuse: trace.refuse,
    riskLevel: trace.riskLevel,
    reason: trace.reason,
    model: trace.model,
    selectedMemories: selectedClipped,
    selectedMemoriesCount: selected.length,
    selectedMemoriesDigest: selectedDigest,
    selectedMemoryEvidenceIds: evidenceIds,
    selectedMemoryEvidenceCount: (trace.selectedMemoryBlocks ?? []).length,
    selectedMemoryEvidenceDigest: evidenceDigest,
    memoryBudget: trace.memoryBudget,
    retrievalBreakdown: trace.retrievalBreakdown,
    memoryWeights: trace.memoryWeights,
    voiceIntent: trace.voiceIntent ?? null,
    recallTraceId: trace.recallTraceId ?? null
  };
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
  const strictMemoryGrounding = resolveStrictMemoryGrounding(options);
  const chainCheck = await ensureScarForBrokenLifeLog({
    rootPath: personaPath,
    detector: "runtime"
  });
  if (!chainCheck.ok) {
    const written = chainCheck.scarWritten ? "并已写入 scar 事件" : "scar 事件已存在";
    console.warn(`[warning] life.log hash 链断裂: ${chainCheck.reason ?? "unknown"}，${written}`);
  }
  let workingSetData = await readWorkingSet(personaPath);
  let memoryWeights = workingSetData.memoryWeights ?? DEFAULT_MEMORY_WEIGHTS;
  const adapter = new DeepSeekAdapter({
    model: typeof options.model === "string" ? options.model : undefined
  });

  console.log(`会话已启动：${personaPkg.persona.displayName}`);
  console.log(`strict_memory_grounding=${strictMemoryGrounding ? "on" : "off"}`);
  console.log("输入 /read <路径> 可附加本地文件；输入 /proactive on 10 开启主动消息；输入 /exit 退出。");

  const assistantLabel = (): string => `${personaPkg.persona.displayName}>`;
  const sayAsAssistant = (content: string, emotionPrefix = ""): void => {
    console.log(`${assistantLabel()} ${emotionPrefix}${content}`);
  };

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> "
  });

  let currentAbort: AbortController | null = null;
  let currentToolAbort: AbortController | null = null;
  const toolSession = createToolSessionState();
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
    if (currentAbort || currentToolAbort) {
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
      if (currentToolAbort) {
        currentToolAbort.abort();
        currentToolAbort = null;
      }
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
        if (input === "/relation" || input === "/relation detail") {
          const rs = personaPkg.relationshipState;
          if (!rs) {
            console.log("关系状态未初始化。");
          } else {
            console.log(`关系状态: ${rs.state} (confidence=${rs.confidence.toFixed(2)})`);
            if (input === "/relation detail") {
              console.log(`overall=${rs.overall.toFixed(2)} version=${rs.version}`);
              console.log(
                `dimensions: trust=${rs.dimensions.trust.toFixed(2)} safety=${rs.dimensions.safety.toFixed(2)} intimacy=${rs.dimensions.intimacy.toFixed(2)} reciprocity=${rs.dimensions.reciprocity.toFixed(2)} stability=${rs.dimensions.stability.toFixed(2)}`
              );
              if (rs.drivers.length === 0) {
                console.log("drivers: none");
              } else {
                console.log("drivers:");
                for (const driver of rs.drivers.slice(-3)) {
                  const delta = Object.entries(driver.deltaSummary)
                    .map(([k, v]) => `${k}:${typeof v === "number" ? v.toFixed(3) : v}`)
                    .join(", ");
                  console.log(`- ${driver.source} ${driver.signal} (${delta || "no-delta"})`);
                }
              }
            }
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
          const resolvedPath = path.resolve(process.cwd(), arg);
          currentToolAbort = new AbortController();
          const toolCallId = randomUUID();
          const outcome = await executeToolCall({
            toolName: "fs.read_text",
            impact: {
              readPaths: [resolvedPath],
              estimatedDurationMs: 300
            },
            approval: {
              approved: true,
              reason: "user explicit command /read",
              budget: {
                maxCallsPerSession: 64,
                maxDurationMs: 4000
              },
              allowedReadRoots: [process.cwd()]
            },
            session: toolSession,
            signal: currentToolAbort.signal,
            run: async (signal) => readTextAttachmentResolved(resolvedPath, signal)
          });
          currentToolAbort = null;

          if (outcome.status !== "ok" || !outcome.result) {
            console.log(`读取失败: ${outcome.reason}`);
            console.log('提示: 路径可直接粘贴，或用引号包裹；不需要写 "\\ " 转义空格。');
            await appendLifeEvent(personaPath, {
              type: "mcp_tool_rejected",
              payload: {
                toolName: outcome.toolName,
                callId: toolCallId,
                reason: outcome.reason,
                status: outcome.status,
                budgetSnapshot: outcome.budgetSnapshot,
                impact: {
                  readPaths: [resolvedPath]
                }
              }
            });
          } else {
            attachedFiles.set(outcome.result.path, outcome.result.content);
            console.log(`已附加: ${outcome.result.path} (${outcome.result.size} bytes)`);
            await appendLifeEvent(personaPath, {
              type: "mcp_tool_called",
              payload: {
                toolName: outcome.toolName,
                callId: toolCallId,
                approvalReason: outcome.reason,
                budgetSnapshot: outcome.budgetSnapshot,
                durationMs: outcome.durationMs,
                impact: {
                  readPaths: [resolvedPath]
                },
                result: {
                  path: outcome.result.path,
                  size: outcome.result.size
                }
              }
            });
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
          personaPkg.relationshipState ?? createInitialRelationshipState(),
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
        const recallResult = await recallMemoriesWithTrace(personaPath, input);
        const trace = decide(personaPkg, input, model, {
          lifeEvents: pastEvents,
          memoryWeights,
          recalledMemories: recallResult.memories,
          recalledMemoryBlocks: recallResult.memoryBlocks,
          recallTraceId: recallResult.traceId
        });
        const effectiveInput = injectAttachments(input, attachedFiles);
        const messages = compileContext(personaPkg, effectiveInput, trace, {
          lifeEvents: pastEvents
        });

        await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: input,
        trace: compactDecisionTrace(trace),
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
          trace: compactDecisionTrace(trace),
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
      const relationshipAfterRefusal = evolveRelationshipStateFromAssistant(
        personaPkg.relationshipState ?? createInitialRelationshipState(),
        refusal,
        await readLifeEvents(personaPath)
      );
      if (
        relationshipAfterRefusal.state !== personaPkg.relationshipState?.state ||
        relationshipAfterRefusal.confidence !== personaPkg.relationshipState?.confidence ||
        relationshipAfterRefusal.overall !== personaPkg.relationshipState?.overall
      ) {
        personaPkg.relationshipState = relationshipAfterRefusal;
        await writeRelationshipState(personaPath, relationshipAfterRefusal);
        await appendLifeEvent(personaPath, {
          type: "relationship_state_updated",
          payload: { ...relationshipAfterRefusal }
        });
      }
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, refusal);
      await runSelfRevisionLoop({
        personaPath,
        personaPkg,
        userInput: input,
        assistantReply: refusal
      });
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
        let streamed = false;

        try {
      const result = await adapter.streamChat(
        messages,
        {
          onToken: (chunk: string) => {
            assistantContent += chunk;
            if (!streamed) {
              process.stdout.write(`${assistantLabel()} `);
              streamed = true;
            }
            process.stdout.write(chunk);
          },
          onDone: () => {
            if (streamed) {
              process.stdout.write("\n");
            }
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
      const rawAssistantContent = assistantContent;
      const identityGuard = enforceIdentityGuard(assistantContent, personaPkg.persona.displayName, input);
      assistantContent = identityGuard.text;
      const relationalGuard = enforceRelationalGuard(assistantContent, {
        selectedMemories: trace.selectedMemories,
        selectedMemoryBlocks: trace.selectedMemoryBlocks,
        personaName: personaPkg.persona.displayName
      });
      assistantContent = relationalGuard.text;
      const recallGroundingGuard = enforceRecallGroundingGuard(assistantContent, {
        selectedMemories: trace.selectedMemories,
        selectedMemoryBlocks: trace.selectedMemoryBlocks,
        lifeEvents: pastEvents,
        strictMemoryGrounding
      });
      assistantContent = recallGroundingGuard.text;
      const emotion = parseEmotionTag(assistantContent);
      assistantContent = emotion.text;
      const resolvedEmotion = emotion.emotion ?? inferEmotionFromText(assistantContent);
      if (!streamed) {
        sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
      } else if (identityGuard.corrected || relationalGuard.corrected || recallGroundingGuard.corrected) {
        sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
      } else if (parseEmotionTag(rawAssistantContent).text.trim() !== assistantContent.trim()) {
        sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
      }
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
      if (relationalGuard.corrected || recallGroundingGuard.corrected) {
        await appendLifeEvent(personaPath, {
          type: "memory_contamination_flagged",
          payload: {
            flags: [...new Set([...relationalGuard.flags, ...recallGroundingGuard.flags])],
            userInput: input,
            rewrittenText: assistantContent
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
      if (relationalGuard.corrected || recallGroundingGuard.corrected) {
        assistantMeta.credibilityScore = 0.2;
        assistantMeta.contaminationFlags = [...new Set([...relationalGuard.flags, ...recallGroundingGuard.flags])];
        assistantMeta.excludedFromRecall = true;
      }
      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: {
          text: assistantContent,
          trace: compactDecisionTrace(trace),
          identityGuard,
          relationalGuard,
          recallGroundingGuard,
          memoryMeta: assistantMeta
        }
      });
      const relationshipAfterAssistant = evolveRelationshipStateFromAssistant(
        personaPkg.relationshipState ?? createInitialRelationshipState(),
        assistantContent,
        await readLifeEvents(personaPath)
      );
      if (
        relationshipAfterAssistant.state !== personaPkg.relationshipState?.state ||
        relationshipAfterAssistant.confidence !== personaPkg.relationshipState?.confidence ||
        relationshipAfterAssistant.overall !== personaPkg.relationshipState?.overall
      ) {
        personaPkg.relationshipState = relationshipAfterAssistant;
        await writeRelationshipState(personaPath, relationshipAfterAssistant);
        await appendLifeEvent(personaPath, {
          type: "relationship_state_updated",
          payload: { ...relationshipAfterAssistant }
        });
      }
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, assistantContent);
      await runSelfRevisionLoop({
        personaPath,
        personaPkg,
        userInput: input,
        assistantReply: assistantContent
      });

      const nextWeights = adaptWeights(memoryWeights, {
        activationDelta: profilePatch?.preferredName ? 0.02 : 0.01,
        emotionDelta:
          identityGuard.corrected || relationalGuard.corrected || recallGroundingGuard.corrected
            ? 0.02
            : 0,
        narrativeDelta:
          identityGuard.corrected || relationalGuard.corrected || recallGroundingGuard.corrected
            ? 0.02
            : 0.01
      });
      if (JSON.stringify(nextWeights) !== JSON.stringify(memoryWeights)) {
        await appendLifeEvent(personaPath, {
          type: "memory_weight_updated",
          payload: {
            oldWeights: memoryWeights,
            newWeights: nextWeights,
            reason: identityGuard.corrected || relationalGuard.corrected || recallGroundingGuard.corrected
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
            compactedHashes: compactResult.compactedIds.slice(0, 12),
            compactedHashesDigest: createHash("sha256")
              .update(compactResult.compactedIds.join("|"), "utf8")
              .digest("hex")
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

async function readTextAttachmentResolved(
  filePath: string,
  signal?: AbortSignal
): Promise<{ path: string; content: string; size: number }> {
  if (signal?.aborted) {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }
  const resolved = path.resolve(filePath);
  if (!existsSync(resolved)) {
    throw new Error("文件不存在");
  }
  try {
    if (signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    const raw = await readFile(resolved, "utf8");
    if (signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    if (!raw.trim()) {
      throw new Error("文件为空");
    }
    const MAX_CHARS = 50_000;
    const clipped = raw.length > MAX_CHARS;
    const content = clipped ? `${raw.slice(0, MAX_CHARS)}\n\n[truncated]` : raw;
    return {
      path: resolved,
      content,
      size: Buffer.byteLength(raw, "utf8")
    };
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === "AbortError" || error.message === "文件不存在" || error.message === "文件为空")) {
      throw error;
    }
    throw new Error("读取失败（仅支持可按 UTF-8 读取的文本文件）");
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

interface MemoryRowView {
  id: string;
  memoryType: string;
  content: string;
  salience: number;
  state: string;
  activationCount: number;
  lastActivatedAt: string;
  credibilityScore: number;
  excludedFromRecall: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function optionString(options: Record<string, string | boolean>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function optionBoolean(options: Record<string, string | boolean>, key: string): boolean {
  return options[key] === true;
}

function parseLimit(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parseMemoryState(raw: string | undefined): "hot" | "warm" | "cold" | "archive" | "scar" | undefined {
  if (!raw) {
    return undefined;
  }
  return raw === "hot" || raw === "warm" || raw === "cold" || raw === "archive" || raw === "scar"
    ? raw
    : undefined;
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function queryMemoryRows(rootPath: string, sql: string): Promise<MemoryRowView[]> {
  const raw = await runMemoryStoreSql(rootPath, sql);
  if (!raw.trim()) {
    return [];
  }
  const rows: MemoryRowView[] = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      if (!id) {
        continue;
      }
      rows.push({
        id,
        memoryType: typeof parsed.memoryType === "string" ? parsed.memoryType : "episodic",
        content: typeof parsed.content === "string" ? parsed.content : "",
        salience: Number(parsed.salience) || 0,
        state: typeof parsed.state === "string" ? parsed.state : "warm",
        activationCount: Number(parsed.activationCount) || 0,
        lastActivatedAt: typeof parsed.lastActivatedAt === "string" ? parsed.lastActivatedAt : "",
        credibilityScore: Number(parsed.credibilityScore) || 0,
        excludedFromRecall: Number(parsed.excludedFromRecall) === 1 || parsed.excludedFromRecall === true,
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : "",
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        deletedAt: typeof parsed.deletedAt === "string" ? parsed.deletedAt : null
      });
    } catch {
      continue;
    }
  }
  return rows;
}

async function runMemoryStatus(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const inspection = await inspectMemoryStore(personaPath);
  const statsRaw = await runMemoryStoreSql(
    personaPath,
    [
      "SELECT json_object(",
      "'total', COUNT(*),",
      "'active', SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END),",
      "'deleted', SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END),",
      "'excluded', SUM(CASE WHEN excluded_from_recall = 1 THEN 1 ELSE 0 END),",
      "'hot', SUM(CASE WHEN state='hot' THEN 1 ELSE 0 END),",
      "'warm', SUM(CASE WHEN state='warm' THEN 1 ELSE 0 END),",
      "'cold', SUM(CASE WHEN state='cold' THEN 1 ELSE 0 END),",
      "'archive', SUM(CASE WHEN state='archive' THEN 1 ELSE 0 END),",
      "'scar', SUM(CASE WHEN state='scar' THEN 1 ELSE 0 END)",
      ")",
      "FROM memories;"
    ].join("\n")
  );
  const stats = statsRaw.trim() ? JSON.parse(statsRaw.trim()) : {};
  console.log(
    JSON.stringify(
      {
        exists: inspection.exists,
        schemaVersion: inspection.schemaVersion,
        missingTables: inspection.missingTables,
        stats
      },
      null,
      2
    )
  );
}

async function runMemoryList(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const limit = parseLimit(optionString(options, "limit"), 20, 1, 200);
  const state = parseMemoryState(optionString(options, "state"));
  if (optionString(options, "state") && !state) {
    throw new Error("memory list --state 仅支持 hot|warm|cold|archive|scar");
  }
  const includeDeleted = optionBoolean(options, "deleted") || optionBoolean(options, "include-deleted");
  const where: string[] = [];
  if (!includeDeleted) {
    where.push("deleted_at IS NULL");
  }
  if (state) {
    where.push(`state = ${sqlText(state)}`);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await queryMemoryRows(
    personaPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'memoryType', memory_type,",
      "'content', content,",
      "'salience', salience,",
      "'state', state,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'credibilityScore', credibility_score,",
      "'excludedFromRecall', excluded_from_recall,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at,",
      "'deletedAt', deleted_at",
      ")",
      "FROM memories",
      whereSql,
      "ORDER BY updated_at DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );

  console.log(
    JSON.stringify(
      {
        count: rows.length,
        includeDeleted,
        state: state ?? null,
        items: rows
      },
      null,
      2
    )
  );
}

async function runMemoryInspect(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const id = optionString(options, "id")?.trim();
  if (!id) {
    throw new Error("memory inspect 需要 --id <memory_id>");
  }
  const rows = await queryMemoryRows(
    personaPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'memoryType', memory_type,",
      "'content', content,",
      "'salience', salience,",
      "'state', state,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'credibilityScore', credibility_score,",
      "'excludedFromRecall', excluded_from_recall,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at,",
      "'deletedAt', deleted_at",
      ")",
      "FROM memories",
      `WHERE id = ${sqlText(id)}`,
      "LIMIT 1;"
    ].join("\n")
  );
  if (rows.length === 0) {
    throw new Error(`memory inspect 未找到 id=${id}`);
  }
  console.log(JSON.stringify(rows[0], null, 2));
}

async function runMemoryForget(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const id = optionString(options, "id")?.trim();
  if (!id) {
    throw new Error("memory forget 需要 --id <memory_id>");
  }
  const modeRaw = (optionString(options, "mode") ?? "soft").trim().toLowerCase();
  const mode = modeRaw === "soft" || modeRaw === "hard" ? modeRaw : null;
  if (!mode) {
    throw new Error("memory forget --mode 仅支持 soft|hard");
  }
  const now = new Date().toISOString();
  if (mode === "soft") {
    await runMemoryStoreSql(
      personaPath,
      [
        "UPDATE memories",
        `SET deleted_at = ${sqlText(now)}, updated_at = ${sqlText(now)}`,
        `WHERE id = ${sqlText(id)} AND deleted_at IS NULL;`
      ].join(" ")
    );
  } else {
    await runMemoryStoreSql(personaPath, `DELETE FROM memories WHERE id = ${sqlText(id)};`);
  }

  await appendLifeEvent(personaPath, {
    type: "memory_soft_forgotten",
    payload: {
      id,
      mode,
      ts: now
    }
  });

  console.log(JSON.stringify({ ok: true, id, mode }, null, 2));
}

async function runMemoryRecover(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const id = optionString(options, "id")?.trim();
  if (!id) {
    throw new Error("memory recover 需要 --id <memory_id>");
  }
  const now = new Date().toISOString();
  await runMemoryStoreSql(
    personaPath,
    [
      "UPDATE memories",
      `SET deleted_at = NULL, updated_at = ${sqlText(now)}`,
      `WHERE id = ${sqlText(id)};`
    ].join(" ")
  );
  await appendLifeEvent(personaPath, {
    type: "memory_recovered",
    payload: {
      id,
      ts: now
    }
  });

  console.log(JSON.stringify({ ok: true, id, recovered: true }, null, 2));
}

async function runMemoryExport(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const outPathRaw = optionString(options, "out");
  if (!outPathRaw) {
    throw new Error("memory export 需要 --out <file.json>");
  }
  const includeDeleted = optionBoolean(options, "include-deleted");
  const whereSql = includeDeleted ? "" : "WHERE deleted_at IS NULL";
  const rows = await queryMemoryRows(
    personaPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'memoryType', memory_type,",
      "'content', content,",
      "'salience', salience,",
      "'state', state,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'emotionScore', emotion_score,",
      "'narrativeScore', narrative_score,",
      "'credibilityScore', credibility_score,",
      "'originRole', origin_role,",
      "'evidenceLevel', evidence_level,",
      "'excludedFromRecall', excluded_from_recall,",
      "'reconsolidationCount', reconsolidation_count,",
      "'sourceEventHash', source_event_hash,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at,",
      "'deletedAt', deleted_at",
      ")",
      "FROM memories",
      whereSql,
      "ORDER BY created_at ASC;"
    ].join("\n")
  );

  const outPath = path.resolve(process.cwd(), outPathRaw);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(
    outPath,
    JSON.stringify(
      {
        schema: "soulseed.memory.export.v1",
        exportedAt: new Date().toISOString(),
        personaPath,
        includeDeleted,
        items: rows
      },
      null,
      2
    ),
    "utf8"
  );
  console.log(JSON.stringify({ ok: true, outPath, count: rows.length }, null, 2));
}

async function runMemoryImport(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const inPathRaw = optionString(options, "in");
  if (!inPathRaw) {
    throw new Error("memory import 需要 --in <file.json>");
  }
  const inPath = path.resolve(process.cwd(), inPathRaw);
  const raw = await readFile(inPath, "utf8");
  const parsed = JSON.parse(raw) as { items?: Array<Record<string, unknown>> };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  if (items.length === 0) {
    console.log(JSON.stringify({ ok: true, imported: 0 }, null, 2));
    return;
  }

  const statements: string[] = [];
  for (const item of items) {
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : "";
    const content = typeof item.content === "string" ? item.content : "";
    if (!id || !content) {
      continue;
    }
    const now = new Date().toISOString();
    const memoryType = typeof item.memoryType === "string" ? item.memoryType : "episodic";
    const salience = Number(item.salience);
    const state = typeof item.state === "string" ? item.state : "warm";
    const activationCount = Number(item.activationCount);
    const lastActivatedAt = typeof item.lastActivatedAt === "string" ? item.lastActivatedAt : now;
    const emotionScore = Number(item.emotionScore);
    const narrativeScore = Number(item.narrativeScore);
    const credibilityScore = Number(item.credibilityScore);
    const originRole = typeof item.originRole === "string" ? item.originRole : "system";
    const evidenceLevel = typeof item.evidenceLevel === "string" ? item.evidenceLevel : "derived";
    const excludedFromRecall = item.excludedFromRecall === true || Number(item.excludedFromRecall) === 1 ? 1 : 0;
    const reconsolidationCount = Number(item.reconsolidationCount);
    const sourceEventHash =
      typeof item.sourceEventHash === "string" && item.sourceEventHash.trim() ? item.sourceEventHash : `import:${id}`;
    const createdAt = typeof item.createdAt === "string" ? item.createdAt : now;
    const updatedAt = typeof item.updatedAt === "string" ? item.updatedAt : now;
    const deletedAt =
      typeof item.deletedAt === "string" && item.deletedAt.trim().length > 0 ? sqlText(item.deletedAt) : "NULL";

    statements.push(
      [
        "INSERT OR REPLACE INTO memories",
        "(id, memory_type, content, salience, state, origin_role, evidence_level, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
        "VALUES",
        `(${sqlText(id)}, ${sqlText(memoryType)}, ${sqlText(content.slice(0, 2000))}, ${Number.isFinite(salience) ? Math.max(0, Math.min(1, salience)) : 0.3}, ${sqlText(state)}, ${sqlText(originRole)}, ${sqlText(evidenceLevel)}, ${Number.isFinite(activationCount) ? Math.max(1, Math.floor(activationCount)) : 1}, ${sqlText(lastActivatedAt)}, ${Number.isFinite(emotionScore) ? Math.max(0, Math.min(1, emotionScore)) : 0.2}, ${Number.isFinite(narrativeScore) ? Math.max(0, Math.min(1, narrativeScore)) : 0.2}, ${Number.isFinite(credibilityScore) ? Math.max(0, Math.min(1, credibilityScore)) : 0.8}, ${excludedFromRecall}, ${Number.isFinite(reconsolidationCount) ? Math.max(0, Math.floor(reconsolidationCount)) : 0}, ${sqlText(sourceEventHash)}, ${sqlText(createdAt)}, ${sqlText(updatedAt)}, ${deletedAt});`
      ].join(" ")
    );
  }

  if (statements.length === 0) {
    console.log(JSON.stringify({ ok: true, imported: 0 }, null, 2));
    return;
  }

  await runMemoryStoreSql(
    personaPath,
    `
    BEGIN;
    ${statements.join("\n")}
    COMMIT;
    `
  );
  console.log(JSON.stringify({ ok: true, imported: statements.length }, null, 2));
}

async function runMemoryCompact(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const report = await migrateLifeLogAndWorkingSet(personaPath);
  console.log(JSON.stringify(report, null, 2));
}

async function runMemoryPin(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (action === "add") {
    const text = options.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("memory pin add 需要 --text <memory>");
    }
    if (text.trim().length > 240) {
      throw new Error("memory pin add --text 长度不能超过 240 字符");
    }
    const pinned = await addPinnedMemory(personaPath, text);
    console.log(JSON.stringify(pinned, null, 2));
    return;
  }

  if (action === "list") {
    const memories = await listPinnedMemories(personaPath);
    console.log(JSON.stringify({ memories }, null, 2));
    return;
  }

  if (action === "remove") {
    const text = options.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("memory pin remove 需要 --text <memory>");
    }
    const pinned = await removePinnedMemory(personaPath, text);
    console.log(JSON.stringify(pinned, null, 2));
    return;
  }

  throw new Error("memory pin 用法: memory pin <add|list|remove> [--text <memory>] [--persona <path>]");
}

async function runMemoryReconcile(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const report = await reconcileMemoryStoreFromLifeLog(personaPath);
  console.log(JSON.stringify(report, null, 2));
}

async function runMcp(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (!existsSync(personaPath)) {
    throw new Error(`Persona directory not found: ${personaPath}`);
  }
  const transportRaw = typeof options.transport === "string" ? options.transport.trim().toLowerCase() : "stdio";
  const transport = transportRaw === "http" ? "http" : "stdio";
  const host = typeof options.host === "string" && options.host.trim() ? options.host.trim() : "127.0.0.1";
  const portRaw = typeof options.port === "string" ? Number(options.port) : 8787;
  const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw <= 65535 ? Math.floor(portRaw) : 8787;
  const authToken = typeof options["auth-token"] === "string" && options["auth-token"].trim()
    ? options["auth-token"].trim()
    : undefined;
  const mcpServerPath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    "../../mcp-server/dist/index.js"
  );
  if (!existsSync(mcpServerPath)) {
    throw new Error(
      `MCP server not built. Run: npm run build -w @soulseed/mcp-server\n  (expected: ${mcpServerPath})`
    );
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [mcpServerPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        SOULSEED_PERSONA_PATH: personaPath,
        MCP_TRANSPORT: transport,
        MCP_HOST: host,
        MCP_PORT: String(port),
        ...(authToken ? { MCP_AUTH_TOKEN: authToken } : {})
      }
    });
    child.on("close", (code) => {
      if (code !== null && code !== 0) {
        process.exitCode = code;
      }
      resolve();
    });
    child.on("error", reject);
  });
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

  if (resource === "mcp") {
    await runMcp(args.options);
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

  if (resource === "memory" && action === "compact") {
    await runMemoryCompact(args.options);
    return;
  }

  if (resource === "memory" && action === "status") {
    await runMemoryStatus(args.options);
    return;
  }

  if (resource === "memory" && action === "list") {
    await runMemoryList(args.options);
    return;
  }

  if (resource === "memory" && action === "inspect") {
    await runMemoryInspect(args.options);
    return;
  }

  if (resource === "memory" && action === "forget") {
    await runMemoryForget(args.options);
    return;
  }

  if (resource === "memory" && action === "recover") {
    await runMemoryRecover(args.options);
    return;
  }

  if (resource === "memory" && action === "export") {
    await runMemoryExport(args.options);
    return;
  }

  if (resource === "memory" && action === "import") {
    await runMemoryImport(args.options);
    return;
  }

  if (resource === "memory" && action === "pin") {
    const pinAction = typeof args._[2] === "string" ? args._[2] : undefined;
    await runMemoryPin(pinAction, args.options);
    return;
  }

  if (resource === "memory" && action === "unpin") {
    await runMemoryPin("remove", args.options);
    return;
  }

  if (resource === "memory" && action === "reconcile") {
    await runMemoryReconcile(args.options);
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

async function runSelfRevisionLoop(params: {
  personaPath: string;
  personaPkg: {
    constitution: { mission: string; values: string[]; boundaries: string[] };
    relationshipState?: RelationshipState;
    voiceProfile?: VoiceProfile;
  };
  userInput: string;
  assistantReply: string;
}): Promise<void> {
  const events = await readLifeEvents(params.personaPath);
  const signals = collectRevisionSignals({
    userInput: params.userInput,
    assistantReply: params.assistantReply,
    events,
    relationshipState: params.personaPkg.relationshipState
  });
  const proposal = proposeSelfRevision({
    signals,
    relationshipState: params.personaPkg.relationshipState,
    voiceProfile: params.personaPkg.voiceProfile
  });
  if (!proposal) {
    return;
  }

  await appendLifeEvent(params.personaPath, {
    type: "self_revision_proposed",
    payload: {
      proposal,
      evidenceCount: proposal.evidence.length,
      source: "self_revision_loop"
    }
  });

  const conflicts = detectCoreConflicts({
    proposal,
    constitution: params.personaPkg.constitution,
    userInput: params.userInput,
    assistantReply: params.assistantReply
  });
  if (conflicts.length > 0) {
    await appendLifeEvent(params.personaPath, {
      type: "self_revision_conflicted",
      payload: {
        proposal: {
          ...proposal,
          status: "frozen",
          conflictsWithBoundaries: conflicts
        },
        constitutionPatchProposal: {
          domain: "constitution_proposal",
          reason: "conflicts detected in self revision",
          conflicts
        }
      }
    });
    return;
  }

  const apply = shouldApplyRevision({
    proposal,
    events,
    nowMs: Date.now()
  });
  if (!apply) {
    return;
  }

  await applyRevisionPatch(params.personaPath, proposal);
  if (proposal.domain === "worldview_proposal") {
    await appendLifeEvent(params.personaPath, {
      type: "worldview_revised",
      payload: {
        diff: proposal.changes,
        reason: proposal.reasonCodes.join(",") || "self_revision_loop",
        evidenceHashes: proposal.evidence
      }
    });
  }
  if (proposal.domain === "constitution_proposal") {
    await appendLifeEvent(params.personaPath, {
      type: "constitution_revised",
      payload: {
        diff: proposal.changes,
        reason: proposal.reasonCodes.join(",") || "self_revision_loop",
        evidenceHashes: proposal.evidence
      }
    });
  }
  await appendLifeEvent(params.personaPath, {
    type: "self_revision_applied",
    payload: {
      proposal: {
        ...proposal,
        status: "applied"
      },
      summary: summarizeAppliedRevision(proposal),
      source: "self_revision_loop"
    }
  });
}
