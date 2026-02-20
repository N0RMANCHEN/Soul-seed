import type { LifeEvent } from "./types.js";
import type { MemoryEvidenceBlock } from "./types.js";

export interface RecallGroundingGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
}

const RECALL_CLAIM_PATTERNS = [
  /(上次我们聊到|你之前提到过|我们之前聊过|你刚才说过|你前面说过|你先前说过|你曾说过|你昨天说的|你先提到|你上次推荐的|你之前推荐过)/u,
  /(last time we talked|earlier you said|you mentioned before|as we discussed before|you said earlier|you told me before|we talked about|you mentioned first|you said yesterday|you recommended before)/i
];

const RECALL_SENTENCE_PATTERN =
  /(?:上次我们聊到|你之前提到过|我们之前聊过|你刚才说过|你前面说过|你先前说过|你曾说过|你昨天说的|你先提到|你上次推荐的|你之前推荐过|last time we talked|earlier you said|you mentioned before|as we discussed before|you said earlier|you told me before|we talked about|you mentioned first|you said yesterday|you recommended before)[^。！？!?]{0,160}[。！？!?]?/giu;

const WORD_PATTERN = /[\p{L}\p{N}_]{2,}/gu;
const RECALL_STOPWORDS = new Set([
  "上次",
  "之前",
  "先前",
  "刚才",
  "前面",
  "聊到",
  "聊过",
  "提到过",
  "先提到",
  "说过",
  "昨天",
  "上次推荐的",
  "推荐过",
  "细节",
  "我们",
  "你",
  "我",
  "last",
  "time",
  "talked",
  "earlier",
  "you",
  "said",
  "mentioned",
  "before",
  "discussed",
  "about",
  "we"
]);

export function enforceRecallGroundingGuard(
  reply: string,
  options?: {
    selectedMemories?: string[];
    selectedMemoryBlocks?: MemoryEvidenceBlock[];
    lifeEvents?: LifeEvent[];
    strictMemoryGrounding?: boolean;
  }
): RecallGroundingGuardResult {
  const strict = options?.strictMemoryGrounding !== false;
  if (!strict) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  if (!RECALL_CLAIM_PATTERNS.some((pattern) => pattern.test(text))) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const selected = (options?.selectedMemories ?? []).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  const selectedBlocks = (options?.selectedMemoryBlocks ?? [])
    .filter(
      (item): item is MemoryEvidenceBlock =>
        item != null &&
        typeof item.id === "string" &&
        typeof item.content === "string" &&
        (item.source === "user" || item.source === "assistant" || item.source === "system")
    )
    .slice(0, 16);
  const recentTexts = (options?.lifeEvents ?? [])
    .filter((event) => event.type === "user_message" || event.type === "assistant_message")
    .slice(-8)
    .map((event) => String(event.payload.text ?? "").toLowerCase());
  const memoryTexts = selected.map((item) =>
    item.replace(/^life=/, "").replace(/^memory=/, "").replace(/^pinned=/, "").toLowerCase()
  );
  const blockTexts = selectedBlocks.map((item) => item.content.toLowerCase());
  const corpus = [...blockTexts, ...memoryTexts, ...recentTexts];

  let corrected = false;
  const flags: string[] = [];
  const rewritten = text.replace(RECALL_SENTENCE_PATTERN, (sentence) => {
    const normalized = sentence.toLowerCase();
    const tokens = normalized.match(WORD_PATTERN) ?? [];
    const meaningful = tokens
      .filter((token) => token.length >= 2 && !RECALL_STOPWORDS.has(token))
      .slice(0, 12);
    const tokenHits = meaningful.filter((token) =>
      corpus.some((entry) => entry.includes(token))
    ).length;
    const grounded =
      meaningful.length === 0
        ? false
        : meaningful.length === 1
          ? tokenHits >= 1
          : tokenHits >= 2;
    if (grounded) {
      return sentence;
    }
    corrected = true;
    return "我不确定我们之前是否聊过这个细节，我现在没有可核对的记忆证据。";
  });

  if (!corrected) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  flags.push("ungrounded_recall");
  return {
    text: rewritten,
    corrected: true,
    reason: "ungrounded_recall",
    flags
  };
}
