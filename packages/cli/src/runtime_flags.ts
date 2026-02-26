export type StreamReplySource = "default_on" | "soulseed_stream_reply" | "legacy_stream_raw";

export interface StreamReplyResolution {
  enabled: boolean;
  source: StreamReplySource;
}

export interface ReplyDisplayModeInput {
  streamed: boolean;
  shouldDisplayAssistant: boolean;
  adjustedByGuard: boolean;
  rawText: string;
  finalText: string;
}

function isTruthy(value: string): boolean {
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function isFalsy(value: string): boolean {
  return value === "0" || value === "false" || value === "off" || value === "no";
}

function parseSwitch(raw: string | undefined): boolean | null {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (isTruthy(normalized)) {
    return true;
  }
  if (isFalsy(normalized)) {
    return false;
  }
  return null;
}

export function resolveStreamReplyEnabled(env: NodeJS.ProcessEnv = process.env): StreamReplyResolution {
  const primary = parseSwitch(env.SOULSEED_STREAM_REPLY);
  if (primary !== null) {
    return {
      enabled: primary,
      source: "soulseed_stream_reply"
    };
  }

  const legacy = parseSwitch(env.SOULSEED_STREAM_RAW);
  if (legacy !== null) {
    return {
      enabled: legacy,
      source: "legacy_stream_raw"
    };
  }

  return {
    enabled: true,
    source: "default_on"
  };
}

export function resolveReplyDisplayMode(input: ReplyDisplayModeInput): "none" | "full" | "adjusted" {
  if (!input.shouldDisplayAssistant) {
    return "none";
  }
  if (!input.streamed) {
    return "full";
  }
  if (input.adjustedByGuard || input.rawText.trim() !== input.finalText.trim()) {
    return "adjusted";
  }
  return "none";
}
