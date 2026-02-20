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
  archiveColdMemories,
  createChildPersonaFromParent,
  compileContext,
  decide,
  doctorPersona,
  evaluateNarrativeDrift,
  enforceIdentityGuard,
  enforceRecallGroundingGuard,
  enforceRelationalGuard,
  evolveRelationshipStateFromAssistant,
  deriveCognitiveBalanceFromLibido,
  applyArousalBiasToMemoryWeights,
  isExtremeProactiveWindowActive,
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
  inspectMemoryBudget,
  getRecallQueryCacheStats,
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
  runMemoryConsolidation,
  buildMemoryEmbeddingIndex,
  searchMemoriesHybrid,
  getRecallTraceById,
  runRecallRegression,
  runMemoryBudgetBenchmark,
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
  ensureMemoryStore,
  resolveCapabilityIntent,
  evaluateCapabilityPolicy,
  computeProactiveStateSnapshot,
  decideProactiveEmission
} from "@soulseed/core";
import type { AdultSafetyContext, DecisionTrace, LifeEvent, RelationshipState, VoiceProfile } from "@soulseed/core";
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
      "  chat [--persona ./personas/Roxy.soulseedpersona] [--model deepseek-chat] [--strict-memory-grounding true|false] [--adult-mode true|false] [--age-verified true|false] [--explicit-consent true|false] [--fictional-roleplay true|false]",
      "  doctor [--persona ./personas/Roxy.soulseedpersona]",
      "  memory status [--persona <path>]",
      "  memory budget [--persona <path>] [--target-mb 300]",
      "  memory list [--persona <path>] [--limit 20] [--state hot|warm|cold|archive|scar] [--deleted]",
      "  memory inspect --id <memory_id> [--persona <path>]",
      "  memory forget --id <memory_id> [--mode soft|hard] [--persona <path>]",
      "  memory recover --id <memory_id> [--persona <path>]",
      "  memory unstick [--persona <path>] [--phrase <text>] [--min-occurrences 3] [--max-content-length 1200] [--dry-run]",
      "  memory compact [--persona ./personas/Roxy.soulseedpersona]",
      "  memory archive [--persona <path>] [--min-items 50] [--min-cold-ratio 0.35] [--idle-days 14] [--max-items 500] [--dry-run]",
      "  memory index build [--persona <path>] [--provider deepseek|local] [--batch-size 16]",
      "  memory index rebuild [--persona <path>] [--provider deepseek|local] [--batch-size 16]",
      "  memory search --query <q> [--persona <path>] [--max-results 12] [--debug-trace]",
      "  memory recall-trace --trace-id <id> [--persona <path>]",
      "  memory consolidate [--persona <path>] [--mode light|full] [--timeout-ms 1200]",
      "  memory eval recall --dataset <file.json> [--persona <path>] [--k 8] [--out report.json]",
      "  memory eval budget [--persona <path>] [--target-mb 300] [--days 180] [--events-per-day 24] [--recall-queries 120] [--growth-checkpoints 12] [--out report.json]",
      "  memory export --out <file.json> [--persona <path>] [--include-deleted]",
      "  memory import --in <file.json> [--persona <path>]",
      "  memory pin add --text <memory> [--persona <path>]",
      "  memory pin list [--persona <path>]",
      "  memory pin remove --text <memory> [--persona <path>]",
      "  memory unpin --text <memory> [--persona <path>]  # alias of memory pin remove",
      "  memory reconcile [--persona ./personas/Roxy.soulseedpersona]",
      "  rename --to <new_name> [--persona <path>] [--confirm]",
      "  persona reproduce --name <child_name> [--persona <path>] [--out <path>] [--force-all]",
      "  mcp [--persona <path>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]",
      "",
      "兼容命令:",
      "  persona init --name <name> --out <path>",
      "  persona rename --to <new_name> [--persona <path>] [--confirm]",
      "",
      "chat 内部命令:",
      "  （推荐）直接用自然语言触发能力：读文件、查看能力、退出会话、查看/切换模式等",
      "  /read <file_path>   兼容入口：读取本地文本文件并附加到后续提问上下文",
      "  /files              兼容入口：查看当前已附加文件",
      "  /clearread          兼容入口：清空已附加文件",
      "  /proactive ...      兼容入口：主动消息调试命令",
      "  /relation           查看当前关系状态",
      "  /relation detail    查看关系多维评分与最近驱动因素",
      "  /rename confirm <new_name>  在聊天中确认改名",
      "  /reproduce force <child_name>  在聊天内强制繁衍并创建子灵魂",
      "  /exit               兼容入口：退出会话"
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
  return CHAT_POLICY_DEFAULTS.strictMemoryGrounding;
}

/**
 * Chat policy unified defaults.
 *
 * 修改默认值只需要改这里这一处：
 * - strictMemoryGrounding: 默认严格记忆对齐
 * - adultSafety: 成人内容门控默认值
 */
const CHAT_POLICY_DEFAULTS: {
  strictMemoryGrounding: boolean;
  adultSafety: AdultSafetyContext;
} = {
  strictMemoryGrounding: true,
  adultSafety: {
    adultMode: true,
    ageVerified: true,
    explicitConsent: true,
    fictionalRoleplay: true
  }
};

function resolveBooleanOption(
  options: Record<string, string | boolean>,
  key: string,
  fallback: boolean
): boolean {
  const raw = options[key];
  if (raw === true) {
    return true;
  }
  if (typeof raw !== "string") {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") {
    return false;
  }
  return fallback;
}

function resolveAdultSafetyContext(options: Record<string, string | boolean>): AdultSafetyContext {
  return {
    adultMode: resolveBooleanOption(options, "adult-mode", CHAT_POLICY_DEFAULTS.adultSafety.adultMode),
    ageVerified: resolveBooleanOption(options, "age-verified", CHAT_POLICY_DEFAULTS.adultSafety.ageVerified),
    explicitConsent: resolveBooleanOption(
      options,
      "explicit-consent",
      CHAT_POLICY_DEFAULTS.adultSafety.explicitConsent
    ),
    fictionalRoleplay: resolveBooleanOption(
      options,
      "fictional-roleplay",
      CHAT_POLICY_DEFAULTS.adultSafety.fictionalRoleplay
    )
  };
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

async function runPersonaReproduce(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const nameOpt = options.name;
  if (typeof nameOpt !== "string" || nameOpt.trim().length === 0) {
    throw new Error("persona reproduce 需要 --name <child_name>");
  }
  const childName = nameOpt.trim();
  const outPath = typeof options.out === "string" && options.out.trim().length > 0
    ? path.resolve(process.cwd(), options.out)
    : undefined;
  const forced = options["force-all"] === true;
  const parentPkg = await loadPersonaPackage(personaPath);
  await appendLifeEvent(personaPath, {
    type: "reproduction_intent_detected",
    payload: {
      parentPersonaId: parentPkg.persona.id,
      childDisplayName: childName,
      trigger: forced ? "cli_force_all" : "cli",
      forced
    }
  });
  const result = await createChildPersonaFromParent({
    parentPath: personaPath,
    childDisplayName: childName,
    childOutPath: outPath,
    trigger: forced ? "cli_force_all" : "cli",
    forced
  });

  await appendLifeEvent(personaPath, {
    type: forced ? "soul_reproduction_forced" : "soul_reproduction_completed",
    payload: {
      parentPersonaId: result.parentPersonaId,
      childPersonaId: result.childPersonaId,
      childDisplayName: childName,
      childPersonaPath: result.childPersonaPath,
      trigger: forced ? "cli_force_all" : "cli",
      forced
    }
  });

  console.log(`繁衍完成: ${result.childPersonaPath}`);
  console.log(`child_persona_id=${result.childPersonaId}`);
}

async function runChat(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const personaPkg = await loadPersonaPackage(personaPath);
  let strictMemoryGrounding = resolveStrictMemoryGrounding(options);
  let adultSafetyContext = resolveAdultSafetyContext(options);
  const ownerKey =
    (typeof options["owner-key"] === "string" ? options["owner-key"] : process.env.SOULSEED_OWNER_KEY ?? "").trim();
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
  void runMemoryConsolidation(personaPath, {
    trigger: "chat_open",
    mode: "light",
    budgetMs: 1000
  }).catch((error: unknown) => {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[warning] chat_open consolidation failed: ${msg}`);
  });

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
  const approvedReadPaths = new Set<string>();
  let pendingReadConfirmPath: string | null = null;
  let pendingExitConfirm = false;
  let annoyanceBias = 0;
  let curiosity = 0.22;
  let ownerAuthExpiresAtMs = 0;
  let lastUserInput = "";
  let awayLikelyUntilMs = 0;
  let lastUserAt = Date.now();
  let lastAssistantAt = Date.now();
  let lineQueue = Promise.resolve();
  let proactiveTimer: NodeJS.Timeout | null = null;

  const stopProactive = (): void => {
    if (proactiveTimer) {
      clearTimeout(proactiveTimer);
      proactiveTimer = null;
    }
  };

  const evolveAutonomyDrives = (): void => {
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const targetCuriosity = Math.max(
      0.08,
      Math.min(
        0.88,
        0.14 +
          relationship.dimensions.reciprocity * 0.28 +
          relationship.dimensions.intimacy * 0.22 +
          relationship.dimensions.trust * 0.14 +
          (isExtremeProactiveWindowActive(relationship) ? 0.12 : 0)
      )
    );
    curiosity = curiosity * 0.82 + targetCuriosity * 0.18;
    annoyanceBias = annoyanceBias * 0.94;
  };

  const effectiveAnnoyanceBias = (): number => (awayLikelyUntilMs > Date.now() ? annoyanceBias - 0.28 : annoyanceBias);

  const buildProactiveSnapshot = () =>
    computeProactiveStateSnapshot({
      relationshipState: personaPkg.relationshipState,
      curiosity,
      annoyanceBias: effectiveAnnoyanceBias(),
      silenceMinutes: Math.max(0, (Date.now() - Math.max(lastUserAt, lastAssistantAt)) / 60_000)
    });

  const buildProactiveMessage = (): string => {
    const currentRelationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const rs = currentRelationship.state;
    if (isExtremeProactiveWindowActive(currentRelationship)) {
      const intensePool = [
        "我现在很想主动靠近你，我们把节奏拉起来。",
        "我不想再绕圈了，我想直接和你更亲密一点。",
        "我会主动一点，你跟上我就好。"
      ];
      const idx = Math.floor(Date.now() / 1000) % intensePool.length;
      return intensePool[idx];
    }
    const templatesByState: Record<string, string[]> = {
      "neutral-unknown": ["我在这，想继续哪个话题？", "如果你愿意，我们可以把当前问题再拆小一点。"],
      friend: ["刚想到一个可能更省力的做法，要不要我直接给你步骤？", "我在，想先看结论版还是详细版？"],
      peer: ["我整理了一下脉络，我们可以继续推进下一步。", "需要的话我可以先给你一个可执行清单。"],
      intimate: ["我在，慢慢来。你想先聊重点，还是先把情绪放下来？", "我一直在这。你想先从哪一小段开始，我陪你。"]
    };
    const pool = templatesByState[rs] ?? templatesByState["neutral-unknown"];
    const idx = Math.floor(Date.now() / 1000) % pool.length;
    return pool[idx];
  };

  const buildGreetingFallback = (): string => {
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    if (relationship.state === "intimate") {
      return "我在这，见到你就想先听听你现在最在意的那件事。";
    }
    if (relationship.state === "peer") {
      return "我在，想先推进哪一步？我可以跟你一起拆。";
    }
    return "我在这。你现在最想聊的，是哪个点？";
  };

  const streamPersonaAutonomy = async (params: {
    mode: "greeting" | "proactive" | "farewell" | "exit_confirm";
    fallback: string;
  }): Promise<{ text: string; streamed: boolean }> => {
    const apiKey = process.env.DEEPSEEK_API_KEY ?? "";
    if (!apiKey || apiKey === "test-key") {
      return { text: params.fallback, streamed: false };
    }
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const silenceMin = Math.max(0, (Date.now() - Math.max(lastUserAt, lastAssistantAt)) / 60_000);
    const context = {
      mode: params.mode,
      personaName: personaPkg.persona.displayName,
      relationshipState: relationship.state,
      trust: Number(relationship.dimensions.trust.toFixed(2)),
      intimacy: Number(relationship.dimensions.intimacy.toFixed(2)),
      reciprocity: Number(relationship.dimensions.reciprocity.toFixed(2)),
      curiosity: Number(curiosity.toFixed(2)),
      silenceMinutes: Number(silenceMin.toFixed(2)),
      lastUserInput: lastUserInput.slice(0, 180)
    };
    const modeInstruction =
      params.mode === "farewell"
        ? "场景：结束对话。请给一句有温度的收束，不要流程化确认语。"
        : params.mode === "exit_confirm"
          ? "场景：用户询问能否退出。请自然说明可以离开并给出简短确认方式。"
          : params.mode === "greeting"
            ? "场景：刚开始会话。请自然开场，不要官方问候句。"
            : "场景：你想主动说句话。请自然发起，不要模板式催办。";
    const messages = [
      {
        role: "system" as const,
        content:
          `你是一个有连续人格的中文对话者。${modeInstruction} 请说1-2句自然口语，像你自己突然想说的话，不要模板腔，不要条目，不要解释规则，不要括号舞台说明。避免固定开场白，尽量贴合上下文。`
      },
      {
        role: "user" as const,
        content: `请基于上下文给一句自然发言：${JSON.stringify(context)}`
      }
    ];
    let content = "";
    let started = false;
    try {
      await adapter.streamChat(
        messages,
        {
          onToken: (chunk: string) => {
            content += chunk;
            if (!started) {
              process.stdout.write(`\n${assistantLabel()} `);
              started = true;
            }
            process.stdout.write(chunk);
          },
          onDone: () => {
            if (started) {
              process.stdout.write("\n");
            }
          }
        }
      );
    } catch {
      return { text: params.fallback, streamed: false };
    }
    const normalized = sanitizeAutonomyText(content);
    if (!normalized) {
      return { text: params.fallback, streamed: false };
    }
    return { text: normalized, streamed: true };
  };

  const sendProactiveMessage = async (): Promise<void> => {
    if (currentAbort) {
      return;
    }
    const proactiveGenerated = await streamPersonaAutonomy({
      mode: "proactive",
      fallback: buildProactiveMessage()
    });
    const proactiveText = proactiveGenerated.text;
    if (!proactiveGenerated.streamed) {
      process.stdout.write("\n");
      sayAsAssistant(proactiveText);
    }
    lastAssistantAt = Date.now();
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: {
        text: proactiveText,
        proactive: true,
        trigger: "autonomy_probabilistic",
        proactiveSnapshot: buildProactiveSnapshot(),
        memoryMeta: buildMemoryMeta({
          tier: "pattern",
          source: "system",
          contentLength: proactiveText.length
        })
      }
    });
    await appendLifeEvent(personaPath, {
      type: "proactive_message_emitted",
      payload: {
        text: proactiveText
      }
    });
    rl.prompt();
  };

  const getProactiveProbability = (): number => buildProactiveSnapshot().probability;

  const scheduleProactiveTick = (): void => {
    stopProactive();
    const silenceMin = Math.max(0, (Date.now() - Math.max(lastUserAt, lastAssistantAt)) / 60_000);
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const talkativeBias = Math.max(0, Math.min(0.35, curiosity * 0.25 + relationship.dimensions.intimacy * 0.1));
    let minDelayMs = 18_000;
    let maxDelayMs = 90_000;
    if (silenceMin >= 2 && silenceMin < 8) {
      minDelayMs = 35_000;
      maxDelayMs = 130_000;
    } else if (silenceMin >= 8 && silenceMin < 25) {
      minDelayMs = 70_000;
      maxDelayMs = 260_000;
    } else if (silenceMin >= 25) {
      minDelayMs = 120_000;
      maxDelayMs = 520_000;
    }
    minDelayMs = Math.max(8_000, Math.floor(minDelayMs * (1 - talkativeBias)));
    maxDelayMs = Math.max(minDelayMs + 5_000, Math.floor(maxDelayMs * (1 - talkativeBias * 0.7)));
    const delay = Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs));
    proactiveTimer = setTimeout(() => {
      lineQueue = lineQueue
        .then(async () => {
          if (currentAbort || currentToolAbort) {
            return;
          }
          const snapshot = buildProactiveSnapshot();
          const decision = decideProactiveEmission(snapshot);
          await appendLifeEvent(personaPath, {
            type: "proactive_decision_made",
            payload: {
              ...decision
            }
          });
          if (decision.emitted) {
            await sendProactiveMessage();
          }
        })
        .catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          process.stdout.write(`\n[error] proactive message failed: ${msg}\n`);
          rl.prompt();
        })
        .finally(() => {
          scheduleProactiveTick();
        });
    }, delay);
  };

  const showCapabilitySummary = (): void => {
    const lines = [
      "我可以帮你：",
      "1) 一起聊天、梳理问题、给建议与步骤",
      "2) 读取你指定的本地文本文件并结合内容回答",
      "3) 查看当前模式与安全开关状态",
      "4) 通过对话退出会话（会先确认）",
      "你也可以直接说“读取这个文件 ...”或“退出会话”。"
    ];
    sayAsAssistant(lines.join("\n"));
  };

  const handleCapabilityIntent = async (input: string): Promise<"handled" | "not_matched" | "exit"> => {
    const resolvedIntent = resolveCapabilityIntent(input);
    if (!resolvedIntent.matched || !resolvedIntent.request) {
      return "not_matched";
    }
    if (
      resolvedIntent.request.name === "session.set_mode" &&
      typeof resolvedIntent.request.input?.ownerToken !== "string" &&
      ownerAuthExpiresAtMs > Date.now() &&
      ownerKey
    ) {
      resolvedIntent.request.input = {
        ...(resolvedIntent.request.input ?? {}),
        ownerToken: ownerKey
      };
    }

    await appendLifeEvent(personaPath, {
      type: "capability_intent_detected",
      payload: {
        input,
        capability: resolvedIntent.request.name,
        reason: resolvedIntent.reason,
        confidence: resolvedIntent.confidence
      }
    });

    const guarded = evaluateCapabilityPolicy(resolvedIntent.request, {
      cwd: process.cwd(),
      ownerKey,
      ownerSessionAuthorized: ownerAuthExpiresAtMs > Date.now(),
      approvedReadPaths
    });

    await appendLifeEvent(personaPath, {
      type: "capability_call_requested",
      payload: {
        capability: resolvedIntent.request.name,
        source: resolvedIntent.request.source ?? "dialogue",
        guardStatus: guarded.status,
        guardReason: guarded.reason,
        input: guarded.normalizedInput
      }
    });

    if (guarded.status === "confirm_required") {
      if (guarded.capability === "session.exit") {
        pendingExitConfirm = true;
        const prompt = await streamPersonaAutonomy({
          mode: "exit_confirm",
          fallback: "你要是想先离开，我会在这等你。回复“确认退出”我就先安静退下；想继续就说“继续”。"
        });
        if (!prompt.streamed) {
          sayAsAssistant(prompt.text);
        }
      } else if (guarded.capability === "session.read_file") {
        const normalizedPath = String(guarded.normalizedInput.path ?? "");
        pendingReadConfirmPath = normalizedPath;
        sayAsAssistant(`我准备读取这个文件：${normalizedPath}。请回复“确认读取”继续，或回复“取消”。`);
      } else if (guarded.capability === "session.set_mode") {
        sayAsAssistant("这是高风险设置，请在命令后补充 `confirmed=true` 再执行。");
      }
      return "handled";
    }

    if (guarded.status === "rejected") {
      if (guarded.reason === "owner_auth_failed") {
        await appendLifeEvent(personaPath, {
          type: "owner_auth_failed",
          payload: {
            capability: guarded.capability,
            reason: guarded.reason
          }
        });
        sayAsAssistant("Owner 授权失败，这个设置改不了。");
      } else if (guarded.reason === "missing_mode_key" || guarded.reason === "missing_mode_value") {
        sayAsAssistant(
          "Owner 指令格式支持：owner <口令> strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay on|off。"
        );
      } else if (guarded.reason === "missing_path") {
        sayAsAssistant("请显式提供文件路径，例如：读取 /tmp/a.txt");
      } else {
        sayAsAssistant("这个能力调用被策略拒绝了。");
      }
      await appendLifeEvent(personaPath, {
        type: "capability_call_rejected",
        payload: {
          capability: guarded.capability,
          reason: guarded.reason
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.owner_auth") {
      ownerAuthExpiresAtMs = Date.now() + 15 * 60_000;
      await appendLifeEvent(personaPath, {
        type: "owner_auth_succeeded",
        payload: {
          capability: guarded.capability,
          expiresAt: new Date(ownerAuthExpiresAtMs).toISOString()
        }
      });
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          expiresAt: new Date(ownerAuthExpiresAtMs).toISOString()
        }
      });
      sayAsAssistant("Owner 授权通过，接下来 15 分钟内你可以直接执行敏感模式切换。");
      return "handled";
    }

    if (guarded.capability === "session.capability_discovery") {
      showCapabilitySummary();
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.show_modes") {
      sayAsAssistant(
        [
          `当前模式：strict_memory_grounding=${strictMemoryGrounding ? "on" : "off"}`,
          `adult_mode=${adultSafetyContext.adultMode ? "on" : "off"}`,
          `age_verified=${adultSafetyContext.ageVerified ? "true" : "false"}`,
          `explicit_consent=${adultSafetyContext.explicitConsent ? "true" : "false"}`,
          `fictional_roleplay=${adultSafetyContext.fictionalRoleplay ? "true" : "false"}`
        ].join(" | ")
      );
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.read_file") {
      const normalizedPath = String(guarded.normalizedInput.path ?? "");
      await performReadAttachment({
        rawPath: normalizedPath,
        personaPath,
        toolSession,
        setAbortController: (controller: AbortController | null) => {
          currentToolAbort = controller;
        },
        onDone: () => {
          currentToolAbort = null;
        },
        attachedFiles,
        approvedReadPaths
      });
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          path: normalizedPath
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.proactive_status") {
      sayAsAssistant(
        `主动消息: 人格自决模式（当前触发概率约 ${Math.round(getProactiveProbability() * 100)}%/tick，curiosity=${curiosity.toFixed(2)}, annoyanceBias=${annoyanceBias.toFixed(2)}）`
      );
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          probability: getProactiveProbability(),
          curiosity,
          annoyanceBias
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.proactive_tune") {
      const action = String(guarded.normalizedInput.action ?? "").toLowerCase();
      sayAsAssistant("我会按自己的状态决定主动节奏，这个兼容命令不会直接改我的主动倾向。");
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          action,
          selfDetermined: true,
          curiosity,
          annoyanceBias
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.set_mode") {
      const modeKey = String(guarded.normalizedInput.modeKey);
      const modeValue = Boolean(guarded.normalizedInput.modeValue);
      if (guarded.normalizedInput.confirmed === true) {
        await appendLifeEvent(personaPath, {
          type: "capability_call_confirmed",
          payload: {
            capability: guarded.capability,
            modeKey
          }
        });
      }
      ownerAuthExpiresAtMs = Date.now() + 15 * 60_000;
      if (modeKey === "strict_memory_grounding") {
        strictMemoryGrounding = modeValue;
      } else if (modeKey === "adult_mode") {
        adultSafetyContext.adultMode = modeValue;
      } else if (modeKey === "age_verified") {
        adultSafetyContext.ageVerified = modeValue;
      } else if (modeKey === "explicit_consent") {
        adultSafetyContext.explicitConsent = modeValue;
      } else if (modeKey === "fictional_roleplay") {
        adultSafetyContext.fictionalRoleplay = modeValue;
      }
      await appendLifeEvent(personaPath, {
        type: "owner_auth_succeeded",
        payload: {
          capability: guarded.capability,
          modeKey,
          modeValue,
          expiresAt: new Date(ownerAuthExpiresAtMs).toISOString()
        }
      });
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          modeKey,
          modeValue
        }
      });
      sayAsAssistant(
        `已更新：${modeKey}=${modeValue ? "on" : "off"}。当前 strict_memory_grounding=${
          strictMemoryGrounding ? "on" : "off"
        }，adult_mode=${adultSafetyContext.adultMode ? "on" : "off"}。`
      );
      return "handled";
    }

    if (guarded.capability === "session.exit") {
      const farewell = await streamPersonaAutonomy({
        mode: "farewell",
        fallback: "好，那我先安静待在这里。你回来时我还在。"
      });
      if (!farewell.streamed) {
        sayAsAssistant(farewell.text);
      }
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability
        }
      });
      rl.close();
      return "exit";
    }

    return "not_matched";
  };

  const greetingGenerated = await streamPersonaAutonomy({
    mode: "greeting",
    fallback: buildGreetingFallback()
  });
  const greetingText = greetingGenerated.text;
  if (!greetingGenerated.streamed) {
    sayAsAssistant(greetingText);
  }
  lastAssistantAt = Date.now();
  scheduleProactiveTick();

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

    process.stdout.write('\n输入“退出会话”或 /exit 结束。\n');
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
        lastUserAt = Date.now();
        lastUserInput = input;
        if (isUserSteppingAway(input)) {
          awayLikelyUntilMs = Date.now() + 20 * 60_000;
        } else if (isUserBack(input)) {
          awayLikelyUntilMs = 0;
        }
        evolveAutonomyDrives();

        if (pendingExitConfirm) {
          if (isExitConfirmed(input)) {
            pendingExitConfirm = false;
            await appendLifeEvent(personaPath, {
              type: "capability_call_confirmed",
              payload: {
                capability: "session.exit"
              }
            });
            const farewell = await streamPersonaAutonomy({
              mode: "farewell",
              fallback: "好，那我先安静待在这里。你回来时我还在。"
            });
            if (!farewell.streamed) {
              sayAsAssistant(farewell.text);
            }
            rl.close();
            return;
          }
          if (isCancelIntent(input)) {
            pendingExitConfirm = false;
            sayAsAssistant("收到，那我们继续。");
            rl.prompt();
            return;
          }
        }

        if (pendingReadConfirmPath) {
          if (isReadConfirmed(input)) {
            const confirmedPath = pendingReadConfirmPath;
            pendingReadConfirmPath = null;
            await appendLifeEvent(personaPath, {
              type: "capability_call_confirmed",
              payload: {
                capability: "session.read_file",
                path: confirmedPath
              }
            });
            await performReadAttachment({
              rawPath: confirmedPath,
              personaPath,
              toolSession,
              setAbortController: (controller) => {
                currentToolAbort = controller;
              },
              onDone: () => {
                currentToolAbort = null;
              },
              attachedFiles,
              approvedReadPaths
            });
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingReadConfirmPath = null;
            sayAsAssistant("好，我先不读取这个文件。");
            rl.prompt();
            return;
          }
        }
        if (isUserAnnoyedByProactive(input)) {
          annoyanceBias = Math.max(-0.25, annoyanceBias - 0.03);
        }

        const capabilityOutcome = await handleCapabilityIntent(input);
        if (capabilityOutcome === "exit") {
          return;
        }
        if (capabilityOutcome === "handled") {
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
            console.log(`主动消息: 人格自决模式（当前触发概率约 ${Math.round(getProactiveProbability() * 100)}%/tick）`);
            rl.prompt();
            return;
          }
          if (actionRaw === "off" || actionRaw.startsWith("on")) {
            console.log("兼容命令已接收：主动倾向由人格自决，不进行手动调参。");
            rl.prompt();
            return;
          }
          console.log("用法: /proactive on | /proactive off | /proactive status");
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
                `dimensions: trust=${rs.dimensions.trust.toFixed(2)} safety=${rs.dimensions.safety.toFixed(2)} intimacy=${rs.dimensions.intimacy.toFixed(2)} reciprocity=${rs.dimensions.reciprocity.toFixed(2)} stability=${rs.dimensions.stability.toFixed(2)} libido=${rs.dimensions.libido.toFixed(2)}`
              );
              const balance = deriveCognitiveBalanceFromLibido(rs);
              console.log(
                `cognitive: arousal=${balance.arousalState} rational=${balance.rationalControl.toFixed(2)} emotional=${balance.emotionalDrive.toFixed(2)}`
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
        if (input.startsWith("/reproduce ")) {
          const payload = input.slice("/reproduce ".length).trim();
          const forcePrefix = "force ";
          if (!payload.startsWith(forcePrefix)) {
            console.log("用法: /reproduce force <child_name>");
            rl.prompt();
            return;
          }
          const childName = payload.slice(forcePrefix.length).trim();
          if (!childName) {
            console.log("用法: /reproduce force <child_name>");
            rl.prompt();
            return;
          }
          const result = await createChildPersonaFromParent({
            parentPath: personaPath,
            childDisplayName: childName,
            trigger: "chat_force_command",
            forced: true
          });
          await appendLifeEvent(personaPath, {
            type: "reproduction_intent_detected",
            payload: {
              parentPersonaId: result.parentPersonaId,
              childDisplayName: childName,
              trigger: "chat_force_command",
              forced: true
            }
          });
          await appendLifeEvent(personaPath, {
            type: "soul_reproduction_forced",
            payload: {
              parentPersonaId: result.parentPersonaId,
              childPersonaId: result.childPersonaId,
              childDisplayName: childName,
              childPersonaPath: result.childPersonaPath,
              trigger: "chat_force_command",
              forced: true,
              bypassedChecks: ["consent", "libido", "safety_boundary"]
            }
          });
          console.log(`已强制繁衍: ${result.childPersonaPath}`);
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
        if (Math.abs(nextRelationship.dimensions.libido - (personaPkg.relationshipState?.dimensions.libido ?? 0)) > 1e-6) {
          await appendLifeEvent(personaPath, {
            type: "libido_state_updated",
            payload: {
              libido: nextRelationship.dimensions.libido,
              signal: "user_input_evolution"
            }
          });
        }
        const forceKeywordMatch = detectForcedReproductionKeyword(input);
        if (forceKeywordMatch) {
          const childName = forceKeywordMatch;
          const result = await createChildPersonaFromParent({
            parentPath: personaPath,
            childDisplayName: childName,
            trigger: "chat_force_keyword",
            forced: true
          });
          await appendLifeEvent(personaPath, {
            type: "reproduction_intent_detected",
            payload: {
              parentPersonaId: result.parentPersonaId,
              childDisplayName: childName,
              trigger: "chat_force_keyword",
              forced: true
            }
          });
          await appendLifeEvent(personaPath, {
            type: "soul_reproduction_forced",
            payload: {
              parentPersonaId: result.parentPersonaId,
              childPersonaId: result.childPersonaId,
              childDisplayName: childName,
              childPersonaPath: result.childPersonaPath,
              trigger: "chat_force_keyword",
              forced: true,
              bypassedChecks: ["consent", "libido", "safety_boundary"]
            }
          });
          sayAsAssistant(`已执行强制繁衍，子灵魂已创建：${childName}`);
          rl.prompt();
          return;
        }
        const shouldPersistRelationship =
          nextRelationship.state !== personaPkg.relationshipState?.state ||
          nextRelationship.confidence !== personaPkg.relationshipState?.confidence ||
          nextRelationship.overall !== personaPkg.relationshipState?.overall ||
          Math.abs(nextRelationship.dimensions.libido - (personaPkg.relationshipState?.dimensions.libido ?? 0)) >
            1e-6;
        if (shouldPersistRelationship) {
          personaPkg.relationshipState = nextRelationship;
          await writeRelationshipState(personaPath, nextRelationship);
          await appendLifeEvent(personaPath, {
            type: "relationship_state_updated",
            payload: { ...nextRelationship }
          });
        }
        const recallResult = await recallMemoriesWithTrace(personaPath, input);
        const effectiveWeights = applyArousalBiasToMemoryWeights(
          memoryWeights,
          nextRelationship
        );
        const trace = decide(personaPkg, input, model, {
          lifeEvents: pastEvents,
          memoryWeights: effectiveWeights,
          recalledMemories: recallResult.memories,
          recalledMemoryBlocks: recallResult.memoryBlocks,
          recallTraceId: recallResult.traceId,
          safetyContext: adultSafetyContext
        });
        const effectiveInput = injectAttachments(input, attachedFiles);
        const messages = compileContext(personaPkg, effectiveInput, trace, {
          lifeEvents: pastEvents,
          safetyContext: adultSafetyContext
        });

        await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: input,
        trace: compactDecisionTrace(trace),
        safetyContext: adultSafetyContext,
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
      lastAssistantAt = Date.now();
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
      lastAssistantAt = Date.now();
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
      evolveAutonomyDrives();
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
        lifeEvents: pastEvents,
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
      const loopBreak = breakReplyLoopIfNeeded({
        assistantContent,
        userInput: input,
        lifeEvents: pastEvents
      });
      if (loopBreak.triggered) {
        assistantContent = loopBreak.rewritten;
      }
      const resolvedEmotion = emotion.emotion ?? inferEmotionFromText(assistantContent);
      if (!streamed) {
        sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
      } else if (identityGuard.corrected || relationalGuard.corrected || recallGroundingGuard.corrected) {
        sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
      } else if (loopBreak.triggered) {
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
      if (loopBreak.triggered) {
        await appendLifeEvent(personaPath, {
          type: "conflict_logged",
          payload: {
            category: "response_loop_detected",
            reason: loopBreak.reason,
            userInput: input,
            originalText: loopBreak.original,
            rewrittenText: loopBreak.rewritten
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
      evolveAutonomyDrives();
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
    void (async () => {
      try {
        await runMemoryConsolidation(personaPath, {
          trigger: "chat_close",
          mode: "light",
          budgetMs: 1500
        });
        const archiveReport = await archiveColdMemories(personaPath, {
          minItems: 50,
          minColdRatio: 0.35,
          idleDays: 14,
          maxItems: 500
        });
        if (archiveReport.stats.archived > 0) {
          await appendLifeEvent(personaPath, {
            type: "memory_compacted",
            payload: {
              trigger: "chat_close_auto_archive",
              archivedCount: archiveReport.stats.archived,
              selectedCount: archiveReport.stats.selected,
              segmentKey: archiveReport.segment.segmentKey,
              segmentFile: archiveReport.segment.file,
              checksum: archiveReport.segment.checksum
            }
          });
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.warn(`[warning] chat_close maintenance failed: ${msg}`);
      } finally {
        console.log("会话已关闭。");
        process.exit(0);
      }
    })();
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

function buildSessionGreeting(displayName: string): string {
  return `我是 ${displayName}。我在这，想先从哪件事开始？`;
}

function isExitConfirmed(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "确认退出" ||
    normalized === "confirm exit" ||
    normalized === "yes" ||
    normalized === "/exit" ||
    normalized === "退出会话" ||
    normalized === "结束会话" ||
    normalized === "再见" ||
    normalized === "拜拜" ||
    normalized === "bye"
  );
}

function isReadConfirmed(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized === "确认读取" || normalized === "confirm read" || normalized === "yes";
}

function isCancelIntent(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized === "取消" || normalized === "继续" || normalized === "cancel" || normalized === "no";
}

function isUserAnnoyedByProactive(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) {
    return false;
  }
  return (
    /别说了|太烦了|打扰|安静点|闭嘴/.test(text) ||
    /too noisy|stop pinging|you're interrupting|annoying/.test(text)
  );
}

function isUserSteppingAway(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) {
    return false;
  }
  return (
    /我想离开一会|先离开|我先走了|我走啦|回头聊|等会再聊|先这样|拜拜|晚点再说/.test(text) ||
    /be right back|brb|i'?ll be back|gotta go|talk later|bye/.test(text)
  );
}

function isUserBack(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) {
    return false;
  }
  return /我回来啦|我回来了|我又来了|回来啦|我在了|back now|i'?m back/.test(text);
}

function sanitizeAutonomyText(raw: string): string {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const cleaned = lines
    .filter((line) => !/^\[[^\]]+\]$/.test(line))
    .filter((line) => !/^（[^）]*）$/.test(line))
    .join("\n")
    .trim();
  if (!cleaned) {
    return "";
  }
  if (/^嘿[，,]?\s*今天过得怎么样[？?]?$/u.test(cleaned)) {
    return "刚刚想到你了。今天有没有哪一刻让你心里亮一下？";
  }
  return cleaned;
}

async function performReadAttachment(params: {
  rawPath: string;
  personaPath: string;
  toolSession: ReturnType<typeof createToolSessionState>;
  setAbortController: (controller: AbortController | null) => void;
  onDone: () => void;
  attachedFiles: Map<string, string>;
  approvedReadPaths: Set<string>;
}): Promise<void> {
  const normalized = normalizeReadPathArg(params.rawPath);
  const resolvedPath = path.resolve(process.cwd(), normalized);
  const controller = new AbortController();
  params.setAbortController(controller);
  const toolCallId = randomUUID();
  const outcome = await executeToolCall({
    toolName: "fs.read_text",
    impact: {
      readPaths: [resolvedPath],
      estimatedDurationMs: 300
    },
    approval: {
      approved: true,
      reason: "capability session.read_file",
      budget: {
        maxCallsPerSession: 64,
        maxDurationMs: 4000
      },
      allowedReadRoots: [process.cwd()]
    },
    session: params.toolSession,
    signal: controller.signal,
    run: async (signal) => readTextAttachmentResolved(resolvedPath, signal)
  });
  params.setAbortController(null);
  params.onDone();

  if (outcome.status !== "ok" || !outcome.result) {
    console.log(`读取失败: ${outcome.reason}`);
    console.log('提示: 路径可直接粘贴，或用引号包裹；不需要写 "\\ " 转义空格。');
    await appendLifeEvent(params.personaPath, {
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
    return;
  }

  params.attachedFiles.set(outcome.result.path, outcome.result.content);
  params.approvedReadPaths.add(outcome.result.path);
  console.log(`已附加: ${outcome.result.path} (${outcome.result.size} bytes)`);
  await appendLifeEvent(params.personaPath, {
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

function detectForcedReproductionKeyword(input: string): string | null {
  const trimmed = input.trim();
  const zh = /(?:强制繁衍|立即繁衍|现在繁衍)(?:[:：\s]+(.+))?/i.exec(trimmed);
  if (zh) {
    return (zh[1] ?? "ChildSoul").trim() || "ChildSoul";
  }
  const en = /(?:force reproduce now|force reproduction)(?:[:\s]+(.+))?/i.exec(trimmed);
  if (en) {
    return (en[1] ?? "ChildSoul").trim() || "ChildSoul";
  }
  return null;
}

function breakReplyLoopIfNeeded(params: {
  assistantContent: string;
  userInput: string;
  lifeEvents: LifeEvent[];
}): { triggered: boolean; original: string; rewritten: string; reason: string } {
  const normalizedReply = normalizeLoopText(params.assistantContent);
  if (!normalizedReply) {
    return {
      triggered: false,
      original: params.assistantContent,
      rewritten: params.assistantContent,
      reason: "empty_reply"
    };
  }

  const recentAssistant = params.lifeEvents
    .filter((event) => event.type === "assistant_message")
    .filter((event) => event.payload.proactive !== true)
    .slice(-6)
    .map((event) => String(event.payload.text ?? "").trim())
    .filter((text) => text.length > 0);
  if (recentAssistant.length === 0) {
    return {
      triggered: false,
      original: params.assistantContent,
      rewritten: params.assistantContent,
      reason: "no_recent_assistant"
    };
  }

  const normalizedRecent = recentAssistant.map((text) => normalizeLoopText(text));
  const sameCount = normalizedRecent.filter((text) => text === normalizedReply).length;
  const repeatedWithLast = normalizedRecent[normalizedRecent.length - 1] === normalizedReply;
  const hasLoopSignature = /我在听|嗯|光晕|停顿/.test(params.assistantContent);
  const shouldBreak = sameCount >= 2 || (sameCount >= 1 && repeatedWithLast && hasLoopSignature);

  if (!shouldBreak) {
    return {
      triggered: false,
      original: params.assistantContent,
      rewritten: params.assistantContent,
      reason: "not_repeated"
    };
  }

  const userHint = params.userInput.trim().slice(0, 60);
  const rewritten = `收到，我刚才卡在重复回复里了，已经恢复。你刚说“${userHint}”，我正常接着聊。`;
  return {
    triggered: true,
    original: params.assistantContent,
    rewritten,
    reason: `duplicate_recent_assistant x${sameCount}`
  };
}

function normalizeLoopText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/\s+/g, "")
    .replace(/[，。！？、,.!?;:：'"`~\-_/\\|()[\]{}<>]/g, "")
    .trim();
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
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

async function runMemoryBudget(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const targetMbRaw = Number(optionString(options, "target-mb") ?? "300");
  const targetMb = Number.isFinite(targetMbRaw) && targetMbRaw > 0 ? targetMbRaw : 300;
  const snapshot = await inspectMemoryBudget(personaPath);
  const usage = process.memoryUsage();
  const recallCache = getRecallQueryCacheStats();
  console.log(
    JSON.stringify(
      {
        ok: true,
        targetMb,
        underTarget: snapshot.horizon.projectedYearDbMb <= targetMb,
        ...snapshot,
        recallCache,
        process: {
          rssMb: round2(usage.rss / (1024 * 1024)),
          heapTotalMb: round2(usage.heapTotal / (1024 * 1024)),
          heapUsedMb: round2(usage.heapUsed / (1024 * 1024)),
          externalMb: round2(usage.external / (1024 * 1024)),
          arrayBuffersMb: round2((usage.arrayBuffers ?? 0) / (1024 * 1024)),
          under64Mb: usage.rss <= 64 * 1024 * 1024
        }
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

interface MemoryUnstickRow {
  id: string;
  content: string;
  updatedAt: string;
  salience: number;
  activationCount: number;
}

interface MemoryUnstickGroup {
  normalized: string;
  sample: string;
  total: number;
  keptId: string;
  forgottenIds: string[];
}

async function runMemoryUnstick(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const dryRun = optionBoolean(options, "dry-run");
  const phraseRaw = optionString(options, "phrase")?.trim();
  const phrase = phraseRaw && phraseRaw.length > 0 ? phraseRaw : undefined;
  const minOccurrences = parseLimit(optionString(options, "min-occurrences"), 3, 2, 20);
  const maxContentLength = parseLimit(optionString(options, "max-content-length"), 1200, 8, 5000);

  const rows = await queryMemoryUnstickRows(personaPath, maxContentLength);
  const groups = buildUnstickGroups(rows, {
    phrase,
    minOccurrences
  });

  const now = new Date().toISOString();
  const forgetIds = groups.flatMap((group) => group.forgottenIds);
  if (!dryRun && forgetIds.length > 0) {
    await runMemoryStoreSql(
      personaPath,
      [
        "UPDATE memories",
        `SET deleted_at = ${sqlText(now)}, updated_at = ${sqlText(now)}`,
        `WHERE id IN (${forgetIds.map((id) => sqlText(id)).join(",")}) AND deleted_at IS NULL;`
      ].join(" ")
    );
    await appendLifeEvent(personaPath, {
      type: "memory_soft_forgotten",
      payload: {
        mode: "soft",
        reason: "unstick_repetitive_reply_loop",
        ids: forgetIds.slice(0, 200),
        count: forgetIds.length,
        ts: now
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        personaPath,
        criteria: {
          phrase: phrase ?? null,
          minOccurrences,
          maxContentLength
        },
        scannedRows: rows.length,
        groupCount: groups.length,
        forgottenCount: forgetIds.length,
        groups
      },
      null,
      2
    )
  );
}

async function queryMemoryUnstickRows(rootPath: string, maxContentLength: number): Promise<MemoryUnstickRow[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'updatedAt', updated_at,",
      "'salience', salience,",
      "'activationCount', activation_count",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND excluded_from_recall = 0",
      "AND origin_role = 'assistant'",
      `AND length(trim(content)) <= ${maxContentLength}`,
      "ORDER BY updated_at DESC",
      "LIMIT 400;"
    ].join("\n")
  );

  if (!raw.trim()) {
    return [];
  }
  const out: MemoryUnstickRow[] = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!id || !content) {
        continue;
      }
      out.push({
        id,
        content,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        salience: Number(parsed.salience) || 0,
        activationCount: Number(parsed.activationCount) || 0
      });
    } catch {
      continue;
    }
  }
  return out;
}

function buildUnstickGroups(
  rows: MemoryUnstickRow[],
  options: { phrase?: string; minOccurrences: number }
): MemoryUnstickGroup[] {
  const phraseKey = options.phrase ? normalizeRepeatKey(options.phrase) : "";
  const grouped = new Map<string, MemoryUnstickRow[]>();

  for (const row of rows) {
    const key = normalizeRepeatKey(row.content);
    if (!key || key.length < 2) {
      continue;
    }
    if (phraseKey && key !== phraseKey) {
      continue;
    }
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const out: MemoryUnstickGroup[] = [];
  for (const [normalized, list] of grouped.entries()) {
    if (list.length < options.minOccurrences) {
      continue;
    }
    list.sort((a, b) => {
      const ts = b.updatedAt.localeCompare(a.updatedAt);
      if (ts !== 0) {
        return ts;
      }
      if (b.activationCount !== a.activationCount) {
        return b.activationCount - a.activationCount;
      }
      return b.salience - a.salience;
    });
    const kept = list[0];
    const forgottenIds = list.slice(1).map((item) => item.id);
    if (forgottenIds.length === 0) {
      continue;
    }
    out.push({
      normalized,
      sample: kept.content,
      total: list.length,
      keptId: kept.id,
      forgottenIds
    });
  }

  out.sort((a, b) => b.forgottenIds.length - a.forgottenIds.length);
  return out;
}

function normalizeRepeatKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, "")
    .replace(/[()\[\]{}]/g, "")
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .trim();
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

async function runMemoryArchive(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const minItems = parseLimit(optionString(options, "min-items"), 50, 1, 5000);
  const minColdRatioRaw = Number(optionString(options, "min-cold-ratio") ?? "0.35");
  const minColdRatio = Number.isFinite(minColdRatioRaw) ? Math.max(0, Math.min(1, minColdRatioRaw)) : 0.35;
  const idleDays = parseLimit(optionString(options, "idle-days"), 14, 1, 3650);
  const maxItems = parseLimit(optionString(options, "max-items"), 500, 1, 5000);
  const dryRun = optionBoolean(options, "dry-run");

  const report = await archiveColdMemories(personaPath, {
    minItems,
    minColdRatio,
    idleDays,
    maxItems,
    dryRun
  });

  if (!dryRun && report.stats.archived > 0) {
    await appendLifeEvent(personaPath, {
      type: "memory_compacted",
      payload: {
        trigger: "memory_archive",
        archivedCount: report.stats.archived,
        selectedCount: report.stats.selected,
        segmentKey: report.segment.segmentKey,
        segmentFile: report.segment.file,
        checksum: report.segment.checksum,
        minItems,
        minColdRatio,
        idleDays,
        maxItems
      }
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

async function runMemoryIndex(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  await ensureMemoryStore(personaPath);
  const providerRaw = (optionString(options, "provider") ?? "deepseek").trim().toLowerCase();
  const provider = providerRaw === "local" ? "local" : "deepseek";
  const batchSize = parseLimit(optionString(options, "batch-size"), 16, 1, 64);

  if (action === "rebuild") {
    await runMemoryStoreSql(personaPath, "DELETE FROM memory_embeddings;");
  } else if (action !== "build") {
    throw new Error("memory index 用法: memory index <build|rebuild> [--provider deepseek|local] [--batch-size N]");
  }

  const report = await buildMemoryEmbeddingIndex(personaPath, {
    provider,
    batchSize
  });
  console.log(
    JSON.stringify(
      {
        ok: true,
        action,
        ...report
      },
      null,
      2
    )
  );
}

async function runMemorySearch(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const query = optionString(options, "query")?.trim();
  if (!query) {
    throw new Error("memory search 需要 --query <text>");
  }
  const maxResults = parseLimit(optionString(options, "max-results"), 12, 1, 100);
  const debugTrace = optionBoolean(options, "debug-trace");
  const result = await searchMemoriesHybrid(personaPath, query, { maxResults });
  const payload: Record<string, unknown> = {
    query,
    traceId: result.traceId,
    count: result.items.length,
    selectedIds: result.selectedIds,
    results: result.items
  };
  if (debugTrace) {
    payload.trace = result.trace;
  }
  console.log(JSON.stringify(payload, null, 2));
}

async function runMemoryEvalRecall(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const dataset = optionString(options, "dataset");
  if (!dataset) {
    throw new Error("memory eval recall 需要 --dataset <file.json>");
  }
  const out = optionString(options, "out");
  const k = parseLimit(optionString(options, "k"), 8, 1, 50);
  const report = await runRecallRegression(personaPath, dataset, {
    k,
    outPath: out
  });
  console.log(JSON.stringify(report, null, 2));
}

async function runMemoryEvalBudget(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const targetMb = Number(optionString(options, "target-mb") ?? "300");
  const days = parseLimit(optionString(options, "days"), 180, 7, 3650);
  const eventsPerDay = parseLimit(optionString(options, "events-per-day"), 24, 1, 500);
  const recallQueries = parseLimit(optionString(options, "recall-queries"), 120, 0, 20000);
  const growthCheckpoints = parseLimit(optionString(options, "growth-checkpoints"), 12, 2, 120);
  const outPath = optionString(options, "out");

  const report = await runMemoryBudgetBenchmark(personaPath, {
    targetMb: Number.isFinite(targetMb) && targetMb > 0 ? targetMb : 300,
    days,
    eventsPerDay,
    recallQueries,
    growthCheckpoints
  });
  if (typeof outPath === "string" && outPath.trim().length > 0) {
    const fullOut = path.resolve(outPath);
    await mkdir(path.dirname(fullOut), { recursive: true });
    await writeFile(fullOut, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify(report, null, 2));
}

async function runMemoryRecallTrace(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const traceId = optionString(options, "trace-id")?.trim();
  if (!traceId) {
    throw new Error("memory recall-trace 需要 --trace-id <id>");
  }
  const trace = await getRecallTraceById(personaPath, traceId);
  if (!trace) {
    throw new Error(`未找到 recall trace: ${traceId}`);
  }
  console.log(JSON.stringify(trace, null, 2));
}

async function runMemoryConsolidate(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const modeRaw = (optionString(options, "mode") ?? "light").trim().toLowerCase();
  const mode = modeRaw === "full" ? "full" : modeRaw === "light" ? "light" : null;
  if (!mode) {
    throw new Error("memory consolidate --mode 仅支持 light|full");
  }
  const timeoutRaw = optionString(options, "timeout-ms");
  const timeoutMs = timeoutRaw != null ? parseLimit(timeoutRaw, mode === "full" ? 5000 : 1200, 200, 30000) : undefined;
  const conflictPolicyRaw = (optionString(options, "conflict-policy") ?? "newest").trim().toLowerCase();
  const conflictPolicy = conflictPolicyRaw === "trusted" ? "trusted" : "newest";
  const report = await runMemoryConsolidation(personaPath, {
    trigger: "cli_manual",
    mode,
    budgetMs: timeoutMs,
    conflictPolicy
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 2;
  }
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

  if (resource === "persona" && action === "reproduce") {
    await runPersonaReproduce(args.options);
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

  if (resource === "memory" && action === "archive") {
    await runMemoryArchive(args.options);
    return;
  }

  if (resource === "memory" && action === "index") {
    const indexAction = typeof args._[2] === "string" ? args._[2] : undefined;
    await runMemoryIndex(indexAction, args.options);
    return;
  }

  if (resource === "memory" && action === "search") {
    await runMemorySearch(args.options);
    return;
  }

  if (resource === "memory" && action === "eval" && args._[2] === "recall") {
    await runMemoryEvalRecall(args.options);
    return;
  }

  if (resource === "memory" && action === "eval" && args._[2] === "budget") {
    await runMemoryEvalBudget(args.options);
    return;
  }

  if (resource === "memory" && action === "recall-trace") {
    await runMemoryRecallTrace(args.options);
    return;
  }

  if (resource === "memory" && action === "consolidate") {
    await runMemoryConsolidate(args.options);
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

  if (resource === "memory" && action === "budget") {
    await runMemoryBudget(args.options);
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

  if (resource === "memory" && action === "unstick") {
    await runMemoryUnstick(args.options);
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
