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

const OWNER_PATTERN = /^owner\s+(\S+)\s+(.+)$/i;
const OWNER_AUTH_PATTERN = /^owner\s+(\S+)$/i;
const MODE_UPDATE_PATTERN =
  /^(strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay)\s+(on|off|true|false|1|0)$/i;
const PROACTIVE_TUNE_PATTERN = /^\/proactive\s+(on|off)(?:\s+\d+)?$/i;
const MODE_UPDATE_STANDALONE_PATTERN =
  /^(strict_memory_grounding|adult_mode|age_verified|explicit_consent|fictional_roleplay)\s+(on|off|true|false|1|0)(?:\s+confirmed=(true|false))?$/i;

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

  if (EXIT_HINTS.some((pattern) => pattern.test(input))) {
    return buildResolution("session.exit", {}, "rule:exit", 0.99);
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

export function extractReadPathFromIntent(inputRaw: string): string | null {
  const input = inputRaw.trim();
  if (!input) {
    return null;
  }
  if (input.startsWith("/read ")) {
    return input.slice("/read ".length).trim();
  }
  const zh = /(?:读取|读一下|帮我读|帮我读取)\s*(?:文件)?\s*[:：]?\s*(.+)$/i.exec(input);
  if (zh?.[1]) {
    return zh[1].trim();
  }
  const en = /(?:read|open)\s+(?:file\s+)?(.+)$/i.exec(input);
  if (en?.[1]) {
    return en[1].trim();
  }
  return null;
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
