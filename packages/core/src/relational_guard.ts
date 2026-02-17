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

export function enforceRelationalGuard(
  reply: string,
  options?: {
    selectedMemories?: string[];
    personaName?: string;
  }
): RelationalGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const flags: string[] = [];
  let next = reply;

  const hasServiceTone = SERVICE_PATTERNS.some((pattern) => pattern.test(next));
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
    const canCiteSpecific = selected.some((m) => m.startsWith("life="));
    if (!canCiteSpecific) {
      flags.push("fabricated_recall");
      next = next.replace(
        /(上次我们聊到[^。！？!?]*[。！？!?]?)/u,
        "我不确定我们之前是否聊过这个细节。"
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
