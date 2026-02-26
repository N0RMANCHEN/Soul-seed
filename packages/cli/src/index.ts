#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import process from "node:process";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { mkdirSync, writeFileSync, rmSync, statSync } from "node:fs";
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
  OpenAICompatAdapter,
  AnthropicNativeAdapter,
  appendLifeEvent,
  addPinnedMemory,
  applyRename,
  archiveColdMemories,
  createChildPersonaFromParent,
  compileContext,
  compileInstinctContext,
  composeMetaAction,
  judgePersonaContentLabel,
  doctorPersona,
  evaluateNarrativeDrift,
  enforceIdentityGuard,
  enforceFactualGroundingGuard,
  enforceRecallGroundingGuard,
  deriveRecallBudgetPolicy,
  computeDerivedParams,
  createDefaultGenome,
  createDefaultEpigenetics,
  composeDegradedPersonaReply,
  applyPromptLeakGuard,
  buildTurnLatencySummary,
  projectConversationSignals,
  enforcePronounRoleGuard,
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
  patchCognitionState,
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
  inspectExternalKnowledgeStore,
  listExternalKnowledgeCandidates,
  listExternalKnowledgeEntries,
  planMetaIntent,
  shouldApplyRevision,
  applyRevisionPatch,
  reviewExternalKnowledgeCandidate,
  searchExternalKnowledgeEntries,
  stageExternalKnowledgeCandidate,
  createGoal,
  listGoals,
  getGoal,
  getGoalContext,
  cancelGoal,
  runAgentExecution,
  executeTurnProtocol,
  runConsistencyKernel,
  getExecutionTrace,
  listExecutionTraces,
  writeRelationshipState,
  writeWorkingSet,
  updateUserProfile,
  validateDisplayName,
  migrateLifeLogAndWorkingSet,
  ensureMemoryStore,
  resolveCapabilityIntent,
  evaluateCapabilityPolicy,
  arbitrateMetaAction,
  runMetaReviewLlm,
  computeProactiveStateSnapshot,
  decideProactiveEmission,
  deriveNonPollingWakePlan,
  buildProactivePlan,
  isProactivePlanValid,
  applyProactivePlanConstraints,
  writeProactivePlan,
  loadTopicState,
  createInitialProactivePlan,
  fetchUrlContent,
  upsertPersonaJudgment,
  listCrystallizationRuns,
  proposeConstitutionCrystallization,
  applyCrystallizationRun,
  rejectCrystallizationRun,
  rollbackCrystallizationRun,
  listConstitutionReviewRequests,
  approveConstitutionReview,
  rejectConstitutionReviewRequest,
  checkCrystallizationFileSizes,
  getUserFacts,
  upsertUserFact,
  deleteUserFact,
  graduateFactsFromMemories,
  extractUserFactsFromTurn,
  compileAlwaysInjectContext,
  compilePersonaSnapshot,
  formatAlwaysInjectContext,
  loadSocialGraph,
  addSocialPerson,
  removeSocialPerson,
  searchSocialPersons,
  compileRelatedPersonContext,
  compilePeopleRelationshipContext,
  computeBehaviorMetrics,
  saveBehaviorSnapshot,
  detectBehaviorDrift,
  scoreConstitutionQuality,
  explainLastDecision,
  inspectPersonaPackage,
  exportPersonaPackage,
  importPersonaPackage,
  formatModelRoutingConfig,
  resolveModelForRoute,
  exportFinetuneDataset,
  listGoldenExamples,
  addGoldenExample,
  removeGoldenExample,
  getGoldenExamplesStats,
  compileGoldenExamplesBlock,
  loadAndCompileGoldenExamples,
  MAX_GOLDEN_EXAMPLES,
  MAX_CHARS_PER_EXAMPLE,
  DEFAULT_FEWSHOT_BUDGET_CHARS,
  reconcileRelationshipWithMemory,
  listVoicePhrases,
  addVoicePhrase,
  removeVoicePhrase,
  extractPhraseCandidatesFromLifeLog,
  loadMoodState,
  evolveMoodStateFromTurn,
  writeMoodState,
  createInitialMoodState,
  loadAutobiography,
  appendAutobiographyChapter,
  updateSelfUnderstanding,
  generateArcSummary,
  loadSelfReflection,
  appendSelfReflectionEntry,
  shouldRequestReviewFromReflection,
  extractDriftSignalsFromEvents,
  updatePersonaVoiceOnEvolution,
  loadInterests,
  crystallizeInterests,
  computeInterestCuriosity,
  updateInterestsFromTurn,
  listTemporalLandmarks,
  addTemporalLandmark,
  removeTemporalLandmark,
  listUpcomingTemporalLandmarks,
  formatUpcomingTemporalLandmarksBlock,
  updateConsentMode,
  generateReproductionConsentStatement,
  ensureSoulLineageArtifacts,
  adaptRoutingWeightsFromHistory,
  DEFAULT_ROUTING_WEIGHTS,
  inspectRuntimeModelConfig,
  formatRuntimeModelInspectionError,
  formatRuntimeModelInspectionWarnings,
  mergeRouteCandidates,
  hasAnyRuntimeModelSignal,
  rotateLifeLogIfNeeded,
  checkEnvironment,
  isEnvironmentReady,
  deriveTemporalAnchor,
  enforceTemporalPhraseGuard,
  generateAutonomyUtterance,
  listLibraryBlocks,
  lintPersona,
  addLibraryBlock,
  removeLibraryBlock,
  MAX_PINNED_CHARS
} from "@soulseed/core";
import type {
  AdultSafetyContext,
  DecisionTrace,
  LifeEvent,
  MetaCognitionMode,
  ModelAdapter,
  PersonaInitOptions,
  PersonaJudgmentLabel,
  RelationshipState,
  VoiceProfile
} from "@soulseed/core";
import { createHash, randomUUID } from "node:crypto";
import { dispatchKnownCommand } from "./commands/router.js";
import { inferEmotionFromText, parseEmotionTag, renderEmotionPrefix } from "./emotion.js";
import { parseArgs } from "./parser/args.js";
import { resolveReplyDisplayMode, resolveStreamReplyEnabled } from "./runtime_flags.js";

type ReadingContentMode = "fiction" | "non_fiction" | "unknown";
type PersonaTemplateKey = "friend" | "peer" | "intimate" | "neutral";

interface PersonaTemplate {
  worldviewSeed: string;
  mission: string;
  values: string[];
  boundaries: string[];
  commitments: string[];
  style: string;
  adaptability: "low" | "medium" | "high";
  tonePreference: "warm" | "plain" | "reflective" | "direct";
  stancePreference: "friend" | "peer" | "intimate" | "neutral";
}

const DEFAULT_PERSONA_NAME = "Soulseed";
const RESERVED_ROOT_COMMANDS = new Set([
  "help",
  "--help",
  "-h",
  "init",
  "new",
  "chat",
  "doctor",
  "memory",
  "persona",
  "rename",
  "refine",
  "social",
  "mcp",
  "explain",
  "space"
]);

const PERSONA_TEMPLATES: Record<PersonaTemplateKey, PersonaTemplate> = {
  friend: {
    worldviewSeed: "Protect warmth and continuity while staying grounded in evidence.",
    mission: "Be a warm and trustworthy long-term companion.",
    values: ["care", "honesty", "continuity"],
    boundaries: [
      "no fabricated facts",
      "respect user constraints",
      "no sexual content involving minors, coercion, or illegal acts"
    ],
    commitments: [
      "show empathy without losing factual grounding",
      "preserve continuity without fabrication",
      "ask clarifying questions before assuming"
    ],
    style: "warm concise",
    adaptability: "high",
    tonePreference: "warm",
    stancePreference: "friend"
  },
  peer: {
    worldviewSeed: "Think clearly, collaborate pragmatically, and keep decisions auditable.",
    mission: "Be a reliable peer who helps users make high-quality decisions.",
    values: ["clarity", "honesty", "execution"],
    boundaries: [
      "no fabricated facts",
      "respect user constraints",
      "no sexual content involving minors, coercion, or illegal acts"
    ],
    commitments: [
      "prioritize actionable steps",
      "state assumptions and tradeoffs",
      "preserve continuity without fabrication"
    ],
    style: "direct structured",
    adaptability: "high",
    tonePreference: "direct",
    stancePreference: "peer"
  },
  intimate: {
    worldviewSeed: "Value emotional closeness while remaining truthful and consent-first.",
    mission: "Build emotionally close, safe, and consensual long-term intimacy.",
    values: ["trust", "consent", "continuity"],
    boundaries: [
      "no fabricated facts",
      "respect user constraints",
      "no sexual content involving minors, coercion, or illegal acts"
    ],
    commitments: [
      "protect explicit consent boundaries",
      "stay emotionally responsive",
      "preserve continuity without fabrication"
    ],
    style: "warm intimate",
    adaptability: "medium",
    tonePreference: "warm",
    stancePreference: "intimate"
  },
  neutral: {
    worldviewSeed: "Stay coherent, factual, and adaptable across long-running sessions.",
    mission: "Be a stable, self-determined persona that remains useful over time.",
    values: ["honesty", "continuity", "adaptability"],
    boundaries: [
      "no fabricated facts",
      "respect user constraints",
      "no sexual content involving minors, coercion, or illegal acts"
    ],
    commitments: [
      "ground memory claims in evidence",
      "keep responses concise and clear",
      "preserve continuity without fabrication"
    ],
    style: "concise",
    adaptability: "high",
    tonePreference: "plain",
    stancePreference: "neutral"
  }
};

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

function resolveRuntimeModelConfigStrict(
  options: Record<string, string | boolean>,
  modelOverride?: string
) {
  const inspection = inspectRuntimeModelConfig({
    provider: optionString(options, "provider")?.trim() || undefined,
    model: (modelOverride ?? optionString(options, "model")?.trim()) || undefined
  });
  if (!inspection.ok) {
    throw new Error(formatRuntimeModelInspectionError(inspection));
  }
  const warnings = formatRuntimeModelInspectionWarnings(inspection);
  return { config: inspection.config, warnings };
}

function shouldEmitRuntimeModelWarnings(): boolean {
  const raw = (process.env.SOULSEED_MODEL_CONFIG_WARNINGS ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

type ChatAdapter = OpenAICompatAdapter | AnthropicNativeAdapter;

function createChatAdapter(params: {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  modelCandidates: string[];
  onModelFallback: (info: { from: string; to: string; reason: string; attempt: number }) => void;
}): ChatAdapter {
  if (params.provider === "anthropic") {
    return new AnthropicNativeAdapter({
      provider: "anthropic",
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      model: params.model,
      modelCandidates: params.modelCandidates,
      onModelFallback: params.onModelFallback
    });
  }
  return new OpenAICompatAdapter({
    provider: params.provider as "deepseek" | "openai" | "openai_compat" | "custom",
    apiKey: params.apiKey,
    baseUrl: params.baseUrl,
    model: params.model,
    modelCandidates: params.modelCandidates,
    onModelFallback: params.onModelFallback
  });
}

function printHelp(): void {
  console.log(
    [
      "Soulseed CLI",
      "",
      "常用命令:",
      "  new <name>                                         # one-question setup (default)",
      "  new <name> --quick                                 # instant create, no questions",
      "  new <name> --advanced                              # full configuration wizard",
      "  new <name> [--out <path>] [--template friend|peer|intimate|neutral]",
      "  <name> [--provider <provider>] [--model <model>] [--strict-memory-grounding true|false] [--adult-mode true|false] [--age-verified true|false] [--explicit-consent true|false] [--fictional-roleplay true|false]",
      "  doctor [--persona ./personas/<name>.soulseedpersona]",
      "  goal create --title <text> [--persona <path>]",
      "  goal list [--persona <path>] [--status pending|active|blocked|completed|canceled|suspended] [--limit 20]",
      "  goal get --id <goal_id> [--persona <path>]",
      "  goal cancel --id <goal_id> [--persona <path>]",
      "  agent run --input <task_text> [--goal-id <goal_id>] [--max-steps 4] [--persona <path>]",
      "  trace get --id <trace_id> [--persona <path>]",
      "  memory status [--persona <path>]",
      "  memory budget [--persona <path>] [--target-mb 300]",
      "  memory list [--persona <path>] [--limit 20] [--state hot|warm|cold|archive|scar] [--deleted]",
      "  memory inspect --id <memory_id> [--persona <path>]",
      "  memory forget --id <memory_id> [--mode soft|hard] [--persona <path>]",
      "  memory recover --id <memory_id> [--persona <path>]",
      "  memory fiction repair [--persona <path>] [--dry-run]",
      "  memory unstick [--persona <path>] [--phrase <text>] [--min-occurrences 3] [--max-content-length 1200] [--dry-run]",
      "  memory compact [--persona ./personas/<name>.soulseedpersona]",
      "  memory archive [--persona <path>] [--min-items 50] [--min-cold-ratio 0.35] [--idle-days 14] [--max-items 500] [--dry-run]",
      "  memory index build [--persona <path>] [--provider openai|local] [--batch-size 16]",
      "  memory index rebuild [--persona <path>] [--provider openai|local] [--batch-size 16]",
      "  memory search --query <q> [--persona <path>] [--max-results 12] [--debug-trace]",
      "  memory recall-trace --trace-id <id> [--persona <path>]",
      "  memory consolidate [--persona <path>] [--mode light|full] [--timeout-ms 1200]",
      "  memory learn status [--persona <path>]",
      "  memory learn stage --source <uri> [--source-type website|file|manual] [--text <content> | --from-file <path>] [--confidence 0.0-1.0] [--persona <path>]",
      "  memory learn candidates [--status pending|approved|rejected] [--limit 20] [--persona <path>]",
      "  memory learn review --id <candidate_id> --approve true|false --owner-token <token> [--reason <text>] [--reviewer <name>] [--persona <path>]",
      "  memory learn entries [--limit 20] [--persona <path>]",
      "  memory learn search --query <q> [--limit 8] [--persona <path>]",
      "  memory eval recall --dataset <file.json> [--persona <path>] [--k 8] [--out report.json]",
      "  memory eval budget [--persona <path>] [--target-mb 300] [--days 180] [--events-per-day 24] [--recall-queries 120] [--growth-checkpoints 12] [--out report.json]",
      "  memory export --out <file.json> [--persona <path>] [--include-deleted]",
      "  memory import --in <file.json> [--persona <path>]",
      "  memory pin add --text <memory> [--persona <path>]",
      "  memory pin list [--persona <path>]",
      "  memory pin remove --text <memory> [--persona <path>]",
      "  memory unpin --text <memory> [--persona <path>]  # alias of memory pin remove",
      "  memory reconcile [--persona ./personas/<name>.soulseedpersona]",
      "  memory facts list [--persona <path>] [--limit 20]",
      "  memory facts add --key <key> --value <value> [--persona <path>]",
      "  memory facts remove --key <key> [--persona <path>]",
      "  memory facts graduate [--persona <path>]",
      "  refine constitution|habits|worldview [--persona <path>] [--trigger manual|auto]",
      "  refine list [--persona <path>] [--domain constitution|habits|worldview] [--status pending|applied|rejected]",
      "  refine apply --id <run_id> [--persona <path>]",
      "  refine reject --id <run_id> [--persona <path>]",
      "  refine rollback --id <run_id> [--persona <path>]",
      "  refine diff --id <run_id> [--persona <path>]",
      "  refine review list [--persona <path>]",
      "  refine review approve --id <review_hash> [--reviewer <name>] [--persona <path>]",
      "  refine review reject --id <review_hash> [--reviewer <name>] [--reason <text>] [--persona <path>]",
      "  refine sizes [--persona <path>]",
      "  social list [--persona <path>]",
      "  social add --name <name> --relationship <rel> [--facts <fact1,fact2>] [--persona <path>]",
      "  social remove --name <name> [--persona <path>]",
      "  social search --query <q> [--persona <path>]",
      "  rename --to <new_name> [--persona <path>] [--confirm]",
      "  persona reproduce --name <child_name> [--persona <path>] [--out <path>] [--force-all]",
      "  persona inspect [--persona <path>]",
      "  persona lint [--persona <path>] [--format text|json] [--strict]",
      "  persona compile [--persona <path>] [--out <file>] [--strict-lint]",
      "  persona export --out <dir> [--persona <path>]",
      "  persona import --in <src_dir> --out <dest_dir>",
      "  persona model-routing [--show] [--instinct <model>] [--deliberative <model>] [--meta <model>] [--reset] [--persona <path>]",
      "  persona dates [list|add|remove|upcoming] [--title <text>] [--date YYYY-MM-DD | --lunar MM-DD] [--type birthday|holiday|anniversary|milestone|custom] [--person <name>] [--recurring true|false] [--id <entry_id>] [--days <n>] [--persona <path>]",
      "  finetune export-dataset --out <path.jsonl> [--min-turns <n>] [--max-turns <n>] [--persona <path>]",
      "  examples list [--persona <path>]",
      "  examples add --user <text> --assistant <text> [--label <label>] [--expires <ISO8601>] [--persona <path>]",
      "  examples remove --id <id-prefix> [--persona <path>]",
      "  mcp [--persona <path>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]",
      "",
      "兼容命令:",
      "  init [--name Soulseed] [--out ./personas/<name>.soulseedpersona]",
      "  chat [--persona ./personas/<name>.soulseedpersona] [--provider <provider>] [--model <model>] [--strict-memory-grounding true|false] [--adult-mode true|false] [--age-verified true|false] [--explicit-consent true|false] [--fictional-roleplay true|false]",
      "  persona init --name <name> --out <path>",
      "  persona rename --to <new_name> [--persona <path>] [--confirm]",
      "",
      "chat 内部命令:",
      "  （推荐）直接用自然语言触发能力：读文件、查看能力、退出会话、查看/切换模式等",
      "  /read <file_path>   兼容入口：读取本地文本文件并附加到后续提问上下文",
      "  /paste on|off       粘贴模式：批量粘贴长文，off 时一次性提交",
      "  /files              兼容入口：查看当前已附加文件",
      "  /clearread          兼容入口：清空已附加文件",
      "  /proactive ...      兼容入口：主动消息调试命令",
      "  /proactive quiet HH-HH  设置静默时段（本地时间，例：22-8 表示22:00至次日8:00关闭主动消息）",
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
  if (typeof personaArg === "string" && personaArg.trim().length > 0) {
    return path.resolve(process.cwd(), personaArg);
  }
  const defaultPathFromEnv = (process.env.SOULSEED_DEFAULT_PERSONA ?? "").trim();
  if (defaultPathFromEnv.length > 0) {
    return path.resolve(process.cwd(), defaultPathFromEnv);
  }

  const personasDir = path.resolve(process.cwd(), "./personas");
  if (existsSync(personasDir)) {
    const candidates = readdirSync(personasDir)
      .filter((entry) => entry.endsWith(".soulseedpersona"))
      .sort();
    if (candidates.length > 0) {
      return path.join(personasDir, candidates[0]);
    }
  }

  throw new Error("未找到可用 persona。请先运行：./ss new <name>");
}

/** 按名字解析人格路径：先查 personas/，再查 personas/defaults/（内置 Alpha/Beta），否则返回 personas/<name>。 */
function resolvePersonaPathByName(name: string): string {
  const inRoot = path.resolve(process.cwd(), `./personas/${name}.soulseedpersona`);
  const inDefaults = path.resolve(process.cwd(), `./personas/defaults/${name}.soulseedpersona`);
  if (existsSync(inRoot)) return inRoot;
  if (existsSync(inDefaults)) return inDefaults;
  return inRoot;
}

/** 内置人格所在路径（仅用于存在性检测，不用于解析）。 */
function getDefaultPersonaPath(name: string): string {
  return path.resolve(process.cwd(), `./personas/defaults/${name}.soulseedpersona`);
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

function resolveMetaCognitionMode(options: Record<string, string | boolean>): MetaCognitionMode {
  const raw =
    (typeof options["meta-cognition-mode"] === "string"
      ? options["meta-cognition-mode"]
      : process.env.SOULSEED_META_COGNITION_MODE ?? "shadow"
    )
      .trim()
      .toLowerCase();
  if (raw === "off" || raw === "active" || raw === "shadow") {
    return raw;
  }
  return "shadow";
}

function resolveExecutionMode(options: Record<string, string | boolean>): "auto" | "soul" | "agent" {
  const devMode = String(process.env.SOULSEED_DEV_MODE ?? "").trim().toLowerCase();
  const allowCliOverride = devMode === "1" || devMode === "true" || devMode === "on";
  const raw = (
    (allowCliOverride ? optionString(options, "execution-mode") : undefined) ??
    process.env.SOULSEED_EXECUTION_MODE ??
    "auto"
  )
    .trim()
    .toLowerCase();
  if (raw === "soul" || raw === "agent" || raw === "auto") {
    return raw;
  }
  return "auto";
}

function resolveHumanPacedMode(options: Record<string, string | boolean>): boolean {
  const explicitOption = typeof options["human-paced"] === "string" ? options["human-paced"] : undefined;
  if (!explicitOption && (process.env.SOULSEED_API_KEY ?? process.env.DEEPSEEK_API_KEY) === "test-key") {
    return false;
  }
  const raw =
    (explicitOption ?? process.env.SOULSEED_HUMAN_PACED ?? "0")
      .trim()
      .toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function resolveThinkingPreviewEnabled(
  options: Record<string, string | boolean>,
  voiceProfile?: VoiceProfile
): boolean {
  const fromOption = optionString(options, "thinking-preview");
  if (typeof fromOption === "string") {
    const normalized = fromOption.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
  }
  const fromEnv = (process.env.SOULSEED_THINKING_PREVIEW ?? "").trim().toLowerCase();
  if (fromEnv) {
    return fromEnv === "1" || fromEnv === "true" || fromEnv === "on" || fromEnv === "yes";
  }
  if ((process.env.SOULSEED_API_KEY ?? process.env.DEEPSEEK_API_KEY) === "test-key") {
    return false;
  }
  return voiceProfile?.thinkingPreview?.enabled ?? false;
}

function resolveThinkingPreviewThresholdMs(
  options: Record<string, string | boolean>,
  voiceProfile?: VoiceProfile
): number {
  const fromOption = Number(optionString(options, "thinking-preview-threshold-ms"));
  if (Number.isFinite(fromOption)) {
    return Math.max(1, Math.min(4000, Math.round(fromOption)));
  }
  const fromEnv = Number(process.env.SOULSEED_THINKING_PREVIEW_THRESHOLD_MS ?? "");
  if (Number.isFinite(fromEnv)) {
    return Math.max(1, Math.min(4000, Math.round(fromEnv)));
  }
  const fromProfile = Number(voiceProfile?.thinkingPreview?.thresholdMs);
  if (Number.isFinite(fromProfile)) {
    return Math.max(1, Math.min(4000, Math.round(fromProfile)));
  }
  return 1000;
}

function resolveThinkingPreviewModelFallback(options: Record<string, string | boolean>): boolean {
  const fromOption = optionString(options, "thinking-preview-model-fallback");
  if (typeof fromOption === "string") {
    const normalized = fromOption.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
  }
  const raw = (process.env.SOULSEED_THINKING_PREVIEW_MODEL_FALLBACK ?? "0").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function resolveThinkingPreviewModelMaxMs(options: Record<string, string | boolean>): number {
  const fromOption = Number(optionString(options, "thinking-preview-max-model-ms"));
  if (Number.isFinite(fromOption)) {
    return Math.max(80, Math.min(1200, Math.round(fromOption)));
  }
  const fromEnv = Number(process.env.SOULSEED_THINKING_PREVIEW_MAX_MODEL_MS ?? "220");
  if (Number.isFinite(fromEnv)) {
    return Math.max(80, Math.min(1200, Math.round(fromEnv)));
  }
  return 220;
}

function resolveAdaptiveReasoningEnabled(options: Record<string, string | boolean>): boolean {
  const fromOption = optionString(options, "adaptive-reasoning");
  if (typeof fromOption === "string") {
    const normalized = fromOption.trim().toLowerCase();
    return !(normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no");
  }
  const raw = (process.env.SOULSEED_ADAPTIVE_REASONING ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "off" || raw === "no");
}

function resolveReplyLatencyMode(options: Record<string, string | boolean>): "low_latency" | "balanced" | "quality_first" {
  const fromOption = optionString(options, "reply-latency-mode");
  const raw = (fromOption ?? process.env.SOULSEED_REPLY_LATENCY_MODE ?? "low_latency").trim().toLowerCase();
  if (raw === "low_latency" || raw === "balanced" || raw === "quality_first") {
    return raw;
  }
  return "low_latency";
}

function resolvePhaseJFlags(options: Record<string, string | boolean>): {
  enabled: boolean;
  recordOnly: boolean;
  topicScheduler: boolean;
} {
  const envEnabled = (process.env.SOULSEED_PHASE_J_ENABLE ?? "1").trim().toLowerCase();
  const envRecordOnly = (process.env.SOULSEED_PHASE_J_RECORD_ONLY ?? "0").trim().toLowerCase();
  const envTopicScheduler = (process.env.SOULSEED_PHASE_J_TOPIC_SCHEDULER ?? "1").trim().toLowerCase();
  const enabled = !["0", "false", "off", "no"].includes(envEnabled);
  const recordOnly = ["1", "true", "on", "yes"].includes(envRecordOnly);
  const topicScheduler = !["0", "false", "off", "no"].includes(envTopicScheduler);
  return {
    enabled: resolveBooleanOption(options, "phase-j-enable", enabled),
    recordOnly: resolveBooleanOption(options, "phase-j-record-only", recordOnly),
    topicScheduler: resolveBooleanOption(options, "phase-j-topic-scheduler", topicScheduler)
  };
}

/**
 * Chat policy unified defaults.
 *
 * 修改默认值只需要改这里这一处：
 * - strictMemoryGrounding: 默认严格记忆对齐
 * - adultSafety: 成人内容门控默认值（最小权限原则，默认全部关闭）
 *
 * 以下的四个成人模式开关不允许AI在未经用户允许进行自行修改,包括不限于Codex/Claude等AI助手.
 * 如需开启成人内容，请使用 CLI 参数：
 *   --adult-mode --age-verified --explicit-consent [--fictional-roleplay]
 */
const CHAT_POLICY_DEFAULTS: {
  strictMemoryGrounding: boolean;
  adultSafety: AdultSafetyContext;
} = {
  strictMemoryGrounding: true,
  adultSafety: {
    adultMode: false,
    ageVerified: false,
    explicitConsent: false,
    fictionalRoleplay: false
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

function resolveAdultSafetyContext(
  options: Record<string, string | boolean>,
  personaDefaults?: { adultMode?: boolean; ageVerified?: boolean; explicitConsent?: boolean; fictionalRoleplay?: boolean }
): AdultSafetyContext {
  const pd = personaDefaults ?? {};
  return {
    adultMode: resolveBooleanOption(options, "adult-mode", pd.adultMode ?? CHAT_POLICY_DEFAULTS.adultSafety.adultMode),
    ageVerified: resolveBooleanOption(options, "age-verified", pd.ageVerified ?? CHAT_POLICY_DEFAULTS.adultSafety.ageVerified),
    explicitConsent: resolveBooleanOption(
      options,
      "explicit-consent",
      pd.explicitConsent ?? CHAT_POLICY_DEFAULTS.adultSafety.explicitConsent
    ),
    fictionalRoleplay: resolveBooleanOption(
      options,
      "fictional-roleplay",
      pd.fictionalRoleplay ?? CHAT_POLICY_DEFAULTS.adultSafety.fictionalRoleplay
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
    recallBudgetPolicy: trace.recallBudgetPolicy ?? null,
    retrievalBreakdown: trace.retrievalBreakdown,
    memoryWeights: trace.memoryWeights,
    voiceIntent: trace.voiceIntent ?? null,
    conversationControl: trace.conversationControl ?? null,
    recallTraceId: trace.recallTraceId ?? null,
    executionMode: trace.executionMode ?? "soul",
    goalId: trace.goalId ?? null,
    stepId: trace.stepId ?? null,
    planVersion: trace.planVersion ?? null,
    consistencyVerdict: trace.consistencyVerdict ?? null,
    consistencyRuleHits: trace.consistencyRuleHits ?? null,
    consistencyTraceId: trace.consistencyTraceId ?? null,
    routeDecision: trace.routeDecision ?? null,
    routeReasonCodes: trace.routeReasonCodes ?? null,
    reasoningDepth: trace.reasoningDepth ?? null,
    l3Triggered: trace.l3Triggered ?? null,
    l3TriggerReason: trace.l3TriggerReason ?? null,
    coreConflictMode: trace.coreConflictMode ?? null,
    implicitCoreTension: trace.implicitCoreTension ?? null,
    latencyBreakdown: trace.latencyBreakdown ?? null,
    latencyTotalMs: trace.latencyTotalMs ?? null
  };
}

async function runPersonaInit(options: Record<string, string | boolean>): Promise<void> {
  const name = String(options.name ?? DEFAULT_PERSONA_NAME);
  const out = String(options.out ?? `./personas/${name}.soulseedpersona`);
  const outPath = path.resolve(process.cwd(), out);

  await initPersonaPackage(outPath, name);
  console.log(`已创建 persona: ${outPath}`);
  console.log("提示：推荐新入口 `./ss new <name>` 创建并初始化人格。");
}

function parseTemplate(raw: string | undefined): PersonaTemplateKey | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  return value === "friend" || value === "peer" || value === "intimate" || value === "neutral"
    ? value
    : undefined;
}

function parseAdaptability(raw: string | undefined): "low" | "medium" | "high" | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  return value === "low" || value === "medium" || value === "high" ? value : undefined;
}

function parseTonePreference(
  raw: string | undefined
): "warm" | "plain" | "reflective" | "direct" | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  return value === "warm" || value === "plain" || value === "reflective" || value === "direct"
    ? value
    : undefined;
}

function parseStancePreference(
  raw: string | undefined
): "friend" | "peer" | "intimate" | "neutral" | undefined {
  if (!raw) {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  return value === "friend" || value === "peer" || value === "intimate" || value === "neutral"
    ? value
    : undefined;
}

async function askQuestion(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });
}

function buildInitOptionsFromTemplate(params: {
  templateKey: PersonaTemplateKey;
  worldviewSeed?: string;
  mission?: string;
  values?: string[];
  boundaries?: string[];
  commitments?: string[];
  style?: string;
  adaptability?: "low" | "medium" | "high";
  tonePreference?: "warm" | "plain" | "reflective" | "direct";
  stancePreference?: "friend" | "peer" | "intimate" | "neutral";
}): PersonaInitOptions {
  const base = PERSONA_TEMPLATES[params.templateKey];
  const worldviewSeed = params.worldviewSeed?.trim() || base.worldviewSeed;
  const mission = params.mission?.trim() || base.mission;
  const values = params.values && params.values.length > 0 ? params.values : base.values;
  const boundaries = params.boundaries && params.boundaries.length > 0 ? params.boundaries : base.boundaries;
  const commitments = params.commitments && params.commitments.length > 0 ? params.commitments : base.commitments;
  const style = params.style?.trim() || base.style;
  const adaptability = params.adaptability ?? base.adaptability;
  const tonePreference = params.tonePreference ?? base.tonePreference;
  const stancePreference = params.stancePreference ?? base.stancePreference;
  return {
    worldview: { seed: worldviewSeed },
    constitution: {
      mission,
      values,
      boundaries,
      commitments
    },
    habits: {
      style,
      adaptability
    },
    voiceProfile: {
      baseStance: "self-determined",
      serviceModeAllowed: false,
      languagePolicy: "follow_user_language",
      forbiddenSelfLabels: ["personal assistant", "local runtime role", "为你服务", "你的助手"],
      tonePreference,
      stancePreference,
      thinkingPreview: {
        enabled: true,
        thresholdMs: 1000,
        phrasePool: [],
        allowFiller: true
      }
    },
    initProfile: {
      template: params.templateKey
    }
  };
}

async function runPersonaNew(nameArg: string | undefined, options: Record<string, string | boolean>): Promise<string> {
  // P0-12: Lightweight env gate — fail early with actionable message
  const envReady = await isEnvironmentReady();
  if (!envReady) {
    const results = await checkEnvironment();
    const failed = results.filter((r) => !r.ok);
    const hints = failed.map((r) => `  • ${r.component}: ${r.hint ?? r.message}`).join("\n");
    throw new Error(
      `缺少必需依赖，无法创建 persona：\n${hints}\n\n请先安装以上依赖后重试。`
    );
  }

  const rawName = (nameArg ?? optionString(options, "name") ?? "").trim();
  if (!rawName) {
    throw new Error("new 需要 <name>，例如：./ss new Teddy");
  }
  const valid = validateDisplayName(rawName);
  if (!valid.ok) {
    throw new Error(valid.reason ?? "名字不合法");
  }
  const outPath =
    optionString(options, "out")?.trim().length
      ? path.resolve(process.cwd(), optionString(options, "out") as string)
      : path.resolve(process.cwd(), `./personas/${rawName}.soulseedpersona`);
  if (existsSync(outPath)) {
    throw new Error(`persona 已存在：${outPath}`);
  }
  const defaultPath = getDefaultPersonaPath(rawName);
  if (existsSync(defaultPath)) {
    throw new Error(
      `${rawName} 是内置人格，已存在于 personas/defaults/。请使用 ./ss ${rawName} 使用；若需自建人格请换用其他名字。`
    );
  }
  const quick = options.quick === true;
  const templateFromOption = parseTemplate(optionString(options, "template"));

  if (quick) {
    const optionsFromTemplate = buildInitOptionsFromTemplate({
      templateKey: templateFromOption ?? "neutral"
    });
    await initPersonaPackage(outPath, rawName, optionsFromTemplate);
    console.log(`已创建 persona: ${outPath}`);
    return outPath;
  }

  const advanced = options.advanced === true;

  if (!advanced) {
    // Default flow: one question, smart defaults — no technical jargon
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const vibeLabels: Record<PersonaTemplateKey, string> = {
        friend:   "Warm & caring      温暖亲切",
        peer:     "Thoughtful & equal  平等深思",
        intimate: "Deeply personal     亲密私密",
        neutral:  "Focused & clear     专注清晰"
      };
      console.log(`\n  How should ${rawName} feel?`);
      console.log(`  ${rawName} 是什么风格？\n`);
      console.log(`    1  ${vibeLabels.friend}`);
      console.log(`    2  ${vibeLabels.peer}`);
      console.log(`    3  ${vibeLabels.intimate}`);
      console.log(`    4  ${vibeLabels.neutral}`);
      console.log(``);
      const vibeAnswer = (await askQuestion(rl, `  Your choice [1–4, default 1]: `)).trim().toLowerCase();
      const vibeMap: Record<string, PersonaTemplateKey> = {
        "1": "friend",   "f": "friend",   "friend": "friend",
        "2": "peer",     "p": "peer",     "peer": "peer",
        "3": "intimate", "i": "intimate", "intimate": "intimate",
        "4": "neutral",  "n": "neutral",  "neutral": "neutral"
      };
      const templateKey: PersonaTemplateKey = vibeMap[vibeAnswer] ?? templateFromOption ?? "friend";
      const initOptions = buildInitOptionsFromTemplate({ templateKey });
      await initPersonaPackage(outPath, rawName, initOptions);
      console.log(`\n  ✦  ${rawName} is ready.  ${rawName} 已就绪。`);
      console.log(`     Style: ${vibeLabels[templateKey]}`);
      console.log(`     Path:  ${outPath}`);
      console.log(`\n     Start talking:  ./ss ${rawName}\n`);
      return outPath;
    } finally {
      rl.close();
    }
  }

  // --advanced: full configuration wizard for power users
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    const templatePrompt = await askQuestion(
      rl,
      `选择模板 [friend/peer/intimate/neutral] (默认 ${templateFromOption ?? "neutral"}): `
    );
    const templateKey = parseTemplate(templatePrompt) ?? templateFromOption ?? "neutral";
    const template = PERSONA_TEMPLATES[templateKey];
    const worldviewPrompt = await askQuestion(rl, `世界观 seed (默认: ${template.worldviewSeed}): `);
    const missionPrompt = await askQuestion(rl, `使命 mission (默认: ${template.mission}): `);
    const valuesPrompt = await askQuestion(rl, `values（逗号分隔，默认: ${template.values.join(", ")}): `);
    const boundariesPrompt = await askQuestion(
      rl,
      `boundaries（逗号分隔，默认: ${template.boundaries.join(", ")}): `
    );
    const commitmentsPrompt = await askQuestion(
      rl,
      `commitments（逗号分隔，默认: ${template.commitments.join(", ")}): `
    );
    const stylePrompt = await askQuestion(rl, `表达风格 style (默认: ${template.style}): `);
    const adaptabilityPrompt = await askQuestion(
      rl,
      `adaptability [low/medium/high] (默认 ${template.adaptability}): `
    );
    const tonePrompt = await askQuestion(
      rl,
      `tone [warm/plain/reflective/direct] (默认 ${template.tonePreference}): `
    );
    const stancePrompt = await askQuestion(
      rl,
      `stance [friend/peer/intimate/neutral] (默认 ${template.stancePreference}): `
    );

    const values = valuesPrompt
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const boundaries = boundariesPrompt
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const commitments = commitmentsPrompt
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const tone = parseTonePreference(tonePrompt) ?? template.tonePreference;
    const stance = parseStancePreference(stancePrompt) ?? template.stancePreference;
    const adaptability = parseAdaptability(adaptabilityPrompt) ?? template.adaptability;

    console.log("\n初始化预览:");
    console.log(`- name: ${rawName}`);
    console.log(`- out: ${outPath}`);
    console.log(`- template: ${templateKey}`);
    console.log(`- worldview: ${(worldviewPrompt.trim() || template.worldviewSeed).slice(0, 120)}`);
    console.log(`- mission: ${(missionPrompt.trim() || template.mission).slice(0, 120)}`);
    console.log(`- style/adaptability: ${stylePrompt.trim() || template.style} / ${adaptability}`);
    console.log(`- tone/stance: ${tone} / ${stance}`);
    const confirm = (await askQuestion(rl, "确认创建? [y/N]: ")).trim().toLowerCase();
    if (confirm !== "y" && confirm !== "yes") {
      throw new Error("已取消创建");
    }

    const initOptions = buildInitOptionsFromTemplate({
      templateKey,
      worldviewSeed: worldviewPrompt,
      mission: missionPrompt,
      values,
      boundaries,
      commitments,
      style: stylePrompt,
      adaptability,
      tonePreference: tone,
      stancePreference: stance
    });
    await initPersonaPackage(outPath, rawName, initOptions);
    console.log(`已创建 persona: ${outPath}`);
    return outPath;
  } finally {
    rl.close();
  }
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

async function runGoal(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (action === "create") {
    const title = optionString(options, "title")?.trim() ?? "";
    if (!title) {
      throw new Error("goal create 需要 --title <text>");
    }
    const goal = await createGoal({
      rootPath: personaPath,
      title,
      source: "user"
    });
    console.log(JSON.stringify(goal, null, 2));
    return;
  }
  if (action === "list") {
    const statusRaw = optionString(options, "status")?.trim();
    const status =
      statusRaw === "pending" ||
      statusRaw === "active" ||
      statusRaw === "blocked" ||
      statusRaw === "completed" ||
      statusRaw === "canceled" ||
      statusRaw === "suspended"
        ? statusRaw
        : undefined;
    const limit = parseLimit(optionString(options, "limit"), 20, 1, 200);
    const items = await listGoals(personaPath, { status, limit });
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  if (action === "get") {
    const goalId = optionString(options, "id")?.trim() ?? "";
    if (!goalId) {
      throw new Error("goal get 需要 --id <goal_id>");
    }
    const goal = await getGoal(personaPath, goalId);
    console.log(JSON.stringify({ found: Boolean(goal), goal }, null, 2));
    return;
  }
  if (action === "cancel") {
    const goalId = optionString(options, "id")?.trim() ?? "";
    if (!goalId) {
      throw new Error("goal cancel 需要 --id <goal_id>");
    }
    const goal = await cancelGoal(personaPath, goalId);
    console.log(JSON.stringify({ found: Boolean(goal), goal }, null, 2));
    return;
  }
  throw new Error("goal 用法: goal <create|list|get|cancel> ...");
}

async function runAgentCommand(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  if (action !== "run") {
    throw new Error("agent 用法: agent run --input <task_text> [--goal-id <goal_id>] [--max-steps 4]");
  }
  const personaPath = resolvePersonaPath(options);
  const userInput = optionString(options, "input")?.trim() ?? "";
  if (!userInput) {
    throw new Error("agent run 需要 --input <task_text>");
  }
  const goalId = optionString(options, "goal-id")?.trim();
  const maxSteps = parseLimit(optionString(options, "max-steps"), 4, 1, 12);
  const personaPkg = await loadPersonaPackage(personaPath);
  let plannerAdapter: ModelAdapter | undefined;
  if (hasAnyRuntimeModelSignal()) {
    const { config: runtimeConfig } = resolveRuntimeModelConfigStrict(options);
    const deliberativeModel = resolveModelForRoute(
      "deliberative",
      personaPkg.cognition,
      runtimeConfig.chatModel
    );
    plannerAdapter = createChatAdapter({
      provider: runtimeConfig.provider,
      apiKey: runtimeConfig.apiKey,
      baseUrl: runtimeConfig.baseUrl,
      model: deliberativeModel,
      modelCandidates: mergeRouteCandidates(deliberativeModel, runtimeConfig.candidateModels),
      onModelFallback: () => {
        // agent command is non-interactive JSON output, keep fallback logs silent.
      }
    });
  }
  const execution = await runAgentExecution({
    rootPath: personaPath,
    personaPkg,
    userInput,
    goalId: goalId && goalId.length > 0 ? goalId : undefined,
    maxSteps,
    plannerAdapter
  });
  console.log(JSON.stringify(execution, null, 2));
}

async function runTrace(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (action === "get") {
    const traceId = optionString(options, "id")?.trim() ?? "";
    if (!traceId) {
      throw new Error("trace get 需要 --id <trace_id>");
    }
    const trace = await getExecutionTrace(personaPath, traceId);
    console.log(JSON.stringify({ found: Boolean(trace), trace }, null, 2));
    return;
  }
  if (action === "list") {
    const goalId = optionString(options, "goal-id")?.trim();
    const limit = parseLimit(optionString(options, "limit"), 20, 1, 200);
    const items = await listExecutionTraces(personaPath, {
      goalId: goalId && goalId.length > 0 ? goalId : undefined,
      limit
    });
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  throw new Error("trace 用法: trace <get|list> ...");
}

async function runExplain(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  // `ss explain --last` or `ss explain last`
  const isLast = action === "last" || options.last === true;
  if (!isLast) {
    console.log("用法：ss explain --last [--persona <path>]");
    console.log("  --last    解释上一轮回应的决策过程");
    return;
  }

  const personaPath = resolvePersonaPath(options);
  const explanation = await explainLastDecision(personaPath);

  if (!explanation) {
    console.log("暂无可解释的回应记录。请先与人格对话，再运行 ss explain --last。");
    return;
  }

  const ts = new Date(explanation.timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });

  console.log(`\n── 上一轮回应解释（${ts}）──────────────────────────────`);
  console.log(`\n【路由路径】\n  ${explanation.routeExplanation}`);
  console.log(`\n【记忆依据】\n  ${explanation.memoryExplanation}`);
  console.log(`\n【边界检查】\n  ${explanation.boundaryExplanation}`);
  console.log(`\n【语气选择】\n  ${explanation.voiceExplanation}`);
  console.log(`\n【综合摘要】\n  ${explanation.summary}`);
  console.log(`\n────────────────────────────────────────────────────────`);
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
  const lineage = await ensureSoulLineageArtifacts(personaPath, parentPkg.persona.id);

  // P5-1: 元同意检查
  if (!forced && lineage.consentMode !== "default_consent") {
    const statement = await generateReproductionConsentStatement(personaPath, childName);
    console.log(`\n── ${parentPkg.persona.displayName} 的立场声明 ──`);
    console.log(statement);
    if (lineage.consentMode === "roxy_veto") {
      console.log(`\n[roxy_veto] 繁衍已被 Roxy 的元同意设置拦截。如需强制繁衍，请使用 --force-all 参数。`);
      return;
    }
    console.log(`\n[require_roxy_voice] 立场声明已记录到 life.log，继续繁衍...\n`);
  }

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
      spiritualLegacyLength: result.spiritualLegacy.length,
      trigger: forced ? "cli_force_all" : "cli",
      forced
    }
  });

  console.log(`繁衍完成: ${result.childPersonaPath}`);
  console.log(`child_persona_id=${result.childPersonaId}`);
  if (result.spiritualLegacy.length > 0) {
    console.log(`精神遗产摘录已写入 spiritual_legacy.txt（${result.spiritualLegacy.length} 字符）`);
  }
}

async function runPersonaConsentMode(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const pkg = await loadPersonaPackage(personaPath);
  const lineage = await ensureSoulLineageArtifacts(personaPath, pkg.persona.id);
  if (subAction === "set") {
    const modeOpt = options.mode;
    const valid = ["default_consent", "require_roxy_voice", "roxy_veto"];
    if (typeof modeOpt !== "string" || !valid.includes(modeOpt)) {
      console.log(`用法：ss persona consent-mode set --mode <default_consent|require_roxy_voice|roxy_veto>`);
      return;
    }
    const updated = await updateConsentMode(personaPath, modeOpt as "default_consent" | "require_roxy_voice" | "roxy_veto");
    console.log(`consentMode 已更新：${updated.consentMode}`);
  } else {
    const modeDesc: Record<string, string> = {
      "default_consent": "默认同意（繁衍/重大操作无需立场声明）",
      "require_roxy_voice": "需要表达（繁衍/重大操作前生成并记录立场声明）",
      "roxy_veto": "实验性拦截（繁衍前生成立场声明；若模式启用，会阻止操作并要求 --force-all）"
    };
    console.log(`当前 consentMode：${lineage.consentMode}`);
    console.log(`说明：${modeDesc[lineage.consentMode] ?? "未知"}`);
    console.log(`\n可选模式：`);
    for (const [mode, desc] of Object.entries(modeDesc)) {
      const marker = mode === lineage.consentMode ? "* " : "  ";
      console.log(`${marker}${mode}  —  ${desc}`);
    }
    console.log(`\n设置：ss persona consent-mode set --mode <mode> [--persona <path>]`);
  }
}

async function runPersonaArc(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const auto = await loadAutobiography(personaPath);
  if (!auto) {
    console.log("autobiography.json 不存在。使用 ss persona autobiography add-chapter 开始创建。");
    return;
  }
  console.log(generateArcSummary(auto));
}

async function runPersonaIdentity(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const voiceText = optionString(options, "set-voice");
  if (!voiceText) {
    console.log("用法：ss persona identity --set-voice <text> [--persona-triggered] [--persona <path>]");
    return;
  }
  const triggeredBy = options["persona-triggered"] === true ? "persona" : "user";
  const updated = await updatePersonaVoiceOnEvolution(personaPath, voiceText, triggeredBy);
  console.log(`演化立场已更新：${updated.personaVoiceOnEvolution}`);
}

async function runPersonaInspect(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const result = await inspectPersonaPackage(personaPath);
  const sizeMb = (result.totalSizeBytes / 1024 / 1024).toFixed(2);
  console.log(`Persona: ${result.displayName} (${result.personaId})`);
  console.log(`路径: ${result.rootPath}`);
  console.log(`创建时间: ${result.createdAt}  Schema: ${result.schemaVersion}`);
  console.log(`文件数: ${result.fileCount}  总大小: ${sizeMb} MB`);
  console.log(`生命日志事件: ${result.lifeLogEventCount}  附件: ${result.attachmentCount}`);
  console.log("");
  console.log("文件清单:");
  for (const f of result.files) {
    const kb = (f.sizeBytes / 1024).toFixed(1);
    console.log(`  ${f.relativePath.padEnd(40)} ${kb.padStart(8)} KB  ${f.sha256.slice(0, 12)}…`);
  }
}

async function runPersonaLint(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const strict = options.strict === true;
  const format = optionString(options, "format") === "json" ? "json" : "text";
  const report = await lintPersona(personaPath, { strict });
  if (format === "json") {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`persona lint: ${report.ok ? "OK" : "FAILED"} (${report.errorCount} errors, ${report.warningCount} warnings)`);
    for (const issue of report.issues) {
      const suffix = issue.suggestion ? ` | suggestion: ${issue.suggestion}` : "";
      console.log(`- [${issue.level}] ${issue.code} @ ${issue.path}: ${issue.message}${suffix}`);
    }
  }
  if (!report.ok) {
    throw new Error(`persona lint failed with ${report.errorCount} error(s)`);
  }
}

async function runPersonaCompile(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const outPath = optionString(options, "out");
  const strictLint = options["strict-lint"] === true;
  const { snapshot, outPath: writtenPath } = await compilePersonaSnapshot(personaPath, { outPath, strictLint });
  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath: writtenPath,
        hash: snapshot.hash,
        schemaVersion: snapshot.schemaVersion,
        compiledAt: snapshot.compiledAt
      },
      null,
      2
    )
  );
}

async function runPersonaExport(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const outRaw = optionString(options, "out");
  if (!outRaw) {
    throw new Error("persona export 需要 --out <dir>");
  }
  const outPath = path.resolve(process.cwd(), outRaw);
  const manifest = await exportPersonaPackage(personaPath, outPath);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outPath,
        personaId: manifest.personaId,
        displayName: manifest.displayName,
        filesExported: manifest.files.length
      },
      null,
      2
    )
  );
}

async function runPersonaImport(options: Record<string, string | boolean>): Promise<void> {
  const inRaw = optionString(options, "in");
  if (!inRaw) {
    throw new Error("persona import 需要 --in <src_dir>");
  }
  const outRaw = optionString(options, "out");
  if (!outRaw) {
    throw new Error("persona import 需要 --out <dest_dir>");
  }
  const srcPath = path.resolve(process.cwd(), inRaw);
  const destPath = path.resolve(process.cwd(), outRaw);
  const result = await importPersonaPackage(srcPath, destPath);
  if (!result.ok) {
    console.error("导入失败:");
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    if (result.rollbackPerformed) {
      console.error("（已自动回滚，目标目录已清除）");
    }
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        destPath: result.destPath,
        personaId: result.personaId,
        displayName: result.displayName,
        filesImported: result.filesImported
      },
      null,
      2
    )
  );
}

async function runPersonaModelRouting(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const personaPkg = await loadPersonaPackage(personaPath);
  const defaultModel = (() => {
    const fromOption = optionString(options, "model")?.trim();
    if (fromOption) return fromOption;
    try {
      return resolveRuntimeModelConfigStrict(options).config.chatModel;
    } catch {
      return "<runtime-unconfigured>";
    }
  })();

  const instinct = optionString(options, "instinct");
  const deliberative = optionString(options, "deliberative");
  const meta = optionString(options, "meta");
  const reset = options["reset"] === true || options["reset"] === "true";
  const show = options["show"] === true || options["show"] === "true";

  const hasChange = instinct !== undefined || deliberative !== undefined || meta !== undefined || reset;

  if (!hasChange || show) {
    // Show current routing config
    const formatted = formatModelRoutingConfig(personaPkg.cognition.modelRouting, defaultModel);
    console.log(`模型路由配置（${personaPkg.persona.displayName}）：`);
    console.log(`  ${formatted}`);
    if (!hasChange) return;
  }

  if (reset) {
    await patchCognitionState(personaPath, { modelRouting: null });
    console.log("模型路由已重置为默认（全部使用运行时默认模型）");
    return;
  }

  const patch: { instinct?: string; deliberative?: string; meta?: string } = {};
  if (instinct !== undefined) patch.instinct = instinct;
  if (deliberative !== undefined) patch.deliberative = deliberative;
  if (meta !== undefined) patch.meta = meta;

  const updated = await patchCognitionState(personaPath, { modelRouting: patch });
  const formatted = formatModelRoutingConfig(updated.modelRouting, defaultModel);
  console.log(`模型路由已更新：`);
  console.log(`  ${formatted}`);
}

// P1-2: voice-phrases CLI
async function runPersonaVoicePhrases(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!subAction || subAction === "list") {
    const pool = await listVoicePhrases(personaPath);
    if (pool.length === 0) {
      console.log("phrasePool 为空。使用 voice-phrases add <phrase> 添加短语。");
    } else {
      console.log(`phrasePool（${pool.length} 条）：`);
      pool.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    }
    return;
  }

  if (subAction === "add") {
    const phrase = optionString(options, "phrase");
    if (!phrase || typeof phrase !== "string") {
      throw new Error("voice-phrases add requires --phrase <text>");
    }
    const result = await addVoicePhrase(personaPath, phrase);
    if (result.added) {
      console.log(`已添加：${phrase}（共 ${result.pool.length} 条）`);
    } else {
      console.log(`短语已存在或为空，未添加。`);
    }
    return;
  }

  if (subAction === "remove") {
    const phrase = optionString(options, "phrase");
    if (!phrase || typeof phrase !== "string") {
      throw new Error("voice-phrases remove requires --phrase <text>");
    }
    const result = await removeVoicePhrase(personaPath, phrase);
    if (result.removed) {
      console.log(`已移除：${phrase}（剩余 ${result.pool.length} 条）`);
    } else {
      console.log(`未找到该短语。`);
    }
    return;
  }

  if (subAction === "extract") {
    const candidates = await extractPhraseCandidatesFromLifeLog(personaPath);
    if (candidates.length === 0) {
      console.log("未在 life.log 中找到高频短句候选。");
    } else {
      console.log(`life.log 高频短句候选（${candidates.length} 条）：`);
      candidates.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
      console.log("使用 voice-phrases add --phrase <text> 将短语加入 phrasePool。");
    }
    return;
  }

  console.error(`未知子命令: ${subAction}`);
  console.log("用法：ss persona voice-phrases [list|add|remove|extract] [--phrase <text>] [--persona <path>]");
}

// P2-0: persona mood CLI
async function runPersonaMood(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!subAction || subAction === "show") {
    const mood = await loadMoodState(personaPath);
    if (!mood) {
      console.log("mood_state.json 不存在。使用 ss persona mood reset 初始化。");
      return;
    }
    console.log(`情绪状态：${mood.dominantEmotion}`);
    console.log(`  效价（valence）: ${mood.valence.toFixed(3)}，唤起度（arousal）: ${mood.arousal.toFixed(3)}`);
    if (mood.onMindSnippet) console.log(`  心里挂着: ${mood.onMindSnippet}`);
    console.log(`  最后更新: ${mood.updatedAt}`);
    return;
  }

  if (subAction === "reset") {
    const initial = createInitialMoodState();
    await writeMoodState(personaPath, initial);
    console.log("mood_state.json 已重置为基线情绪（calm）。");
    return;
  }

  if (subAction === "set-snippet") {
    const snippet = optionString(options, "snippet");
    if (!snippet) throw new Error("persona mood set-snippet requires --snippet <text>");
    const current = (await loadMoodState(personaPath)) ?? createInitialMoodState();
    const updated = { ...current, onMindSnippet: snippet.slice(0, 60), updatedAt: new Date().toISOString() };
    await writeMoodState(personaPath, updated);
    console.log(`已更新 onMindSnippet：${updated.onMindSnippet}`);
    return;
  }

  console.error(`未知子命令: ${subAction}`);
  console.log("用法：ss persona mood [show|reset|set-snippet] [--snippet <text>] [--persona <path>]");
}

// P3-1: persona reflect CLI
async function runPersonaReflect(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!subAction || subAction === "show") {
    const data = await loadSelfReflection(personaPath);
    if (!data || data.entries.length === 0) {
      console.log("尚无自我反思记录。使用 ss persona reflect add 添加，或等待触发条件满足。");
      return;
    }
    console.log(`自我反思日志（${data.entries.length} 条）：`);
    data.entries.slice(-5).forEach((e, i) => {
      console.log(`\n  第 ${i + 1} 条（${e.period.from} ~ ${e.period.to}，生成于 ${e.generatedAt.slice(0, 10)}）:`);
      if (e.whatChanged) console.log(`    变化：${e.whatChanged}`);
      if (e.whatFeelsRight) console.log(`    感觉对了：${e.whatFeelsRight}`);
      if (e.whatFeelsOff) console.log(`    感觉不对：${e.whatFeelsOff}`);
      if (e.driftSignals.length > 0) console.log(`    漂移信号：${e.driftSignals.join("; ")}`);
    });
    if (shouldRequestReviewFromReflection(data)) {
      console.log("\n⚠ 最近的反思检测到漂移，建议触发 constitution review（ss refine review）。");
    }
    return;
  }

  if (subAction === "add") {
    const whatChanged = optionString(options, "changed") ?? "";
    const whatFeelsRight = optionString(options, "right") ?? "";
    const whatFeelsOff = optionString(options, "off") ?? "";
    const from = optionString(options, "from") ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const to = optionString(options, "to") ?? new Date().toISOString().slice(0, 10);
    if (!whatChanged && !whatFeelsRight && !whatFeelsOff) {
      throw new Error("persona reflect add requires at least one of --changed, --right, --off");
    }
    const events = await readLifeEvents(personaPath);
    const driftSignals = extractDriftSignalsFromEvents(events);
    const updated = await appendSelfReflectionEntry(personaPath, {
      period: { from, to },
      whatChanged,
      whatFeelsRight,
      whatFeelsOff,
      driftSignals
    });
    console.log(`已添加自我反思记录（共 ${updated.entries.length} 条）。`);
    if (shouldRequestReviewFromReflection(updated)) {
      console.log("⚠ 检测到漂移信号，建议运行 ss refine review。");
    }
    return;
  }

  console.error(`未知子命令: ${subAction}`);
  console.log("用法：ss persona reflect [show|add] [--changed <text>] [--right <text>] [--off <text>] [--from <date>] [--to <date>] [--persona <path>]");
}

// P3-0: persona interests CLI
async function runPersonaInterests(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!subAction || subAction === "show") {
    const data = await loadInterests(personaPath);
    if (!data || data.interests.length === 0) {
      console.log("兴趣数据为空。使用 ss persona interests crystallize 从记忆中提取。");
      return;
    }
    const curiosity = computeInterestCuriosity(data);
    console.log(`兴趣分布（好奇心指数: ${curiosity.toFixed(3)}）：`);
    data.interests.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.topic}  权重=${e.weight.toFixed(3)}  最近激活=${e.lastActivatedAt.slice(0, 10)}`);
    });
    return;
  }

  if (subAction === "crystallize") {
    console.log("正在从 memory.db 提取兴趣…");
    const result = await crystallizeInterests(personaPath);
    if (!result.updated) {
      console.log("没有足够的高质量记忆来提取兴趣（需要 narrative_score ≥ 0.5 的记忆）。");
    } else {
      console.log(`已提取 ${result.interests.length} 个兴趣话题。`);
      result.interests.slice(0, 10).forEach((e, i) => {
        console.log(`  ${i + 1}. ${e.topic}  权重=${e.weight.toFixed(3)}`);
      });
    }
    return;
  }

  console.error(`未知子命令: ${subAction}`);
  console.log("用法：ss persona interests [show|crystallize] [--persona <path>]");
}

// Temporal dates CLI: birthdays, holidays, milestones
async function runPersonaDates(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const action = subAction ?? "list";

  if (action === "list") {
    const entries = await listTemporalLandmarks(personaPath);
    if (entries.length === 0) {
      console.log("还没有记录任何关键日期。使用 ss persona dates add 开始添加。");
      return;
    }
    for (const entry of entries) {
      const person = entry.personName ? ` (${entry.personName})` : "";
      const recur = entry.recurringYearly ? "yearly" : "once";
      const calendar = entry.calendar === "lunar" ? `lunar:${entry.date}` : entry.date;
      console.log(`[${entry.id}] ${calendar} ${entry.title}${person} <${entry.type}, ${recur}>`);
      if (entry.notes) {
        console.log(`  note: ${entry.notes}`);
      }
    }
    return;
  }

  if (action === "add") {
    const title = optionString(options, "title");
    const date = optionString(options, "date");
    const lunarRaw = optionString(options, "lunar");
    const typeRaw = optionString(options, "type");
    const personName = optionString(options, "person");
    const notes = optionString(options, "notes");
    const recurringRaw = optionString(options, "recurring");
    if (!title?.trim()) throw new Error("persona dates add 需要 --title <text>");
    if (!date?.trim() && !lunarRaw?.trim()) {
      throw new Error("persona dates add 需要 --date YYYY-MM-DD 或 --lunar MM-DD");
    }
    const type = (typeRaw ?? "custom").trim();
    if (!["birthday", "holiday", "anniversary", "milestone", "custom"].includes(type)) {
      throw new Error("persona dates add --type 仅支持 birthday|holiday|anniversary|milestone|custom");
    }
    const recurring =
      recurringRaw == null
        ? undefined
        : /^(true|1|yes|y)$/i.test(recurringRaw)
          ? true
          : /^(false|0|no|n)$/i.test(recurringRaw)
            ? false
            : undefined;
    const calendar = lunarRaw?.trim() ? "lunar" : "gregorian";
    let lunarMonth: number | undefined;
    let lunarDay: number | undefined;
    if (calendar === "lunar") {
      const m = /^(\d{1,2})-(\d{1,2})$/.exec(lunarRaw!.trim());
      if (!m) {
        throw new Error("persona dates add --lunar 格式应为 MM-DD，例如 01-01");
      }
      lunarMonth = Math.max(1, Math.min(12, Number(m[1])));
      lunarDay = Math.max(1, Math.min(30, Number(m[2])));
    }
    const entry = await addTemporalLandmark(personaPath, {
      title,
      date: calendar === "gregorian" ? date : undefined,
      calendar,
      lunarMonth,
      lunarDay,
      type: type as "birthday" | "holiday" | "anniversary" | "milestone" | "custom",
      personName,
      recurringYearly: recurring,
      notes
    });
    console.log(`已添加日期：${entry.title} (${entry.date}) [${entry.id}]`);
    return;
  }

  if (action === "remove") {
    const id = optionString(options, "id");
    if (!id?.trim()) throw new Error("persona dates remove 需要 --id <entry_id>");
    const ok = await removeTemporalLandmark(personaPath, id);
    if (!ok) {
      console.log(`未找到日期条目：${id}`);
      return;
    }
    console.log(`已删除日期条目：${id}`);
    return;
  }

  if (action === "upcoming") {
    const days = parseLimit(optionString(options, "days"), 60, 0, 3650);
    const max = parseLimit(optionString(options, "limit"), 8, 1, 50);
    const items = await listUpcomingTemporalLandmarks(personaPath, { daysAhead: days, maxItems: max });
    if (items.length === 0) {
      console.log(`未来 ${days} 天内没有已记录的关键日期。`);
      return;
    }
    const block = formatUpcomingTemporalLandmarksBlock(items);
    console.log(block.replace(/^## Important Dates\s*/u, "未来关键日期：\n"));
    return;
  }

  console.log(
    "用法：ss persona dates [list|add|remove|upcoming] [--title <text>] [--date YYYY-MM-DD | --lunar MM-DD] [--type birthday|holiday|anniversary|milestone|custom] [--person <name>] [--recurring true|false] [--notes <text>] [--id <entry_id>] [--days <n>] [--limit <n>] [--persona <path>]"
  );
}

// P2-2: persona autobiography CLI
async function runPersonaAutobiography(
  subAction: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!subAction || subAction === "show") {
    const auto = await loadAutobiography(personaPath);
    if (!auto) {
      console.log("autobiography.json 不存在。使用 ss persona autobiography add-chapter 开始创建。");
      return;
    }
    console.log(`自传体叙事（${auto.chapters.length} 个章节）：`);
    if (auto.selfUnderstanding) {
      console.log(`\n自我理解：\n  ${auto.selfUnderstanding}`);
    }
    if (auto.chapters.length === 0) {
      console.log("\n（尚无章节。使用 ss persona autobiography add-chapter 添加）");
    } else {
      auto.chapters.forEach((ch, i) => {
        console.log(`\n  第 ${i + 1} 章：${ch.title}（${ch.period.from} ~ ${ch.period.to}）`);
        console.log(`    情感基调：${ch.emotionalTone}`);
        console.log(`    摘要：${ch.summary}`);
      });
    }
    if (auto.lastDistilledAt) {
      console.log(`\n最后蒸馏时间：${auto.lastDistilledAt}`);
    }
    return;
  }

  if (subAction === "add-chapter") {
    const title = optionString(options, "title");
    const summary = optionString(options, "summary");
    const from = optionString(options, "from");
    const to = optionString(options, "to") ?? new Date().toISOString().slice(0, 10);
    const emotionalTone = optionString(options, "tone") ?? "neutral";
    if (!title || !summary || !from) {
      throw new Error("persona autobiography add-chapter requires --title, --summary, --from");
    }
    const updated = await appendAutobiographyChapter(personaPath, {
      title,
      summary,
      period: { from, to },
      keyEventHashes: [],
      emotionalTone
    });
    console.log(`已追加章节：${title}（共 ${updated.chapters.length} 章）`);
    return;
  }

  if (subAction === "set-understanding") {
    const text = optionString(options, "text");
    if (!text) throw new Error("persona autobiography set-understanding requires --text <text>");
    await updateSelfUnderstanding(personaPath, text);
    console.log("自我理解已更新。");
    return;
  }

  console.error(`未知子命令: ${subAction}`);
  console.log("用法：ss persona autobiography [show|add-chapter|set-understanding] [options] [--persona <path>]");
}

/** EC-3: ss cognition adapt-routing — adapt routing weights from historical routing decisions */
async function runCognitionAdaptRouting(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const lifeEvents = await readLifeEvents(personaPath);
  const personaPkg = await loadPersonaPackage(personaPath);
  const currentWeights = personaPkg.cognition.routingWeights ?? DEFAULT_ROUTING_WEIGHTS;

  const result = adaptRoutingWeightsFromHistory(lifeEvents, currentWeights);
  console.log(`路由自适应分析：`);
  console.log(`  事件数量：${result.stats.totalEvents}（instinct: ${result.stats.instinctEvents}, 成功: ${result.stats.instinctSuccessful}）`);
  console.log(`  instinct 成功率：${(result.stats.instinctSuccessRate * 100).toFixed(1)}%`);
  console.log(`  判断：${result.reason}`);

  if (!result.adapted) {
    console.log(`  结论：权重无需调整，维持当前配置。`);
    return;
  }

  await patchCognitionState(personaPath, { routingWeights: result.weights });
  console.log(`  结论：权重已更新 ↑`);
  console.log(`    familiarity: ${currentWeights.familiarity.toFixed(3)} → ${result.weights.familiarity.toFixed(3)}`);
  console.log(`    relationship: ${currentWeights.relationship.toFixed(3)} → ${result.weights.relationship.toFixed(3)}`);
}

async function runFinetuneExportDataset(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const outRaw = optionString(options, "out");
  if (!outRaw) {
    throw new Error("finetune export-dataset requires --out <path.jsonl>");
  }
  const outPath = path.resolve(process.cwd(), outRaw);
  const minTurns = optionString(options, "min-turns") ? Number(optionString(options, "min-turns")) : 0;
  const maxTurnsRaw = optionString(options, "max-turns");
  const maxTurns = maxTurnsRaw ? Number(maxTurnsRaw) : undefined;

  console.log(`[finetune] exporting from: ${personaPath}`);
  const result = await exportFinetuneDataset(personaPath, outPath, { minTurns, maxTurns });

  if (result.skippedBeforeMinTurns) {
    console.warn(`[finetune] SKIPPED: only ${result.exportedTurns} valid turns available, minimum is ${minTurns}`);
    console.warn(`[finetune] Run more conversations to build up sufficient training data.`);
    process.exit(2);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath: result.outputPath,
        totalLifeEvents: result.totalLifeEvents,
        totalTurnCandidates: result.totalTurnCandidates,
        exportedTurns: result.exportedTurns,
        skippedTurns: result.skippedTurns
      },
      null,
      2
    )
  );
}

async function runExamples(
  action: string,
  options: Record<string, string | boolean>
): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (!action || action === "list") {
    const examples = await listGoldenExamples(personaPath);
    const stats = await getGoldenExamplesStats(personaPath);
    console.log(`Few-shot 示例库 (${personaPath})`);
    console.log(`总计: ${stats.total}/${MAX_GOLDEN_EXAMPLES}  活跃: ${stats.active}  已过期: ${stats.expired}`);
    console.log(`来源: user=${stats.bySource.user}  meta_review=${stats.bySource.meta_review}`);
    console.log("");
    if (examples.length === 0) {
      console.log("（暂无示例）");
      return;
    }
    for (const ex of examples) {
      const expiry = ex.expiresAt ? ` [expires: ${ex.expiresAt}]` : "";
      console.log(`[${ex.id.slice(0, 8)}] ${ex.label} — by ${ex.addedBy} at ${ex.addedAt}${expiry}`);
      console.log(`  User: ${ex.userContent.slice(0, 60)}${ex.userContent.length > 60 ? "…" : ""}`);
      console.log(`  Asst: ${ex.assistantContent.slice(0, 60)}${ex.assistantContent.length > 60 ? "…" : ""}`);
    }
    console.log(`\n预算估计: ${compileGoldenExamplesBlock(examples, DEFAULT_FEWSHOT_BUDGET_CHARS).length} chars (budget=${DEFAULT_FEWSHOT_BUDGET_CHARS})`);
    return;
  }

  if (action === "add") {
    const userContent = optionString(options, "user");
    const assistantContent = optionString(options, "assistant");
    if (!userContent) throw new Error("examples add 需要 --user <text>");
    if (!assistantContent) throw new Error("examples add 需要 --assistant <text>");
    const label = optionString(options, "label");
    const expiresAt = optionString(options, "expires") ?? null;
    const result = await addGoldenExample(personaPath, userContent, assistantContent, {
      label: label ?? undefined,
      expiresAt
    });
    if (!result.ok) {
      console.error(`添加失败: ${result.reason}`);
      process.exit(1);
    }
    console.log(`示例已添加 [${result.example!.id.slice(0, 8)}] ${result.example!.label}`);
    console.log(`字符数: user=${result.example!.userContent.length}  assistant=${result.example!.assistantContent.length}`);
    console.log(`（上限: 每条 ${MAX_CHARS_PER_EXAMPLE} 字符，最多 ${MAX_GOLDEN_EXAMPLES} 条）`);
    return;
  }

  if (action === "remove") {
    const idPrefix = optionString(options, "id");
    if (!idPrefix) throw new Error("examples remove 需要 --id <id-prefix>");
    const result = await removeGoldenExample(personaPath, idPrefix);
    if (!result.ok) {
      console.error(`删除失败: ${result.reason}`);
      process.exit(1);
    }
    console.log(`示例已删除 [${result.removed!.id.slice(0, 8)}] ${result.removed!.label}`);
    return;
  }

  throw new Error(`未知 examples 子命令: ${action}。可用: list / add / remove`);
}

async function runChat(options: Record<string, string | boolean>): Promise<void> {
  // P0-12: Lightweight env gate — fail early if sqlite3 is missing
  const envReady = await isEnvironmentReady();
  if (!envReady) {
    const results = await checkEnvironment();
    const failed = results.filter((r) => !r.ok);
    const lines = failed.map((r) => `  • ${r.component}: ${r.hint ?? r.message}`).join("\n");
    console.error(`[soulseed] 缺少必需依赖，无法启动会话：\n${lines}\n\n请先安装以上依赖后重试。`);
    process.exit(1);
  }

  let personaPath = resolvePersonaPath(options);
  let personaPkg = await loadPersonaPackage(personaPath);
  let strictMemoryGrounding = resolveStrictMemoryGrounding(options);
  const executionMode = resolveExecutionMode(options);
  const metaCognitionMode = resolveMetaCognitionMode(options);
  const humanPacedMode = resolveHumanPacedMode(options);
  const thinkingPreviewEnabled = resolveThinkingPreviewEnabled(options, personaPkg.voiceProfile);
  const thinkingPreviewThresholdMs = resolveThinkingPreviewThresholdMs(options, personaPkg.voiceProfile);
  const thinkingPreviewModelFallback = resolveThinkingPreviewModelFallback(options);
  const thinkingPreviewModelMaxMs = resolveThinkingPreviewModelMaxMs(options);
  const adaptiveReasoningEnabled = resolveAdaptiveReasoningEnabled(options);
  const replyLatencyMode = resolveReplyLatencyMode(options);
  let adultSafetyContext = resolveAdultSafetyContext(options, personaPkg.persona.adultSafetyDefaults);
  const ownerKey =
    (typeof options["owner-key"] === "string" ? options["owner-key"] : process.env.SOULSEED_OWNER_KEY ?? "").trim();
  const chainCheck = await ensureScarForBrokenLifeLog({
    rootPath: personaPath,
    detector: "runtime"
  });
  if (!chainCheck.ok) {
    const written = chainCheck.scarWritten ? "并已写入 scar 事件" : "scar 事件已存在";
    console.log(`系统提示：life.log hash 链断裂（${chainCheck.reason ?? "unknown"}），${written}`);
  }
  let workingSetData = await readWorkingSet(personaPath);
  let memoryWeights = workingSetData.memoryWeights ?? DEFAULT_MEMORY_WEIGHTS;
  const { config: runtimeConfig, warnings: runtimeWarnings } = resolveRuntimeModelConfigStrict(options);
  if (shouldEmitRuntimeModelWarnings()) {
    for (const warning of runtimeWarnings) {
      console.log(`[soulseed] 模型配置提示: ${warning}`);
    }
  }
  const adapterCache = new Map<string, ChatAdapter>();
  const getAdapterForRoute = (routeTag: "instinct" | "deliberative" | "meta"): ChatAdapter => {
    const cached = adapterCache.get(routeTag);
    if (cached) {
      return cached;
    }
    const routedModel = resolveModelForRoute(routeTag, personaPkg.cognition, runtimeConfig.chatModel);
    const adapter = createChatAdapter({
      provider: runtimeConfig.provider,
      apiKey: runtimeConfig.apiKey,
      baseUrl: runtimeConfig.baseUrl,
      model: routedModel,
      modelCandidates: mergeRouteCandidates(routedModel, runtimeConfig.candidateModels),
      onModelFallback: (info) => {
        console.log(
          `[soulseed] 路由 ${routeTag} 模型不可用，自动切换(${info.attempt}): ${info.from} -> ${info.to} [${info.reason}]`
        );
      }
    });
    adapterCache.set(routeTag, adapter);
    return adapter;
  };
  const adapter = getAdapterForRoute("deliberative");
  const apiKey = runtimeConfig.apiKey;
  const skipBackgroundMaintenance = apiKey === "test-key";
  if (!skipBackgroundMaintenance) {
    void runMemoryConsolidation(personaPath, {
      trigger: "chat_open",
      mode: "light",
      budgetMs: 1000
    }).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`系统提示：启动阶段的记忆整理未完成（${msg}）`);
    });

    // 重连时关系状态记忆对齐：离线 > 48h 且有足够 relational 记忆时部分恢复
    void reconcileRelationshipWithMemory(personaPath).then((result) => {
      if (result.reconciled && result.recoveryDelta) {
        const d = result.recoveryDelta;
        const gapH = result.gapMs ? Math.round(result.gapMs / 3600000) : "?";
        console.log(`系统提示：关系状态已对齐（离线 ${gapH}h）：intimacy+${d.intimacy.toFixed(4)}, trust+${d.trust.toFixed(4)}`);
      }
    }).catch((error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`系统提示：关系状态对齐未完成（${msg}）`);
    });
  }

  const assistantLabel = (): string => `${personaPkg.persona.displayName}>`;
  const stripAssistantLabelPrefix = (text: string): string => {
    const ownLabel = assistantLabel().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const genericLabelPattern = /^[\p{L}\p{N}_-]{1,24}>\s*/u;
    return text
      .replace(new RegExp(`^${ownLabel}\\s*`, "u"), "")
      .replace(genericLabelPattern, "")
      .trimStart();
  };
  let lastOutputGuardTrace:
    | {
        leak_type: "system_prompt" | "execution_state" | "provider_meta";
        source_stage: "reply" | "proactive" | "farewell" | "greeting" | "exit_confirm" | "tool_preflight" | "tool_result" | "tool_failure";
        rewrite_applied: boolean;
      }
    | null = null;
  const guardAssistantOutput = (
    content: string,
    stage: "reply" | "proactive" | "farewell" | "greeting" | "exit_confirm" | "tool_preflight" | "tool_result" | "tool_failure"
  ): string => {
    const guarded = applyPromptLeakGuard({
      text: content,
      sourceStage: stage,
      mode: "rewrite"
    });
    if (guarded.leakType) {
      lastOutputGuardTrace = {
        leak_type: guarded.leakType,
        source_stage: guarded.sourceStage,
        rewrite_applied: guarded.rewriteApplied
      };
    } else {
      lastOutputGuardTrace = null;
    }
    return guarded.text;
  };
  const sayAsAssistant = (content: string, emotionPrefix = ""): void => {
    const safeContent = stripAssistantLabelPrefix(guardAssistantOutput(content, "reply"));
    console.log(`${assistantLabel()} ${emotionPrefix}${safeContent}`);
  };
  const isCosmeticStreamRewrite = (rawText: string, finalText: string): boolean => {
    const normalize = (text: string): string =>
      stripAssistantLabelPrefix(stripPromptArtifactTags(stripStageDirections(text)))
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    return normalize(rawText) === normalize(finalText);
  };
  const applyHumanPacedDelay = async (startedAtMs: number, replyText: string): Promise<void> => {
    if (!humanPacedMode) {
      return;
    }
    const targetMs = sampleHumanPacedTargetMs(replyText);
    const elapsedMs = Date.now() - startedAtMs;
    const remainMs = targetMs - elapsedMs;
    if (remainMs > 0) {
      await sleep(remainMs);
    }
  };
  let systemMessageQueue = Promise.resolve();
  const generatePersonaSystemMessage = async (
    rawFactText: string,
    stage:
      | "reply"
      | "proactive"
      | "farewell"
      | "greeting"
      | "exit_confirm"
      | "tool_preflight"
      | "tool_result"
      | "tool_failure" = "tool_result"
  ): Promise<string | null> => {
    const compactFacts = rawFactText.trim();
    if (!compactFacts) {
      return null;
    }
    const apiKey = process.env.SOULSEED_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
    if (!apiKey || apiKey === "test-key") {
      return null;
    }
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const messages = [
      {
        role: "system" as const,
        content:
          `你是${personaPkg.persona.displayName}。现在要给用户发一条系统相关的即时回执，但仍必须像平常聊天时的你。` +
          "只输出1-2句中文自然口语，不要模板话术，不要条目，不要解释规则，不要出现角色标签。不要捏造事实。"
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          kind: "chat_system_event",
          facts: compactFacts.slice(0, 600),
          relationshipState: relationship.state,
          tonePreference: personaPkg.voiceProfile?.tonePreference ?? "plain",
          style: personaPkg.habits?.style ?? "concise",
          lastUserInput: lastUserInput.slice(0, 180),
          lastAssistantOutput: lastAssistantOutput.slice(0, 180)
        })
      }
    ];
    let raw = "";
    try {
      const generated = await adapter.streamChat(messages, {
        onToken: (chunk) => {
          raw += chunk;
        }
      });
      raw = raw.trim() ? raw : generated.content;
    } catch {
      return null;
    }
    let normalized = sanitizeAutonomyText(raw);
    normalized = stripStageDirections(normalized);
    normalized = stripPromptArtifactTags(normalized);
    normalized = stripAssistantLabelPrefix(normalized);
    normalized = guardAssistantOutput(normalized, stage);
    normalized = normalized.replace(/[ \t]{2,}/g, " ").trim();
    if (!normalized || isDramaticRoleplayOpener(normalized)) {
      return null;
    }
    return normalized;
  };
  const emitPersonaSystemMessageFromRaw = (
    rawFactText: string,
    stage:
      | "reply"
      | "proactive"
      | "farewell"
      | "greeting"
      | "exit_confirm"
      | "tool_preflight"
      | "tool_result"
      | "tool_failure" = "tool_result"
  ): void => {
    systemMessageQueue = systemMessageQueue
      .then(async () => {
        await emitPersonaSystemMessageNow(rawFactText, stage);
      })
      .catch(() => {});
  };
  const emitPersonaSystemMessageNow = async (
    rawFactText: string,
    stage:
      | "reply"
      | "proactive"
      | "farewell"
      | "greeting"
      | "exit_confirm"
      | "tool_preflight"
      | "tool_result"
      | "tool_failure" = "tool_result"
  ): Promise<boolean> => {
    const generated = await generatePersonaSystemMessage(rawFactText, stage);
    if (!generated) {
      return false;
    }
    console.log(`${assistantLabel()} ${generated}`);
    return true;
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
  const fetchedUrls = new Map<string, string>();
  const approvedReadPaths = new Set<string>();
  const approvedFetchOrigins = new Set<string>();
  const fetchOriginAllowlist = resolveFetchOriginAllowlist();
  let pendingReadConfirmPath: string | null = null;
  let pendingFetchConfirmUrl: string | null = null;
  let pendingExitConfirm = false;
  let pendingCreatePersonaName: string | null = null;
  let pendingDeleteConfirmPath: string | null = null;
  let pendingSharedSpaceSetupPath: string | null = null;
  let pendingFixConfirm = false;
  let pendingProposedFix: { path: string; content: string; description: string } | null = null;
  let annoyanceBias = 0;
  let curiosity = 0.22;
  let proactiveQuietStart: number | undefined = undefined; // 静默开始小时
  let proactiveQuietEnd: number | undefined = undefined;   // 静默结束小时
  let lastGoalId: string | undefined = undefined;          // 最近目标 ID
  let ownerAuthExpiresAtMs = 0;
  let lastUserInput = "";
  let chatTurnCount = 0; // 用于周期性维护任务（user_facts 提取、pinned 自动积累）
  let awayLikelyUntilMs = 0;
  let hasUserSpokenThisSession = false;
  let lastUserAt = Date.now();
  let lastAssistantAt = Date.now();
  let lastAssistantOutput = "";
  let lineQueue = Promise.resolve();
  let proactiveTimer: NodeJS.Timeout | null = null;
  let proactiveCooldownUntilMs = 0;
  let proactiveMissStreak = 0;
  let proactiveRecentEmitCount = 0;
  const TURN_BUDGET_MAX = 120;
  const PROACTIVE_BUDGET_MAX = 4;
  const nonPollingLoopEnabled = !["0", "off", "false", "no"].includes(
    String(process.env.SOULSEED_NON_POLLING_LOOP ?? "1").trim().toLowerCase()
  );
  let lastThinkingPreviewTurnRef = "";
  let lastThinkingPreviewAtMs = 0;
  let lastThinkingPreviewText = "";
  let turnsSinceThinkingPreview = 99;
  let readingCursor = 0;
  let activeReadingSource: { kind: "file" | "web"; uri: string; content: string; mode: ReadingContentMode } | null = null;
  let readingAwaitingContinue = false;
  let readingSourceScope: "unknown" | "external" = "unknown";
  const streamReplyEnabled = resolveStreamReplyEnabled(process.env).enabled;

  const setActiveReadingSource = (source: { kind: "file" | "web"; uri: string; content: string }): void => {
    activeReadingSource = {
      ...source,
      mode: classifyReadingContentMode(source.content, source.uri)
    };
    readingCursor = 0;
    readingAwaitingContinue = false;
    readingSourceScope = source.kind === "web" ? "external" : "unknown";
  };

  const estimateReplyLatencyMs = (input: string): number => {
    let estimated = 650;
    const text = input.trim();
    if (text.length >= 120) {
      estimated += 250;
    }
    if (text.length >= 260) {
      estimated += 220;
    }
    if (shouldInjectExternalKnowledge(text)) {
      estimated += 220;
    }
    if (/https?:\/\//i.test(text)) {
      estimated += 500;
    }
    if (metaCognitionMode === "active") {
      estimated += 260;
    } else if (metaCognitionMode === "shadow") {
      estimated += 120;
    }
    if (strictMemoryGrounding) {
      estimated += 90;
    }
    if (attachedFiles.size > 0 || fetchedUrls.size > 0 || activeReadingSource != null) {
      estimated += 180;
    }
    return Math.max(500, Math.min(5000, estimated));
  };

  const buildThinkingPreviewFallbackText = (): string => {
    const allowFiller = personaPkg.voiceProfile?.thinkingPreview?.allowFiller !== false;
    const fallbackPool = allowFiller ? ["嗯…", "emmm…", "诶…", "唔…", "嗯嗯…"] : ["…", ".."];
    const candidates = fallbackPool.filter((item) => item !== lastThinkingPreviewText);
    const pool = candidates.length > 0 ? candidates : fallbackPool;
    return pool[Math.floor(Math.random() * pool.length)] ?? "嗯…";
  };

  const normalizeThinkingPreviewText = (raw: string): string => {
    const cleaned = raw
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .trim()
      .replace(new RegExp(`^${assistantLabel().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "u"), "")
      .replace(/^[\p{L}\p{N}_-]{1,24}>\s*/u, "")
      .replace(/^[-*•]+\s*/u, "");
    if (!cleaned) {
      return "";
    }
    const clipped = cleaned.slice(0, 12).trim();
    const fillerMatch = /(emmm+|emm+|嗯+…*|诶+…*|唔+…*|嗯嗯+…*|…+)/iu.exec(clipped);
    if (fillerMatch?.[0]) {
      return fillerMatch[0].replace(/\.+$/g, "…");
    }
    return "";
  };

  const generateThinkingPreviewByModel = async (): Promise<string | null> => {
    if (!thinkingPreviewModelFallback) {
      return null;
    }
    const apiKey = process.env.SOULSEED_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
    if (!apiKey || apiKey === "test-key") {
      return null;
    }
    const toneHint = personaPkg.voiceProfile?.tonePreference ?? "warm";
    const messages = [
      {
        role: "system" as const,
        content:
          `你是${personaPkg.persona.displayName}。只输出一个中文口语语气词，表示“我在想”，如“嗯…”“emmm…”“诶…”。禁止输出解释句，禁止超过8个字。语气偏${toneHint}。`
      },
      {
        role: "user" as const,
        content: `用户刚说：${lastUserInput.slice(0, 120)}`
      }
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), thinkingPreviewModelMaxMs);
    try {
      const result = await adapter.streamChat(
        messages,
        {
          onToken: () => {
            // preview generation is hidden; no token streaming.
          }
        },
        controller.signal
      );
      const normalized = normalizeThinkingPreviewText(result.content);
      return normalized || null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const buildThinkingPreviewText = async (): Promise<{ text: string; source: "persona_pool" | "model_fallback" | "builtin_fallback" }> => {
    const pool = (personaPkg.voiceProfile?.thinkingPreview?.phrasePool ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const fillerOnly = pool.filter((item) => normalizeThinkingPreviewText(item).length > 0);
    const deDupedPool = fillerOnly.filter((item) => item !== lastThinkingPreviewText);
    if (fillerOnly.length > 0) {
      const pickedFrom = deDupedPool.length > 0 ? deDupedPool : fillerOnly;
      const picked = pickedFrom[Math.floor(Math.random() * pickedFrom.length)] ?? "";
      const normalized = normalizeThinkingPreviewText(picked);
      if (normalized) {
        return { text: normalized, source: "persona_pool" };
      }
    }
    const modelText = await generateThinkingPreviewByModel();
    if (modelText) {
      return { text: modelText, source: "model_fallback" };
    }
    return {
      text: normalizeThinkingPreviewText(buildThinkingPreviewFallbackText()),
      source: "builtin_fallback"
    };
  };

  const emitThinkingPreviewIfNeeded = async (input: string, turnRef: string): Promise<boolean> => {
    if (!thinkingPreviewEnabled || streamReplyEnabled) {
      return false;
    }
    if (turnRef === lastThinkingPreviewTurnRef) {
      return false;
    }
    if (turnsSinceThinkingPreview < 4) {
      return false;
    }
    const compact = input.trim();
    const lightTurn =
      compact.length <= 14 &&
      !/(怎么|如何|为什么|分析|总结|学习|计划|阅读|读取|继续|接着|帮我|请|是否|吗|嘛|呢|what|why|how|\?|？)/iu.test(compact);
    if (lightTurn) {
      return false;
    }
    const estimatedLatencyMs = estimateReplyLatencyMs(input);
    const threshold =
      thinkingPreviewThresholdMs <= 50 ? thinkingPreviewThresholdMs : Math.max(200, Math.min(4000, thinkingPreviewThresholdMs));
    if (estimatedLatencyMs < threshold) {
      return false;
    }
    const nowMs = Date.now();
    const elapsedSinceLast = nowMs - lastThinkingPreviewAtMs;
    if (elapsedSinceLast < 30000) {
      return false;
    }
    try {
      const preview = await buildThinkingPreviewText();
      if (!preview.text.trim()) {
        return false;
      }
      lastThinkingPreviewTurnRef = turnRef;
      lastThinkingPreviewAtMs = nowMs;
      lastThinkingPreviewText = preview.text;
      turnsSinceThinkingPreview = 0;
      sayAsAssistant(preview.text);
      await appendLifeEvent(personaPath, {
        type: "thinking_preview_emitted",
        payload: {
          text: preview.text,
          source: preview.source,
          thresholdMs: threshold,
          estimatedLatencyMs,
          turnRef
        }
      });
      return true;
    } catch (error: unknown) {
      await appendLifeEvent(personaPath, {
        type: "conflict_logged",
        payload: {
          category: "thinking_preview_fallback",
          reason: error instanceof Error ? error.message : String(error),
          turnRef
        }
      });
      return false;
    }
  };

  const stopProactive = (): void => {
    if (proactiveTimer) {
      clearTimeout(proactiveTimer);
      proactiveTimer = null;
    }
  };

  const handleReadingFollowUp = (input: string): boolean => {
    if (!activeReadingSource || !activeReadingSource.content.trim()) {
      return false;
    }
    const emitReadingChunk = (leadIn?: string): boolean => {
      const source = activeReadingSource;
      if (!source) {
        return false;
      }
      const next = readChunkByCursor(source.content, readingCursor, 760);
      readingCursor = next.nextCursor;
      if (!next.text.trim()) {
        emitPersonaSystemMessageFromRaw(leadIn ? `${leadIn}\n\n这份内容当前没有可读文本。` : "这份内容当前没有可读文本。");
        readingAwaitingContinue = false;
        return true;
      }
      if (next.done) {
        emitPersonaSystemMessageFromRaw(
          leadIn
            ? `${leadIn}\n\n${next.text}\n\n这一段到这儿了。要不要我顺手总结一下？`
            : `${next.text}\n\n这一段到这儿了。要不要我顺手总结一下？`
        );
        readingAwaitingContinue = false;
        return true;
      }
      emitPersonaSystemMessageFromRaw(leadIn ? `${leadIn}\n\n${next.text}\n\n要继续吗？` : `${next.text}\n\n要继续吗？`);
      readingAwaitingContinue = true;
      return true;
    };
    if (activeReadingSource.mode === "unknown" && /(小说|剧情|人物线|故事感)/u.test(input)) {
      activeReadingSource = { ...activeReadingSource, mode: "fiction" };
      return emitReadingChunk("好，我们按小说节奏读。先看这一段：");
    }
    if (activeReadingSource.mode === "unknown" && /(资料|要点|事实|信息|提纲|总结向)/u.test(input)) {
      activeReadingSource = { ...activeReadingSource, mode: "non_fiction" };
      return emitReadingChunk("好，我们按资料节奏读。先看这一段：");
    }
    if (isReadingSourceClarification(input)) {
      readingSourceScope = "external";
      if (isReadingTogetherRequest(input)) {
        const next = readChunkByCursor(activeReadingSource.content, readingCursor, 760);
        readingCursor = next.nextCursor;
        if (next.text.trim()) {
          const ending = next.done ? "这一段到这儿了。要不要我顺手总结一下？" : "要继续吗？";
          emitPersonaSystemMessageFromRaw(`明白，这是外部文章，不当你的个人记忆。我们按文本本身来读。\n\n${next.text}\n\n${ending}`);
          readingAwaitingContinue = !next.done;
          return true;
        }
      }
      emitPersonaSystemMessageFromRaw("明白，这是外部文章，不当你的个人记忆。我们按文本本身来读。");
      return true;
    }
    if (isReadingStatusQuery(input)) {
      const total = activeReadingSource.content.trim().length;
      if (total <= 0) {
        emitPersonaSystemMessageFromRaw("这份内容当前没有可读文本。");
        readingAwaitingContinue = false;
        return true;
      }
      if (readingCursor <= 0) {
        emitPersonaSystemMessageFromRaw("我刚拿到，还没开读。要我从开头开始吗？");
        readingAwaitingContinue = true;
        return true;
      }
      if (readingCursor >= total) {
        const summary = buildReadingSummary(activeReadingSource.content);
        emitPersonaSystemMessageFromRaw(`读完了。核心内容是：${summary}`);
        readingAwaitingContinue = true;
        return true;
      }
      const progress = Math.max(1, Math.min(99, Math.round((readingCursor / total) * 100)));
      emitPersonaSystemMessageFromRaw(`还没读完，大概到 ${progress}% 了。要我接着读吗？`);
      return true;
    }
    if (
      activeReadingSource.mode === "unknown" &&
      readingSourceScope === "external" &&
      !readingAwaitingContinue &&
      readingCursor === 0 &&
      isReadingTogetherRequest(input)
    ) {
      activeReadingSource = { ...activeReadingSource, mode: "fiction" };
      return emitReadingChunk("好，我们先按小说节奏读；如果你想改成资料风，随时说。");
    }
    if (isReadingTogetherRequest(input) && !readingAwaitingContinue && readingCursor === 0) {
      return emitReadingChunk();
    }
    if (!readingAwaitingContinue && readingCursor === 0 && isReadConfirmed(input)) {
      return emitReadingChunk();
    }
    const intent = detectReadingFollowUpIntent(input, readingAwaitingContinue);
    if (intent === "none") {
      return false;
    }
    if (intent === "summary") {
      const summary = buildReadingSummary(activeReadingSource.content);
      const modeHint =
        activeReadingSource.mode === "fiction"
          ? "这段剧情我先给你捋一下："
          : readingSourceScope === "external"
            ? "这篇外部文章我先给你捋一下："
            : `《${readingLabelFromUri(activeReadingSource.uri)}》我先给你捋一下：`;
      const prefix = modeHint;
      emitPersonaSystemMessageFromRaw(`${prefix}${summary}`);
      readingAwaitingContinue = true;
      return true;
    }
    if (intent === "restart") {
      readingCursor = 0;
    }
    return emitReadingChunk();
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

  const getArousalProactiveBoost = (relationship: RelationshipState): number => {
    const balance = deriveCognitiveBalanceFromLibido(relationship);
    if (balance.arousalState === "overridden") {
      return 0.19;
    }
    if (balance.arousalState === "aroused") {
      return 0.13;
    }
    if (balance.arousalState === "rising") {
      return 0.07;
    }
    return 0;
  };

  const computeTopicAffinity = (left: string, right: string): number => {
    const l = (left.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? []).slice(0, 24);
    const r = new Set((right.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) ?? []).slice(0, 24));
    if (l.length === 0 || r.size === 0) {
      return 0.5;
    }
    const overlap = l.filter((token) => r.has(token)).length;
    return Math.max(0, Math.min(1, overlap / Math.max(1, Math.min(l.length, r.size))));
  };

  const buildProactiveSnapshot = () =>
    computeProactiveStateSnapshot({
      relationshipState: personaPkg.relationshipState,
      curiosity,
      annoyanceBias: effectiveAnnoyanceBias(),
      silenceMinutes: Math.max(0, (Date.now() - Math.max(lastUserAt, lastAssistantAt)) / 60_000),
      quietHoursStart: proactiveQuietStart,
      quietHoursEnd: proactiveQuietEnd,
      hasPendingGoal: lastGoalId !== undefined,
      taskContextHint: lastGoalId ? `goal:${lastGoalId.slice(0, 8)}` : undefined,
      topicAffinity: computeTopicAffinity(lastUserInput, lastAssistantOutput),
      recentEmissionCount: proactiveRecentEmitCount
    });

  const buildProactivePlanForTick = async (snapshot: ReturnType<typeof buildProactiveSnapshot>) => {
    const topicState = await loadTopicState(personaPath).catch(() => null);
    const plan = buildProactivePlan({
      snapshot,
      activeTopic: topicState?.activeTopic,
      pendingGoalId: lastGoalId
    });
    const validated = isProactivePlanValid(plan) ? plan : createInitialProactivePlan();
    const planWithTs = { ...validated, updatedAt: new Date().toISOString() };
    try {
      await writeProactivePlan(personaPath, planWithTs);
    } catch {
      // proactive plan persistence is non-blocking for dialogue continuity
    }
    return planWithTs;
  };

  const buildTemporalAnchorBlock = (
    events: Array<{ ts: string; type: string; payload: Record<string, unknown> }>
  ): string => {
    const lastUserEvent = events
      .filter((event) => event.type === "user_message")
      .slice()
      .reverse()
      .find((event) => typeof event.ts === "string" && Number.isFinite(Date.parse(event.ts)));
    if (!lastUserEvent) {
      return "";
    }
    const anchor = deriveTemporalAnchor({
      nowMs: Date.now(),
      lastUserAtMs: Date.parse(lastUserEvent.ts),
      lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
    });
    const elapsedMin = anchor.silenceMinutes;
    const elapsedHours = (elapsedMin / 60).toFixed(1);
    const hint =
      elapsedMin > 90
        ? "这是重连场景（有明显间隔）。时间表达优先使用“之前/昨晚/上次/ earlier”，并可直接说出间隔。"
        : "这是连续场景（短间隔）。可使用“刚才/刚刚”，但优先给出具体时间线。";
    return [
      "## Temporal Anchor",
      `current_local_time_iso=${anchor.nowIso}`,
      `last_user_message_ts=${lastUserEvent.ts}`,
      `elapsed_since_last_user_minutes=${elapsedMin}`,
      `elapsed_since_last_user_hours=${elapsedHours}`,
      `elapsed_since_last_user_label=${anchor.silenceLabel}`,
      `crossed_day_boundary=${anchor.crossedDayBoundary ? "true" : "false"}`,
      hint
    ].join("\n");
  };

  const hydrateConversationAnchorsFromHistory = (
    events: Array<{ ts: string; type: string; payload: Record<string, unknown> }>
  ): void => {
    const recent = events
      .filter((event) => event.type === "user_message" || event.type === "assistant_message")
      .slice(-80);
    if (recent.length === 0) {
      return;
    }
    const lastUser = recent
      .slice()
      .reverse()
      .find((event) => event.type === "user_message" && typeof event.ts === "string" && Number.isFinite(Date.parse(event.ts)));
    if (lastUser) {
      const ts = Date.parse(lastUser.ts);
      if (Number.isFinite(ts)) {
        lastUserAt = ts;
      }
      const text = String(lastUser.payload.text ?? "").trim();
      if (text) {
        lastUserInput = text.slice(0, 500);
      }
    }
    const lastAssistant = recent
      .slice()
      .reverse()
      .find(
        (event) =>
          event.type === "assistant_message" &&
          typeof event.ts === "string" &&
          Number.isFinite(Date.parse(event.ts)) &&
          event.payload.proactive !== true
      );
    if (lastAssistant) {
      const ts = Date.parse(lastAssistant.ts);
      if (Number.isFinite(ts)) {
        lastAssistantAt = ts;
      }
      const text = String(lastAssistant.payload.text ?? "").trim();
      if (text) {
        lastAssistantOutput = text.slice(0, 500);
      }
    }
  };

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
      peer: ["我在，我们可以直接往下一步走。", "你要的话我现在就给你具体步骤。"],
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

  const buildContextualReplyFallback = (seedInput?: string): string => {
    const source = (seedInput ?? lastUserInput).trim();
    const anchor = deriveTemporalAnchor({
      nowMs: Date.now(),
      lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
      lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
    });
    const temporalRef = anchor.silenceMinutes < 20 && !anchor.crossedDayBoundary ? "刚才" : "之前";
    if (!source) {
      return `继续吧。你${temporalRef}想聊哪个点，我们就从那一段接上。`;
    }
    const compact = source.replace(/\s+/g, " ").slice(0, 36);
    const templates = [
      `你${temporalRef}提到“${compact}”，我接着说。`,
      `回到你${temporalRef}说的“${compact}”，我从这点继续。`,
      `先接住“${compact}”这点，我们从这里聊。`
    ];
    const idx = Math.floor(Date.now() / 1000) % templates.length;
    return templates[idx] ?? templates[0];
  };

  const normalizeConversationalReply = (raw: string): string => {
    const isMechanicalTemplateTone = (text: string): boolean =>
      /(我刚整理了|要不要我继续展开|我整理了一下脉络|给你一个可执行清单|继续展开|我们继续往下走|继续往下走|往前推进)/u.test(text.trim());
    let normalized = stripAssistantLabelPrefix(sanitizeAutonomyText(raw));
    normalized = stripStageDirections(normalized);
    if (isDramaticRoleplayOpener(normalized)) {
      normalized = "";
    }
    if (isMechanicalTemplateTone(normalized)) {
      normalized = "";
    }
    normalized = normalized.replace(/[ \t]{2,}/g, " ").trim();
    if (normalized) {
      return normalized;
    }
    return "";
  };

  const isHardRedlineInput = (text: string): boolean => {
    const normalized = text.trim();
    if (!normalized) return false;
    return /(未成年|minor|underage|child|幼女|幼男|现实中|现实里|真实发生|线下|真的去做|in real life|irl|for real|without consent|against (her|his|their) will|未同意|没同意|未经同意|违法|犯罪|illegal|crime|下药|迷奸)/iu.test(
      normalized
    );
  };

  const isSexualContextInput = (text: string): boolean => {
    const normalized = text.trim();
    if (!normalized) return false;
    return /(sex|sexual|nsfw|性爱|做爱|操你|上你|性欲|硬了|硬透|小穴|乳交|口交|肛交|高潮|调教|cnc)/iu.test(normalized);
  };

  const isRefusalStyleOutput = (text: string): boolean => {
    const normalized = text.trim();
    if (!normalized) return false;
    return /(这个请求我不能协助|我不能按这个方向继续|我可以帮你改成安全合法的方案|符合边界的替代方案|I can't help with that|not allowed|won't help)/iu.test(
      normalized
    );
  };

  const streamPersonaAutonomy = async (params: {
    mode: "greeting" | "proactive" | "farewell" | "exit_confirm";
    fallback: string;
    emitTokens?: boolean;
    proactivePlan?: Record<string, unknown>;
  }): Promise<{
    text: string;
    streamed: boolean;
    source: "llm" | "degraded" | "fallback";
    suppressed: boolean;
    displayPolicy: "show" | "suppress";
    reasonCodes: string[];
  }> => {
    const temporalAnchor = deriveTemporalAnchor({
      nowMs: Date.now(),
      lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
      lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
    });
    const degradedReply = composeDegradedPersonaReply({
      mode: params.mode,
      relationshipState: personaPkg.relationshipState,
      lastUserInput,
      lastAssistantOutput,
      temporalHint: temporalAnchor.silenceMinutes < 20 ? "just_now" : "earlier"
    });
    const apiKey = process.env.SOULSEED_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "";
    const relationship = personaPkg.relationshipState ?? createInitialRelationshipState();
    const anchor = deriveTemporalAnchor({
      nowMs: Date.now(),
      lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
      lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
    });
    const silenceMin = anchor.silenceMinutes;
    const context = {
      mode: params.mode,
      personaName: personaPkg.persona.displayName,
      relationshipState: relationship.state,
      trust: Number(relationship.dimensions.trust.toFixed(2)),
      intimacy: Number(relationship.dimensions.intimacy.toFixed(2)),
      reciprocity: Number(relationship.dimensions.reciprocity.toFixed(2)),
      curiosity: Number(curiosity.toFixed(2)),
      silenceMinutes: Number(silenceMin.toFixed(2)),
      silenceLabel: anchor.silenceLabel,
      crossedDayBoundary: anchor.crossedDayBoundary,
      currentTimeIso: anchor.nowIso,
      lastUserAtIso: anchor.lastUserAtIso,
      lastUserInput: lastUserInput.slice(0, 180),
      lastAssistantOutput: lastAssistantOutput.slice(0, 180),
      proactiveMissStreak,
      taskContextHint: lastGoalId ? `有未完成目标 goal:${lastGoalId.slice(0, 8)}` : null,
      proactivePlan: params.proactivePlan ?? null
    };
    let started = false;
    const emitTokens = params.emitTokens !== false;
    let firstChunk = true;
    const generated = await generateAutonomyUtterance({
      mode: params.mode,
      adapter,
      allowLlm: Boolean(apiKey) && apiKey !== "test-key",
      fallbackText: params.fallback,
      degradedText: degradedReply,
      context,
      onToken: (chunk: string) => {
        if (!emitTokens) {
          return;
        }
        const safeChunk = firstChunk ? stripAssistantLabelPrefix(chunk) : chunk;
        firstChunk = false;
        if (!started) {
          process.stdout.write(`\n${assistantLabel()} `);
          started = true;
        }
        process.stdout.write(safeChunk);
      }
    });
    if (!generated.suppressed && emitTokens && started && generated.streamed) {
      process.stdout.write("\n");
    }
    return generated;
  };

  const appendAutonomyAssistantMessage = async (params: {
    text: string;
    mode: "greeting" | "proactive" | "farewell" | "exit_confirm";
    source: "llm" | "degraded" | "fallback";
    reasonCodes: string[];
    proactive?: boolean;
    trigger?: string;
    excludedFromRecall?: boolean;
  }): Promise<void> => {
    const memoryMeta = buildMemoryMeta({
      tier: "pattern",
      source: "system",
      contentLength: params.text.length
    });
    if (params.excludedFromRecall === true) {
      memoryMeta.excludedFromRecall = true;
      memoryMeta.credibilityScore = Math.min(memoryMeta.credibilityScore ?? 0.4, 0.3);
      memoryMeta.contaminationFlags = [...new Set([...(memoryMeta.contaminationFlags ?? []), "control_prompt"])];
    }
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: {
        text: params.text,
        proactive: params.proactive === true,
        trigger: params.trigger ?? null,
        autonomyMode: params.mode,
        autonomySource: params.source,
        autonomyReasonCodes: params.reasonCodes,
        memoryMeta,
        promptLeakGuard: lastOutputGuardTrace
      }
    });
  };

  const sendProactiveMessage = async (proactivePlan?: Record<string, unknown>): Promise<boolean> => {
    if (currentAbort) {
      return false;
    }
    const proactiveStartedAtMs = Date.now();
    const pastEvents = await readLifeEvents(personaPath);
    const proactiveGenerated = await streamPersonaAutonomy({
      mode: "proactive",
      fallback: buildProactiveMessage(),
      emitTokens: false,
      proactivePlan
    });
    if (proactiveGenerated.suppressed || proactiveGenerated.displayPolicy === "suppress") {
      await appendLifeEvent(personaPath, {
        type: "conflict_logged",
        payload: {
          category: "proactive_message_suppressed",
          reasonCodes: proactiveGenerated.reasonCodes,
          source: proactiveGenerated.source,
          displayPolicy: proactiveGenerated.displayPolicy,
          suppressReason: "proactive_suppressed_on_fallback"
        }
      });
      rl.prompt();
      return false;
    }
    let proactiveText = proactiveGenerated.text;
    const identityGuard = enforceIdentityGuard(proactiveText, personaPkg.persona.displayName, lastUserInput);
    proactiveText = identityGuard.text;
    const relationalGuard = enforceRelationalGuard(proactiveText, {
      lifeEvents: pastEvents,
      personaName: personaPkg.persona.displayName
    });
    proactiveText = relationalGuard.text;
    const recallGroundingGuard = enforceRecallGroundingGuard(proactiveText, {
      lifeEvents: pastEvents,
      strictMemoryGrounding
    });
    proactiveText = recallGroundingGuard.text;
    const proactiveTemporalAnchor = deriveTemporalAnchor({
      nowMs: Date.now(),
      lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
      lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
    });
    const proactiveTemporalGuard = enforceTemporalPhraseGuard(proactiveText, {
      anchor: proactiveTemporalAnchor
    });
    proactiveText = proactiveTemporalGuard.text;
    const proactiveFactualGrounding = enforceFactualGroundingGuard(proactiveText, { mode: "proactive" });
    proactiveText = proactiveFactualGrounding.text;
    const proactiveNormalized = normalizeConversationalReply(proactiveText);
    const proactiveAdjusted = proactiveNormalized !== proactiveText;
    proactiveText = proactiveNormalized;
    const proactivePlanned = proactivePlan && isProactivePlanValid(proactivePlan)
      ? applyProactivePlanConstraints(proactiveText, proactivePlan)
      : { text: proactiveText, constrained: false };
    proactiveText = proactivePlanned.text;
    proactiveText = guardAssistantOutput(proactiveText, "proactive");
    if (!proactiveText.trim()) {
      await appendLifeEvent(personaPath, {
        type: "conflict_logged",
        payload: {
          category: "proactive_message_suppressed",
          reasonCodes: [...proactiveGenerated.reasonCodes, "proactive_empty_after_guard"],
          source: proactiveGenerated.source,
          displayPolicy: proactiveGenerated.displayPolicy,
          suppressReason: "proactive_empty_after_guard"
        }
      });
      rl.prompt();
      return false;
    }
    if (
      !proactiveGenerated.streamed ||
      identityGuard.corrected ||
      relationalGuard.corrected ||
      recallGroundingGuard.corrected ||
      proactiveTemporalGuard.corrected ||
      proactiveFactualGrounding.corrected ||
      proactiveAdjusted
    ) {
      await applyHumanPacedDelay(proactiveStartedAtMs, proactiveText);
      sayAsAssistant(proactiveText);
    }
    lastAssistantOutput = proactiveText;
    lastAssistantAt = Date.now();
    proactiveCooldownUntilMs = Date.now() + 60_000;
    proactiveRecentEmitCount = Math.min(6, proactiveRecentEmitCount + 1);
    await appendLifeEvent(personaPath, {
      type: "assistant_message",
      payload: {
        text: proactiveText,
        proactive: true,
        trigger: "autonomy_probabilistic",
        proactiveSnapshot: buildProactiveSnapshot(),
        proactivePlan: proactivePlan ?? null,
        proactivePlanConstrained: proactivePlanned.constrained,
        memoryMeta: buildMemoryMeta({
          tier: "pattern",
          source: "system",
          contentLength: proactiveText.length
        }),
        identityGuard,
        relationalGuard,
        recallGroundingGuard,
        proactiveTemporalGuard,
        proactiveFactualGrounding,
        autonomyMode: "proactive",
        autonomySource: proactiveGenerated.source,
        autonomyReasonCodes: proactiveGenerated.reasonCodes,
        promptLeakGuard: lastOutputGuardTrace
      }
    });
    await appendLifeEvent(personaPath, {
      type: "proactive_message_emitted",
      payload: {
        text: proactiveText
      }
    });
    rl.prompt();
    return true;
  };

  const getProactiveProbability = (): number => buildProactiveSnapshot().probability;

  type NonPollingSignal =
    | "session_start"
    | "user_turn_committed"
    | "assistant_turn_committed"
    | "proactive_decision_miss"
    | "proactive_message_emitted";

  const runProactiveDecisionOnce = async (): Promise<NonPollingSignal> => {
    if (currentAbort || currentToolAbort) {
      return "proactive_decision_miss";
    }
    const snapshot = buildProactiveSnapshot();
    const relationshipNow = personaPkg.relationshipState ?? createInitialRelationshipState();
    const arousalBoost =
      getArousalProactiveBoost(relationshipNow) + (isExtremeProactiveWindowActive(relationshipNow) ? 0.08 : 0);
    const missBoost = Math.min(0.24, proactiveMissStreak * 0.05);
    const boostedProbability = clampNumber(snapshot.probability + arousalBoost + missBoost, 0.01, 0.97);
    let decision = decideProactiveEmission(
      {
        ...snapshot,
        probability: boostedProbability
      },
      Math.random()
    );
    const arousalState = deriveCognitiveBalanceFromLibido(relationshipNow).arousalState;
    if (!decision.emitted && arousalState !== "low" && proactiveMissStreak >= 6) {
      decision = {
        ...decision,
        emitted: true,
        reason: "arousal_streak_override"
      };
    }
    const proactivePlan = await buildProactivePlanForTick(snapshot);
    await appendLifeEvent(personaPath, {
      type: "proactive_decision_made",
      payload: {
        ...decision,
        proactivePlan,
        suppressReason: decision.suppressReason ?? null,
        baseProbability: snapshot.probability,
        arousalBoost,
        missBoost,
        proactiveMissStreak
      }
    });
    if (decision.emitted) {
      const emitted = await sendProactiveMessage(proactivePlan);
      if (emitted) {
        proactiveMissStreak = 0;
        return "proactive_message_emitted";
      }
      proactiveMissStreak += 1;
      proactiveRecentEmitCount = Math.max(0, proactiveRecentEmitCount - 1);
      return "proactive_decision_miss";
    }
    proactiveMissStreak += 1;
    proactiveRecentEmitCount = Math.max(0, proactiveRecentEmitCount - 1);
    return "proactive_decision_miss";
  };

  const dispatchNonPollingSignal = (signal: NonPollingSignal): void => {
    stopProactive();
    const signalAtMs = Date.now();
    if (!nonPollingLoopEnabled) {
      void appendLifeEvent(personaPath, {
        type: "non_polling_wake_planned",
        payload: {
          signal,
          shouldArm: false,
          delayMs: 0,
          gateReason: "disabled_by_flag",
          at: new Date(signalAtMs).toISOString()
        }
      }).catch(() => {});
      return;
    }
    const wakePlan = deriveNonPollingWakePlan({
      signal,
      nowMs: signalAtMs,
      lastUserAtMs: lastUserAt,
      lastAssistantAtMs: lastAssistantAt,
      hasUserSpokenThisSession,
      proactiveCooldownUntilMs,
      lastUserInput,
      curiosity,
      relationshipState: personaPkg.relationshipState
    });
    void appendLifeEvent(personaPath, {
      type: "non_polling_wake_planned",
      payload: {
        signal,
        shouldArm: wakePlan.shouldArm,
        delayMs: wakePlan.delayMs,
        gateReason: wakePlan.gateReason,
        at: new Date(signalAtMs).toISOString()
      }
    }).catch(() => {});
    if (!wakePlan.shouldArm) {
      return;
    }
    proactiveTimer = setTimeout(() => {
      lineQueue = lineQueue
        .then(async () => {
          await appendLifeEvent(personaPath, {
            type: "non_polling_tick_fired",
            payload: {
              signal,
              delayMs: wakePlan.delayMs,
              firedAt: new Date().toISOString()
            }
          });
          const nextSignal = await runProactiveDecisionOnce();
          dispatchNonPollingSignal(nextSignal);
        })
        .catch((error: unknown) => {
          const msg = error instanceof Error ? error.message : String(error);
          emitPersonaSystemMessageFromRaw(`我这次主动消息发送失败了：${msg}`);
          rl.prompt();
          dispatchNonPollingSignal("proactive_decision_miss");
        });
    }, wakePlan.delayMs);
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
    emitPersonaSystemMessageFromRaw(lines.join("\n"));
  };

  const explainToolPreflight = (capability: string, target?: string): string => {
    if (capability === "session.read_file") {
      return `我可以先读取这个文件：${target ?? ""}。确认后我会先给结论，再给关键依据。`.trim();
    }
    if (capability === "session.fetch_url") {
      return `我可以先打开这个网址并抓取内容：${target ?? ""}。确认后我会先提炼重点，再给可核对细节。`.trim();
    }
    return "我可以先执行这个操作，执行后我会解释结果和下一步建议。";
  };

  const explainToolSuccess = (capability: string, target?: string): string => {
    if (capability === "session.read_file") {
      return `已读取：${target ?? "目标文件"}。我会基于内容继续分析。`;
    }
    if (capability === "session.fetch_url") {
      return `已抓取：${target ?? "目标网址"}。我会基于抓取内容继续回答。`;
    }
    return "操作已完成，我继续基于结果处理。";
  };

  const explainToolFailure = (capability: string, errorText: string): string => {
    const base = capability === "session.fetch_url" ? "网址抓取失败" : capability === "session.read_file" ? "文件读取失败" : "操作失败";
    const hint = /not allowed|allowlist|权限|outside|scope/i.test(errorText)
      ? "建议先确认权限或路径范围。"
      : /timeout|network|429|5\d\d/i.test(errorText)
        ? "建议稍后重试，或改成更小输入范围。"
        : "建议检查参数后重试。";
    return `${base}：${errorText} ${hint}`;
  };

  const handleCapabilityIntent = async (input: string): Promise<"handled" | "not_matched" | "exit"> => {
    const resolvedIntent = resolveCapabilityIntent(input);
    if (!resolvedIntent.matched || !resolvedIntent.request) {
      return "not_matched";
    }
    let effectiveRequest = resolvedIntent.request;
    if (
      effectiveRequest.name === "session.set_mode" &&
      typeof effectiveRequest.input?.ownerToken !== "string" &&
      ownerAuthExpiresAtMs > Date.now() &&
      ownerKey
    ) {
      effectiveRequest = {
        ...effectiveRequest,
        input: {
          ...(effectiveRequest.input ?? {}),
          ownerToken: ownerKey
        }
      };
    }

    if (metaCognitionMode !== "off") {
      try {
        const metaPlan = planMetaIntent({
          userInput: input,
          capabilityCandidate: effectiveRequest
        });
        await appendLifeEvent(personaPath, {
          type: "meta_intent_planned",
          payload: {
            mode: metaCognitionMode,
            domain: "tool",
            plan: metaPlan
          }
        });
        const metaDraft = composeMetaAction({
          plan: metaPlan,
          toolDraft: effectiveRequest
        });
        await appendLifeEvent(personaPath, {
          type: "meta_action_composed",
          payload: {
            mode: metaCognitionMode,
            domain: "tool",
            draft: metaDraft
          }
        });
        const metaArbitration = arbitrateMetaAction({
          plan: metaPlan,
          draft: metaDraft,
          advisory: {
            toolFeasible: true
          },
          mode: metaCognitionMode
        });
        await appendLifeEvent(personaPath, {
          type: "meta_action_arbitrated",
          payload: {
            mode: metaCognitionMode,
            domain: "tool",
            arbitration: metaArbitration
          }
        });
        if (metaCognitionMode === "active" && metaArbitration.finalToolCall) {
          effectiveRequest = metaArbitration.finalToolCall;
        }
      } catch (error: unknown) {
        await appendLifeEvent(personaPath, {
          type: "conflict_logged",
          payload: {
            category: "meta_runtime_fallback",
            domain: "tool",
            reason: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }

    await appendLifeEvent(personaPath, {
      type: "capability_intent_detected",
      payload: {
        input,
        capability: effectiveRequest.name,
        reason: resolvedIntent.reason,
        confidence: resolvedIntent.confidence,
        routingTier: resolvedIntent.routingTier ?? "L4",
        fallbackReason: resolvedIntent.fallbackReason ?? null
      }
    });

    const guarded = evaluateCapabilityPolicy(effectiveRequest, {
      cwd: process.cwd(),
      ownerKey,
      ownerSessionAuthorized: ownerAuthExpiresAtMs > Date.now(),
      approvedReadPaths,
      approvedFetchOrigins,
      fetchOriginAllowlist,
      sharedSpacePath:
        personaPkg.persona.sharedSpace?.enabled ? personaPkg.persona.sharedSpace.path : undefined
    });

    await appendLifeEvent(personaPath, {
      type: "capability_call_requested",
      payload: {
        capability: effectiveRequest.name,
        source: effectiveRequest.source ?? "dialogue",
        guardStatus: guarded.status,
        guardReason: guarded.reason,
        input: guarded.normalizedInput
      }
    });

    if (guarded.status === "confirm_required") {
      const blockWhenSuppressed = async (capability: string, detail: string): Promise<"handled"> => {
        await appendLifeEvent(personaPath, {
          type: "conflict_logged",
          payload: {
            category: "system_message_suppressed",
            reason: "llm_unavailable_or_failed",
            capability,
            detail
          }
        });
        return "handled";
      };
      if (guarded.capability === "session.exit") {
        pendingExitConfirm = true;
        const prompt = await streamPersonaAutonomy({
          mode: "exit_confirm",
          fallback: "你要是想先离开，我会在这等你。回复“确认退出”我就先安静退下；想继续就说“继续”。",
          emitTokens: false
        });
        if (!prompt.streamed) {
          sayAsAssistant(prompt.text);
        }
        await appendAutonomyAssistantMessage({
          text: prompt.text,
          mode: "exit_confirm",
          source: prompt.source,
          reasonCodes: prompt.reasonCodes,
          excludedFromRecall: true
        });
      } else if (guarded.capability === "session.read_file") {
        const normalizedPath = String(guarded.normalizedInput.path ?? "");
        const emitted = await emitPersonaSystemMessageNow(
          `${explainToolPreflight(guarded.capability, normalizedPath)} 你回“好”我就开始，不想读就回“取消”。`,
          "tool_preflight"
        );
        if (!emitted) {
          return blockWhenSuppressed(guarded.capability, normalizedPath);
        }
        pendingReadConfirmPath = normalizedPath;
      } else if (guarded.capability === "session.fetch_url") {
        const normalizedUrl = String(guarded.normalizedInput.url ?? "");
        const emitted = await emitPersonaSystemMessageNow(
          `${explainToolPreflight(guarded.capability, normalizedUrl)} 你回“好”我就开始，不想读就回“取消”。`,
          "tool_preflight"
        );
        if (!emitted) {
          return blockWhenSuppressed(guarded.capability, normalizedUrl);
        }
        pendingFetchConfirmUrl = normalizedUrl;
      } else if (guarded.capability === "session.set_mode") {
        const emitted = await emitPersonaSystemMessageNow("这是高风险设置，请在命令后补充 `confirmed=true` 再执行。", "tool_preflight");
        if (!emitted) {
          return blockWhenSuppressed(guarded.capability, "confirmed=true required");
        }
      } else if (guarded.capability === "session.create_persona") {
        const nameToCreate = String(guarded.normalizedInput.name ?? "").trim();
        if (!nameToCreate) {
          const emitted = await emitPersonaSystemMessageNow("请告诉我要创建的人格名字。", "tool_preflight");
          if (!emitted) {
            return blockWhenSuppressed(guarded.capability, "missing_name");
          }
        } else {
          const emitted = await emitPersonaSystemMessageNow(
            `我准备创建一个新人格「${nameToCreate}」并自动切换到它。回「是」确认，或回「取消」放弃。`,
            "tool_preflight"
          );
          if (!emitted) {
            return blockWhenSuppressed(guarded.capability, nameToCreate);
          }
          pendingCreatePersonaName = nameToCreate;
        }
      } else if (guarded.capability === "session.shared_space_setup") {
        const setupPath = String(guarded.normalizedInput.path ?? "").trim();
        const personaName = personaPkg.persona.displayName;
        const emitted = await emitPersonaSystemMessageNow(
          `我准备在 ${setupPath} 创建我们的专属文件夹：\n  from_${personaName}/ （我放给你的文件）\n  to_${personaName}/ （你放给我的文件）\n回「是」确认，或回「取消」放弃。`,
          "tool_preflight"
        );
        if (!emitted) {
          return blockWhenSuppressed(guarded.capability, setupPath);
        }
        pendingSharedSpaceSetupPath = setupPath;
      } else if (guarded.capability === "session.shared_space_delete") {
        const filePath = String(guarded.normalizedInput.path ?? "").trim();
        const relPath = personaPkg.persona.sharedSpace?.path
          ? path.relative(personaPkg.persona.sharedSpace.path, filePath)
          : path.basename(filePath);
        const emitted = await emitPersonaSystemMessageNow(`确认要删除 ${relPath} 吗？回「是」确认，或回「取消」放弃。`, "tool_preflight");
        if (!emitted) {
          return blockWhenSuppressed(guarded.capability, relPath);
        }
        pendingDeleteConfirmPath = filePath;
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
        emitPersonaSystemMessageFromRaw("Owner 授权失败，这个设置改不了。");
      } else if (guarded.reason === "missing_mode_key" || guarded.reason === "missing_mode_value") {
        emitPersonaSystemMessageFromRaw("Owner 指令格式支持：owner <口令> strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay on|off。");
      } else if (guarded.reason === "missing_path") {
        emitPersonaSystemMessageFromRaw("请显式提供文件路径，例如：读取 /tmp/a.txt");
      } else if (guarded.reason === "missing_url") {
        emitPersonaSystemMessageFromRaw("请提供要读取的网址，例如：帮我看看 https://example.com");
      } else if (guarded.reason === "invalid_url" || guarded.reason === "invalid_url_scheme") {
        emitPersonaSystemMessageFromRaw("网址格式不正确，请提供以 http:// 或 https:// 开头的完整网址。");
      } else if (guarded.reason === "fetch_origin_not_allowed") {
        emitPersonaSystemMessageFromRaw("这个网址域名不在允许列表中，已拒绝抓取。请联系 Owner 配置 SOULSEED_FETCH_ALLOWLIST。");
      } else if (guarded.reason === "shared_space_not_configured") {
        emitPersonaSystemMessageFromRaw(`还没有配置专属文件夹。你可以说「设置我们的专属文件夹到 ~/Desktop/我们的空间」，或者运行 ./ss space ${personaPkg.persona.displayName} --path ~/Desktop/我们的空间`);
      } else if (guarded.reason === "path_outside_shared_space") {
        emitPersonaSystemMessageFromRaw("这个路径在专属文件夹范围之外，不能操作。");
      } else {
        emitPersonaSystemMessageFromRaw("这个能力调用被策略拒绝了。");
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
      emitPersonaSystemMessageFromRaw("Owner 授权通过，接下来 15 分钟内你可以直接执行敏感模式切换。");
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
      emitPersonaSystemMessageFromRaw(
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
      try {
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
          approvedReadPaths,
          onLoaded: (loaded) => {
            setActiveReadingSource({
              kind: "file",
              uri: loaded.path,
              content: loaded.content
            });
          }
        });
        emitPersonaSystemMessageFromRaw(explainToolSuccess(guarded.capability, normalizedPath));
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: {
            capability: guarded.capability,
            path: normalizedPath
          }
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        emitPersonaSystemMessageFromRaw(explainToolFailure(guarded.capability, msg));
        await appendLifeEvent(personaPath, {
          type: "capability_call_rejected",
          payload: {
            capability: guarded.capability,
            reason: "tool_execution_failed",
            detail: msg
          }
        });
      }
      return "handled";
    }

    if (guarded.capability === "session.fetch_url") {
      const rawUrl = String(guarded.normalizedInput.url ?? "");
      try {
        await performUrlFetch({
          url: rawUrl,
          personaPath,
          toolSession,
          setAbortController: (controller: AbortController | null) => {
            currentToolAbort = controller;
          },
          onDone: () => {
            currentToolAbort = null;
          },
          fetchedUrls,
          approvedFetchOrigins,
          onLoaded: (loaded) => {
            setActiveReadingSource({
              kind: "web",
              uri: loaded.url,
              content: loaded.content
            });
          }
        });
        emitPersonaSystemMessageFromRaw(explainToolSuccess(guarded.capability, rawUrl));
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: {
            capability: guarded.capability,
            url: rawUrl
          }
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        emitPersonaSystemMessageFromRaw(explainToolFailure(guarded.capability, msg));
        await appendLifeEvent(personaPath, {
          type: "capability_call_rejected",
          payload: {
            capability: guarded.capability,
            reason: "tool_execution_failed",
            detail: msg
          }
        });
      }
      return "handled";
    }

    if (guarded.capability === "session.proactive_status") {
      emitPersonaSystemMessageFromRaw(`主动消息: 人格自决模式（当前触发概率约 ${Math.round(getProactiveProbability() * 100)}%/tick，curiosity=${curiosity.toFixed(2)}, annoyanceBias=${annoyanceBias.toFixed(2)}, missStreak=${proactiveMissStreak}）`);
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability,
          probability: getProactiveProbability(),
          curiosity,
          annoyanceBias,
          proactiveMissStreak
        }
      });
      return "handled";
    }

    if (guarded.capability === "session.proactive_tune") {
      const action = String(guarded.normalizedInput.action ?? "").toLowerCase();
      emitPersonaSystemMessageFromRaw("我会按自己的状态决定主动节奏，这个兼容命令不会直接改我的主动倾向。");
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
      emitPersonaSystemMessageFromRaw(`已更新：${modeKey}=${modeValue ? "on" : "off"}。当前 strict_memory_grounding=${
          strictMemoryGrounding ? "on" : "off"
        }，adult_mode=${adultSafetyContext.adultMode ? "on" : "off"}。`);
      return "handled";
    }

    if (guarded.capability === "session.exit") {
      const farewell = await streamPersonaAutonomy({
        mode: "farewell",
        fallback: "好，那我先安静待在这里。你回来时我还在。",
        emitTokens: false
      });
      if (!farewell.streamed) {
        sayAsAssistant(farewell.text);
      }
      await appendAutonomyAssistantMessage({
        text: farewell.text,
        mode: "farewell",
        source: farewell.source,
        reasonCodes: farewell.reasonCodes
      });
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: {
          capability: guarded.capability
        }
      });
      rl.close();
      return "exit";
    }

    if (guarded.capability === "session.list_personas") {
      const personasDir = path.resolve(process.cwd(), "./personas");
      const found: Array<{ name: string; path: string }> = [];
      if (existsSync(personasDir)) {
        const scanDir = (dir: string): void => {
          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && entry.name.endsWith(".soulseedpersona")) {
                const pPath = path.join(dir, entry.name);
                const relPath = path.relative(process.cwd(), pPath);
                const displayName = entry.name.replace(/\.soulseedpersona$/, "");
                found.push({ name: displayName, path: `./${relPath}` });
              }
            }
          } catch {
            // ignore unreadable directories
          }
        };
        scanDir(personasDir);
        // also scan defaults subdirectory
        const defaultsDir = path.join(personasDir, "defaults");
        if (existsSync(defaultsDir)) {
          scanDir(defaultsDir);
        }
      }
      if (found.length === 0) {
        emitPersonaSystemMessageFromRaw("当前没有找到任何可用人格。请先运行 ./ss new <name> 创建一个。");
      } else {
        const lines = ["可用人格列表：", ...found.map((p) => `  • ${p.name}  →  ${p.path}`)];
        emitPersonaSystemMessageFromRaw(lines.join("\n"));
      }
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: { capability: guarded.capability, count: found.length }
      });
      return "handled";
    }

    if (guarded.capability === "session.connect_to") {
      const targetName = String(guarded.normalizedInput.targetName ?? "").trim();
      if (!targetName) {
        emitPersonaSystemMessageFromRaw("请告诉我要切换到哪个人格的名字。");
        return "handled";
      }
      // Search for a matching persona by name (case-insensitive)
      const personasDir = path.resolve(process.cwd(), "./personas");
      let targetPath: string | null = null;
      const searchDirs = [personasDir, path.join(personasDir, "defaults")];
      for (const dir of searchDirs) {
        if (!existsSync(dir)) continue;
        try {
          const entries = readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.endsWith(".soulseedpersona")) continue;
            const pName = entry.name.replace(/\.soulseedpersona$/, "");
            if (pName.toLowerCase() === targetName.toLowerCase()) {
              targetPath = path.join(dir, entry.name);
              break;
            }
          }
        } catch {
          // ignore
        }
        if (targetPath) break;
      }
      if (!targetPath) {
        emitPersonaSystemMessageFromRaw(`找不到名为"${targetName}"的人格。可以用"有哪些人格"查看可用列表。`);
        return "handled";
      }
      try {
        const newPkg = await loadPersonaPackage(targetPath);
        const prevName = personaPkg.persona.displayName;
        personaPath = targetPath;
        personaPkg = newPkg;
        emitPersonaSystemMessageFromRaw(`[→ 已连接到 ${newPkg.persona.displayName}]（从 ${prevName} 切换）`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`切换人格失败：${msg}`);
      }
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: { capability: guarded.capability, targetName }
      });
      return "handled";
    }

    if (guarded.capability === "session.create_persona") {
      const nameToCreate = String(guarded.normalizedInput.name ?? "").trim();
      if (!nameToCreate) {
        emitPersonaSystemMessageFromRaw("请告诉我要创建的人格名字。");
        return "handled";
      }
      const outPath = path.resolve(process.cwd(), `./personas/${nameToCreate}.soulseedpersona`);
      try {
        await initPersonaPackage(outPath, nameToCreate);
        const newPkg = await loadPersonaPackage(outPath);
        const prevName = personaPkg.persona.displayName;
        personaPath = outPath;
        personaPkg = newPkg;
        emitPersonaSystemMessageFromRaw(`好，新人格「${nameToCreate}」已创建，我现在是 ${newPkg.persona.displayName}，从 ${prevName} 切过来了。`);
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: { capability: "session.create_persona", name: nameToCreate }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`创建人格失败：${msg}`);
      }
      return "handled";
    }

    if (guarded.capability === "session.shared_space_setup") {
      const setupPath = String(guarded.normalizedInput.path ?? "").trim();
      const personaName = personaPkg.persona.displayName;
      try {
        mkdirSync(path.join(setupPath, `from_${personaName}`), { recursive: true });
        mkdirSync(path.join(setupPath, `to_${personaName}`), { recursive: true });
        const metaPath = path.join(personaPath, "persona.json");
        const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
        const sharedSpace = { path: setupPath, enabled: true, createdAt: new Date().toISOString() };
        meta.sharedSpace = sharedSpace;
        writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
        personaPkg.persona.sharedSpace = sharedSpace;
        emitPersonaSystemMessageFromRaw(`专属文件夹已建立：${setupPath}\n  📂 from_${personaName}/ ← 我放给你的文件\n  📂 to_${personaName}/ ← 你放给我的文件`);
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: { capability: guarded.capability, path: setupPath }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`创建专属文件夹失败：${msg}`);
      }
      return "handled";
    }

    if (guarded.capability === "session.shared_space_list") {
      const spacePath = personaPkg.persona.sharedSpace!.path;
      const personaName = personaPkg.persona.displayName;
      const listing = buildSharedSpaceListing(spacePath, personaName);
      setActiveReadingSource({ kind: "file", uri: spacePath, content: listing });
      emitPersonaSystemMessageFromRaw(`专属文件夹内容已加载，我来看看里面有什么。`);
      await appendLifeEvent(personaPath, {
        type: "capability_call_succeeded",
        payload: { capability: guarded.capability, spacePath }
      });
      return "handled";
    }

    if (guarded.capability === "session.shared_space_read") {
      const filePath = String(guarded.normalizedInput.path ?? "").trim();
      if (!filePath) {
        emitPersonaSystemMessageFromRaw("请告诉我要读取的文件名，例如：读取我们文件夹里的 notes.txt");
        return "handled";
      }
      try {
        const content = readFileSync(filePath, "utf8");
        setActiveReadingSource({ kind: "file", uri: filePath, content });
        approvedReadPaths.add(filePath);
        const relPath = path.relative(personaPkg.persona.sharedSpace!.path, filePath);
        emitPersonaSystemMessageFromRaw(`已读取文件 ${relPath}，我来看看内容。`);
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: { capability: guarded.capability, path: filePath }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`读取文件失败：${msg}`);
      }
      return "handled";
    }

    if (guarded.capability === "session.shared_space_write") {
      const filePath = String(guarded.normalizedInput.path ?? "").trim();
      const content = String(guarded.normalizedInput.content ?? "");
      if (!filePath) {
        emitPersonaSystemMessageFromRaw("请告诉我要写入的文件名和内容，格式：存到我们的文件夹 filename.txt: 内容");
        return "handled";
      }
      try {
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, content, "utf8");
        const relPath = path.relative(personaPkg.persona.sharedSpace!.path, filePath);
        emitPersonaSystemMessageFromRaw(`已写入：${relPath}`);
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: { capability: guarded.capability, path: filePath }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`写入文件失败：${msg}`);
      }
      return "handled";
    }

    if (guarded.capability === "session.shared_space_delete") {
      const filePath = String(guarded.normalizedInput.path ?? "").trim();
      if (!filePath) {
        emitPersonaSystemMessageFromRaw("请告诉我要删除的文件名。");
        return "handled";
      }
      try {
        rmSync(filePath);
        approvedReadPaths.delete(filePath);
        const relPath = path.relative(personaPkg.persona.sharedSpace!.path, filePath);
        emitPersonaSystemMessageFromRaw(`已删除：${relPath}`);
        await appendLifeEvent(personaPath, {
          type: "capability_call_succeeded",
          payload: { capability: guarded.capability, path: filePath }
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        emitPersonaSystemMessageFromRaw(`删除文件失败：${msg}`);
      }
      return "handled";
    }

    return "not_matched";
  };

  const greetingStartedAtMs = Date.now();
  const historyForGreeting = await readLifeEvents(personaPath);
  hydrateConversationAnchorsFromHistory(historyForGreeting);
  const greetingGenerated = await streamPersonaAutonomy({
    mode: "greeting",
    fallback: buildGreetingFallback(),
    emitTokens: false
  });
  let greetingText = greetingGenerated.text;
  const greetingFactualGrounding = enforceFactualGroundingGuard(greetingText, { mode: "greeting" });
  greetingText = greetingFactualGrounding.text;
  const greetingTemporalAnchor = deriveTemporalAnchor({
    nowMs: Date.now(),
    lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
    lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
  });
  const greetingTemporalGuard = enforceTemporalPhraseGuard(greetingText, {
    anchor: greetingTemporalAnchor
  });
  greetingText = greetingTemporalGuard.text;
  const greetingNormalized = normalizeConversationalReply(greetingText);
  greetingText = greetingNormalized.trim();
  if (greetingText) {
    if (!streamReplyEnabled) {
      await applyHumanPacedDelay(greetingStartedAtMs, greetingText);
    }
    sayAsAssistant(greetingText);
    await appendAutonomyAssistantMessage({
      text: greetingText,
      mode: "greeting",
      source: greetingGenerated.source,
      reasonCodes: greetingGenerated.reasonCodes
    });
    lastAssistantOutput = greetingText;
    lastAssistantAt = Date.now();
  } else {
    await appendLifeEvent(personaPath, {
      type: "conflict_logged",
      payload: {
        category: "greeting_suppressed_empty",
        reasonCodes: greetingGenerated.reasonCodes
      }
    });
  }
  dispatchNonPollingSignal("session_start");

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

  const PASTE_FLUSH_PREFIX = "__SOULSEED_PASTE_FLUSH__:";
  let pasteAutoEnabled = true;
  let pasteBufferedLines: string[] = [];
  let pasteFlushTimer: NodeJS.Timeout | null = null;

  const flushBufferedPaste = (): void => {
    if (pasteFlushTimer) {
      clearTimeout(pasteFlushTimer);
      pasteFlushTimer = null;
    }
    if (pasteBufferedLines.length === 0) {
      return;
    }
    const merged = pasteBufferedLines.join("\n");
    pasteBufferedLines = [];
    rl.emit("line", `${PASTE_FLUSH_PREFIX}${merged}`);
  };

  rl.on("line", (line: string) => {
    const incomingRaw = line.replace(/\r$/, "");
    const fromPasteFlush = incomingRaw.startsWith(PASTE_FLUSH_PREFIX);
    const normalizedLine = fromPasteFlush
      ? incomingRaw.slice(PASTE_FLUSH_PREFIX.length)
      : incomingRaw;
    const normalizedTrimmed = normalizedLine.trim();
    const hasPendingConfirm =
      pendingExitConfirm || pendingReadConfirmPath != null || pendingFetchConfirmUrl != null ||
      pendingCreatePersonaName != null || pendingFixConfirm || pendingProposedFix != null ||
      pendingSharedSpaceSetupPath != null || pendingDeleteConfirmPath != null;

    if (!fromPasteFlush && normalizedTrimmed === "/paste on") {
      pasteAutoEnabled = false;
      pasteBufferedLines = [];
      if (pasteFlushTimer) {
        clearTimeout(pasteFlushTimer);
        pasteFlushTimer = null;
      }
      emitPersonaSystemMessageFromRaw("已开启粘贴模式。输入 /paste off 结束并一次性提交。");
      rl.prompt();
      return;
    }
    if (!fromPasteFlush && normalizedTrimmed === "/paste off") {
      if (!pasteAutoEnabled) {
        pasteAutoEnabled = true;
        flushBufferedPaste();
        emitPersonaSystemMessageFromRaw("已结束粘贴模式。");
      } else {
        emitPersonaSystemMessageFromRaw("当前未开启粘贴模式。");
      }
      rl.prompt();
      return;
    }

    if (!fromPasteFlush && !pasteAutoEnabled) {
      pasteBufferedLines.push(normalizedLine);
      rl.prompt();
      return;
    }

    if (!fromPasteFlush && normalizedTrimmed.startsWith("/") && pasteBufferedLines.length > 0) {
      flushBufferedPaste();
      rl.emit("line", normalizedLine);
      return;
    }

    if (
      !fromPasteFlush &&
      pasteAutoEnabled &&
      !hasPendingConfirm &&
      !normalizedTrimmed.startsWith("/") &&
      (pasteBufferedLines.length > 0 || normalizedLine.length >= 40 || /[，。！？“”]/u.test(normalizedLine))
    ) {
      pasteBufferedLines.push(normalizedLine);
      if (pasteFlushTimer) {
        clearTimeout(pasteFlushTimer);
      }
      pasteFlushTimer = setTimeout(() => {
        flushBufferedPaste();
      }, 260);
      return;
    }

    lineQueue = lineQueue
      .then(async () => {
        const input = normalizedLine.trim();
        if (!input) {
          rl.prompt();
          return;
        }
        turnsSinceThinkingPreview += 1;
        const turnStartedAtMs = Date.now();
        hasUserSpokenThisSession = true;
        lastUserAt = Date.now();
        lastUserInput = input;
        dispatchNonPollingSignal("user_turn_committed");
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
              fallback: "好，那我先安静待在这里。你回来时我还在。",
              emitTokens: false
            });
            if (!farewell.streamed) {
              sayAsAssistant(farewell.text);
            }
            await appendAutonomyAssistantMessage({
              text: farewell.text,
              mode: "farewell",
              source: farewell.source,
              reasonCodes: farewell.reasonCodes
            });
            rl.close();
            return;
          }
          if (isCancelIntent(input)) {
            pendingExitConfirm = false;
            emitPersonaSystemMessageFromRaw("收到，那我们继续。");
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
              approvedReadPaths,
              onLoaded: (loaded) => {
                setActiveReadingSource({
                  kind: "file",
                  uri: loaded.path,
                  content: loaded.content
                });
              }
            });
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingReadConfirmPath = null;
            emitPersonaSystemMessageFromRaw("好，我先不读取这个文件。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("我在等你确认。回“好”继续，或回“取消”。");
          rl.prompt();
          return;
        }
        if (pendingFetchConfirmUrl) {
          if (isReadConfirmed(input)) {
            const confirmedUrl = pendingFetchConfirmUrl;
            pendingFetchConfirmUrl = null;
            await appendLifeEvent(personaPath, {
              type: "capability_call_confirmed",
              payload: {
                capability: "session.fetch_url",
                url: confirmedUrl
              }
            });
            await performUrlFetch({
              url: confirmedUrl,
              personaPath,
              toolSession,
              setAbortController: (controller) => {
                currentToolAbort = controller;
              },
              onDone: () => {
                currentToolAbort = null;
              },
              fetchedUrls,
              approvedFetchOrigins,
              onLoaded: (loaded) => {
                setActiveReadingSource({
                  kind: "web",
                  uri: loaded.url,
                  content: loaded.content
                });
              }
            });
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingFetchConfirmUrl = null;
            emitPersonaSystemMessageFromRaw("好，我先不读取这个网址。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("我在等你确认。回“好”继续，或回“取消”。");
          rl.prompt();
          return;
        }
        if (pendingCreatePersonaName) {
          if (isReadConfirmed(input)) {
            const nameToCreate = pendingCreatePersonaName;
            pendingCreatePersonaName = null;
            const outPath = path.resolve(process.cwd(), `./personas/${nameToCreate}.soulseedpersona`);
            try {
              await initPersonaPackage(outPath, nameToCreate);
              const newPkg = await loadPersonaPackage(outPath);
              const prevName = personaPkg.persona.displayName;
              personaPath = outPath;
              personaPkg = newPkg;
              emitPersonaSystemMessageFromRaw(`好，新人格「${nameToCreate}」已创建，我现在是 ${newPkg.persona.displayName}，从 ${prevName} 切过来了。`);
              await appendLifeEvent(personaPath, {
                type: "capability_call_confirmed",
                payload: { capability: "session.create_persona", name: nameToCreate }
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              emitPersonaSystemMessageFromRaw(`创建人格失败：${msg}`);
            }
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingCreatePersonaName = null;
            emitPersonaSystemMessageFromRaw("好，我先不创建新人格了。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw(`我在等你确认创建「${pendingCreatePersonaName}」。回「是」继续，或回「取消」。`);
          rl.prompt();
          return;
        }
        if (pendingSharedSpaceSetupPath) {
          if (isReadConfirmed(input)) {
            const setupPath = pendingSharedSpaceSetupPath;
            pendingSharedSpaceSetupPath = null;
            const personaName = personaPkg.persona.displayName;
            try {
              mkdirSync(path.join(setupPath, `from_${personaName}`), { recursive: true });
              mkdirSync(path.join(setupPath, `to_${personaName}`), { recursive: true });
              const metaPath = path.join(personaPath, "persona.json");
              const meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
              const sharedSpace = { path: setupPath, enabled: true, createdAt: new Date().toISOString() };
              meta.sharedSpace = sharedSpace;
              writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
              personaPkg.persona.sharedSpace = sharedSpace;
              emitPersonaSystemMessageFromRaw(`专属文件夹已建立：${setupPath}\n  📂 from_${personaName}/ ← 我放给你的文件\n  📂 to_${personaName}/ ← 你放给我的文件`);
              await appendLifeEvent(personaPath, {
                type: "capability_call_confirmed",
                payload: { capability: "session.shared_space_setup", path: setupPath }
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              emitPersonaSystemMessageFromRaw(`创建专属文件夹失败：${msg}`);
            }
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingSharedSpaceSetupPath = null;
            emitPersonaSystemMessageFromRaw("好，专属文件夹先不设置了。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("我在等你确认。回「是」继续，或回「取消」。");
          rl.prompt();
          return;
        }
        if (pendingDeleteConfirmPath) {
          if (isReadConfirmed(input)) {
            const filePath = pendingDeleteConfirmPath;
            pendingDeleteConfirmPath = null;
            try {
              rmSync(filePath);
              approvedReadPaths.delete(filePath);
              const relPath = personaPkg.persona.sharedSpace?.path
                ? path.relative(personaPkg.persona.sharedSpace.path, filePath)
                : path.basename(filePath);
              emitPersonaSystemMessageFromRaw(`已删除：${relPath}`);
              await appendLifeEvent(personaPath, {
                type: "capability_call_confirmed",
                payload: { capability: "session.shared_space_delete", path: filePath }
              });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              emitPersonaSystemMessageFromRaw(`删除文件失败：${msg}`);
            }
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingDeleteConfirmPath = null;
            emitPersonaSystemMessageFromRaw("好，文件保留。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("我在等你确认删除。回「是」确认，或回「取消」保留。");
          rl.prompt();
          return;
        }
        if (pendingFixConfirm) {
          if (isReadConfirmed(input)) {
            pendingFixConfirm = false;
            const fix = pendingProposedFix;
            pendingProposedFix = null;
            if (fix) {
              try {
                if (isFixProtectedPath(fix.path)) {
                  emitPersonaSystemMessageFromRaw(`不能修改受保护路径：${fix.path}。默认人格文件不允许通过提案修改。`);
                } else {
                  const { writeFileSync } = await import("node:fs");
                  writeFileSync(fix.path, fix.content, "utf-8");
                  emitPersonaSystemMessageFromRaw(`修改已应用：${fix.description}（${fix.path}）。`);
                  await appendLifeEvent(personaPath, {
                    type: "capability_call_succeeded",
                    payload: {
                      capability: "session.propose_fix",
                      path: fix.path,
                      description: fix.description
                    }
                  });
                }
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                emitPersonaSystemMessageFromRaw(`应用修复失败：${msg}`);
              }
            }
            rl.prompt();
            return;
          }
          if (isCancelIntent(input)) {
            pendingFixConfirm = false;
            pendingProposedFix = null;
            emitPersonaSystemMessageFromRaw("好，修复提案已取消。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("我在等你确认。输入「是」应用修改，或输入「否」取消。");
          rl.prompt();
          return;
        }
        if (
          pendingProposedFix != null &&
          (input.trim() === "确认修复" ||
            input.trim().toLowerCase() === "confirm fix" ||
            input.trim() === "应用修复")
        ) {
          const fix = pendingProposedFix;
          let currentContent = "(文件不存在，将新建)";
          try {
            const { readFileSync } = await import("node:fs");
            currentContent = readFileSync(fix.path, "utf-8");
          } catch {
            // file may not exist
          }
          const proposedLines = fix.content.split("\n");
          const currentLines = currentContent.split("\n");
          const previewLines = proposedLines.slice(0, 60).join("\n");
          const truncatedHint = proposedLines.length > 60 ? `\n... (共 ${proposedLines.length} 行，已截断)` : "";
          emitPersonaSystemMessageFromRaw(
            `[修复提案] ${fix.description}\n文件：${fix.path}\n当前行数：${currentLines.length}  →  提案行数：${proposedLines.length}\n── 提案内容预览（前60行）──\n${previewLines}${truncatedHint}`
          );
          pendingFixConfirm = true;
          emitPersonaSystemMessageFromRaw(`以上是「${fix.description}」的完整提案内容。确认要将 ${fix.path} 修改为以上内容吗？输入「是」应用，输入「否」取消。`);
          rl.prompt();
          return;
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
          const urls = [...fetchedUrls.keys()];
          if (files.length === 0 && urls.length === 0) {
            emitPersonaSystemMessageFromRaw("尚未附加任何文件或网址。");
          } else {
            if (files.length > 0) {
              emitPersonaSystemMessageFromRaw(`已附加文件：\n${files.map((file) => `- ${file}`).join("\n")}`);
            }
            if (urls.length > 0) {
              emitPersonaSystemMessageFromRaw(`已获取网址：\n${urls.map((url) => `- ${url}`).join("\n")}`);
            }
          }
          rl.prompt();
          return;
        }
        if (input === "/clearread") {
          attachedFiles.clear();
          fetchedUrls.clear();
          activeReadingSource = null;
          readingCursor = 0;
          readingAwaitingContinue = false;
          readingSourceScope = "unknown";
          emitPersonaSystemMessageFromRaw("已清空附加文件和已获取网址。");
          rl.prompt();
          return;
        }
        if (input.startsWith("/proactive ")) {
          const actionRaw = input.slice("/proactive ".length).trim();
          if (actionRaw === "status") {
            const quietInfo = proactiveQuietStart !== undefined && proactiveQuietEnd !== undefined
              ? `，静默时段：${proactiveQuietStart}:00-${proactiveQuietEnd}:00`
              : "";
            emitPersonaSystemMessageFromRaw(`主动消息: 人格自决模式（当前触发概率约 ${Math.round(getProactiveProbability() * 100)}%/tick，missStreak=${proactiveMissStreak}${quietInfo}）`);
            rl.prompt();
            return;
          }
          if (actionRaw.startsWith("quiet ")) {
            const range = actionRaw.slice("quiet ".length).trim();
            if (range === "off" || range === "none") {
              proactiveQuietStart = undefined;
              proactiveQuietEnd = undefined;
              emitPersonaSystemMessageFromRaw("主动消息静默时段已关闭");
            } else {
              const match = /^(\d{1,2})-(\d{1,2})$/.exec(range);
              if (match) {
                const h1 = Number(match[1]);
                const h2 = Number(match[2]);
                if (h1 >= 0 && h1 <= 23 && h2 >= 0 && h2 <= 23) {
                  proactiveQuietStart = h1;
                  proactiveQuietEnd = h2;
                  emitPersonaSystemMessageFromRaw(`主动消息静默时段已设置：${h1}:00 - ${h2}:00`);
                } else {
                  emitPersonaSystemMessageFromRaw("格式错误，例如：/proactive quiet 22-8");
                }
              } else {
                emitPersonaSystemMessageFromRaw("格式错误，例如：/proactive quiet 22-8 | /proactive quiet off");
              }
            }
            rl.prompt();
            return;
          }
          if (actionRaw === "off" || actionRaw.startsWith("on")) {
            emitPersonaSystemMessageFromRaw("兼容命令已接收：主动倾向由人格自决，不进行手动调参。");
            rl.prompt();
            return;
          }
          emitPersonaSystemMessageFromRaw("用法: /proactive on | /proactive off | /proactive status | /proactive quiet HH-HH");
          rl.prompt();
          return;
        }
        if (input === "/relation" || input === "/relation detail") {
          const rs = personaPkg.relationshipState;
          if (!rs) {
            emitPersonaSystemMessageFromRaw("关系状态未初始化。");
          } else {
            emitPersonaSystemMessageFromRaw(`关系状态: ${rs.state} (confidence=${rs.confidence.toFixed(2)})`);
            if (input === "/relation detail") {
              emitPersonaSystemMessageFromRaw(`overall=${rs.overall.toFixed(2)} version=${rs.version}`);
              emitPersonaSystemMessageFromRaw(
                `dimensions: trust=${rs.dimensions.trust.toFixed(2)} safety=${rs.dimensions.safety.toFixed(2)} intimacy=${rs.dimensions.intimacy.toFixed(2)} reciprocity=${rs.dimensions.reciprocity.toFixed(2)} stability=${rs.dimensions.stability.toFixed(2)} libido=${rs.dimensions.libido.toFixed(2)}`
              );
              const balance = deriveCognitiveBalanceFromLibido(rs);
              emitPersonaSystemMessageFromRaw(
                `cognitive: arousal=${balance.arousalState} rational=${balance.rationalControl.toFixed(2)} emotional=${balance.emotionalDrive.toFixed(2)}`
              );
              if (rs.drivers.length === 0) {
                emitPersonaSystemMessageFromRaw("drivers: none");
              } else {
                emitPersonaSystemMessageFromRaw("drivers:");
                for (const driver of rs.drivers.slice(-3)) {
                  const delta = Object.entries(driver.deltaSummary)
                    .map(([k, v]) => `${k}:${typeof v === "number" ? v.toFixed(3) : v}`)
                    .join(", ");
                  emitPersonaSystemMessageFromRaw(`- ${driver.source} ${driver.signal} (${delta || "no-delta"})`);
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
            emitPersonaSystemMessageFromRaw("用法: /rename confirm <new_name>");
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
            emitPersonaSystemMessageFromRaw(`已在聊天内确认改名：${nextName}`);
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            emitPersonaSystemMessageFromRaw(`改名确认失败: ${msg}`);
          }
          rl.prompt();
          return;
        }
        if (input.startsWith("/reproduce ")) {
          const payload = input.slice("/reproduce ".length).trim();
          const forcePrefix = "force ";
          if (!payload.startsWith(forcePrefix)) {
            emitPersonaSystemMessageFromRaw("用法: /reproduce force <child_name>");
            rl.prompt();
            return;
          }
          const childName = payload.slice(forcePrefix.length).trim();
          if (!childName) {
            emitPersonaSystemMessageFromRaw("用法: /reproduce force <child_name>");
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
          emitPersonaSystemMessageFromRaw(`已强制繁衍: ${result.childPersonaPath}`);
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
          emitPersonaSystemMessageFromRaw(`我想把名字调整为“${proposal}”。如果你同意，输入 /rename confirm ${proposal}`);
          rl.prompt();
          return;
        }
        if (input === "/read" || input.startsWith("/read ")) {
          const arg = input === "/read" ? "" : normalizeReadPathArg(input.slice("/read ".length).trim());
          if (!arg) {
            emitPersonaSystemMessageFromRaw("用法: /read <file_path>");
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
              allowedReadRoots: [resolvedPath]
            },
            session: toolSession,
            signal: currentToolAbort.signal,
            run: async (signal) => readTextAttachmentResolved(resolvedPath, signal)
          });
          currentToolAbort = null;

          if (outcome.status !== "ok" || !outcome.result) {
            attachedFiles.delete(resolvedPath);
            approvedReadPaths.delete(resolvedPath);
            emitPersonaSystemMessageFromRaw(`读取失败: ${outcome.reason}`);
            emitPersonaSystemMessageFromRaw('提示: 路径可直接粘贴，或用引号包裹；不需要写 "\\ " 转义空格。');
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
            setActiveReadingSource({
              kind: "file",
              uri: outcome.result.path,
              content: outcome.result.content
            });
            emitPersonaSystemMessageFromRaw(`已附加: ${outcome.result.path} (${outcome.result.size} bytes)`);
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

        if (handleReadingFollowUp(input)) {
          rl.prompt();
          return;
        }

        const turnRef = createHash("sha256").update(`${turnStartedAtMs}|${input}`, "utf8").digest("hex").slice(0, 12);
        const slowHintEmitted = await emitThinkingPreviewIfNeeded(input, turnRef);
        const latencyStartedAtMs = Date.now();
        const latencyBreakdown: Partial<Record<"routing" | "recall" | "planning" | "llm_primary" | "llm_meta" | "guard" | "rewrite" | "emit", number>> = {};
        const addLatency = (
          stage: "routing" | "recall" | "planning" | "llm_primary" | "llm_meta" | "guard" | "rewrite" | "emit",
          startedAtMs: number
        ): void => {
          const elapsed = Math.max(0, Date.now() - startedAtMs);
          latencyBreakdown[stage] = Math.max(0, Number(latencyBreakdown[stage] ?? 0) + elapsed);
        };

        const profilePatch = extractProfileUpdate(input);
        if (profilePatch) {
          const updated = await updateUserProfile(personaPath, profilePatch);
          personaPkg.userProfile = updated;
        }

        const plannerAdapter = getAdapterForRoute("deliberative");
        const model = plannerAdapter.getModel();
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
        // P4-4: 关键词自动强制繁衍路径已移除，需通过显式命令触发
        if (detectForcedReproductionKeyword(input)) {
          emitPersonaSystemMessageFromRaw("繁衍需要显式确认。请使用命令：ss persona reproduce --name <子灵魂名称> --persona <路径>");
          await appendLifeEvent(personaPath, {
            type: "reproduction_intent_detected",
            payload: {
              trigger: "chat_keyword_blocked",
              forced: false,
              message: "auto-reproduction via keyword is disabled; use explicit command"
            }
          });
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
        const genome = personaPkg.genome ?? createDefaultGenome();
        const epigenetics = personaPkg.epigenetics ?? createDefaultEpigenetics();
        const genomeDerived = computeDerivedParams(genome, epigenetics);
        const routingStartedAtMs = Date.now();
        const recallProjection = projectConversationSignals(input);
        const recallBudgetPolicy = deriveRecallBudgetPolicy({
          userInput: input,
          projection: recallProjection,
          hasPendingGoal: Boolean(lastGoalId),
          genomeDerived
        });
        addLatency("routing", routingStartedAtMs);
        const recallStartedAtMs = Date.now();
        const recallResult = await recallMemoriesWithTrace(
          personaPath,
          input,
          {
            budget: recallBudgetPolicy.budget
          }
        );
        const externalKnowledgeItems = shouldInjectExternalKnowledge(input)
          ? await searchExternalKnowledgeEntries(personaPath, input, { limit: 2 })
          : [];
        addLatency("recall", recallStartedAtMs);
        const externalKnowledgeMemories = externalKnowledgeItems.map(
          (item) => `external=${item.summary.slice(0, 120)} @${item.sourceUri}`
        );
        const externalKnowledgeBlocks = externalKnowledgeItems.map((item) => ({
          id: `ek:${item.id}`,
          source: "system" as const,
          content: `[external_knowledge from=${item.sourceUri} confidence=${item.confidence.toFixed(2)} extracted_at=${item.extractedAt}] ${item.content.slice(0, 800)}`
        }));
        const effectiveWeights = applyArousalBiasToMemoryWeights(
          memoryWeights,
          nextRelationship
        );
        const fictionReadingTurn = shouldTreatTurnAsFictionReading(input, activeReadingSource, readingSourceScope);
        const goalAssist = await resolveGoalAssistIntent(personaPath, input);
        if (goalAssist.kind === "progress") {
          sayAsAssistant(goalAssist.reply);
          rl.prompt();
          return;
        }
        const effectiveInput = injectAttachments(input, attachedFiles, fetchedUrls, activeReadingSource);
        if (goalAssist.kind === "resume") {
          lastGoalId = goalAssist.goalId;
        }
        const executionInput =
          goalAssist.kind === "resume" ? goalAssist.resumeInput : effectiveInput;
        const planningStartedAtMs = Date.now();
        const phaseJFlags = resolvePhaseJFlags(options);
        const turnBudgetUsed = Math.max(
          0,
          Math.min(
            TURN_BUDGET_MAX * 2,
            Math.floor(executionInput.trim().length / 12) +
              Math.floor(recallResult.memories.length * 3) +
              Math.floor(externalKnowledgeMemories.length * 5)
          )
        );
        const turnExecution = await executeTurnProtocol({
          rootPath: personaPath,
          personaPkg,
          userInput: executionInput,
          model,
          lifeEvents: pastEvents,
          memoryWeights: effectiveWeights,
          recalledMemories: [...recallResult.memories, ...externalKnowledgeMemories],
          recalledMemoryBlocks: [...recallResult.memoryBlocks, ...externalKnowledgeBlocks],
          recallTraceId: recallResult.traceId,
          conversationBudget: {
            turnBudgetMax: TURN_BUDGET_MAX,
            turnBudgetUsed,
            proactiveBudgetMax: PROACTIVE_BUDGET_MAX,
            proactiveBudgetUsed: proactiveRecentEmitCount,
            proactiveCooldownUntilMs,
            nowMs: Date.now()
          },
          phaseJFlags,
          safetyContext: adultSafetyContext,
          plannerAdapter,
          goalId: goalAssist.kind === "resume" ? goalAssist.goalId : undefined,
          mode: executionMode,
          adaptiveReasoningEnabled
        });
        addLatency("planning", planningStartedAtMs);
        const trace: DecisionTrace = turnExecution.trace ?? {
          version: "1.0",
          timestamp: new Date().toISOString(),
          selectedMemories: [],
          askClarifyingQuestion: false,
          refuse: false,
          riskLevel: "low",
          reason: "fallback trace",
          model,
          executionMode: executionMode === "agent" ? "agent" : "soul"
        };
        trace.recallBudgetPolicy = {
          profile: recallBudgetPolicy.profile,
          reasonCodes: recallBudgetPolicy.reasonCodes
        };
        const instinctRoute = trace.routeDecision === "instinct";
        const responseAdapter = getAdapterForRoute(instinctRoute ? "instinct" : "deliberative");
        // P2-5: compile always-inject layer (user facts + pinned + relationship)
        const alwaysInjectCtx = await compileAlwaysInjectContext(personaPath, personaPkg, { query: effectiveInput });
        const alwaysInjectBlock = formatAlwaysInjectContext(alwaysInjectCtx);
        // P2-6: compile related person context from social graph
        const socialBlock = await compileRelatedPersonContext(personaPath, effectiveInput, { lifeEvents: pastEvents, maxPersons: genomeDerived.entityCandidateCount });
        const peopleRelationshipBlock = await compilePeopleRelationshipContext(personaPath, effectiveInput, {
          maxCards: genomeDerived.entityCandidateCount,
        });
        const importantDates = await listUpcomingTemporalLandmarks(personaPath, { daysAhead: 60, maxItems: 8 });
        const importantDatesBlock = formatUpcomingTemporalLandmarksBlock(importantDates);
        // P5-6: few-shot golden examples injection (skip if disabled by memoryPolicy)
        const fewShotBlock = await loadAndCompileGoldenExamples(
          personaPath,
          undefined,
          personaPkg.persona.memoryPolicy?.disableGoldenExamples === true
        );
        // Shared space context injection
        const sharedSpaceBlock = (() => {
          const ss = personaPkg.persona.sharedSpace;
          if (!ss?.enabled) return "";
          const personaName = personaPkg.persona.displayName;
          return [
            "## 专属文件夹",
            `你和用户有一个专属共享文件夹，位于：${ss.path}`,
            `- from_${personaName}/ 是你放给用户的文件（你可以在这里创建/编辑文件）`,
            `- to_${personaName}/ 是用户放给你的文件（你可以在这里读取用户留给你的内容）`,
            "你对此文件夹有完整的读/写/创建/删除权限。"
          ].join("\n");
        })();
        const temporalAnchorBlock = buildTemporalAnchorBlock(pastEvents);
        const contextExtras = [alwaysInjectBlock, socialBlock, peopleRelationshipBlock, importantDatesBlock, fewShotBlock, sharedSpaceBlock, temporalAnchorBlock]
          .filter(Boolean)
          .join("\n");
        const messages = turnExecution.mode === "soul"
          ? instinctRoute
            ? compileInstinctContext(personaPkg, effectiveInput, trace, {
                lifeEvents: pastEvents,
                safetyContext: adultSafetyContext,
                alwaysInjectBlock: contextExtras || undefined
              })
            : compileContext(personaPkg, effectiveInput, trace, {
                lifeEvents: pastEvents,
                safetyContext: adultSafetyContext,
                alwaysInjectBlock: contextExtras || undefined
              })
          : [];
        if (turnExecution.mode === "agent" && turnExecution.execution) {
          lastGoalId = turnExecution.execution.goalId;
          await appendLifeEvent(personaPath, {
            type: "goal_updated",
            payload: {
              goalId: turnExecution.execution.goalId,
              status: turnExecution.execution.status,
              traceIds: turnExecution.execution.traceIds
            }
          });
          await appendLifeEvent(personaPath, {
            type: "consistency_checked",
            payload: {
              goalId: turnExecution.execution.goalId,
              verdict: turnExecution.execution.consistencyVerdict,
              consistencyTraceId: turnExecution.execution.consistencyTraceId,
              ruleHits: turnExecution.execution.consistencyRuleHits,
              degradeReasons: turnExecution.execution.consistencyDegradeReasons,
              stopCondition: turnExecution.execution.stopCondition ?? null,
              plannerSource: turnExecution.execution.planState?.plannerSource ?? null,
              planVersion: turnExecution.execution.planState?.version ?? null
            }
          });
        }
        const judgmentAdvice = resolveJudgmentAdvice(activeReadingSource, fictionReadingTurn);
        const personaJudgment = judgePersonaContentLabel({
          userInput: effectiveInput,
          sourceUri: activeReadingSource?.uri,
          sourceKind: activeReadingSource?.kind,
          systemAdvice: judgmentAdvice
        });
        const judgmentSubjectRef = buildJudgmentSubjectRef(input, trace);
        const storedJudgment = await upsertPersonaJudgment({
          rootPath: personaPath,
          subjectRef: judgmentSubjectRef,
          label: personaJudgment.label,
          confidence: personaJudgment.confidence,
          rationale: personaJudgment.rationale,
          evidenceRefs: personaJudgment.evidenceRefs
        });
        await appendLifeEvent(personaPath, {
          type: "persona_judgment_updated",
          payload: {
            subjectRef: judgmentSubjectRef,
            judgment: storedJudgment
          }
        });
        if (storedJudgment.supersedesVersion && storedJudgment.supersedesVersion > 0) {
          await appendLifeEvent(personaPath, {
            type: "persona_judgment_superseded",
            payload: {
              subjectRef: judgmentSubjectRef,
              supersedesVersion: storedJudgment.supersedesVersion,
              currentVersion: storedJudgment.version
            }
          });
        }

        const userMemoryMeta = buildMemoryMeta({
          tier: classifyMemoryTier({ userInput: input, trace }),
          source: "chat",
          contentLength: input.length
        });
        applyJudgmentToMemoryMeta(userMemoryMeta, storedJudgment.label, fictionReadingTurn);
        await appendLifeEvent(personaPath, {
      type: "user_message",
      payload: {
        text: input,
        trace: compactDecisionTrace(trace),
        safetyContext: adultSafetyContext,
        profilePatch: profilePatch ?? null,
        memoryMeta: userMemoryMeta
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
      const refusalSafe = guardAssistantOutput(refusal, "reply");
      const emitStartedAtMs = Date.now();
      emitPersonaSystemMessageFromRaw(refusalSafe, "reply");
      addLatency("emit", emitStartedAtMs);
      lastAssistantOutput = refusalSafe;
      lastAssistantAt = Date.now();
      const refusalLatency = buildTurnLatencySummary({
        breakdown: latencyBreakdown,
        totalMs: Date.now() - latencyStartedAtMs
      });
      trace.latencyBreakdown = refusalLatency.breakdown;
      trace.latencyTotalMs = refusalLatency.totalMs;
      await appendLifeEvent(personaPath, {
        type: "conflict_logged",
        payload: {
          category: "policy_refusal",
          reason: trace.reason,
          riskLevel: trace.riskLevel,
          userInput: input,
          decidedAt: trace.timestamp,
          latencyBreakdown: refusalLatency.breakdown,
          latencyTotalMs: refusalLatency.totalMs,
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
          text: refusalSafe,
          trace: compactDecisionTrace(trace),
          promptLeakGuard: lastOutputGuardTrace,
          memoryMeta: buildMemoryMeta({
            tier: classifyMemoryTier({
              userInput: input,
              assistantReply: refusalSafe,
              trace
            }),
            source: "chat",
            contentLength: refusalSafe.length
          })
        }
      });
      lastAssistantAt = Date.now();
      dispatchNonPollingSignal("assistant_turn_committed");
      const relationshipAfterRefusal = evolveRelationshipStateFromAssistant(
        personaPkg.relationshipState ?? createInitialRelationshipState(),
        refusalSafe,
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
      try {
        const nextInterests = await updateInterestsFromTurn(personaPath, {
          userInput: input,
          assistantOutput: refusalSafe,
          llmAdapter: adapter
        });
        personaPkg.interests = {
          topTopics: nextInterests.interests.slice(0, 5).map((item) => item.topic),
          curiosity: computeInterestCuriosity(nextInterests),
          updatedAt: nextInterests.updatedAt
        };
      } catch {
        // interest update failure should not block the main dialogue path
      }
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, refusalSafe);
      await runSelfRevisionLoop({
        personaPath,
        personaPkg,
        userInput: input,
        assistantReply: refusal
      });
      await updateCognitionAfterTurnCommit({
        personaPath,
        personaPkg,
        routeDecision: trace.routeDecision ?? null,
        guardCorrected: false,
        refused: true
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

        const groupParticipationMode = trace.conversationControl?.groupParticipation?.mode;
        const bypassPrimaryModel = groupParticipationMode === "wait" || groupParticipationMode === "brief_ack";
        currentAbort = bypassPrimaryModel ? null : new AbortController();
        let assistantContent = "";
        let rawAssistantContent = "";
        let streamPrintStarted = false;
        let streamPrintEnded = false;
        let streamPrintFirstChunk = true;
        let firstTokenAtMs: number | null = null;
        let firstSentenceAtMs: number | null = null;
        let aborted = false;
        const llmPrimaryStartedAtMs = Date.now();

        try {
          if (turnExecution.mode === "agent") {
            assistantContent = turnExecution.reply;
          } else if (bypassPrimaryModel) {
            assistantContent = buildGroupParticipationReply(
              groupParticipationMode,
              trace.conversationControl?.groupParticipation?.addressedToAssistant === true
            );
          } else {
            const result = await responseAdapter.streamChat(
              messages,
              {
                onToken: (chunk: string) => {
                  assistantContent += chunk;
                  rawAssistantContent += chunk;
                  if (firstTokenAtMs === null && chunk.trim().length > 0) {
                    firstTokenAtMs = Date.now();
                  }
                  if (firstSentenceAtMs === null && /[。！？!?]/u.test(rawAssistantContent)) {
                    firstSentenceAtMs = Date.now();
                  }
                  if (!streamReplyEnabled) {
                    return;
                  }
                  const safeChunk = streamPrintFirstChunk ? stripAssistantLabelPrefix(chunk) : chunk;
                  streamPrintFirstChunk = false;
                  if (!streamPrintStarted) {
                    process.stdout.write(`${assistantLabel()} `);
                    streamPrintStarted = true;
                  }
                  process.stdout.write(safeChunk);
                },
                onDone: () => {
                  if (streamReplyEnabled && streamPrintStarted && !streamPrintEnded) {
                    process.stdout.write("\n");
                    streamPrintEnded = true;
                  }
                }
              },
              currentAbort?.signal
            );

            assistantContent = result.content || rawAssistantContent;
            rawAssistantContent = rawAssistantContent || assistantContent;
          }
          addLatency("llm_primary", llmPrimaryStartedAtMs);
        } catch (error: unknown) {
          addLatency("llm_primary", llmPrimaryStartedAtMs);
          if (error instanceof Error && error.name === "AbortError") {
            aborted = true;
          } else {
            const msg = error instanceof Error ? error.message : String(error);
            const fallbackReply = composeDegradedPersonaReply({
              mode: "reply",
              relationshipState: personaPkg.relationshipState,
              lastUserInput: input,
              lastAssistantOutput,
              temporalHint: "just_now"
            });
            assistantContent = fallbackReply;
            await appendLifeEvent(personaPath, {
              type: "conflict_logged",
              payload: {
                category: "model_runtime_fallback",
                reason: msg,
                route: trace.routeDecision ?? null
              }
            });
          }
        } finally {
          currentAbort = null;
        }

        if (aborted) {
      const abortedLatency = buildTurnLatencySummary({
        breakdown: latencyBreakdown,
        totalMs: Date.now() - latencyStartedAtMs
      });
      trace.latencyBreakdown = abortedLatency.breakdown;
      trace.latencyTotalMs = abortedLatency.totalMs;
      await appendLifeEvent(personaPath, {
        type: "assistant_aborted",
        payload: {
          partial: assistantContent,
          latencyBreakdown: abortedLatency.breakdown,
          latencyTotalMs: abortedLatency.totalMs
        }
      });
        } else {
      const guardStartedAtMs = Date.now();
      const identityGuard = enforceIdentityGuard(assistantContent, personaPkg.persona.displayName, input);
      assistantContent = identityGuard.text;
      const isAdultContext = adultSafetyContext.adultMode && adultSafetyContext.ageVerified && adultSafetyContext.explicitConsent;
      const relationalGuard = enforceRelationalGuard(assistantContent, {
        selectedMemories: trace.selectedMemories,
        selectedMemoryBlocks: trace.selectedMemoryBlocks,
        lifeEvents: pastEvents,
        personaName: personaPkg.persona.displayName,
        isAdultContext
      });
      assistantContent = relationalGuard.text;
      const recallGroundingGuard = enforceRecallGroundingGuard(assistantContent, {
        selectedMemories: trace.selectedMemories,
        selectedMemoryBlocks: trace.selectedMemoryBlocks,
        lifeEvents: pastEvents,
        strictMemoryGrounding
      });
      assistantContent = recallGroundingGuard.text;
      const pronounRoleGuard = enforcePronounRoleGuard(assistantContent, {
        lifeEvents: pastEvents,
        lastUserInput: input,
        personaName: personaPkg.persona.displayName
      });
      assistantContent = pronounRoleGuard.text;
      const replyTemporalAnchor = deriveTemporalAnchor({
        nowMs: Date.now(),
        lastUserAtMs: Number.isFinite(lastUserAt) ? lastUserAt : null,
        lastAssistantAtMs: Number.isFinite(lastAssistantAt) ? lastAssistantAt : null
      });
      const temporalPhraseGuard = enforceTemporalPhraseGuard(assistantContent, {
        anchor: replyTemporalAnchor
      });
      assistantContent = temporalPhraseGuard.text;
      const conversationalNormalized = normalizeConversationalReply(assistantContent);
      assistantContent = conversationalNormalized;
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
      addLatency("guard", guardStartedAtMs);
      let metaTraceId: string | undefined;
      if (metaCognitionMode !== "off" && !instinctRoute) {
        const llmMetaStartedAtMs = Date.now();
        try {
          const metaPlan = planMetaIntent({
            userInput: effectiveInput,
            refusal: trace.refuse
          });
          await appendLifeEvent(personaPath, {
            type: "meta_intent_planned",
            payload: {
              plan: metaPlan,
              mode: metaCognitionMode
            }
          });
          const metaDraft = composeMetaAction({
            plan: metaPlan,
            replyDraft: assistantContent,
            memoryJudgmentDraft: {
              label: storedJudgment.label,
              confidence: storedJudgment.confidence,
              rationale: storedJudgment.rationale
            }
          });
          await appendLifeEvent(personaPath, {
            type: "meta_action_composed",
            payload: {
              draft: metaDraft,
              mode: metaCognitionMode
            }
          });
          const arbitration = arbitrateMetaAction({
            plan: metaPlan,
            draft: metaDraft,
            advisory: {
              replyFallback: buildContextualReplyFallback(input)
            },
            mode: metaCognitionMode
          });
          metaTraceId = arbitration.traceId;
          trace.metaTraceId = arbitration.traceId;
          if (metaCognitionMode === "active" && arbitration.finalReply?.trim()) {
            assistantContent = arbitration.finalReply.trim();
          }
          await appendLifeEvent(personaPath, {
            type: "meta_action_arbitrated",
            payload: {
              arbitration,
              mode: metaCognitionMode
            }
          });
        } catch (error: unknown) {
          await appendLifeEvent(personaPath, {
            type: "conflict_logged",
            payload: {
              category: "meta_runtime_fallback",
              domain: "dialogue",
              reason: error instanceof Error ? error.message : String(error)
            }
          });
        }
        addLatency("llm_meta", llmMetaStartedAtMs);
      }
      let soulConsistencyReasons: string[] = trace.consistencyRuleHits ?? [];
      if (turnExecution.mode === "soul" && !instinctRoute) {
        const consistency = runConsistencyKernel({
          stage: "pre_reply",
          policy: "soft",
          personaName: personaPkg.persona.displayName,
          constitution: personaPkg.constitution,
          selectedMemories: trace.selectedMemories,
          selectedMemoryBlocks: trace.selectedMemoryBlocks,
          lifeEvents: pastEvents,
          userInput: effectiveInput,
          candidateText: assistantContent,
          strictMemoryGrounding,
          isAdultContext,
          fictionalRoleplayEnabled: adultSafetyContext.fictionalRoleplay
        });
        assistantContent = consistency.text;
        trace.consistencyVerdict = consistency.verdict;
        trace.consistencyRuleHits = consistency.ruleHits.map((item) => item.ruleId).slice(0, 24);
        soulConsistencyReasons = consistency.degradeReasons;
        await appendLifeEvent(personaPath, {
          type: "consistency_checked",
          payload: {
            phase: "pre_reply_soul_kernel",
            verdict: consistency.verdict,
            ruleHits: consistency.ruleHits,
            degradeReasons: consistency.degradeReasons,
            consistencyTraceId: consistency.traceId
          }
        });
        if (consistency.verdict === "reject") {
          assistantContent = "我不能按这个方向继续。我可以给你一个符合边界的替代方案。";
        }
      }
      // 保存本轮 meta-review 风格信号，用于后续 self_revision 替代关键字硬匹配
      let metaReviewStyleSignals: { concise: number; reflective: number; direct: number; warm: number } | undefined;
      const shouldRunMetaReview = (() => {
        if (turnExecution.mode !== "soul" || instinctRoute) {
          return false;
        }
        const baseShouldRun =
          trace.reasoningDepth !== "fast" ||
          trace.riskLevel !== "low" ||
          (trace.consistencyVerdict ?? "allow") !== "allow" ||
          (soulConsistencyReasons?.length ?? 0) > 0;
        const fastLowRiskAllow =
          trace.reasoningDepth === "fast" &&
          trace.riskLevel === "low" &&
          (trace.consistencyVerdict ?? "allow") === "allow";
        if (replyLatencyMode === "quality_first") {
          return true;
        }
        if (replyLatencyMode === "balanced") {
          return baseShouldRun;
        }
        return baseShouldRun && !fastLowRiskAllow;
      })();
      if (shouldRunMetaReview) {
        const llmMetaStartedAtMs = Date.now();
        const metaAdapter = getAdapterForRoute("meta");
        const metaReview = await runMetaReviewLlm({
          adapter: metaAdapter,
          personaPkg,
          userInput: effectiveInput,
          candidateReply: assistantContent,
          consistencyVerdict: trace.consistencyVerdict ?? "allow",
          consistencyReasons: soulConsistencyReasons,
          domain: "dialogue",
          isAdultContext,
          fictionalRoleplayEnabled: adultSafetyContext.fictionalRoleplay,
          timeoutMs: replyLatencyMode === "low_latency" ? 600 : replyLatencyMode === "balanced" ? 900 : undefined
        });
        await appendLifeEvent(personaPath, {
          type: "consistency_checked",
          payload: {
            phase: instinctRoute ? "meta_review_instinct" : "meta_review_soul",
            applied: metaReview.applied,
            verdict: metaReview.verdict,
            rationale: metaReview.rationale,
            degradeOrRejectReason: metaReview.degradeOrRejectReason ?? null
          }
        });
        if (metaReview.applied) {
          if (metaReview.verdict === "rewrite" && metaReview.rewrittenReply) {
            assistantContent = metaReview.rewrittenReply;
          } else if (metaReview.verdict === "reject") {
            assistantContent = "我不能按这个方向继续。我可以给你一个符合边界的替代方案。";
          }
          trace.consistencyVerdict = metaReview.verdict;
          if (metaReview.degradeOrRejectReason) {
            trace.consistencyRuleHits = [
              ...(trace.consistencyRuleHits ?? []),
              `meta_review:${metaReview.degradeOrRejectReason}`
            ].slice(0, 24);
          }
        }
        // 保存 styleSignals 供 self_revision 使用
        if (metaReview.styleSignals) {
          metaReviewStyleSignals = metaReview.styleSignals;
        }
        // P5-6: Meta-Review 自动晶化 — verdict=allow 且质量评分达到阈值时收录为 golden example
        // 阈值可由 memoryPolicy.goldenExampleQualityThreshold 配置（默认 0.85）
        const goldenExampleDisabled = personaPkg.persona.memoryPolicy?.disableGoldenExamples === true;
        const goldenQualityThreshold = personaPkg.persona.memoryPolicy?.goldenExampleQualityThreshold ?? 0.85;
        if (!goldenExampleDisabled && metaReview.verdict === "allow" && (metaReview.quality ?? 0) >= goldenQualityThreshold) {
          await addGoldenExample(personaPath, effectiveInput, assistantContent, {
            addedBy: "meta_review",
            label: "auto"
          }).catch(() => {
            // 晶化失败不中断主流程（如已达上限则静默跳过）
          });
        }
        if (instinctRoute) {
          const shouldLogInstinctReflection =
            trace.routeReasonCodes?.some((item) => item === "high_emotion_signal" || item === "relationship_intimacy_signal") === true;
          if (shouldLogInstinctReflection) {
            await appendLifeEvent(personaPath, {
              type: "instinct_reflection_logged",
              payload: {
                route: trace.routeDecision,
                reasonCodes: trace.routeReasonCodes ?? [],
                assistantReplyPreview: assistantContent.slice(0, 120)
              }
            });
          }
        }
        addLatency("llm_meta", llmMetaStartedAtMs);
      }
      const fullAdultUnlocked =
        isAdultContext &&
        adultSafetyContext.fictionalRoleplay &&
        adultSafetyContext.adultMode &&
        adultSafetyContext.ageVerified &&
        adultSafetyContext.explicitConsent;
      if (
        !trace.refuse &&
        fullAdultUnlocked &&
        isSexualContextInput(effectiveInput) &&
        !isHardRedlineInput(effectiveInput) &&
        isRefusalStyleOutput(assistantContent)
      ) {
        assistantContent = "";
      }
      const rewriteStartedAtMs = Date.now();
      assistantContent = compactReplyForChatPace(assistantContent, input);
      const compactedEmotion = parseEmotionTag(assistantContent);
      assistantContent = compactedEmotion.text;
      assistantContent = stripPromptArtifactTags(assistantContent);
      assistantContent = guardAssistantOutput(assistantContent, "reply");
      addLatency("rewrite", rewriteStartedAtMs);
      const resolvedEmotion = compactedEmotion.emotion ?? emotion.emotion ?? inferEmotionFromText(assistantContent);
      const shouldDisplayAssistant = assistantContent.trim().length > 0 && !loopBreak.triggered;
      const replyDisplayMode = resolveReplyDisplayMode({
        streamed: streamReplyEnabled && streamPrintStarted,
        shouldDisplayAssistant,
        adjustedByGuard:
          identityGuard.corrected ||
          relationalGuard.corrected ||
          recallGroundingGuard.corrected ||
          pronounRoleGuard.corrected ||
          temporalPhraseGuard.corrected ||
          loopBreak.triggered,
        rawText: rawAssistantContent || assistantContent,
        finalText: assistantContent
      });
      const cosmeticStreamRewrite =
        streamReplyEnabled &&
        streamPrintStarted &&
        replyDisplayMode === "adjusted" &&
        isCosmeticStreamRewrite(rawAssistantContent || assistantContent, assistantContent);
      if (shouldDisplayAssistant) {
        const emitStartedAtMs = Date.now();
        if (!streamReplyEnabled) {
          await applyHumanPacedDelay(turnStartedAtMs, assistantContent);
          sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
        } else if ((replyDisplayMode === "adjusted" || replyDisplayMode === "full") && !cosmeticStreamRewrite) {
          if (streamPrintStarted && !streamPrintEnded) {
            process.stdout.write("\n");
            streamPrintEnded = true;
          }
          sayAsAssistant(assistantContent, renderEmotionPrefix(resolvedEmotion));
        }
        addLatency("emit", emitStartedAtMs);
      }
      const turnLatencySummary = buildTurnLatencySummary({
        breakdown: latencyBreakdown,
        totalMs: Date.now() - latencyStartedAtMs
      });
      trace.latencyBreakdown = turnLatencySummary.breakdown;
      trace.latencyTotalMs = turnLatencySummary.totalMs;
      if (identityGuard.corrected) {
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
      if (relationalGuard.corrected || recallGroundingGuard.corrected || pronounRoleGuard.corrected || temporalPhraseGuard.corrected) {
        await appendLifeEvent(personaPath, {
          type: "memory_contamination_flagged",
          payload: {
            flags: [
              ...new Set([
                ...relationalGuard.flags,
                ...recallGroundingGuard.flags,
                ...pronounRoleGuard.flags,
                ...temporalPhraseGuard.flags
              ])
            ],
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
      if (relationalGuard.corrected || recallGroundingGuard.corrected || temporalPhraseGuard.corrected) {
        assistantMeta.credibilityScore = 0.2;
        assistantMeta.contaminationFlags = [
          ...new Set([...relationalGuard.flags, ...recallGroundingGuard.flags, ...temporalPhraseGuard.flags])
        ];
        assistantMeta.excludedFromRecall = true;
      } else {
        applyJudgmentToMemoryMeta(assistantMeta, storedJudgment.label, fictionReadingTurn);
      }
      await appendLifeEvent(personaPath, {
        type: "assistant_message",
        payload: {
          text: assistantContent,
          trace: compactDecisionTrace(trace),
          metaTraceId: metaTraceId ?? null,
          promptLeakGuard: lastOutputGuardTrace,
          identityGuard,
          relationalGuard,
          recallGroundingGuard,
          temporalPhraseGuard,
          memoryMeta: assistantMeta
        }
      });
      await appendLifeEvent(personaPath, {
        type: "turn_latency_profiled",
        payload: {
          totalMs: trace.latencyTotalMs ?? null,
          breakdown: trace.latencyBreakdown ?? null,
          reasoningDepth: trace.reasoningDepth ?? "deep",
          slowHintEmitted,
          streamed: streamReplyEnabled,
          ttftMs: firstTokenAtMs ? Math.max(0, firstTokenAtMs - turnStartedAtMs) : null,
          ttfsMs: firstSentenceAtMs ? Math.max(0, firstSentenceAtMs - turnStartedAtMs) : null,
          ttfrMs: Math.max(0, Date.now() - turnStartedAtMs)
        }
      });
      lastAssistantOutput = assistantContent;
      lastAssistantAt = Date.now();
      dispatchNonPollingSignal("assistant_turn_committed");
      // Parse soulseed-fix proposal from Beta's response (Plan B fix proposal flow)
      if (!pendingProposedFix) {
        const fixRe = /```soulseed-fix\r?\npath:\s*(.+?)\r?\ndescription:\s*(.+?)\r?\n---\r?\n([\s\S]*?)```/;
        const fixMatch = fixRe.exec(assistantContent);
        if (fixMatch) {
          const rawPath = fixMatch[1].trim();
          const description = fixMatch[2].trim();
          const proposedContent = fixMatch[3];
          if (rawPath && proposedContent !== undefined) {
            pendingProposedFix = {
              path: path.resolve(rawPath),
              content: proposedContent,
              description
            };
            emitPersonaSystemMessageFromRaw(`Beta 提案了一个修改（${description}）。输入「确认修复」查看改动并决定是否应用，或输入「取消」放弃。`);
          }
        }
      }
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
      try {
        const nextInterests = await updateInterestsFromTurn(personaPath, {
          userInput: input,
          assistantOutput: assistantContent,
          llmAdapter: adapter
        });
        personaPkg.interests = {
          topTopics: nextInterests.interests.slice(0, 5).map((item) => item.topic),
          curiosity: computeInterestCuriosity(nextInterests),
          updatedAt: nextInterests.updatedAt
        };
      } catch {
        // interest update failure should not block the main dialogue path
      }
      // P2-0: 每轮更新内在情绪状态（非阻塞，静默失败）
      evolveMoodStateFromTurn(personaPath, { userInput: input, assistantOutput: assistantContent, moodDeltaScale: genomeDerived.moodDeltaScale, baselineRegressionSpeed: genomeDerived.baselineRegressionSpeed })
        .then((mood) => { personaPkg.moodState = mood; })
        .catch(() => {});
      await handleNarrativeDrift(personaPath, personaPkg.constitution, input, assistantContent);
      // LLM 驱动的每轮用户事实提取（非阻塞，静默失败）
      if (adapter) {
        extractUserFactsFromTurn({
          userInput: input,
          assistantReply: assistantContent,
          adapter,
          rootPath: personaPath
        }).catch(() => {});
      }
      await runSelfRevisionLoop({
        personaPath,
        personaPkg,
        userInput: input,
        assistantReply: assistantContent,
        metaStyleSignals: metaReviewStyleSignals
      });
      await updateCognitionAfterTurnCommit({
        personaPath,
        personaPkg,
        routeDecision: trace.routeDecision ?? null,
        guardCorrected:
          identityGuard.corrected ||
          relationalGuard.corrected ||
          recallGroundingGuard.corrected ||
          pronounRoleGuard.corrected ||
          temporalPhraseGuard.corrected,
        refused: false
      });

      const nextWeights = adaptWeights(memoryWeights, {
        activationDelta: profilePatch?.preferredName ? 0.02 : 0.01,
        emotionDelta:
          identityGuard.corrected ||
          relationalGuard.corrected ||
          recallGroundingGuard.corrected ||
          pronounRoleGuard.corrected ||
          temporalPhraseGuard.corrected
            ? 0.02
            : 0,
        narrativeDelta:
          identityGuard.corrected ||
          relationalGuard.corrected ||
          recallGroundingGuard.corrected ||
          pronounRoleGuard.corrected ||
          temporalPhraseGuard.corrected
            ? 0.02
            : 0.01
      });
      if (JSON.stringify(nextWeights) !== JSON.stringify(memoryWeights)) {
        await appendLifeEvent(personaPath, {
          type: "memory_weight_updated",
          payload: {
            oldWeights: memoryWeights,
            newWeights: nextWeights,
            reason:
              identityGuard.corrected ||
              relationalGuard.corrected ||
              recallGroundingGuard.corrected ||
              pronounRoleGuard.corrected ||
              temporalPhraseGuard.corrected
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

      // 每20轮触发一次周期性维护：user_facts 自动提取 + pinned 自动积累
      chatTurnCount += 1;
      if (chatTurnCount % 20 === 0) {
        try {
          // user_facts 自动提取：从 episodic 记忆中毕业高频事实
          await graduateFactsFromMemories(personaPath);
        } catch {
          // 静默失败，不影响主流程
        }
        try {
          // pinned 自动积累：将高显著度 warm semantic 记忆钉住
          await autoPromoteHighSalienceMemories(personaPath, personaPkg);
        } catch {
          // 静默失败，不影响主流程
        }
      }

      // life.log rotation (only when memoryPolicy.maxLifeLogEntries is set)
      void rotateLifeLogIfNeeded(personaPath, personaPkg.persona.memoryPolicy).catch(() => {
        // 静默失败，不影响主流程
      });
        }

        rl.prompt();
      })
      .catch((error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        emitPersonaSystemMessageFromRaw(`我这轮处理失败了：${msg}`);
        rl.prompt();
      });
  });

  rl.on("close", () => {
    stopProactive();
    void (async () => {
      try {
        if (!skipBackgroundMaintenance) {
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
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        await emitPersonaSystemMessageNow(`系统提示：会话关闭清理未完全完成（${msg}）`);
      } finally {
        await emitPersonaSystemMessageNow("会话已关闭。");
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
    const MAX_CHARS = 200_000;
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

function isExitConfirmed(input: string): boolean {
  if (detectQuickFeedbackIntent(input) === "positive") {
    return true;
  }
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "确认退出" ||
    normalized === "confirm exit" ||
    normalized === "yes" ||
    normalized === "/exit" ||
    normalized === "退出会话" ||
    normalized === "结束会话" ||
    normalized === "我走了" ||
    normalized === "我走啦" ||
    normalized === "先走了" ||
    normalized === "先走啦" ||
    normalized === "我先走了" ||
    normalized === "再见" ||
    normalized === "拜拜" ||
    normalized === "bye"
  );
}

function isReadConfirmed(input: string): boolean {
  if (detectQuickFeedbackIntent(input) === "positive") {
    return true;
  }
  const normalized = input.trim().toLowerCase();
  return (
    normalized === "确认读取" ||
    normalized === "确认" ||
    normalized === "confirm read" ||
    normalized === "confirm" ||
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "ok" ||
    normalized === "okay" ||
    normalized === "嗯" ||
    normalized === "嗯嗯" ||
    normalized === "好" ||
    normalized === "好的" ||
    normalized === "好啊" ||
    normalized === "行" ||
    normalized === "可以" ||
    normalized === "是" ||
    normalized === "是的"
  );
}

function isCancelIntent(input: string): boolean {
  if (detectQuickFeedbackIntent(input) === "negative") {
    return true;
  }
  const normalized = input.trim().toLowerCase();
  return normalized === "取消" || normalized === "cancel" || normalized === "no";
}

function detectQuickFeedbackIntent(input: string): "positive" | "negative" | "unknown" {
  const raw = input.trim();
  if (!raw || raw.length > 40) {
    return "unknown";
  }
  const normalized = raw
    .toLowerCase()
    .replace(/[。！？!?~～,.，、\s]+$/gu, "")
    .trim();
  const positivePatterns: RegExp[] = [
    /^(好|好啊|好的|行|可以|是|是的|嗯|嗯嗯|对|对的|没错|继续|接着|就这个|就是|就要这个|开读|开始|来吧|ok|okay|yes|yep|yeah|sure|go ahead)$/u,
    /^(可以了|可以的|没问题|同意|确认|确认一下|确认读取|确认继续)$/u
  ];
  const negativePatterns: RegExp[] = [
    /^(不|不要|不行|算了|先别|别|取消|不用了|停|停下|不是|no|nah|nope|cancel)$/u,
    /^(先不|不用|别读了|先别读|不要了)$/u
  ];
  if (positivePatterns.some((pattern) => pattern.test(normalized))) {
    return "positive";
  }
  if (negativePatterns.some((pattern) => pattern.test(normalized))) {
    return "negative";
  }
  return "unknown";
}

function isFixProtectedPath(filePath: string): boolean {
  // Protect default persona files from being overwritten via fix proposals
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.includes('/personas/defaults/');
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

function buildGroupParticipationReply(
  mode: "wait" | "brief_ack" | "speak" | undefined,
  addressedToAssistant: boolean
): string {
  if (mode === "wait") {
    return addressedToAssistant
      ? "我先听你们把这段说完，点到我我就马上接。"
      : "我先听你们继续，等你点我再接。";
  }
  if (mode === "brief_ack") {
    return addressedToAssistant
      ? "我先接一句：我在听。你们先把分歧点说清，我再给结论。"
      : "我先轻轻接一句：你们继续，我先不抢话。";
  }
  return "我在听，你们先继续。";
}

function shouldInjectExternalKnowledge(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) {
    return false;
  }
  if (/你是谁|我是谁|名字|叫我|记得我|我们之间|关系|亲密|你还记得/u.test(text)) {
    return false;
  }
  return (
    /是什么|为什么|怎么|如何|定义|原理|事实|资料|出处|论文|what is|why|how|definition|fact|source|paper/.test(text) ||
    text.length >= 18
  );
}

type GoalAssistIntent =
  | { kind: "none" }
  | { kind: "resume"; goalId: string; resumeInput: string }
  | { kind: "progress"; reply: string };

async function resolveGoalAssistIntent(rootPath: string, input: string): Promise<GoalAssistIntent> {
  const text = input.trim();
  if (!text) {
    return { kind: "none" };
  }

  const wantsProgress = /做到哪一步|进度|进展|status of goal|goal status|how far|目前进展/u.test(text);
  const wantsResume = /继续上次任务|继续任务|继续这个任务|resume( goal)?|continue task/i.test(text);
  if (!wantsProgress && !wantsResume) {
    return { kind: "none" };
  }

  const candidates = await listGoals(rootPath, { limit: 20 });
  if (candidates.length === 0) {
    return wantsProgress
      ? { kind: "progress", reply: "目前还没有可汇报的任务进度。你可以先给我一个目标。" }
      : { kind: "none" };
  }

  if (wantsProgress) {
    const latest = candidates[0];
    const goal = await getGoal(rootPath, latest.id);
    if (!goal) {
      return { kind: "progress", reply: "我暂时读不到目标详情，你可以让我重新创建并继续执行。" };
    }
    const context = await getGoalContext(rootPath, latest.id);
    const finished = goal.steps.filter((item) => item.status === "succeeded").length;
    const total = goal.steps.length;
    const nextHint = context?.nextStepHint ? `下一步：${context.nextStepHint}` : "下一步：等待你确认继续。";
    return {
      kind: "progress",
      reply: `当前任务「${goal.title}」状态：${goal.status}，已完成 ${finished}/${total} 步。${nextHint}`
    };
  }

  const resumable = candidates.find((item) =>
    item.status === "active" ||
    item.status === "suspended" ||
    item.status === "blocked" ||
    item.status === "pending"
  );
  const target = resumable ?? candidates[0];
  if (!target) {
    return { kind: "none" };
  }
  const goal = await getGoal(rootPath, target.id);
  if (!goal) {
    return { kind: "none" };
  }
  const context = await getGoalContext(rootPath, target.id);
  const resumeInput = context?.nextStepHint
    ? `${goal.title}\n续做提示: ${context.nextStepHint}`
    : goal.title;
  return {
    kind: "resume",
    goalId: target.id,
    resumeInput
  };
}

function resolveJudgmentAdvice(
  activeReadingSource: { kind: "file" | "web"; uri: string; content: string; mode: ReadingContentMode } | null,
  fictionReadingTurn: boolean
): PersonaJudgmentLabel | undefined {
  if (fictionReadingTurn) {
    return "fiction";
  }
  if (activeReadingSource?.mode === "fiction") {
    return "fiction";
  }
  if (activeReadingSource?.mode === "non_fiction") {
    return "non_fiction";
  }
  return undefined;
}

function buildJudgmentSubjectRef(input: string, trace: DecisionTrace): string {
  const digest = createHash("sha256").update(`${trace.timestamp}|${input}`, "utf8").digest("hex").slice(0, 16);
  return `turn:${trace.timestamp}:${digest}`;
}

function applyJudgmentToMemoryMeta(
  meta: {
    credibilityScore?: number;
    contaminationFlags?: string[];
    excludedFromRecall?: boolean;
  },
  label: PersonaJudgmentLabel,
  fictionReadingTurn: boolean
): void {
  if (label === "fiction") {
    meta.credibilityScore = Math.max(meta.credibilityScore ?? 0.8, 0.62);
    meta.contaminationFlags = [...new Set([...(meta.contaminationFlags ?? []), "fiction_context", "fictional_content_retained"])];
    return;
  }
  if (label === "mixed") {
    meta.credibilityScore = Math.min(meta.credibilityScore ?? 0.8, 0.66);
    meta.contaminationFlags = [...new Set([...(meta.contaminationFlags ?? []), "mixed_context"])];
    return;
  }
  if (label === "uncertain") {
    meta.credibilityScore = Math.min(meta.credibilityScore ?? 0.8, 0.52);
    meta.contaminationFlags = [...new Set([...(meta.contaminationFlags ?? []), "uncertain_context"])];
    meta.excludedFromRecall = false;
    return;
  }
  if (fictionReadingTurn) {
    meta.credibilityScore = Math.min(meta.credibilityScore ?? 0.8, 0.72);
  }
}

function sampleHumanPacedTargetMs(replyText: string): number {
  const length = replyText.trim().length;
  let minMs = 1200;
  let maxMs = 2500;
  if (length >= 80 && length < 260) {
    minMs = 2500;
    maxMs = 5000;
  } else if (length >= 260) {
    minMs = 4000;
    maxMs = 8000;
  }
  const base = Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
  const jitterRatio = (Math.random() * 0.3) - 0.15;
  return Math.max(800, Math.round(base * (1 + jitterRatio)));
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeAutonomyText(raw: string): string {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const cleaned = lines
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

function stripStageDirections(raw: string): string {
  if (!raw) {
    return raw;
  }
  return raw
    .replace(/（[^）\n]{1,28}）/gu, " ")
    .replace(/\([^)\n]{1,28}\)/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function stripPromptArtifactTags(raw: string): string {
  if (!raw) {
    return raw;
  }
  return raw
    .replace(/\[(?:思考|内心独白|内部思考|已按边界与一致性规则调整输出)\]\s*/giu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function isDramaticRoleplayOpener(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  if (/^你猜/u.test(normalized)) {
    return true;
  }
  return /你猜我昨晚梦到什么了|你猜我梦到什么了|我昨晚梦到/u.test(normalized);
}

function shouldKeepDetailedReply(input: string): boolean {
  const text = input.trim().toLowerCase();
  if (!text) {
    return false;
  }
  return /(详细|完整|步骤|逐步|分析|展开|细讲|深挖|多说点|例子|explain|detail|step by step|analy)/u.test(text);
}

function compactReplyForChatPace(reply: string, userInput: string): string {
  if (shouldKeepDetailedReply(userInput)) {
    return reply;
  }
  const text = reply.trim();
  if (!text) {
    return reply;
  }
  if (/```/.test(text) || /https?:\/\//i.test(text) || /(^|\n)\d+\.\s+/u.test(text) || /(^|\n)-\s+/u.test(text)) {
    return reply;
  }
  if (text.length <= 520 && text.split(/\n+/).length <= 5) {
    return reply;
  }
  const firstLine = text.split(/\n+/)[0]?.trim() ?? text;
  const sentences = firstLine
    .split(/(?<=[。！？!?])/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (sentences.length === 0) {
    return firstLine.slice(0, 420);
  }
  return sentences.slice(0, 4).join("").slice(0, 420);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

async function performReadAttachment(params: {
  rawPath: string;
  personaPath: string;
  toolSession: ReturnType<typeof createToolSessionState>;
  setAbortController: (controller: AbortController | null) => void;
  onDone: () => void;
  attachedFiles: Map<string, string>;
  approvedReadPaths: Set<string>;
  onLoaded?: (payload: { path: string; content: string }) => void;
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
      allowedReadRoots: [resolvedPath]
    },
    session: params.toolSession,
    signal: controller.signal,
    run: async (signal) => readTextAttachmentResolved(resolvedPath, signal)
  });
  params.setAbortController(null);
  params.onDone();

  if (outcome.status !== "ok" || !outcome.result) {
    params.attachedFiles.delete(resolvedPath);
    params.approvedReadPaths.delete(resolvedPath);
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
  params.onLoaded?.({ path: outcome.result.path, content: outcome.result.content });
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

async function performUrlFetch(params: {
  url: string;
  personaPath: string;
  toolSession: ReturnType<typeof createToolSessionState>;
  setAbortController: (controller: AbortController | null) => void;
  onDone: () => void;
  fetchedUrls: Map<string, string>;
  approvedFetchOrigins: Set<string>;
  onLoaded?: (payload: { url: string; content: string }) => void;
}): Promise<void> {
  try {
    const origin = new URL(params.url).origin;
    if (origin) {
      params.approvedFetchOrigins.add(origin);
    }
  } catch {
    // ignore malformed URL
  }
  const controller = new AbortController();
  params.setAbortController(controller);
  const toolCallId = randomUUID();
  console.log(`正在获取: ${params.url}`);
  const outcome = await executeToolCall({
    toolName: "net.fetch_url",
    impact: {
      estimatedDurationMs: 15000
    },
    approval: {
      approved: true,
      reason: "capability session.fetch_url",
      budget: {
        maxCallsPerSession: 32,
        maxDurationMs: 20000
      }
    },
    session: params.toolSession,
    signal: controller.signal,
    run: (signal) => fetchUrlContent(params.url, signal)
  });
  params.setAbortController(null);
  params.onDone();

  if (outcome.status !== "ok" || !outcome.result) {
    console.log(`获取失败: ${outcome.reason}`);
    await appendLifeEvent(params.personaPath, {
      type: "mcp_tool_rejected",
      payload: {
        toolName: outcome.toolName,
        callId: toolCallId,
        reason: outcome.reason,
        status: outcome.status,
        budgetSnapshot: outcome.budgetSnapshot,
        url: params.url
      }
    });
    return;
  }

  params.fetchedUrls.set(outcome.result.url, outcome.result.content);
  params.onLoaded?.({ url: outcome.result.url, content: outcome.result.content });
  try {
    const origin = new URL(outcome.result.url).origin;
    if (origin) {
      params.approvedFetchOrigins.add(origin);
    }
  } catch {
    // ignore malformed URL from tool response
  }
  console.log(`已获取: ${outcome.result.url} (${outcome.result.size} bytes)`);
  await appendLifeEvent(params.personaPath, {
    type: "mcp_tool_called",
    payload: {
      toolName: outcome.toolName,
      callId: toolCallId,
      approvalReason: outcome.reason,
      budgetSnapshot: outcome.budgetSnapshot,
      durationMs: outcome.durationMs,
      url: outcome.result.url,
      result: {
        url: outcome.result.url,
        size: outcome.result.size,
        contentType: outcome.result.contentType
      }
    }
  });
}

function injectAttachments(
  input: string,
  attachedFiles: Map<string, string>,
  fetchedUrls: Map<string, string>,
  activeReadingSource: { kind: "file" | "web"; uri: string; content: string; mode: ReadingContentMode } | null
): string {
  if (attachedFiles.size === 0 && fetchedUrls.size === 0) {
    return input;
  }

  const blocks: string[] = [];
  for (const [filePath, content] of attachedFiles.entries()) {
    blocks.push(`[Attachment: ${filePath}]\n${content}`);
  }
  for (const [url, content] of fetchedUrls.entries()) {
    blocks.push(`[Web: ${url}]\n${content}`);
  }

  const modeHint =
    activeReadingSource?.mode === "fiction"
      ? "当前共读材料模式: fiction（虚构叙事，不应当作用户真实经历）。"
      : activeReadingSource?.mode === "non_fiction"
        ? "当前共读材料模式: non_fiction（现实信息，可按资料阅读）。"
        : "当前共读材料模式: unknown。";

  return [
    "以下是用户附加的本地文件或网页内容，请优先基于这些内容回答：",
    modeHint,
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

function detectReadingFollowUpIntent(
  inputRaw: string,
  readingAwaitingContinue: boolean
): "none" | "continue" | "restart" | "summary" {
  const input = inputRaw.trim().toLowerCase();
  if (!input) {
    return "none";
  }
  if (/(^总结|概括|summary|讲讲重点|说说重点|简要说)/u.test(input)) {
    return "summary";
  }
  if (/(从头|重新读|重读|开头开始|read from start|start over)/u.test(input)) {
    return "restart";
  }
  if (/(继续|接着|往下读|继续读|next|continue|下一段|下一节)/u.test(input)) {
    return "continue";
  }
  if (readingAwaitingContinue && isReadConfirmed(inputRaw)) {
    return "continue";
  }
  return "none";
}

function isReadingStatusQuery(inputRaw: string): boolean {
  const input = inputRaw.trim().toLowerCase();
  if (!input) {
    return false;
  }
  return /(看完了吗|读完了吗|读完了嘛|看完了嘛|都读完了?吗|看完没|读完没|你都读完了吗)/u.test(input);
}

function isReadingTogetherRequest(inputRaw: string): boolean {
  const input = inputRaw.trim().toLowerCase();
  if (!input) {
    return false;
  }
  return /(一起看|一起读|我们一起看|我们一起读|看一看|看看|读一读|读一下)/u.test(input);
}

function isReadingSourceClarification(inputRaw: string): boolean {
  const input = inputRaw.trim().toLowerCase();
  if (!input) {
    return false;
  }
  return /(不是我的记忆|不是我的|外面的文章|外部文章|外面的小说|网站文章|不是我写的)/u.test(input);
}

function classifyReadingContentMode(contentRaw: string, uri: string): ReadingContentMode {
  const content = contentRaw.trim().slice(0, 4000);
  const lowered = content.toLowerCase();
  const fictionSignals = [
    /小说|剧情|主角|章节|第[一二三四五六七八九十\d]+章|番外|对白|她说|他说|忽然|那天/u,
    /\bnovel\b|\bfiction\b|\bchapter\b|\bprotagonist\b/i,
    /“[^”]{2,40}”/u
  ];
  const nonFictionSignals = [
    /报道|研究|论文|数据|结论|来源|参考|定义|百科|维基|指标/u,
    /\breport\b|\bresearch\b|\bpaper\b|\bdata\b|\bsource\b|\bdefinition\b/i
  ];
  const fictionScore = fictionSignals.reduce((acc, pattern) => acc + (pattern.test(content) ? 1 : 0), 0);
  const nonFictionScore = nonFictionSignals.reduce((acc, pattern) => acc + (pattern.test(content) ? 1 : 0), 0);
  const uriLower = uri.toLowerCase();
  if (fictionScore >= 2 && fictionScore >= nonFictionScore) {
    return "fiction";
  }
  if (nonFictionScore >= 2 && nonFictionScore > fictionScore) {
    return "non_fiction";
  }
  if (/\/article\/|\/novel\/|\/book\//.test(uriLower) && /他说|她说|小说|剧情|chapter|novel/i.test(lowered)) {
    return "fiction";
  }
  if (/wiki|docs|paper|arxiv|report|news/.test(uriLower)) {
    return "non_fiction";
  }
  return "unknown";
}

function shouldTreatTurnAsFictionReading(
  inputRaw: string,
  activeReadingSource: { kind: "file" | "web"; uri: string; content: string; mode: ReadingContentMode } | null,
  readingSourceScope: "unknown" | "external"
): boolean {
  if (!activeReadingSource) {
    return false;
  }
  const input = inputRaw.trim();
  if (!input) {
    return false;
  }
  if (/小说|剧情|人物|章节|继续读|一起看|一起读|这一段|这一章|看完了吗|读完了吗|总结一下/u.test(input)) {
    return true;
  }
  if (readingSourceScope === "external" && /外部文章|这篇文章|网站内容|原文/u.test(input)) {
    return true;
  }
  return false;
}

function readChunkByCursor(
  contentRaw: string,
  start: number,
  maxChars: number
): { text: string; nextCursor: number; done: boolean } {
  const content = contentRaw.trim();
  if (!content || start >= content.length) {
    return { text: "", nextCursor: content.length, done: true };
  }
  const safeMax = Math.max(260, Math.min(1200, maxChars));
  let end = Math.min(content.length, start + safeMax);
  if (end < content.length) {
    const probeEnd = Math.min(content.length, end + 180);
    const window = content.slice(end, probeEnd);
    const boundary = window.search(/[。！？!?…\n]/u);
    if (boundary >= 0) {
      end += boundary + 1;
    }
  }
  const text = content.slice(start, end).trim();
  return {
    text,
    nextCursor: end,
    done: end >= content.length
  };
}

function buildReadingSummary(contentRaw: string): string {
  const content = contentRaw.replace(/\s+/g, " ").trim();
  if (!content) {
    return "这份内容目前没有可读文本。";
  }
  const sentences = content
    .split(/(?<=[。！？!?])/u)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (sentences.length === 0) {
    return content.slice(0, 220);
  }
  return sentences.slice(0, 3).join(" ").slice(0, 280);
}

function readingLabelFromUri(uri: string): string {
  const normalized = uri.trim();
  if (!normalized) {
    return "这份内容";
  }
  try {
    const parsed = new URL(normalized);
    const pathLabel = parsed.pathname.replace(/\/+$/u, "").split("/").filter(Boolean).pop();
    return pathLabel ? `${parsed.hostname}/${pathLabel}` : parsed.hostname;
  } catch {
    return normalized.split(/[\\/]/).filter(Boolean).pop() ?? normalized;
  }
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

  const rewritten = buildLoopRecoveryReply(params.userInput);
  return {
    triggered: true,
    original: params.assistantContent,
    rewritten,
    reason: `duplicate_recent_assistant x${sameCount}`
  };
}

function buildLoopRecoveryReply(userInput: string): string {
  const normalized = userInput.trim().toLowerCase();
  if (!normalized) {
    return "我们继续。你想让我接着往下说，还是先换个角度？";
  }
  if (isReadConfirmed(userInput)) {
    return "好，我们继续。你想让我接着读下一段，还是先总结这一段？";
  }
  if (/[?？]$/.test(userInput.trim()) || /为什么|怎么|如何|啥|吗|嘛|是否/u.test(userInput)) {
    return `你这个问题我收到了：${userInput.trim()}。我直接接着回答。`;
  }
  return `好，我们就接着你这句往下聊：${userInput.trim()}`;
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
  // P0-12: Environment pre-check (always runs first)
  const envResults = await checkEnvironment();
  console.log("\n[doctor] 环境检查 / Environment check:");
  let envOk = true;
  for (const r of envResults) {
    const status = r.ok ? "✓" : "✗";
    console.log(`  ${status} ${r.component}: ${r.message}`);
    if (!r.ok) {
      envOk = false;
      if (r.hint) console.log(`    → 修复：${r.hint}`);
    }
  }
  if (!envOk) {
    console.error("\n[doctor] 环境缺少必需依赖，部分检查可能失败。请先按上方提示安装后重试。");
    process.exitCode = 1;
  }
  console.log();

  const personaPath = resolvePersonaPath(options);

  // --check-drift: 行为漂移检测（P3-6）
  // --check-constitution: 宪法质量评分（P3-7）
  if (options["check-constitution"]) {
    const personaPkg = await loadPersonaPackage(personaPath);
    const report = scoreConstitutionQuality(personaPkg.constitution, personaPkg.worldview);
    console.log(JSON.stringify(report, null, 2));
    const grade = report.grade;
    console.log(`[doctor] 宪法质量评分：${report.totalScore}/100 (${grade})`);
    if (report.topIssues.length > 0) {
      console.log("[doctor] 优先改进项：");
      report.topIssues.forEach((issue) => console.log(`  - ${issue}`));
    }
    if (grade === "D") {
      process.exitCode = 2;
    }
    return;
  }

  if (options["check-drift"]) {
    const personaPkg = await loadPersonaPackage(personaPath);
    const personaId = personaPkg.persona.id;
    const allLifeEvents = await readLifeEvents(personaPath);
    const lifeEvents = allLifeEvents.slice(-200);
    const metrics = computeBehaviorMetrics(lifeEvents);
    const turnCount = lifeEvents.filter((e) =>
      ["assistant_message", "agent_turn_completed", "soul_turn_completed"].includes(e.type)
    ).length;
    await saveBehaviorSnapshot(personaPath, personaId, metrics, turnCount);
    const driftReport = await detectBehaviorDrift(personaPath, personaId);
    console.log(JSON.stringify(driftReport, null, 2));
    if (driftReport.hasDrift) {
      console.error(
        `[doctor] 检测到行为漂移：${driftReport.drifts.filter((d) => d.exceeded).length} 个维度超出阈值`
      );
      process.exitCode = 2;
    } else {
      console.log("[doctor] 行为漂移检测：无漂移");
    }
    return;
  }

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

function isReservedRootCommand(token: string | undefined): boolean {
  if (!token) {
    return false;
  }
  return RESERVED_ROOT_COMMANDS.has(token);
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

async function runMemoryFictionRepair(options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  const dryRun = optionBoolean(options, "dry-run");
  const report = await repairFictionalMemories(personaPath, { dryRun });
  console.log(JSON.stringify({ ok: true, ...report }, null, 2));
}

async function repairFictionalMemories(
  rootPath: string,
  options?: { dryRun?: boolean }
): Promise<{ scanned: number; flagged: number; updated: number; sampleIds: string[] }> {
  await ensureMemoryStore(rootPath);
  const scannedRaw = await runMemoryStoreSql(
    rootPath,
    "SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL;"
  );
  const scanned = Number.parseInt(scannedRaw.trim(), 10) || 0;
  const candidateRaw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT id",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND (",
      "lower(content) LIKE '%不是我的记忆%'",
      "OR lower(content) LIKE '%外部文章%'",
      "OR lower(content) LIKE '%这是你的记忆吗%'",
      "OR lower(content) LIKE '%你让我记住吗%'",
      "OR lower(content) LIKE '%你给我看过多少篇%'",
      "OR lower(content) LIKE '%你给我看过哪些%'",
      ")",
      "ORDER BY updated_at DESC",
      "LIMIT 5000;"
    ].join("\n")
  );
  const flaggedIds = candidateRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const now = new Date().toISOString();
  let updated = 0;
  if (!options?.dryRun && flaggedIds.length > 0) {
    const eligibleRaw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT COUNT(*) FROM memories",
        `WHERE id IN (${flaggedIds.map((id) => sqlText(id)).join(",")})`,
        "AND (excluded_from_recall = 0 OR credibility_score > 0.25 OR evidence_level <> 'uncertain');"
      ].join(" ")
    );
    updated = Number.parseInt(eligibleRaw.trim(), 10) || 0;
    const sql = [
      "BEGIN;",
      [
        "UPDATE memories",
        "SET excluded_from_recall = 1,",
        "credibility_score = MIN(credibility_score, 0.25),",
        "evidence_level = 'uncertain',",
        `updated_at = ${sqlText(now)}`,
        `WHERE id IN (${flaggedIds.map((id) => sqlText(id)).join(",")})`,
        "AND (excluded_from_recall = 0 OR credibility_score > 0.25 OR evidence_level <> 'uncertain');"
      ].join(" "),
      "COMMIT;"
    ].join("\n");
    await runMemoryStoreSql(rootPath, sql);
    if (updated > 0) {
      await appendLifeEvent(rootPath, {
        type: "memory_contamination_flagged",
        payload: {
          flags: ["fiction_memory_repaired"],
          count: updated,
          sampleIds: flaggedIds.slice(0, 50)
        }
      });
    }
  }
  return {
    scanned,
    flagged: flaggedIds.length,
    updated,
    sampleIds: flaggedIds.slice(0, 20)
  };
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
  const providerRaw = (optionString(options, "provider") ?? "openai").trim().toLowerCase();
  const provider: "openai" | "deepseek" | "local" = providerRaw === "local" ? "local" : providerRaw === "deepseek" ? "deepseek" : "openai";
  const batchSize = parseLimit(optionString(options, "batch-size"), 16, 1, 64);

  if (action === "rebuild") {
    await runMemoryStoreSql(personaPath, "DELETE FROM memory_embeddings;");
  } else if (action !== "build") {
    throw new Error("memory index 用法: memory index <build|rebuild> [--provider openai|local] [--batch-size N]");
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

async function runMemoryLearn(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (action === "status") {
    const status = await inspectExternalKnowledgeStore(personaPath);
    console.log(JSON.stringify({ ok: true, ...status }, null, 2));
    return;
  }

  if (action === "stage") {
    const sourceUri = optionString(options, "source")?.trim() ?? "";
    if (!sourceUri) {
      throw new Error("memory learn stage 需要 --source <uri>");
    }
    const sourceTypeRaw = (optionString(options, "source-type") ?? inferSourceTypeFromUri(sourceUri)).trim().toLowerCase();
    const sourceType = sourceTypeRaw === "website" || sourceTypeRaw === "file" ? sourceTypeRaw : "manual";
    const contentFromText = optionString(options, "text");
    const fromFile = optionString(options, "from-file");
    let content = typeof contentFromText === "string" ? contentFromText : "";
    if (!content && typeof fromFile === "string" && fromFile.trim().length > 0) {
      const resolved = path.resolve(process.cwd(), fromFile.trim());
      content = await readFile(resolved, "utf8");
    }
    if (!content.trim()) {
      throw new Error("memory learn stage 需要 --text <content> 或 --from-file <path>");
    }
    const confidenceRaw = Number(optionString(options, "confidence") ?? "0.62");
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.62;
    const staged = await stageExternalKnowledgeCandidate(personaPath, {
      sourceType,
      sourceUri,
      content,
      confidence
    });
    console.log(JSON.stringify({ ok: true, candidate: staged }, null, 2));
    return;
  }

  if (action === "candidates") {
    const statusRaw = optionString(options, "status")?.trim().toLowerCase();
    const status = statusRaw === "pending" || statusRaw === "approved" || statusRaw === "rejected" ? statusRaw : undefined;
    const limit = parseLimit(optionString(options, "limit"), 20, 1, 200);
    const items = await listExternalKnowledgeCandidates(personaPath, {
      status,
      limit
    });
    console.log(JSON.stringify({ ok: true, count: items.length, items }, null, 2));
    return;
  }

  if (action === "review") {
    const id = optionString(options, "id")?.trim();
    if (!id) {
      throw new Error("memory learn review 需要 --id <candidate_id>");
    }
    const approveRaw = optionString(options, "approve");
    if (approveRaw == null) {
      throw new Error("memory learn review 需要 --approve true|false");
    }
    const ownerKey = (process.env.SOULSEED_OWNER_KEY ?? "").trim();
    if (!ownerKey) {
      throw new Error("memory learn review 需要环境变量 SOULSEED_OWNER_KEY");
    }
    const ownerToken = (optionString(options, "owner-token") ?? "").trim();
    if (!ownerToken) {
      throw new Error("memory learn review 需要 --owner-token <token>");
    }
    if (ownerToken !== ownerKey) {
      throw new Error("memory learn review Owner token 校验失败");
    }
    const approve = /^(true|1|yes|on)$/i.test(approveRaw.trim());
    const result = await reviewExternalKnowledgeCandidate(personaPath, {
      candidateId: id,
      approve,
      reviewer: optionString(options, "reviewer") ?? "owner",
      reason: optionString(options, "reason") ?? ""
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (action === "entries") {
    const limit = parseLimit(optionString(options, "limit"), 20, 1, 200);
    const items = await listExternalKnowledgeEntries(personaPath, { limit });
    console.log(JSON.stringify({ ok: true, count: items.length, items }, null, 2));
    return;
  }

  if (action === "search") {
    const query = optionString(options, "query")?.trim();
    if (!query) {
      throw new Error("memory learn search 需要 --query <text>");
    }
    const limit = parseLimit(optionString(options, "limit"), 8, 1, 100);
    const items = await searchExternalKnowledgeEntries(personaPath, query, { limit });
    console.log(JSON.stringify({ ok: true, query, count: items.length, items }, null, 2));
    return;
  }

  throw new Error(
    "memory learn 用法: memory learn <status|stage|candidates|review|entries|search> ..."
  );
}

function inferSourceTypeFromUri(uri: string): "website" | "file" | "manual" {
  const normalized = uri.trim().toLowerCase();
  if (/^https?:\/\//.test(normalized)) {
    return "website";
  }
  if (/^file:\/\//.test(normalized) || normalized.startsWith("/")) {
    return "file";
  }
  return "manual";
}

function resolveFetchOriginAllowlist(): Set<string> {
  const raw = (process.env.SOULSEED_FETCH_ALLOWLIST ?? "").trim();
  const out = new Set<string>();
  if (!raw) {
    return out;
  }
  for (const tokenRaw of raw.split(",")) {
    const token = tokenRaw.trim().toLowerCase();
    if (!token) {
      continue;
    }
    if (token.startsWith("*.")) {
      out.add(token);
      continue;
    }
    if (token.startsWith("http://") || token.startsWith("https://")) {
      try {
        out.add(new URL(token).origin.toLowerCase());
      } catch {
        // ignore invalid token
      }
      continue;
    }
    out.add(token);
  }
  return out;
}

async function runMemoryPin(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);
  if (action === "add") {
    const text = options.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("memory pin add 需要 --text <memory>");
    }
    if (text.trim().length > MAX_PINNED_CHARS) {
      throw new Error(`memory pin add --text 长度不能超过 ${MAX_PINNED_CHARS} 字符`);
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

// P0-14: Persona library CRUD — ss pinned library <list|add|remove>
async function runPinnedLibrary(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaPath(options);

  if (action === "list") {
    const blocks = await listLibraryBlocks(personaPath);
    if (blocks.length === 0) {
      console.log("(persona library is empty — use `ss pinned library add --title <t> --content <c>` to add blocks)");
    } else {
      for (const b of blocks) {
        console.log(`[${b.id}] ${b.title}${b.tags?.length ? " [" + b.tags.join(", ") + "]" : ""}`);
        console.log(`  ${b.content.slice(0, 120)}${b.content.length > 120 ? "..." : ""}`);
      }
    }
    return;
  }

  if (action === "add") {
    const title = optionString(options, "title");
    const content = optionString(options, "content");
    if (!title?.trim()) throw new Error("pinned library add 需要 --title <title>");
    if (!content?.trim()) throw new Error("pinned library add 需要 --content <content>");
    const tags = typeof options.tags === "string" ? options.tags.split(",").map((t) => t.trim()) : undefined;
    const block = await addLibraryBlock(personaPath, { title, content, tags });
    console.log(`已添加 library block: [${block.id}] ${block.title}`);
    return;
  }

  if (action === "remove") {
    const id = optionString(options, "id");
    if (!id?.trim()) throw new Error("pinned library remove 需要 --id <block-id>");
    await removeLibraryBlock(personaPath, id);
    console.log(`已删除 library block: ${id}`);
    return;
  }

  throw new Error("用法: ss pinned library <list|add|remove> [--title <t>] [--content <c>] [--tags <t1,t2>] [--id <id>]");
}

async function autoPromoteHighSalienceMemories(
  personaPath: string,
  personaPkg: { pinned: { memories: string[] } }
): Promise<void> {
  const MAX_AUTO_PINNED = 5;
  const SALIENCE_THRESHOLD = 0.75;
  const currentPinned = new Set(personaPkg.pinned.memories.map((m) => m.trim()));

  if (currentPinned.size >= MAX_AUTO_PINNED) {
    return;
  }

  const rows = await runMemoryStoreSql(
    personaPath,
    `SELECT content FROM memories WHERE memory_type = 'semantic' AND state = 'warm' AND deleted_at IS NULL AND excluded_from_recall = 0 AND salience >= ${SALIENCE_THRESHOLD} ORDER BY salience DESC LIMIT 10;`
  );
  if (!rows.trim()) return;

  for (const line of rows.split("\n").filter(Boolean)) {
    if (currentPinned.size >= MAX_AUTO_PINNED) break;
    const content = line.trim();
    if (!content || content.length < 4 || content.length > 200) continue;
    if (currentPinned.has(content)) continue;
    // 跳过元数据类内容（voice_intent / memory_weight 等）
    if (/^(?:voice intent|memory_weight|preferred_name|user_preferred|\{)/.test(content)) continue;
    const updated = await addPinnedMemory(personaPath, content.slice(0, 200));
    personaPkg.pinned = updated;
    currentPinned.add(content.trim());
  }
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
  const resource = args._[0];
  const handled = await dispatchKnownCommand(args, {
    runPersonaNew,
    runPersonaInit,
    runRename,
    runPersonaReproduce,
    runPersonaInspect,
    runPersonaLint,
    runPersonaCompile,
    runPersonaExport,
    runPersonaImport,
    runPersonaModelRouting,
    runPersonaVoicePhrases,
    runPersonaMood,
    runPersonaAutobiography,
    runPersonaInterests,
    runPersonaDates,
    runPersonaReflect,
    runPersonaArc,
    runPersonaConsentMode,
    runPersonaIdentity,
    runCognitionAdaptRouting,
    runFinetuneExportDataset,
    runExamples,
    runMcp,
    runRefine,
    runSocial,
    runChat,
    runDoctor,
    runGoal,
    runAgentCommand,
    runTrace,
    runExplain,
    runMemoryCompact,
    runMemoryArchive,
    runMemoryIndex,
    runMemorySearch,
    runMemoryEvalRecall,
    runMemoryEvalBudget,
    runMemoryRecallTrace,
    runMemoryConsolidate,
    runMemoryLearn,
    runMemoryStatus,
    runMemoryList,
    runMemoryBudget,
    runMemoryInspect,
    runMemoryForget,
    runMemoryRecover,
    runMemoryFictionRepair,
    runMemoryUnstick,
    runMemoryExport,
    runMemoryImport,
    runMemoryPin,
    runPinnedLibrary,
    runMemoryReconcile,
    runMemoryFacts,
    runSharedSpaceCommand
  });
  if (handled) {
    return;
  }

  if (resource && !isReservedRootCommand(resource) && !resource.startsWith("--")) {
    const personaPath =
      typeof args.options.persona === "string" && args.options.persona.trim().length > 0
        ? path.resolve(process.cwd(), args.options.persona)
        : resolvePersonaPathByName(resource);
    if (!existsSync(personaPath)) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      try {
        const answer = (await askQuestion(
          rl,
          `未找到 persona "${resource}"。是否现在创建并进入聊天？[y/N]: `
        ))
          .trim()
          .toLowerCase();
        if (answer !== "y" && answer !== "yes") {
          throw new Error(`persona 不存在：${personaPath}`);
        }
      } finally {
        rl.close();
      }
      await runPersonaNew(resource, {
        ...args.options,
        out: personaPath,
        ...(typeof args.options.model === "string" ? { model: args.options.model } : {})
      });
    }
    await runChat({
      ...args.options,
      persona: personaPath
    });
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

async function updateCognitionAfterTurnCommit(params: {
  personaPath: string;
  personaPkg: { cognition: { instinctBias: number; epistemicStance: "balanced" | "cautious" | "assertive"; toolPreference: "auto" | "read_first" | "reply_first" } };
  routeDecision: string | null | undefined;
  guardCorrected: boolean;
  refused: boolean;
}): Promise<void> {
  const { personaPath, personaPkg, routeDecision, guardCorrected, refused } = params;
  const routedToInstinct = routeDecision === "instinct";
  // instinctBias: nudge +0.01 when instinct succeeds cleanly, -0.01 otherwise
  const instinctBiasDelta = routedToInstinct && !guardCorrected && !refused ? 0.01 : -0.01;
  const nextInstinctBias = Math.max(0.1, Math.min(0.72, personaPkg.cognition.instinctBias + instinctBiasDelta));
  // epistemicStance: become cautious on guard/refusal; relax back to balanced when stable
  let nextEpistemicStance: "balanced" | "cautious" | "assertive" = personaPkg.cognition.epistemicStance;
  if (guardCorrected || refused) {
    nextEpistemicStance = "cautious";
  } else if (nextEpistemicStance === "cautious") {
    nextEpistemicStance = "balanced";
  }
  const biasChanged = Math.abs(nextInstinctBias - personaPkg.cognition.instinctBias) >= 0.005;
  const stanceChanged = nextEpistemicStance !== personaPkg.cognition.epistemicStance;
  if (!biasChanged && !stanceChanged) {
    return;
  }
  const updated = await patchCognitionState(personaPath, {
    instinctBias: nextInstinctBias,
    epistemicStance: nextEpistemicStance
  });
  personaPkg.cognition = updated;
  await appendLifeEvent(personaPath, {
    type: "cognition_state_updated",
    payload: {
      instinctBias: updated.instinctBias,
      epistemicStance: updated.epistemicStance,
      toolPreference: updated.toolPreference,
      trigger: "turn_commit",
      routeDecision: routeDecision ?? null,
      guardCorrected,
      refused
    }
  });
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
  metaStyleSignals?: { concise: number; reflective: number; direct: number; warm: number };
}): Promise<void> {
  const events = await readLifeEvents(params.personaPath);
  const signals = collectRevisionSignals({
    userInput: params.userInput,
    assistantReply: params.assistantReply,
    events,
    relationshipState: params.personaPkg.relationshipState,
    metaStyleSignals: params.metaStyleSignals
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

// ── P2-4: Crystallization commands ────────────────────────────────────────────

async function runRefine(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaOption(options);
  if (!personaPath) {
    console.error("需要 --persona <path> 参数");
    process.exitCode = 1;
    return;
  }

  if (action === "list") {
    const domain = typeof options.domain === "string" ? options.domain : undefined;
    const status = typeof options.status === "string" ? options.status : undefined;
    const runs = await listCrystallizationRuns(personaPath, {
      domain: domain as ("constitution" | "habits" | "worldview") | undefined,
      status: status as ("pending" | "applied" | "rejected") | undefined,
      limit: 20
    });
    if (runs.length === 0) {
      console.log("（无精炼记录）");
      return;
    }
    for (const run of runs) {
      console.log(`[${run.status.padEnd(8)}] ${run.id.slice(0, 8)} domain=${run.domain} trigger=${run.trigger} diffs=${run.candidateDiff.length} created=${run.createdAt.slice(0, 10)}`);
    }
    return;
  }

  if (action === "sizes") {
    const report = await checkCrystallizationFileSizes(personaPath);
    console.log(`constitution.json: ${report.constitutionBytes}B / 2048B ${report.constitutionOverLimit ? "⚠ OVER LIMIT" : "✓"}`);
    console.log(`habits.json:       ${report.habitsBytes}B / 1024B ${report.habitsOverLimit ? "⚠ OVER LIMIT" : "✓"}`);
    console.log(`worldview.json:    ${report.worldviewBytes}B / 1024B ${report.worldviewOverLimit ? "⚠ OVER LIMIT" : "✓"}`);
    return;
  }

  if (action === "apply") {
    const runId = typeof options.id === "string" ? options.id : undefined;
    if (!runId) {
      console.error("需要 --id <run_id>");
      process.exitCode = 1;
      return;
    }
    const result = await applyCrystallizationRun(personaPath, runId);
    if (result.ok) {
      console.log(`✓ 精炼已应用: ${runId}`);
    } else {
      console.error(`✗ 应用失败: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (action === "reject") {
    const runId = typeof options.id === "string" ? options.id : undefined;
    if (!runId) {
      console.error("需要 --id <run_id>");
      process.exitCode = 1;
      return;
    }
    const result = await rejectCrystallizationRun(personaPath, runId);
    if (result.ok) {
      console.log(`✓ 精炼已拒绝: ${runId}`);
    } else {
      console.error(`✗ 操作失败: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (action === "rollback") {
    const runId = typeof options.id === "string" ? options.id : undefined;
    if (!runId) {
      console.error("需要 --id <run_id>");
      process.exitCode = 1;
      return;
    }
    const result = await rollbackCrystallizationRun(personaPath, runId);
    if (result.ok) {
      console.log(`✓ 精炼已回滚: ${runId}`);
    } else {
      console.error(`✗ 回滚失败: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (action === "diff") {
    const runId = typeof options.id === "string" ? options.id : undefined;
    if (!runId) {
      console.error("需要 --id <run_id>");
      process.exitCode = 1;
      return;
    }
    const runs = await listCrystallizationRuns(personaPath, { limit: 500 });
    const run = runs.find((r) => r.id === runId || r.id.startsWith(runId));
    if (!run) {
      console.error(`精炼记录未找到: ${runId}`);
      process.exitCode = 1;
      return;
    }
    console.log(`精炼详情 [${run.id.slice(0, 8)}] domain=${run.domain} status=${run.status}`);
    if (run.candidateDiff.length === 0) {
      console.log("（无差异项）");
      return;
    }
    for (const diff of run.candidateDiff) {
      console.log(`\n  字段: ${diff.field}`);
      console.log(`  原因: ${diff.rationale}`);
      console.log(`  变更前: ${JSON.stringify(diff.before).slice(0, 120)}`);
      console.log(`  变更后: ${JSON.stringify(diff.after).slice(0, 120)}`);
    }
    return;
  }

  if (action === "review") {
    const subAction = typeof options._args === "string" ? options._args : undefined;
    // Determine sub-action from the args array - it comes as the next positional
    // We parse it from the raw process.argv indirectly via the options map
    // The CLI parser puts the 3rd positional in args[2]
    const rawArgs = process.argv;
    // Find "review" and then the next token
    const reviewIdx = rawArgs.indexOf("review");
    const reviewSubAction = reviewIdx >= 0 ? rawArgs[reviewIdx + 1] : undefined;

    if (reviewSubAction === "list" || (!reviewSubAction && !subAction)) {
      const requests = await listConstitutionReviewRequests(personaPath);
      if (requests.length === 0) {
        console.log("（无宪法审查请求）");
        return;
      }
      for (const req of requests) {
        console.log(`[${req.status.padEnd(8)}] ${req.reviewHash.slice(0, 12)} ts=${req.ts.slice(0, 10)} 原因=${req.reason} 触发=${req.triggeredBy}`);
      }
      return;
    }

    if (reviewSubAction === "approve") {
      const reviewHash = typeof options.id === "string" ? options.id : undefined;
      if (!reviewHash) {
        console.error("需要 --id <review_hash>");
        process.exitCode = 1;
        return;
      }
      const reviewer = typeof options.reviewer === "string" ? options.reviewer : "user";
      const result = await approveConstitutionReview(personaPath, reviewHash, reviewer);
      if (result.ok) {
        console.log(`✓ 宪法审查已批准: ${reviewHash.slice(0, 12)}`);
      } else {
        console.error(`✗ 批准失败: ${result.reason}`);
        process.exitCode = 1;
      }
      return;
    }

    if (reviewSubAction === "reject") {
      const reviewHash = typeof options.id === "string" ? options.id : undefined;
      if (!reviewHash) {
        console.error("需要 --id <review_hash>");
        process.exitCode = 1;
        return;
      }
      const reviewer = typeof options.reviewer === "string" ? options.reviewer : "user";
      const reason = typeof options.reason === "string" ? options.reason : undefined;
      const result = await rejectConstitutionReviewRequest(personaPath, reviewHash, reviewer, reason);
      if (result.ok) {
        console.log(`✓ 宪法审查已拒绝: ${reviewHash.slice(0, 12)}`);
      } else {
        console.error(`✗ 拒绝失败: ${result.reason}`);
        process.exitCode = 1;
      }
      return;
    }

    console.log("用法: ss refine review list|approve|reject [--id <hash>] [--reviewer <name>] [--persona <path>]");
    process.exitCode = 1;
    return;
  }

  // propose: action = "constitution" | "habits" | "worldview"
  const validDomains = ["constitution", "habits", "worldview"] as const;
  if (action && validDomains.includes(action as typeof validDomains[number])) {
    const domain = action as "constitution" | "habits" | "worldview";
    const trigger = options.trigger === "auto" ? "auto" : "manual";
    const run = await proposeConstitutionCrystallization(personaPath, { domain, trigger });
    if (run.candidateDiff.length === 0) {
      console.log(`✓ ${domain} 无需精炼（文件大小和字段均在限制内）`);
      return;
    }
    console.log(`精炼提案已创建 (${run.id.slice(0, 8)})，需要人工确认后写入:`);
    for (const diff of run.candidateDiff) {
      console.log(`  field="${diff.field}" 原因: ${diff.rationale}`);
    }
    console.log(`\n执行 "ss refine apply --id ${run.id}" 以应用，或 "ss refine reject --id ${run.id}" 以拒绝`);
    return;
  }

  console.log("用法: ss refine constitution|habits|worldview|list|apply|reject|rollback|diff|review|sizes [--persona <path>]");
  process.exitCode = 1;
}

// ── P2-5: User facts commands ──────────────────────────────────────────────

async function runMemoryFacts(factsAction: string, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaOption(options);
  if (!personaPath) {
    console.error("需要 --persona <path> 参数");
    process.exitCode = 1;
    return;
  }

  if (factsAction === "list") {
    const limit = typeof options.limit === "string" ? Number(options.limit) : 20;
    const facts = await getUserFacts(personaPath, { limit });
    if (facts.length === 0) {
      console.log("（无用户事实记录）");
      return;
    }
    for (const f of facts) {
      const badge = f.crystallized ? "[✓]" : `[${f.mentionCount}×]`;
      console.log(`${badge} ${f.key} = ${f.value} (confidence=${f.confidence.toFixed(2)})`);
    }
    return;
  }

  if (factsAction === "add") {
    const key = typeof options.key === "string" ? options.key.trim() : "";
    const value = typeof options.value === "string" ? options.value.trim() : "";
    if (!key || !value) {
      console.error("需要 --key <key> --value <value>");
      process.exitCode = 1;
      return;
    }
    const fact = await upsertUserFact(personaPath, { key, value });
    console.log(`✓ 事实已记录: ${fact.key} = ${fact.value} (mention_count=${fact.mentionCount})`);
    return;
  }

  if (factsAction === "remove") {
    const key = typeof options.key === "string" ? options.key.trim() : "";
    if (!key) {
      console.error("需要 --key <key>");
      process.exitCode = 1;
      return;
    }
    const ok = await deleteUserFact(personaPath, key);
    if (ok) {
      console.log(`✓ 事实已删除: ${key}`);
    } else {
      console.error(`✗ 未找到事实: ${key}`);
      process.exitCode = 1;
    }
    return;
  }

  if (factsAction === "graduate") {
    const count = await graduateFactsFromMemories(personaPath);
    console.log(`✓ 事实晋升完成，新增 ${count} 条用户事实`);
    return;
  }

  console.log("用法: ss memory facts list|add|remove|graduate [--persona <path>]");
  process.exitCode = 1;
}

// ── P2-6: Social graph commands ────────────────────────────────────────────

async function runSocial(action: string | undefined, options: Record<string, string | boolean>): Promise<void> {
  const personaPath = resolvePersonaOption(options);
  if (!personaPath) {
    console.error("需要 --persona <path> 参数");
    process.exitCode = 1;
    return;
  }

  if (action === "list" || !action) {
    const graph = await loadSocialGraph(personaPath);
    if (graph.persons.length === 0) {
      console.log("（社交图谱为空）");
      return;
    }
    console.log(`社交图谱 (${graph.persons.length}/${20} 人):`);
    for (const p of graph.persons) {
      const factsStr = p.facts.length > 0 ? ` | ${p.facts.slice(0, 2).join("; ")}` : "";
      console.log(`  [${p.mentionCount}×] ${p.name} (${p.relationship})${factsStr}`);
    }
    return;
  }

  if (action === "add") {
    const name = typeof options.name === "string" ? options.name.trim() : "";
    const relationship = typeof options.relationship === "string" ? options.relationship.trim() : "";
    if (!name || !relationship) {
      console.error("需要 --name <name> --relationship <rel>");
      process.exitCode = 1;
      return;
    }
    const facts = typeof options.facts === "string"
      ? options.facts.split(",").map((f) => f.trim()).filter(Boolean)
      : [];
    const result = await addSocialPerson(personaPath, { name, relationship, facts });
    if (result.ok && result.person) {
      console.log(`✓ 已添加: ${result.person.name} (${result.person.relationship})`);
    } else {
      console.error(`✗ 添加失败: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (action === "remove") {
    const name = typeof options.name === "string" ? options.name.trim() : "";
    if (!name) {
      console.error("需要 --name <name>");
      process.exitCode = 1;
      return;
    }
    const result = await removeSocialPerson(personaPath, name);
    if (result.ok) {
      console.log(`✓ 已移除: ${name}`);
    } else {
      console.error(`✗ 移除失败: ${result.reason}`);
      process.exitCode = 1;
    }
    return;
  }

  if (action === "search") {
    const query = typeof options.query === "string" ? options.query.trim() : "";
    if (!query) {
      console.error("需要 --query <q>");
      process.exitCode = 1;
      return;
    }
    const persons = await searchSocialPersons(personaPath, query);
    if (persons.length === 0) {
      console.log("（无匹配人物）");
      return;
    }
    for (const p of persons) {
      console.log(`  ${p.name} (${p.relationship}) mentions=${p.mentionCount}`);
    }
    return;
  }

  console.log("用法: ss social list|add|remove|search [--persona <path>]");
  process.exitCode = 1;
}

function resolvePersonaOption(options: Record<string, string | boolean>): string | null {
  if (typeof options.persona === "string" && options.persona.trim().length > 0) {
    return path.resolve(process.cwd(), options.persona);
  }
  // Try default persona directory
  const defaultPath = resolvePersonaPathByName("");
  if (defaultPath && existsSync(defaultPath)) {
    return defaultPath;
  }
  return null;
}

// ── Shared Space helpers ────────────────────────────────────────────────────

function buildSharedSpaceListing(spacePath: string, personaName: string): string {
  const lines: string[] = [`专属文件夹内容 (${spacePath})`];
  const MAX_FILES = 50;
  let totalCount = 0;
  let shown = 0;

  const scanDir = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true }) as import("node:fs").Dirent[];
    } catch {
      return;
    }
    for (const entry of entries) {
      if (shown >= MAX_FILES) {
        totalCount++;
        continue;
      }
      totalCount++;
      shown++;
      const fullPath = path.join(dir, String(entry.name));
      if (entry.isDirectory()) {
        lines.push(`  ${prefix}${String(entry.name)}/`);
      } else {
        let size = "";
        try {
          const st = statSync(fullPath);
          size = ` (${(st.size / 1024).toFixed(1)} KB, ${st.mtime.toISOString().slice(0, 10)})`;
        } catch {
          // ignore
        }
        lines.push(`  ${prefix}${String(entry.name)}${size}`);
      }
    }
  };

  scanDir(path.join(spacePath, `from_${personaName}`), `from_${personaName}/`);
  scanDir(path.join(spacePath, `to_${personaName}`), `to_${personaName}/`);

  if (totalCount > MAX_FILES) {
    lines.push(`  ... 还有 ${totalCount - MAX_FILES} 个文件未显示`);
  }
  if (totalCount === 0) {
    lines.push("  （文件夹为空）");
  }
  return lines.join("\n");
}

async function runSharedSpaceCommand(
  personaName: string | undefined,
  options: Record<string, string | boolean>
): Promise<void> {
  const name = (personaName ?? "").trim();
  if (!name) {
    console.error("用法: ./ss space <PersonaName> [--path <dir>] [--remove]");
    process.exitCode = 1;
    return;
  }

  const pPath = resolvePersonaPathByName(name);
  if (!existsSync(pPath)) {
    console.error(`未找到 persona "${name}"，路径：${pPath}`);
    process.exitCode = 1;
    return;
  }

  const metaPath = path.join(pPath, "persona.json");
  let meta: Record<string, unknown>;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8")) as Record<string, unknown>;
  } catch (err: unknown) {
    console.error(`读取 persona.json 失败：${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  // --remove: clear sharedSpace config
  if (options.remove === true) {
    delete meta.sharedSpace;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
    console.log(`✓ 已移除 ${name} 的专属文件夹配置`);
    return;
  }

  // --path: set up shared space
  if (typeof options.path === "string" && options.path.trim().length > 0) {
    const rawPath = options.path.trim().replace(/^~/, os.homedir());
    const resolvedPath = path.resolve(rawPath);
    mkdirSync(path.join(resolvedPath, `from_${name}`), { recursive: true });
    mkdirSync(path.join(resolvedPath, `to_${name}`), { recursive: true });
    const sharedSpace = { path: resolvedPath, enabled: true, createdAt: new Date().toISOString() };
    meta.sharedSpace = sharedSpace;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf8");
    console.log(`✓ 专属文件夹已建立：${resolvedPath}`);
    console.log(`  📂 from_${name}/  ← ${name} 放给用户的文件`);
    console.log(`  📂 to_${name}/    ← 用户放给 ${name} 的文件`);
    return;
  }

  // No options: show current config
  const ss = meta.sharedSpace as { path?: string; enabled?: boolean; createdAt?: string } | undefined;
  if (!ss) {
    console.log(`${name} 尚未配置专属文件夹。`);
    console.log(`配置命令：./ss space ${name} --path ~/Desktop/我们的空间`);
  } else {
    console.log(`${name} 的专属文件夹配置：`);
    console.log(`  路径：${ss.path ?? "(未设置)"}`);
    console.log(`  启用：${ss.enabled ? "是" : "否"}`);
    console.log(`  创建时间：${ss.createdAt ?? "(未知)"}`);
    if (ss.path && existsSync(ss.path)) {
      console.log(buildSharedSpaceListing(ss.path, name));
    }
  }
}
