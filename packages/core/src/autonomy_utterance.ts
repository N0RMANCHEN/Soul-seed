import type { ModelAdapter, RelationshipState } from "./types.js";

export type AutonomyUtteranceMode = "greeting" | "proactive" | "farewell" | "exit_confirm";

export interface AutonomyUtteranceContext {
  personaName: string;
  relationshipState: RelationshipState["state"];
  trust: number;
  intimacy: number;
  reciprocity: number;
  curiosity: number;
  silenceMinutes: number;
  silenceLabel: string;
  crossedDayBoundary: boolean;
  currentTimeIso: string;
  lastUserAtIso: string | null;
  lastUserInput: string;
  lastAssistantOutput: string;
  proactiveMissStreak: number;
  taskContextHint: string | null;
}

export interface GenerateAutonomyUtteranceInput {
  mode: AutonomyUtteranceMode;
  adapter?: ModelAdapter;
  allowLlm: boolean;
  fallbackText: string;
  degradedText: string;
  context: AutonomyUtteranceContext;
  onToken?: (chunk: string) => void;
}

export interface GenerateAutonomyUtteranceResult {
  text: string;
  streamed: boolean;
  source: "llm" | "degraded" | "fallback";
  reasonCodes: string[];
}

function normalizeText(text: string): string {
  const lines = text
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
  return cleaned
    .replace(/（[^）\n]{1,28}）/gu, " ")
    .replace(/\([^)\n]{1,28}\)/g, " ")
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

function hasUngroundedTemporalRecall(text: string, seedInput: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const cue = /(昨天|上次|之前|先前|你说的|你提到的|你推荐的|你先提到|you said|last time|earlier|you mentioned|you recommended)/iu;
  if (!cue.test(normalized)) {
    return false;
  }
  const seed = seedInput.trim().toLowerCase();
  if (!seed) {
    return true;
  }
  const tokens = seed.match(/[\p{L}\p{N}_]{2,}/gu) ?? [];
  const stop = new Set(["昨天", "上次", "之前", "先前", "你", "我", "我们", "you", "i", "we", "last", "time", "earlier"]);
  const meaningful = tokens.filter((token) => !stop.has(token)).slice(0, 12);
  if (meaningful.length === 0) {
    return false;
  }
  const hit = meaningful.some((token) => normalized.includes(token));
  return !hit;
}

function isTemplateyOutput(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  return /(作为|根据|以下是|1\)|^你好[，,]|^您好[，,]|^很高兴见到你)/u.test(normalized);
}

function modeInstruction(mode: AutonomyUtteranceMode, context: AutonomyUtteranceContext): string {
  if (mode === "farewell") {
    return "场景：结束对话。请给一句有温度的收束，不要流程化确认语。";
  }
  if (mode === "exit_confirm") {
    return "场景：用户询问能否退出。请自然说明可以离开并给出简短确认方式。";
  }
  if (mode === "greeting") {
    return "场景：刚开始会话。请自然开场，不要官方问候句。";
  }
  return `场景：主动发起对话，关系状态=${context.relationshipState}，沉默时间=${context.silenceMinutes.toFixed(1)}分钟${context.taskContextHint ? `，${context.taskContextHint}` : ""}。`;
}

function buildMessages(mode: AutonomyUtteranceMode, context: AutonomyUtteranceContext): Array<{ role: "system" | "user"; content: string }> {
  const instruction = modeInstruction(mode, context);
  return [
    {
      role: "system",
      content:
        `你是一个有连续人格的中文对话者。${instruction} 请说1-2句自然口语，像你自己突然想说的话，不要模板腔，不要条目，不要解释规则，不要括号舞台说明。避免固定开场白，尽量贴合上下文。若上下文有未完成问题，直接接着它说。\n` +
        "你具备系统时钟与历史时间锚：可以根据 currentTimeIso、lastUserAtIso、silenceMinutes 判断真实间隔。请基于这些时间锚组织“刚才/之前/昨晚/上次”等时间词；不要声称“我不知道时间”或“需要用户提醒我看表”。"
    },
    {
      role: "user",
      content: `请基于上下文给一句自然发言：${JSON.stringify(context)}`
    }
  ];
}

function resolveFallback(
  input: GenerateAutonomyUtteranceInput,
  reasonCode: string
): GenerateAutonomyUtteranceResult {
  if (input.degradedText.trim()) {
    return {
      text: input.degradedText,
      streamed: false,
      source: "degraded",
      reasonCodes: [reasonCode]
    };
  }
  return {
    text: input.fallbackText,
    streamed: false,
    source: "fallback",
    reasonCodes: [reasonCode, "degraded_empty"]
  };
}

export async function generateAutonomyUtterance(
  input: GenerateAutonomyUtteranceInput
): Promise<GenerateAutonomyUtteranceResult> {
  if (!input.allowLlm || !input.adapter) {
    return resolveFallback(input, "llm_unavailable");
  }
  let raw = "";
  try {
    await input.adapter.streamChat(buildMessages(input.mode, input.context), {
      onToken: (chunk) => {
        raw += chunk;
        input.onToken?.(chunk);
      }
    });
  } catch {
    return resolveFallback(input, "llm_error");
  }
  let normalized = normalizeText(raw);
  if (isDramaticRoleplayOpener(normalized)) {
    normalized = "";
  }
  if (!normalized) {
    return resolveFallback(input, "llm_empty");
  }
  if ((input.mode === "greeting" || input.mode === "proactive") && hasUngroundedTemporalRecall(normalized, input.context.lastUserInput)) {
    return resolveFallback(input, "ungrounded_temporal_recall");
  }
  if (isTemplateyOutput(normalized)) {
    return resolveFallback(input, "templatey_output");
  }
  return {
    text: normalized,
    streamed: true,
    source: "llm",
    reasonCodes: []
  };
}
