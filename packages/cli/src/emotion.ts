export const EMOTION_TOKENS = [
  "warm",
  "confused",
  "expecting",
  "reassured",
  "blink",
  "smile",
  "frown",
  "surprised",
  "blank",
  "blush",
  "angry",
  "sad",
  "sleepy",
  "sparkle",
  "welcome",
  "giddy",
  "playful-serious"
] as const;

export type EmotionToken = (typeof EMOTION_TOKENS)[number];

const EMOTION_RENDER: Record<EmotionToken, { label: string; icon: string }> = {
  warm: { label: "温暖", icon: "(*^_^*)" },
  confused: { label: "困惑", icon: "(?_?)" },
  expecting: { label: "期待", icon: "(*_*)..." },
  reassured: { label: "安心", icon: "(u_u)" },
  blink: { label: "眨眼", icon: "(^_~)" },
  smile: { label: "微笑", icon: "(^_^)" },
  frown: { label: "皱眉", icon: "(>_<)" },
  surprised: { label: "惊讶", icon: "(O_O)" },
  blank: { label: "发呆", icon: "(-_-)" },
  blush: { label: "脸红", icon: "(*/.\\*)" },
  angry: { label: "生气", icon: "(>_<#)" },
  sad: { label: "难过", icon: "(T_T)" },
  sleepy: { label: "困倦", icon: "(-_-) zZ" },
  sparkle: { label: "眼睛发亮", icon: "(*_*)" },
  welcome: { label: "欢迎回来", icon: "(^o^)/" },
  giddy: { label: "眼睛弯弯", icon: "(^.^)" },
  "playful-serious": { label: "假装严肃", icon: "( -_- )" }
};

function isEmotionToken(value: string): value is EmotionToken {
  return (EMOTION_TOKENS as readonly string[]).includes(value);
}

function detectLocalizedEmotionToken(tag: string): EmotionToken | null {
  const normalized = tag.trim();
  if (!normalized) {
    return null;
  }
  for (const [token, ui] of Object.entries(EMOTION_RENDER) as Array<[EmotionToken, { label: string; icon: string }]>) {
    if (normalized === ui.label || normalized.startsWith(`${ui.label} `) || normalized.includes(ui.icon)) {
      return token;
    }
  }
  return null;
}

export function parseEmotionTag(content: string): { emotion: EmotionToken | null; text: string } {
  let rest = content.trimStart();
  let detected: EmotionToken | null = null;
  let matched = false;

  while (true) {
    const match = rest.match(/^\[([a-z-]+)(?::([a-z-]+))?\]\s*/i);
    if (!match) {
      break;
    }
    matched = true;

    const tokenRaw = (match[2] ?? match[1]).toLowerCase();
    if (!detected && isEmotionToken(tokenRaw)) {
      detected = tokenRaw;
    }
    rest = rest.slice(match[0].length);
  }

  for (let i = 0; i < 3; i += 1) {
    const localized = rest.match(/^\[([^\]\n]{1,24})\]\s*/u);
    if (!localized) {
      break;
    }
    const localizedToken = detectLocalizedEmotionToken(localized[1] ?? "");
    if (!localizedToken) {
      break;
    }
    matched = true;
    if (!detected) {
      detected = localizedToken;
    }
    rest = rest.slice(localized[0].length);
  }

  if (!matched) {
    return { emotion: null, text: content.trim() };
  }
  return { emotion: detected, text: rest.trim() };
}

export function renderEmotionPrefix(emotion: EmotionToken | null): string {
  if (!emotion) {
    return "";
  }
  const ui = EMOTION_RENDER[emotion];
  return `[${ui.label} ${ui.icon}] `;
}

const HEURISTICS: Array<{ emotion: EmotionToken; patterns: RegExp[] }> = [
  { emotion: "welcome", patterns: [/欢迎回来/, /回来了/, /welcome back/i] },
  { emotion: "sparkle", patterns: [/眼睛发亮/, /发亮/, /亮起来/, /闪烁/, /光晕.*亮/] },
  { emotion: "smile", patterns: [/微笑/, /笑意/, /笑了/, /笑着/] },
  { emotion: "giddy", patterns: [/眼睛弯弯/, /弯弯/, /开心地笑/] },
  { emotion: "playful-serious", patterns: [/假装严肃/, /装作严肃/, /故作严肃/] },
  { emotion: "confused", patterns: [/困惑/, /疑惑/, /不太明白/, /歪头/] },
  { emotion: "expecting", patterns: [/期待/, /等你/, /想听你说/] },
  { emotion: "reassured", patterns: [/安心/, /放心/, /没事了/, /我在这/] },
  { emotion: "blink", patterns: [/眨眼/, /眨了眨/] },
  { emotion: "frown", patterns: [/皱眉/, /蹙眉/, /眉头/] },
  { emotion: "surprised", patterns: [/惊讶/, /惊喜/, /突然出现/, /吃惊/] },
  { emotion: "blank", patterns: [/发呆/, /愣住/, /呆呆/] },
  { emotion: "blush", patterns: [/脸红/, /害羞/, /耳尖发烫/] },
  { emotion: "angry", patterns: [/生气/, /恼火/, /有点凶/] },
  { emotion: "sad", patterns: [/难过/, /失落/, /低落/, /想哭/] },
  { emotion: "sleepy", patterns: [/困倦/, /困了/, /想睡/, /打哈欠/, /z+Z/i] },
  { emotion: "warm", patterns: [/温柔/, /温暖/, /轻声/, /柔和/] }
];

export function inferEmotionFromText(content: string): EmotionToken | null {
  const text = content.trim();
  if (!text) {
    return null;
  }

  for (const item of HEURISTICS) {
    if (item.patterns.some((pattern) => pattern.test(text))) {
      return item.emotion;
    }
  }
  return null;
}
