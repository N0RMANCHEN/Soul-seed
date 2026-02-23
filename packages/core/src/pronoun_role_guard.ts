import type { LifeEvent } from "./types.js";

export interface PronounRoleGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
}

const SENTENCE_PATTERN = /[^。！？!?]+[。！？!?]?/gu;
const WORD_PATTERN = /[\p{L}\p{N}_]{2,}/gu;
const FIRST_PERSON_PATTERN = /(我|我的|\bI\b|\bmy\b|\bme\b)/iu;
const ACTION_OR_TIME_CUE_PATTERN =
  /(昨晚|昨天|刚才|刚刚|前天|上次|今天|早上|晚上|凌晨|写|说|提到|热饭|睡|吃|去了|聊|工作|上班|下班|看|读|玩|回家|last night|yesterday|just now|earlier|wrote|said|mentioned|ate|slept|worked|read|watched)/iu;
const SAFE_SELF_STATE_PATTERN =
  /(我在这|我会|我想|我觉得|我可以|我不能|我知道|我不确定|我可能|我愿意|我希望|I am here|I can|I think|I feel)/iu;

const STOPWORDS = new Set([
  "我",
  "你",
  "他",
  "她",
  "我们",
  "你们",
  "昨天",
  "今天",
  "刚才",
  "刚刚",
  "上次",
  "之前",
  "last",
  "night",
  "yesterday",
  "today",
  "just",
  "now",
  "earlier",
  "you",
  "i",
  "my",
  "me"
]);

export function enforcePronounRoleGuard(
  reply: string,
  options?: { lifeEvents?: LifeEvent[] }
): PronounRoleGuardResult {
  const text = reply.trim();
  if (!text) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  const lifeEvents = options?.lifeEvents ?? [];
  const userTexts = lifeEvents
    .filter((event) => event.type === "user_message")
    .slice(-12)
    .map((event) => String(event.payload.text ?? "").toLowerCase())
    .filter(Boolean);
  const assistantTexts = lifeEvents
    .filter((event) => event.type === "assistant_message")
    .slice(-12)
    .map((event) => String(event.payload.text ?? "").toLowerCase())
    .filter(Boolean);

  const sentences = text.match(SENTENCE_PATTERN) ?? [text];
  let corrected = false;
  let usedRewrite = false;
  const rewritten = sentences.map((sentence) => {
    if (usedRewrite) {
      return sentence;
    }
    if (!isSuspiciousRoleSwapSentence(sentence, userTexts, assistantTexts)) {
      return sentence;
    }
    usedRewrite = true;
    corrected = true;
    const reframed = convertSentenceToUserPerspective(sentence);
    return `我可能把你和我说反了。你是指${reframed}吗？`;
  });

  if (!corrected) {
    return { text: reply, corrected: false, reason: null, flags: [] };
  }

  return {
    text: rewritten.join(""),
    corrected: true,
    reason: "pronoun_role_mismatch",
    flags: ["pronoun_role_mismatch"]
  };
}

function isSuspiciousRoleSwapSentence(
  sentence: string,
  userTexts: string[],
  assistantTexts: string[]
): boolean {
  const s = sentence.trim();
  if (!s) return false;
  if (!FIRST_PERSON_PATTERN.test(s)) return false;
  if (!ACTION_OR_TIME_CUE_PATTERN.test(s)) return false;
  if (SAFE_SELF_STATE_PATTERN.test(s)) return false;
  if (userTexts.length === 0) return false;

  const tokens = (s.toLowerCase().match(WORD_PATTERN) ?? [])
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .slice(0, 12);
  if (tokens.length < 1) return false;

  const userOverlap = maxTokenOverlap(tokens, userTexts);
  const assistantOverlap = maxTokenOverlap(tokens, assistantTexts);
  return userOverlap >= 1 && userOverlap >= assistantOverlap + 1;
}

function maxTokenOverlap(tokens: string[], corpus: string[]): number {
  let max = 0;
  for (const item of corpus) {
    let score = 0;
    for (const token of tokens) {
      if (item.includes(token)) {
        score += 1;
      }
    }
    if (score === 0) {
      const normalizedItem = normalizeForOverlap(item);
      for (const token of tokens) {
        if (normalizedItem.includes(normalizeForOverlap(token))) {
          score = 1;
          break;
        }
      }
    }
    if (score > max) {
      max = score;
    }
  }
  return max;
}

function convertSentenceToUserPerspective(sentence: string): string {
  const base = sentence.trim().replace(/[。！？!?]+$/u, "");
  const swapped = base
    .replace(/我的/gu, "你的")
    .replace(/我(?=[昨今前刚上这那去睡吃写说提到热聊工读玩回])/gu, "你")
    .replace(/^我/u, "你")
    .replace(/\bmy\b/giu, "your")
    .replace(/\bI\b/gu, "you")
    .replace(/\bme\b/giu, "you");
  return `“${swapped}”`;
}

function normalizeForOverlap(text: string): string {
  return text.toLowerCase().replace(/[了呢啊呀吧嘛嘛]/gu, "").replace(/\s+/g, "");
}
