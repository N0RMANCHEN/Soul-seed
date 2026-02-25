import { projectTopicAttention } from "./semantic_projection.js";

export type RecallNavigationStrength = "none" | "soft" | "strong";

export interface RecallNavigationIntent {
  enabled: boolean;
  strength: RecallNavigationStrength;
  matchedSignals: string[];
  routingTier?: "L1" | "L4";
  fallbackReason?: string;
}

const STRONG_PHRASES: readonly string[] = [
  "再往前",
  "再往后",
  "往前翻",
  "往后翻",
  "上一句",
  "上上句",
  "前一句",
  "前几句",
  "之前说了什么",
  "刚才说了什么",
  "回到刚才",
  "翻聊天记录",
  "按时间线",
  "earlier in chat",
  "scroll back",
  "what did we say",
  "previous message",
  "prior message",
  "timeline"
];

const RECALL_VERBS: readonly string[] = [
  "回忆",
  "回想",
  "想起",
  "记得",
  "回看",
  "翻看",
  "翻到",
  "追溯",
  "recall",
  "remember",
  "rewind",
  "look back"
];

const CONVERSATION_OBJECTS: readonly string[] = [
  "对话",
  "聊天",
  "消息",
  "记录",
  "这段",
  "那段",
  "那句",
  "上一段",
  "刚才",
  "前面",
  "后面",
  "chat",
  "conversation",
  "message",
  "messages",
  "history",
  "earlier",
  "before",
  "previous",
  "prior"
];

const TIME_DIRECTIONS: readonly string[] = [
  "往前",
  "往后",
  "前面",
  "后面",
  "earlier",
  "before",
  "previous",
  "prior",
  "back"
];

export function detectRecallNavigationIntent(input: string): RecallNavigationIntent {
  const normalized = normalizeText(input);
  if (!normalized) {
    return { enabled: false, strength: "none", matchedSignals: [] };
  }

  const semantic = detectRecallNavigationSemantic(normalized);
  if (semantic.enabled) {
    return semantic;
  }

  const strongHits = collectHits(normalized, STRONG_PHRASES);
  if (strongHits.length > 0) {
    return {
      enabled: true,
      strength: "strong",
      matchedSignals: strongHits,
      routingTier: "L4",
      fallbackReason: "recall_navigation_regex_dictionary_hit"
    };
  }

  const verbHits = collectHits(normalized, RECALL_VERBS);
  const objectHits = collectHits(normalized, CONVERSATION_OBJECTS);
  const directionHits = collectHits(normalized, TIME_DIRECTIONS);
  const signals = dedupeHits([...verbHits, ...objectHits, ...directionHits]);

  const hasVerb = verbHits.length > 0;
  const hasObject = objectHits.length > 0;
  const hasDirection = directionHits.length > 0;
  const soft = (hasVerb && (hasObject || hasDirection)) || (hasObject && hasDirection && signals.length >= 2);

  if (!soft) {
    return { enabled: false, strength: "none", matchedSignals: [], routingTier: "L4", fallbackReason: "recall_navigation_no_regex_match" };
  }

  return {
    enabled: true,
    strength: "soft",
    matchedSignals: signals,
    routingTier: "L4",
    fallbackReason: "recall_navigation_regex_composed_match"
  };
}

function detectRecallNavigationSemantic(normalized: string): RecallNavigationIntent {
  const candidates = [
    "timeline recall",
    "chat history rewind",
    "earlier in chat",
    "previous message",
    "回顾刚才对话",
    "翻看聊天记录",
    "回到前面那段",
    "之前说了什么"
  ];
  const scored = projectTopicAttention(normalized, candidates);
  const top = scored[0];
  if (!top || top.score < 0.69) {
    return { enabled: false, strength: "none", matchedSignals: [] };
  }
  return {
    enabled: true,
    strength: top.score >= 0.8 ? "strong" : "soft",
    matchedSignals: [top.topic],
    routingTier: "L1"
  };
}

function collectHits(text: string, dictionary: readonly string[]): string[] {
  const hits: string[] = [];
  for (const phrase of dictionary) {
    if (phrase && text.includes(phrase)) {
      hits.push(phrase);
    }
  }
  return hits;
}

function dedupeHits(items: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      output.push(item);
    }
  }
  return output;
}

function normalizeText(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  let out = "";
  let previousWasSpace = false;
  for (const ch of trimmed) {
    const space = isWhitespace(ch);
    if (space) {
      if (!previousWasSpace) {
        out += " ";
      }
      previousWasSpace = true;
    } else {
      out += ch;
      previousWasSpace = false;
    }
  }
  return out.trim();
}

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\n" || ch === "\r" || ch === "\t" || ch === "\f" || ch === "\v";
}
