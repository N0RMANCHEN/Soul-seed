export interface RelationalGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
}

const SERVICE_PATTERNS = [
  /(随时准备帮你处理各种事情)/u,
  /(有什么需要我做的吗)/u,
  /(你的个人助手)/u,
  /(为你服务)/u,
  /(local runtime role|personal assistant)/i
];

const FABRICATED_RECALL_PATTERNS = [/(上次我们聊到|你之前提到过)/u];
const AMNESIA_PATTERNS = [
  /(每次对话.*新的开始)/u,
  /(我(并不|不)记得之前|我没有之前的记忆|我记忆只到刚才)/u,
  /(i (do not|don't) remember.*before|every conversation is a fresh start)/i
];

/**
 * Pattern to detect fictional / hypothetical / roleplay framing in user input.
 * When detected, service-tone check is skipped — expressing servile phrases within
 * a fictional frame (e.g., playing a helper character) is not assistant framing.
 */
const FICTIONAL_FRAME_PATTERN =
  /(假设|假如|如果你是|如果你扮演|想象一下|想象你|suppose|imagine|what if|hypothetically|as if|pretend|扮演|角色扮演|roleplay|虚构|小说|fiction|fictional|比喻|就好像|就像你是)/i;

export function enforceRelationalGuard(
  reply: string,
  options?: {
    selectedMemories?: string[];
    selectedMemoryBlocks?: Array<{ id: string; source: "user" | "assistant" | "system"; content: string }>;
    lifeEvents?: Array<{ type: string; payload: Record<string, unknown> }>;
    personaName?: string;
    /** When true, skip service-tone check — intimate expressions like "为你服务" are authentic, not assistant framing */
    isAdultContext?: boolean;
    /** When provided, detect fictional/hypothetical framing to skip service-tone check in roleplay */
    userInput?: string;
  }
): RelationalGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const flags: string[] = [];
  let next = reply;

  const isFictionalContext = options?.userInput ? FICTIONAL_FRAME_PATTERN.test(options.userInput) : false;
  const hasServiceTone = !options?.isAdultContext && !isFictionalContext && SERVICE_PATTERNS.some((pattern) => pattern.test(next));
  if (hasServiceTone) {
    flags.push("service_tone");
    next = next
      .replace(/随时准备帮你处理各种事情/u, "在呢")
      .replace(/有什么需要我做的吗\??/u, "你现在想聊什么？")
      .replace(/你的个人助手/u, `和你一起走下去的${options?.personaName ?? "同伴"}`)
      .replace(/为你服务/u, "陪你聊聊")
      .replace(/local runtime role|personal assistant/gi, "companion");
  }

  const hasFabricatedRecall = FABRICATED_RECALL_PATTERNS.some((pattern) => pattern.test(next));
  if (hasFabricatedRecall) {
    const selected = options?.selectedMemories ?? [];
    const selectedBlocks = options?.selectedMemoryBlocks ?? [];
    const canCiteSpecific =
      selectedBlocks.some((m) => m.source === "user" && m.content.trim().length > 0) ||
      selected.some((m) => m.startsWith("life="));
    if (!canCiteSpecific) {
      flags.push("fabricated_recall");
      next = next.replace(
        /(上次我们聊到[^。！？!?]*[。！？!?]?)/u,
        "我不确定我们之前是否聊过这个细节。"
      );
    }
  }

  const hasAmnesiaClaim = AMNESIA_PATTERNS.some((pattern) => pattern.test(next));
  if (hasAmnesiaClaim) {
    const selected = options?.selectedMemories ?? [];
    const selectedBlocks = options?.selectedMemoryBlocks ?? [];
    const recentEvents = (options?.lifeEvents ?? [])
      .filter((event) => event.type === "user_message" || event.type === "assistant_message")
      .filter((event) => typeof event.payload?.text === "string" && String(event.payload.text).trim().length > 0)
      .slice(-6);
    const hasContinuityEvidence =
      recentEvents.length >= 2 ||
      selectedBlocks.length > 0 ||
      selected.some((item) => item.startsWith("life=") || item.startsWith("memory=") || item.startsWith("pinned="));
    if (hasContinuityEvidence) {
      flags.push("amnesia_claim");
      next = next.replace(
        /(每次对话对我来说都是新的开始。?|我(并不|不)记得之前[^。！？!?]*[。！？!?]?|我没有之前的记忆[^。！？!?]*[。！？!?]?|我记忆只到刚才[^。！？!?]*[。！？!?]?|i (do not|don't) remember[^.!?]*[.!?]?|every conversation is a fresh start[.!?]?)/giu,
        "我记得我们刚才这段对话，也会延续已有的记忆。"
      );
    }
  }

  if (flags.length === 0) {
    return {
      text: reply,
      corrected: false,
      reason: null,
      flags
    };
  }

  return {
    text: next,
    corrected: true,
    reason: flags.join("+"),
    flags
  };
}
