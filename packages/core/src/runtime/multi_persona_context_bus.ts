export type ContextChannel = "shared" | "private";

export interface ContextBusConfig {
  isolationLevel: "strict" | "shared" | "hybrid";
  participants: string[];
  currentActorId: string;
}

export interface ContextBusMessage {
  channel: ContextChannel;
  fromActorId: string;
  toActorId?: string;
  content: string;
  timestamp: string;
}

export interface ContextBusState {
  sharedMessages: ContextBusMessage[];
  privateMessages: Record<string, ContextBusMessage[]>;
  accessLog: ContextAccessRecord[];
}

export interface ContextAccessRecord {
  timestamp: string;
  actorId: string;
  targetActorId: string;
  channel: ContextChannel;
  action: "read" | "write";
  allowed: boolean;
  reason: string;
}

export interface IsolationCheckResult {
  allowed: boolean;
  reason: string;
}

const MAX_ACCESS_LOG = 500;
const MAX_MESSAGES = 200;

export function createContextBusState(): ContextBusState {
  return {
    sharedMessages: [],
    privateMessages: {},
    accessLog: [],
  };
}

export function checkAccessPermission(
  config: ContextBusConfig,
  requestingActorId: string,
  targetActorId: string,
  channel: ContextChannel,
  action: "read" | "write"
): IsolationCheckResult {
  if (!config.participants.includes(requestingActorId)) {
    return { allowed: false, reason: "not_a_participant" };
  }

  if (requestingActorId === targetActorId) {
    return { allowed: true, reason: "self_access" };
  }

  if (channel === "shared") {
    if (action === "read") {
      return { allowed: true, reason: "shared_read_allowed" };
    }
    return { allowed: true, reason: "shared_write_allowed" };
  }

  switch (config.isolationLevel) {
    case "strict":
      return { allowed: false, reason: "strict_private_cross_actor_denied" };

    case "shared":
      if (action === "read") {
        return { allowed: true, reason: "shared_mode_cross_actor_read_allowed" };
      }
      return { allowed: false, reason: "shared_mode_cross_actor_write_denied" };

    case "hybrid":
      return { allowed: false, reason: "hybrid_private_cross_actor_denied" };

    default:
      return { allowed: false, reason: "unknown_isolation_level" };
  }
}

export function postMessage(
  state: ContextBusState,
  config: ContextBusConfig,
  message: ContextBusMessage
): { nextState: ContextBusState; accessRecord: ContextAccessRecord } {
  const targetActorId =
    message.channel === "shared"
      ? message.fromActorId
      : (message.toActorId ?? message.fromActorId);

  const check = checkAccessPermission(
    config,
    message.fromActorId,
    targetActorId,
    message.channel,
    "write"
  );

  const record: ContextAccessRecord = {
    timestamp: message.timestamp,
    actorId: message.fromActorId,
    targetActorId,
    channel: message.channel,
    action: "write",
    allowed: check.allowed,
    reason: check.reason,
  };

  const nextLog = trimArray(
    [...state.accessLog, record],
    MAX_ACCESS_LOG
  );

  if (!check.allowed) {
    return {
      nextState: { ...state, accessLog: nextLog },
      accessRecord: record,
    };
  }

  if (message.channel === "shared") {
    const nextShared = trimArray(
      [...state.sharedMessages, message],
      MAX_MESSAGES
    );
    return {
      nextState: {
        sharedMessages: nextShared,
        privateMessages: { ...state.privateMessages },
        accessLog: nextLog,
      },
      accessRecord: record,
    };
  }

  const ownerKey = message.fromActorId;
  const existing = state.privateMessages[ownerKey] ?? [];
  const nextPrivate = {
    ...state.privateMessages,
    [ownerKey]: trimArray([...existing, message], MAX_MESSAGES),
  };

  return {
    nextState: {
      sharedMessages: [...state.sharedMessages],
      privateMessages: nextPrivate,
      accessLog: nextLog,
    },
    accessRecord: record,
  };
}

export function getVisibleMessages(
  state: ContextBusState,
  config: ContextBusConfig,
  actorId: string
): ContextBusMessage[] {
  const visible: ContextBusMessage[] = [...state.sharedMessages];

  for (const ownerId of Object.keys(state.privateMessages)) {
    const check = checkAccessPermission(
      config,
      actorId,
      ownerId,
      "private",
      "read"
    );
    if (check.allowed) {
      visible.push(...state.privateMessages[ownerId]);
    }
  }

  visible.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return visible;
}

/**
 * Scans access log for successful cross-actor private access that
 * should have been denied — i.e. actual data leakage. Denied attempts
 * (the guard working correctly) are NOT counted as leakage.
 */
export function assertNoLeakage(
  state: ContextBusState,
  config: ContextBusConfig
): { ok: boolean; violations: ContextAccessRecord[] } {
  const violations = state.accessLog.filter(
    (r) =>
      r.allowed &&
      r.channel === "private" &&
      r.actorId !== r.targetActorId &&
      (config.isolationLevel === "strict" || config.isolationLevel === "hybrid")
  );
  return { ok: violations.length === 0, violations };
}

export function buildMemoryIsolationFilter(
  config: ContextBusConfig,
  actorId: string
): { speakerIdWhitelist: string[] | null } {
  switch (config.isolationLevel) {
    case "strict":
      return { speakerIdWhitelist: [actorId] };
    case "shared":
      return { speakerIdWhitelist: null };
    case "hybrid":
      return { speakerIdWhitelist: [actorId] };
    default:
      return { speakerIdWhitelist: [actorId] };
  }
}

function trimArray<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}
