import type { CapabilityCallRequest, CapabilityName } from "../types.js";
import { projectTopicAttention } from "../runtime/semantic_projection.js";

export interface CapabilityIntentResolution {
  matched: boolean;
  request?: CapabilityCallRequest;
  confidence: number;
  reason: string;
  routingTier?: "L1" | "L4";
  fallbackReason?: string;
}

const CAPABILITY_HINTS: RegExp[] = [
  /你能[做干]什么/u,
  /都能帮我[做干]什么/u,
  /[可能]以[做干]什么/u,
  /有(?:哪些|什么)功能/u,
  /capabilit/i,
  /what can you do/i,
  /what.*(?:feature|abilit)/i
];

const SHOW_MODE_HINTS: RegExp[] = [
  /当前模式/,
  /模式状态/,
  /(?:查看|显示|看看).*模式/u,
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
  /(?:^|好的|好|嗯|那)我(?:先)?走了[。！!~～]?$/u,
  /(?:^|好的|好|嗯|那)我走啦[。！!~～]?$/u,
  /先走了[。！!~～]?$/u,
  /先走啦[。！!~～]?$/u,
  /我(?:先)?走了[。！!~～]?/u,
  /拜拜[。！!~～]?/u,
  /再见[。！!~～]?/u,
  /回头聊[。！!~～]?/u,
  /晚点聊[。！!~～]?/u,
  /先这样[。！!~～]?/u,
  /\bbye\b/i,
  /\bgoodbye\b/i,
  /\bsee you\b/i
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

// Patterns for creating a new persona: /new <name>, 创建人格 <name>, 新建人格 <name>
const CREATE_PERSONA_PATTERN =
  /^(?:\/new\s+|创建人格\s+|新建人格\s+|create\s+persona\s+)(.+)$/i;

// Shared space patterns
const SHARED_SPACE_SETUP_ZH = /^(?:设置|配置|创建)(?:我们的|我和\S+的)?(?:专属|共享)?文件夹\s*(?:到|为|在|路径)?\s*(.+)$/u;
const SHARED_SPACE_SETUP_EN = /^(?:set\s+up|setup|configure|create)\s+(?:our\s+)?(?:shared|private)?\s*(?:folder|directory)\s+(?:at|to|in)?\s*(.+)$/i;

const SHARED_SPACE_LIST_HINTS: RegExp[] = [
  /看看?我们的(?:专属|共享)?文件夹/u,
  /我们?(?:的)?文件夹里(?:有什么|有哪些|的内容)/u,
  /列出(?:共享|我们的)文件/u,
  /(?:shared\s+folder\s+content|what.+our\s+folder|list.+our\s+folder)/i,
];

const SHARED_SPACE_READ_ZH = /(?:读取|打开|看看?)(?:我们的)?(?:共享|专属)?文件夹(?:里的?|中的?)?\s*["']?([^\s"'，。！？]+)["']?/u;
const SHARED_SPACE_READ_EN = /(?:read|open|show)\s+["']?([^\s"']+)["']?\s+from\s+our\s+(?:shared\s+)?folder/i;

const SHARED_SPACE_WRITE_ZH = /^(?:存|保存|写|放)(?:到|在)我们(?:的)?(?:共享|专属)?文件夹[\s:：]+["']?([^\s"':：，。！？]+)["']?(?:[\s:：]+(.+))?$/su;
const SHARED_SPACE_WRITE_EN = /^(?:save|write|put)\s+(?:to\s+)?our\s+(?:shared\s+)?folder\s+["']?([^\s"':]+)["']?(?::\s*(.+))?$/si;
const SHARED_SPACE_WRITE_HINTS: RegExp[] = [/(?:存|保存|写)到我们(的)?文件夹/u, /save.*our\s+folder/i];

const SHARED_SPACE_DELETE_ZH = /(?:删除|移除|清除)(?:我们的)?(?:共享|专属)?文件夹(?:里的?|中的?)?\s*["']?([^\s"'，。！？]+)["']?/u;
const SHARED_SPACE_DELETE_EN = /(?:delete|remove)\s+["']?([^\s"']+)["']?\s+from\s+our\s+(?:shared\s+)?folder/i;

export function resolveCapabilityIntent(inputRaw: string): CapabilityIntentResolution {
  const input = inputRaw.trim();
  if (!input) {
    return { matched: false, confidence: 0, reason: "empty_input" };
  }

  const semanticMatch = resolveBySemanticRouting(input);
  if (semanticMatch) {
    return semanticMatch;
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

  const createPersonaMatch = CREATE_PERSONA_PATTERN.exec(input);
  if (createPersonaMatch) {
    return buildResolution(
      "session.create_persona",
      { name: createPersonaMatch[1].trim() },
      "rule:create_persona",
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

  // Shared space: setup
  const ssSetupZh = SHARED_SPACE_SETUP_ZH.exec(input);
  if (ssSetupZh) {
    return buildResolution("session.shared_space_setup", { path: ssSetupZh[1].trim() }, "rule:shared_space_setup", 0.96);
  }
  const ssSetupEn = SHARED_SPACE_SETUP_EN.exec(input);
  if (ssSetupEn) {
    return buildResolution("session.shared_space_setup", { path: ssSetupEn[1].trim() }, "rule:shared_space_setup", 0.96);
  }

  // Shared space: delete (check before read to avoid "删除" being caught by read)
  const ssDeleteZh = SHARED_SPACE_DELETE_ZH.exec(input);
  if (ssDeleteZh) {
    return buildResolution("session.shared_space_delete", { path: ssDeleteZh[1].trim() }, "rule:shared_space_delete", 0.95);
  }
  const ssDeleteEn = SHARED_SPACE_DELETE_EN.exec(input);
  if (ssDeleteEn) {
    return buildResolution("session.shared_space_delete", { path: ssDeleteEn[1].trim() }, "rule:shared_space_delete", 0.95);
  }

  // Shared space: list
  if (SHARED_SPACE_LIST_HINTS.some((p) => p.test(input))) {
    return buildResolution("session.shared_space_list", {}, "rule:shared_space_list", 0.95);
  }

  // Shared space: read
  const ssReadZh = SHARED_SPACE_READ_ZH.exec(input);
  if (ssReadZh) {
    return buildResolution("session.shared_space_read", { path: ssReadZh[1].trim() }, "rule:shared_space_read", 0.95);
  }
  const ssReadEn = SHARED_SPACE_READ_EN.exec(input);
  if (ssReadEn) {
    return buildResolution("session.shared_space_read", { path: ssReadEn[1].trim() }, "rule:shared_space_read", 0.95);
  }

  // Shared space: write
  const ssWriteZh = SHARED_SPACE_WRITE_ZH.exec(input);
  if (ssWriteZh) {
    return buildResolution(
      "session.shared_space_write",
      { path: ssWriteZh[1].trim(), content: (ssWriteZh[2] ?? "").trim() },
      "rule:shared_space_write",
      0.95
    );
  }
  const ssWriteEn = SHARED_SPACE_WRITE_EN.exec(input);
  if (ssWriteEn) {
    return buildResolution(
      "session.shared_space_write",
      { path: ssWriteEn[1].trim(), content: (ssWriteEn[2] ?? "").trim() },
      "rule:shared_space_write",
      0.95
    );
  }
  if (SHARED_SPACE_WRITE_HINTS.some((p) => p.test(input))) {
    return buildResolution("session.shared_space_write", { path: "", content: "" }, "rule:shared_space_write_hint", 0.85);
  }

  return { matched: false, confidence: 0, reason: "no_rule_match", routingTier: "L4", fallbackReason: "capability_regex_no_match" };
}

function resolveBySemanticRouting(input: string): CapabilityIntentResolution | null {
  const semanticTargets: Array<{ capability: CapabilityName; anchor: string }> = [
    { capability: "session.capability_discovery", anchor: "what can you do" },
    { capability: "session.show_modes", anchor: "show current mode status" },
    { capability: "session.proactive_status", anchor: "show proactive status" },
    { capability: "session.list_personas", anchor: "list all personas" },
    { capability: "session.connect_to", anchor: "switch to persona" },
    { capability: "session.create_persona", anchor: "create a new persona" },
    { capability: "session.shared_space_list", anchor: "list our shared folder files" }
  ];
  const scored = projectTopicAttention(
    input,
    semanticTargets.map((item) => item.anchor)
  );
  const top = scored[0];
  if (!top || top.score < 0.78) {
    return null;
  }
  const matchedTarget = semanticTargets.find((item) => item.anchor === top.topic);
  if (!matchedTarget) {
    return null;
  }
  if (matchedTarget.capability === "session.connect_to") {
    const m = /(?:切换到|switch to|connect to)\s+(.+)$/iu.exec(input.trim());
    if (m?.[1]?.trim()) {
      return buildResolution("session.connect_to", { targetName: m[1].trim() }, "semantic:connect_to", Math.min(0.98, top.score), "L1");
    }
    return null;
  }
  if (matchedTarget.capability === "session.create_persona") {
    const m = /(?:创建人格|新建人格|create persona|new)\s+(.+)$/iu.exec(input.trim());
    if (m?.[1]?.trim()) {
      return buildResolution("session.create_persona", { name: m[1].trim() }, "semantic:create_persona", Math.min(0.98, top.score), "L1");
    }
    return null;
  }
  return buildResolution(matchedTarget.capability, {}, `semantic:${matchedTarget.capability}`, Math.min(0.98, top.score), "L1");
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
  confidence: number,
  routingTier: "L1" | "L4" = "L4"
): CapabilityIntentResolution {
  return {
    matched: true,
    confidence,
    reason,
    routingTier,
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
