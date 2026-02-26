import {
  loadSpeakerRegistry,
  loadGroupPolicy,
  loadSessionGraph,
  type MultiPersonaSpeakerRegistry,
  type MultiPersonaRegistryEntry
} from "./multi_persona_registry.js";

export interface MultiPersonaCommandContext {
  personaRootPath: string;
  currentPersonaId: string;
  currentPersonaDisplayName: string;
  isPhaseKEnabled: boolean;
}

export interface MultiPersonaCommandResult {
  handled: boolean;
  output: string;
  action?: "mute" | "unmute" | "solo" | "invite" | "who" | "none";
  targetActorId?: string;
}

const COMMAND_PREFIXES = ["/who", "/mute", "/solo", "/invite", "/mp"] as const;

export function isMultiPersonaCommand(input: string): boolean {
  const trimmed = input.trim();
  return COMMAND_PREFIXES.some((cmd) =>
    trimmed === cmd || trimmed.startsWith(cmd + " ")
  );
}

export async function handleMultiPersonaCommand(
  input: string,
  ctx: MultiPersonaCommandContext
): Promise<MultiPersonaCommandResult> {
  const trimmed = input.trim();

  if (!ctx.isPhaseKEnabled) {
    return {
      handled: true,
      output: "multi-persona not enabled (set SOULSEED_PHASE_K_ENABLE=1)",
      action: "none"
    };
  }

  if (trimmed === "/who") {
    return handleWho(ctx);
  }

  if (trimmed.startsWith("/mute ")) {
    const name = trimmed.slice("/mute ".length).trim();
    return handleMute(name, ctx);
  }

  if (trimmed.startsWith("/solo ")) {
    const name = trimmed.slice("/solo ".length).trim();
    return handleSolo(name, ctx);
  }

  if (trimmed.startsWith("/invite ")) {
    const name = trimmed.slice("/invite ".length).trim();
    return handleInvite(name, ctx);
  }

  if (trimmed === "/mp" || trimmed.startsWith("/mp ")) {
    const sub = trimmed.slice("/mp".length).trim();
    if (sub === "status") {
      return handleMpStatus(ctx);
    }
    return {
      handled: true,
      output: buildHelpText(),
      action: "none"
    };
  }

  return { handled: false, output: "", action: "none" };
}

export function formatSpeakerLabel(role: string, label: string): string {
  if ((role === "assistant" || role === "system") && label) {
    return `[${role}:${label}]`;
  }
  return "";
}

// ── Command handlers ────────────────────────────────────────

async function handleWho(ctx: MultiPersonaCommandContext): Promise<MultiPersonaCommandResult> {
  const registry = await loadSpeakerRegistry(ctx.personaRootPath);
  if (registry.entries.length === 0) {
    return {
      handled: true,
      output: "No personas registered. Use /invite <name> to add one.",
      action: "who"
    };
  }
  const header = "actorId            | displayName        | role";
  const separator = "-------------------+--------------------+-----------";
  const rows = registry.entries.map((e) =>
    `${pad(e.actorId, 19)}| ${pad(e.displayName, 19)}| ${e.role}`
  );
  return {
    handled: true,
    output: [header, separator, ...rows].join("\n"),
    action: "who"
  };
}

async function handleMute(
  name: string,
  ctx: MultiPersonaCommandContext
): Promise<MultiPersonaCommandResult> {
  if (!name) {
    return { handled: true, output: "Usage: /mute <displayName>", action: "none" };
  }
  const registry = await loadSpeakerRegistry(ctx.personaRootPath);
  const entry = findByDisplayName(registry, name);
  if (!entry) {
    return {
      handled: true,
      output: `No persona found with name "${name}".`,
      action: "none"
    };
  }
  return {
    handled: true,
    output: `Muted ${entry.displayName} (${entry.actorId}).`,
    action: "mute",
    targetActorId: entry.actorId
  };
}

async function handleSolo(
  name: string,
  ctx: MultiPersonaCommandContext
): Promise<MultiPersonaCommandResult> {
  if (!name) {
    return { handled: true, output: "Usage: /solo <displayName>", action: "none" };
  }
  const registry = await loadSpeakerRegistry(ctx.personaRootPath);
  const entry = findByDisplayName(registry, name);
  if (!entry) {
    return {
      handled: true,
      output: `No persona found with name "${name}".`,
      action: "none"
    };
  }
  return {
    handled: true,
    output: `Solo mode: only ${entry.displayName} will respond.`,
    action: "solo",
    targetActorId: entry.actorId
  };
}

async function handleInvite(
  name: string,
  ctx: MultiPersonaCommandContext
): Promise<MultiPersonaCommandResult> {
  if (!name) {
    return { handled: true, output: "Usage: /invite <displayName>", action: "none" };
  }
  const registry = await loadSpeakerRegistry(ctx.personaRootPath);
  const entry = findByDisplayName(registry, name);
  if (!entry) {
    return {
      handled: true,
      output: `No persona found with name "${name}". Register it first.`,
      action: "none"
    };
  }
  return {
    handled: true,
    output: `Invited ${entry.displayName} (${entry.actorId}) to the conversation.`,
    action: "invite",
    targetActorId: entry.actorId
  };
}

async function handleMpStatus(ctx: MultiPersonaCommandContext): Promise<MultiPersonaCommandResult> {
  const [policy, graph, registry] = await Promise.all([
    loadGroupPolicy(ctx.personaRootPath),
    loadSessionGraph(ctx.personaRootPath),
    loadSpeakerRegistry(ctx.personaRootPath)
  ]);

  const activeSessions = graph.sessions.filter((s) => s.state === "active").length;
  const lines = [
    `Arbitration: ${policy.arbitrationMode}`,
    `Isolation: ${policy.isolationLevel}`,
    `Cooperation: ${policy.cooperationEnabled ? "on" : "off"}`,
    `Turn scheduling: ${policy.turnScheduling.mode} (max ${policy.turnScheduling.maxConsecutiveTurns} consecutive)`,
    `Registered personas: ${registry.entries.length}/${policy.maxRegisteredPersonas}`,
    `Active sessions: ${activeSessions}`
  ];
  return {
    handled: true,
    output: lines.join("\n"),
    action: "none"
  };
}

// ── Helpers ─────────────────────────────────────────────────

function findByDisplayName(
  registry: MultiPersonaSpeakerRegistry,
  name: string
): MultiPersonaRegistryEntry | undefined {
  const lower = name.toLowerCase();
  return registry.entries.find((e) => e.displayName.toLowerCase() === lower);
}

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}

function buildHelpText(): string {
  return [
    "Multi-persona commands:",
    "  /who              — list registered personas",
    "  /mute <name>      — mute a persona",
    "  /solo <name>      — solo a persona (mute all others)",
    "  /invite <name>    — invite a registered persona",
    "  /mp status        — show multi-persona status"
  ].join("\n");
}
