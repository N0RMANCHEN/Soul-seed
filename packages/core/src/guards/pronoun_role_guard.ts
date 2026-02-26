import type { LifeEvent } from "../types.js";
import { projectTopicAttention } from "../runtime/semantic_projection.js";

export interface PronounRoleGuardResult {
  text: string;
  corrected: boolean;
  reason: string | null;
  flags: string[];
  confidence: number;
  mode: "rewrite" | "clarify" | "pass";
  rewrittenSentences: number;
  routingTier?: "L2" | "L4";
  fallbackReason?: string;
}

const SENTENCE_PATTERN = /[^。！？!?]+[。！？!?]?/gu;
const WORD_PATTERN = /[\p{L}\p{N}_]{2,}/gu;
const FIRST_PERSON_PATTERN = /(我|我的|\bI\b|\bmy\b|\bme\b)/iu;
const SECOND_PERSON_PATTERN = /(你|你的|\byou\b|\byour\b)/iu;
const THIRD_PERSON_PATTERN = /(他|她|他们|她们|\bhe\b|\bshe\b|\bthey\b)/iu;
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
const SUBJECT_WORD_PATTERN = /(我|我的|你|你的|他|她|他们|她们|\bI\b|\bmy\b|\bme\b|\byou\b|\byour\b|\bhe\b|\bshe\b|\bthey\b|\btheir\b)/giu;
const CUE_KEYWORDS = [
  "昨晚",
  "昨天",
  "刚才",
  "刚刚",
  "前天",
  "上次",
  "今天",
  "早上",
  "晚上",
  "凌晨",
  "写",
  "说",
  "提到",
  "睡",
  "吃",
  "聊",
  "工作",
  "上班",
  "下班",
  "看",
  "读",
  "玩",
  "回家",
  "last night",
  "yesterday",
  "just now",
  "earlier",
  "wrote",
  "said",
  "mentioned",
  "ate",
  "slept",
  "worked",
  "read",
  "watched"
] as const;

export function enforcePronounRoleGuard(
  reply: string,
  options?: {
    lifeEvents?: LifeEvent[];
    lastUserInput?: string;
    personaName?: string;
    thirdPartyCandidates?: string[];
  }
): PronounRoleGuardResult {
  const text = reply.trim();
  if (!text) {
    return {
      text: reply,
      corrected: false,
      reason: null,
      flags: [],
      confidence: 0,
      mode: "pass",
      rewrittenSentences: 0,
      routingTier: "L4",
      fallbackReason: "empty_reply"
    };
  }

  const lifeEvents = options?.lifeEvents ?? [];
  const userTextsFromEvents = lifeEvents
    .filter((event) => event.type === "user_message")
    .slice(-12)
    .map((event) => String(event.payload.text ?? "").toLowerCase())
    .filter(Boolean);
  const userTexts = [...userTextsFromEvents];
  if (typeof options?.lastUserInput === "string" && options.lastUserInput.trim()) {
    userTexts.push(options.lastUserInput.trim().toLowerCase());
  }
  const assistantTexts = lifeEvents
    .filter((event) => event.type === "assistant_message")
    .slice(-12)
    .map((event) => String(event.payload.text ?? "").toLowerCase())
    .filter(Boolean);

  const sentences = text.match(SENTENCE_PATTERN) ?? [text];
  let corrected = false;
  let rewrittenSentences = 0;
  let highestConfidence = 0;
  const rewritten = sentences.map((sentence) => {
    if (rewrittenSentences >= 2) {
      return sentence;
    }
    const decision = detectRoleMismatchDecision(
      sentence,
      userTexts,
      assistantTexts,
      options?.thirdPartyCandidates ?? []
    );
    if (!decision.rewrite || decision.target == null) {
      return sentence;
    }
    corrected = true;
    rewrittenSentences += 1;
    highestConfidence = Math.max(highestConfidence, decision.confidence);
    if (decision.target === "user") {
      return convertSentenceToUserPerspective(sentence);
    }
    if (decision.target === "assistant") {
      return convertSentenceToAssistantPerspective(sentence);
    }
    return convertSentenceToUserPerspectiveFromThirdPerson(sentence);
  });

  if (!corrected) {
    return {
      text: reply,
      corrected: false,
      reason: null,
      flags: [],
      confidence: 0,
      mode: "pass",
      rewrittenSentences: 0,
      routingTier: "L4",
      fallbackReason: "no_role_mismatch_detected"
    };
  }

  return {
    text: rewritten.join(""),
    corrected: true,
    reason: "pronoun_role_mismatch",
    flags: ["pronoun_role_mismatch"],
    confidence: Number(highestConfidence.toFixed(3)),
    mode: "rewrite",
    rewrittenSentences,
    routingTier: "L2"
  };
}

function detectRoleMismatchDecision(
  sentence: string,
  userTexts: string[],
  assistantTexts: string[],
  thirdPartyCandidates: string[]
): { rewrite: boolean; target: "user" | "assistant" | "third_to_user" | null; confidence: number } {
  const s = sentence.trim();
  if (!s) return { rewrite: false, target: null, confidence: 0 };
  const hasActionCue = ACTION_OR_TIME_CUE_PATTERN.test(s) || hasSemanticActionCue(s);
  if (!hasActionCue) return { rewrite: false, target: null, confidence: 0 };
  if (SAFE_SELF_STATE_PATTERN.test(s)) return { rewrite: false, target: null, confidence: 0 };
  if (userTexts.length === 0 && assistantTexts.length === 0) {
    return { rewrite: false, target: null, confidence: 0 };
  }

  const tokens = (s.toLowerCase().match(WORD_PATTERN) ?? [])
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .slice(0, 12);
  if (tokens.length < 1 && !ACTION_OR_TIME_CUE_PATTERN.test(s)) {
    return { rewrite: false, target: null, confidence: 0 };
  }

  let userOverlap = maxTokenOverlap(tokens, userTexts);
  let assistantOverlap = maxTokenOverlap(tokens, assistantTexts);
  if (userOverlap === 0 && userTexts.length > 0 && hasCueSimilarity(s, userTexts)) {
    userOverlap = 1;
  }
  if (assistantOverlap === 0 && assistantTexts.length > 0 && hasCueSimilarity(s, assistantTexts)) {
    assistantOverlap = 1;
  }

  if (FIRST_PERSON_PATTERN.test(s) && userOverlap >= 1 && userOverlap >= assistantOverlap + 1) {
    return {
      rewrite: true,
      target: "user",
      confidence: scoreConfidence(userOverlap, assistantOverlap)
    };
  }

  if (SECOND_PERSON_PATTERN.test(s) && assistantOverlap >= 1 && assistantOverlap >= userOverlap + 1) {
    return {
      rewrite: true,
      target: "assistant",
      confidence: scoreConfidence(assistantOverlap, userOverlap)
    };
  }

  if (THIRD_PERSON_PATTERN.test(s) && userOverlap >= 1 && userOverlap >= assistantOverlap + 1) {
    const hasThirdPartyEvidence = hasRecentThirdPartyEvidence(userTexts, thirdPartyCandidates);
    if (!hasThirdPartyEvidence) {
      return {
        rewrite: true,
        target: "third_to_user",
        confidence: scoreConfidence(userOverlap, assistantOverlap)
      };
    }
  }

  return { rewrite: false, target: null, confidence: 0 };
}

function hasSemanticActionCue(text: string): boolean {
  const anchors = [
    "之前你说过",
    "刚才提到",
    "昨天发生了什么",
    "earlier you said",
    "you mentioned just now",
    "what happened yesterday"
  ];
  const top = projectTopicAttention(text, anchors)[0];
  return Boolean(top && top.score >= 0.74);
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
  const tail = sentence.match(/[。！？!?]+$/u)?.[0] ?? "";
  const base = sentence.trim().replace(/[。！？!?]+$/u, "");
  return (
    base
    .replace(/我的/gu, "你的")
    .replace(/我(?=[昨今前刚上这那去睡吃写说提到热聊工读玩回])/gu, "你")
    .replace(/^我/u, "你")
    .replace(/\bmy\b/giu, "your")
    .replace(/\bI\b/gu, "you")
    .replace(/\bme\b/giu, "you") + tail
  );
}

function convertSentenceToAssistantPerspective(sentence: string): string {
  const tail = sentence.match(/[。！？!?]+$/u)?.[0] ?? "";
  const base = sentence.trim().replace(/[。！？!?]+$/u, "");
  return (
    base
      .replace(/你的/gu, "我的")
      .replace(/你(?=[昨今前刚上这那去睡吃写说提到热聊工读玩回])/gu, "我")
      .replace(/^你/u, "我")
      .replace(/\byour\b/giu, "my")
      .replace(/\byou\b/giu, "I") + tail
  );
}

function convertSentenceToUserPerspectiveFromThirdPerson(sentence: string): string {
  const tail = sentence.match(/[。！？!?]+$/u)?.[0] ?? "";
  const base = sentence.trim().replace(/[。！？!?]+$/u, "");
  return (
    base
      .replace(/他们|她们/gu, "你")
      .replace(/他|她/gu, "你")
      .replace(/\bthey\b/giu, "you")
      .replace(/\bhe\b/giu, "you")
      .replace(/\bshe\b/giu, "you")
      .replace(/\btheir\b/giu, "your")
      .replace(/\bhis\b/giu, "your")
      .replace(/\bher\b/giu, "your") + tail
  );
}

function hasRecentThirdPartyEvidence(userTexts: string[], thirdPartyCandidates: string[]): boolean {
  const thirdPersonInContext = /(他|她|他们|她们|\bhe\b|\bshe\b|\bthey\b)/iu;
  if (userTexts.some((text) => thirdPersonInContext.test(text))) {
    return true;
  }
  if (thirdPartyCandidates.length > 0) {
    return true;
  }
  return false;
}

function scoreConfidence(primaryOverlap: number, secondaryOverlap: number): number {
  const margin = Math.max(0, primaryOverlap - secondaryOverlap);
  return Math.min(0.98, 0.55 + margin * 0.15);
}

function hasCueSimilarity(sentence: string, corpus: string[]): boolean {
  const lhs = normalizeSubjectAgnostic(sentence);
  if (!lhs) return false;
  for (const item of corpus) {
    const rhs = normalizeSubjectAgnostic(item);
    if (!rhs) continue;
    if (lhs.includes(rhs) || rhs.includes(lhs)) {
      return true;
    }
    let matched = 0;
    for (const cue of CUE_KEYWORDS) {
      if (lhs.includes(cue) && rhs.includes(cue)) {
        matched += 1;
      }
      if (matched >= 2) {
        return true;
      }
    }
  }
  return false;
}

function normalizeSubjectAgnostic(text: string): string {
  return text
    .toLowerCase()
    .replace(SUBJECT_WORD_PATTERN, "")
    .replace(/[。！？!?，,\s"“”'‘’]/gu, "");
}

function normalizeForOverlap(text: string): string {
  return text.toLowerCase().replace(/[了呢啊呀吧嘛嘛]/gu, "").replace(/\s+/g, "");
}
