import type { CapabilityCallRequest, CapabilityName } from "../types.js";

export interface CapabilityIntentResolution {
  matched: boolean;
  request?: CapabilityCallRequest;
  confidence: number;
  reason: string;
}

const CAPABILITY_HINTS: RegExp[] = [
  /你能做什么/,
  /都能帮我做什么/,
  /可以做什么/,
  /capabilit/i,
  /what can you do/i
];

const SHOW_MODE_HINTS: RegExp[] = [
  /当前模式/,
  /模式状态/,
  /show.*mode/i,
  /mode status/i
];

const PROACTIVE_STATUS_HINTS: RegExp[] = [/^\/proactive\s+status$/i, /主动消息.*状态/, /proactive status/i];

const EXIT_HINTS: RegExp[] = [
  /^\/exit$/i,
  /退出会话/,
  /结束会话/,
  /\bexit\b/i,
  /\bquit\b/i
];
const EXIT_CONFIRMED_HINTS: RegExp[] = [
  /^我走了[。！!~～]?$/u,
  /^我走啦[。！!~～]?$/u,
  /^先走了[。！!~～]?$/u,
  /^先走啦[。！!~～]?$/u,
  /^我先走了[。！!~～]?$/u,
  /^拜拜[。！!~～]?$/u,
  /^再见[。！!~～]?$/u,
  /^回头聊[。！!~～]?$/u,
  /^晚点聊[。！!~～]?$/u,
  /^先这样[。！!~～]?$/u
];

const OWNER_PATTERN = /^owner\s+(\S+)\s+(.+)$/i;
const OWNER_AUTH_PATTERN = /^owner\s+(\S+)$/i;
const MODE_UPDATE_PATTERN =
  /^(strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay)\s+(on|off|true|false|1|0)$/i;
const PROACTIVE_TUNE_PATTERN = /^\/proactive\s+(on|off)(?:\s+\d+)?$/i;
const MODE_UPDATE_STANDALONE_PATTERN =
  /^(strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay)\s+(on|off|true|false|1|0)(?:\s+confirmed=(true|false))?$/i;

const LIST_PERSONAS_HINTS: RegExp[] = [
  /^\/personas$/i,
  /(?:有哪些|列出|查看|显示|看看).*(?:人格|角色|persona)/,
  /(?:list|show|view).*persona/i,
  /persona.*(?:list|available)/i
];

// Patterns: /connect <name>, 切换到 <name>, 连接到 <name>, switch to <name>
const CONNECT_TO_PATTERN =
  /^(?:\/connect\s+|切换到\s*|连接到\s*|switch\s+to\s+|connect\s+to\s+)(.+)$/i;

export function resolveCapabilityIntent(inputRaw: string): CapabilityIntentResolution {
  const input = inputRaw.trim();
  if (!input) {
    return { matched: false, confidence: 0, reason: "empty_input" };
  }

  if (CAPABILITY_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.capability_discovery", {}, "rule:capability_discovery", 0.98);
  }

  if (SHOW_MODE_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.show_modes", {}, "rule:show_modes", 0.96);
  }

  if (PROACTIVE_STATUS_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.proactive_status", {}, "rule:proactive_status", 0.97);
  }

  const proactiveTune = PROACTIVE_TUNE_PATTERN.exec(input);
  if (proactiveTune) {
    return buildResolution(
      "session.proactive_tune",
      { action: proactiveTune[1].toLowerCase() },
      "rule:proactive_tune",
      0.97
    );
  }

  if (EXIT_CONFIRMED_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.exit", { confirmed: true }, "rule:exit_direct_confirmed", 0.995);
  }

  if (EXIT_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.exit", {}, "rule:exit", 0.99);
  }

  if (LIST_PERSONAS_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.list_personas", {}, "rule:list_personas", 0.97);
  }

  const connectMatch = CONNECT_TO_PATTERN.exec(input);
  if (connectMatch) {
    return buildResolution(
      "session.connect_to",
      { targetName: connectMatch[1].trim() },
      "rule:connect_to",
      0.97
    );
  }

  const fetchUrl = extractUrlFromIntent(input);
  if (fetchUrl) {
    return buildResolution("session.fetch_url", { url: fetchUrl }, "rule:fetch_url", 0.95);
  }

  const readPath = extractReadPathFromIntent(input);
  if (readPath) {
    return buildResolution("session.read_file", { path: readPath }, "rule:read_file", 0.95);
  }

  const ownerMatch = OWNER_PATTERN.exec(input);
  if (ownerMatch) {
    const ownerToken = ownerMatch[1];
    const command = ownerMatch[2].trim();
    const modeMatch = MODE_UPDATE_PATTERN.exec(command);
    if (modeMatch) {
      return buildResolution(
        "session.set_mode",
        {
          ownerToken,
          modeKey: modeMatch[1],
          modeValue: parseBooleanFlag(modeMatch[2])
        },
        "rule:owner_set_mode",
        0.99
      );
    }
  }
  const ownerAuthMatch = OWNER_AUTH_PATTERN.exec(input);
  if (ownerAuthMatch) {
    return buildResolution(
      "session.owner_auth",
      {
        ownerToken: ownerAuthMatch[1]
      },
      "rule:owner_auth",
      0.99
    );
  }

  const standaloneModeMatch = MODE_UPDATE_STANDALONE_PATTERN.exec(input);
  if (standaloneModeMatch) {
    return buildResolution(
      "session.set_mode",
      {
        modeKey: standaloneModeMatch[1],
        modeValue: parseBooleanFlag(standaloneModeMatch[2]),
        confirmed: standaloneModeMatch[3] === "true"
      },
      "rule:standalone_mode_update",
      0.95
    );
  }

  return { matched: false, confidence: 0, reason: "no_rule_match" };
}

export function extractUrlFromIntent(inputRaw: string): string | null {
  const input = inputRaw.trim();
  if (!input) return null;
  if (input.startsWith("/fetch ")) {
    const candidate = input.slice("/fetch ".length).trim();
    if (/^https?:\/\//i.test(candidate)) {
      return sanitizeUrlCandidate(candidate);
    }
  }
  const urlMatch = /https?:\/\/\S+/i.exec(input);
  if (urlMatch) {
    return sanitizeUrlCandidate(urlMatch[0]);
  }
  return null;
}

export function extractReadPathFromIntent(inputRaw: string): string | null {
  const input = inputRaw.trim();
  if (!input) {
    return null;
  }
  if (/https?:\/\//i.test(input)) return null;
  if (looksLikeDirectPathReadInput(input)) {
    return extractLeadingAbsolutePath(input);
  }
  if (input.startsWith("/read ")) {
    return input.slice("/read ".length).trim();
  }
  const zh = /(?:读取|读一下|帮我读|帮我读取|阅读)\s*(?:文件)?\s*[:：]?\s*(.+)$/i.exec(input);
  if (zh?.[1]) {
    const candidate = zh[1].trim();
    if (!/^(吗|嘛|么|呢)[？?]?$/u.test(candidate)) {
      return candidate;
    }
  }
  const en = /(?:read|open)\s+(?:file\s+)?(.+)$/i.exec(input);
  if (en?.[1]) {
    return en[1].trim();
  }
  const hasReadHint = /(?:读取|读一下|帮我读|帮我读取|阅读|read|open)/i.test(input);
  if (!hasReadHint) {
    return null;
  }
  const quotedPath = /["'“”](\/[^"'“”]+)["'“”]/.exec(input);
  if (quotedPath?.[1]) {
    return quotedPath[1].trim();
  }
  const absolutePath = /(\/[^\s,，。！？!?；;]+)/.exec(input);
  if (absolutePath?.[1]) {
    return absolutePath[1].trim();
  }
  return null;
}

function looksLikeDirectPathReadInput(input: string): boolean {
  if (!input.startsWith("/")) {
    return false;
  }
  if (/^\/(?:read|fetch|exit|files|clearread|proactive|relation|rename|reproduce)\b/i.test(input)) {
    return false;
  }
  return /^\/(?:Users|home|tmp|var|opt|etc)\//.test(input);
}

function extractLeadingAbsolutePath(input: string): string | null {
  const match = /^(\/[^\s,，。！？!?；;]+)/.exec(input);
  if (!match?.[1]) {
    return null;
  }
  return match[1].trim();
}

function buildResolution(
  name: CapabilityName,
  input: Record<string, unknown>,
  reason: string,
  confidence: number
): CapabilityIntentResolution {
  return {
    matched: true,
    confidence,
    reason,
    request: {
      name,
      input,
      source: "dialogue"
    }
  };
}

function parseBooleanFlag(raw: string): boolean {
  return raw === "on" || raw === "true" || raw === "1";
}

function sanitizeUrlCandidate(raw: string): string | null {
  let value = raw.trim();
  if (!value) {
    return null;
  }

  // Remove obvious trailing punctuation from natural language input.
  while (/[，。！？!?；;）)\]】}>、'"`~]+$/u.test(value)) {
    value = value.replace(/[，。！？!?；;）)\]】}>、'"`~]+$/u, "");
  }
  // Keep only URL-safe ASCII characters to avoid swallowing trailing Chinese text.
  let end = 0;
  for (const ch of value) {
    if (/^[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]$/.test(ch)) {
      end += ch.length;
      continue;
    }
    break;
  }
  value = value.slice(0, end);
  if (!value) {
    return null;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
