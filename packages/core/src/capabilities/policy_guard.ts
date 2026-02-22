import path from "node:path";
import os from "node:os";
import type { CapabilityCallRequest, CapabilityName } from "../types.js";
import { getCapabilityDefinition } from "./registry.js";

export interface CapabilityGuardContext {
  cwd: string;
  ownerKey?: string;
  ownerSessionAuthorized?: boolean;
  approvedReadPaths?: Set<string>;
  approvedFetchOrigins?: Set<string>;
  fetchOriginAllowlist?: Set<string>;
  /** Absolute path to persona's shared space root, if configured and enabled */
  sharedSpacePath?: string;
}

export interface CapabilityGuardResult {
  status: "allow" | "confirm_required" | "rejected";
  reason: string;
  capability: CapabilityName;
  normalizedInput: Record<string, unknown>;
  requiresOwnerAuth: boolean;
}

export function evaluateCapabilityPolicy(
  request: CapabilityCallRequest,
  context: CapabilityGuardContext
): CapabilityGuardResult {
  const definition = getCapabilityDefinition(request.name);
  if (!definition) {
    return {
      status: "rejected",
      reason: "capability_not_found",
      capability: request.name,
      normalizedInput: request.input ?? {},
      requiresOwnerAuth: false
    };
  }

  const input = { ...(request.input ?? {}) };
  if (request.name === "session.read_file") {
    const rawPath = typeof input.path === "string" ? input.path.trim() : "";
    if (!rawPath) {
      return reject(request.name, "missing_path", input, false);
    }
    const resolvedPath = path.resolve(context.cwd, rawPath);
    input.path = resolvedPath;
    const confirmed = input.confirmed === true;
    const approved = context.approvedReadPaths?.has(resolvedPath) === true;
    if (!confirmed && !approved) {
      return confirm(request.name, "first_read_path_confirmation_required", input, false);
    }
    return allow(request.name, "read_path_allowed", input, false);
  }

  if (request.name === "session.fetch_url") {
    const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
    if (!rawUrl) {
      return reject(request.name, "missing_url", input, false);
    }
    let origin = "";
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return reject(request.name, "invalid_url_scheme", input, false);
      }
      origin = parsed.origin;
    } catch {
      return reject(request.name, "invalid_url", input, false);
    }
    input.url = rawUrl;
    input.origin = origin;
    const allowlist = context.fetchOriginAllowlist;
    if (allowlist && allowlist.size > 0 && !isOriginAllowed(origin, allowlist)) {
      return reject(request.name, "fetch_origin_not_allowed", input, false);
    }
    const confirmed = input.confirmed === true;
    const approved = origin ? context.approvedFetchOrigins?.has(origin) === true : false;
    if (!confirmed && !approved) {
      return confirm(request.name, "first_fetch_origin_confirmation_required", input, false);
    }
    return allow(request.name, "fetch_url_allowed", input, false);
  }

  if (request.name === "session.exit") {
    if (input.confirmed !== true) {
      return confirm(request.name, "exit_confirmation_required", input, false);
    }
    return allow(request.name, "exit_confirmed", input, false);
  }

  if (request.name === "session.set_mode") {
    const modeKey = typeof input.modeKey === "string" ? input.modeKey.trim() : "";
    if (!modeKey) {
      return reject(request.name, "missing_mode_key", input, true);
    }
    if (typeof input.modeValue !== "boolean") {
      return reject(request.name, "missing_mode_value", input, true);
    }
    const provided = typeof input.ownerToken === "string" ? input.ownerToken : "";
    if (!context.ownerKey || (provided !== context.ownerKey && context.ownerSessionAuthorized !== true)) {
      return reject(request.name, "owner_auth_failed", input, true);
    }
    if (input.confirmed !== true) {
      return confirm(request.name, "high_risk_confirmation_required", input, true);
    }
    return allow(request.name, "owner_auth_passed", input, true);
  }

  if (request.name === "session.owner_auth") {
    const provided = typeof input.ownerToken === "string" ? input.ownerToken : "";
    if (!context.ownerKey || provided !== context.ownerKey) {
      return reject(request.name, "owner_auth_failed", input, true);
    }
    return allow(request.name, "owner_auth_passed", input, true);
  }

  if (request.name === "session.proactive_tune" || request.name === "session.proactive_status") {
    return allow(request.name, "allowed", input, false);
  }

  if (request.name === "session.create_persona") {
    const rawName = typeof input.name === "string" ? input.name.trim() : "";
    if (!rawName) {
      return reject(request.name, "missing_persona_name", input, false);
    }
    input.name = rawName;
    if (input.confirmed !== true) {
      return confirm(request.name, "create_persona_confirmation_required", input, false);
    }
    return allow(request.name, "create_persona_allowed", input, false);
  }

  // Shared space: setup
  if (request.name === "session.shared_space_setup") {
    const rawPath = typeof input.path === "string" ? input.path.trim() : "";
    if (!rawPath) {
      return reject(request.name, "missing_path", input, false);
    }
    // Expand ~ to home directory
    input.path = rawPath.startsWith("~") ? rawPath.replace(/^~/, os.homedir()) : rawPath;
    if (input.confirmed !== true) {
      return confirm(request.name, "setup_confirmation_required", input, false);
    }
    return allow(request.name, "setup_allowed", input, false);
  }

  // Shared space: list — only needs sharedSpacePath to exist
  if (request.name === "session.shared_space_list") {
    if (!context.sharedSpacePath) {
      return reject(request.name, "shared_space_not_configured", input, false);
    }
    return allow(request.name, "allowed", input, false);
  }

  // Shared space: read / write / delete — strict path sandbox
  if (
    request.name === "session.shared_space_read" ||
    request.name === "session.shared_space_write" ||
    request.name === "session.shared_space_delete"
  ) {
    if (!context.sharedSpacePath) {
      return reject(request.name, "shared_space_not_configured", input, false);
    }
    const rawFilePath = typeof input.path === "string" ? input.path.trim() : "";
    if (rawFilePath) {
      const resolved = path.resolve(context.sharedSpacePath, rawFilePath);
      // Path traversal protection: resolved path must be inside sharedSpacePath
      if (!resolved.startsWith(context.sharedSpacePath + path.sep) && resolved !== context.sharedSpacePath) {
        return reject(request.name, "path_outside_shared_space", input, false);
      }
      input.path = resolved;
    }
    if (request.name === "session.shared_space_delete") {
      if (input.confirmed !== true) {
        return confirm(request.name, "delete_confirmation_required", input, false);
      }
    }
    return allow(request.name, "allowed", input, false);
  }

  return allow(request.name, "allowed", input, definition.ownerOnly);
}

function allow(
  capability: CapabilityName,
  reason: string,
  normalizedInput: Record<string, unknown>,
  requiresOwnerAuth: boolean
): CapabilityGuardResult {
  return { status: "allow", reason, capability, normalizedInput, requiresOwnerAuth };
}

function confirm(
  capability: CapabilityName,
  reason: string,
  normalizedInput: Record<string, unknown>,
  requiresOwnerAuth: boolean
): CapabilityGuardResult {
  return { status: "confirm_required", reason, capability, normalizedInput, requiresOwnerAuth };
}

function reject(
  capability: CapabilityName,
  reason: string,
  normalizedInput: Record<string, unknown>,
  requiresOwnerAuth: boolean
): CapabilityGuardResult {
  return { status: "rejected", reason, capability, normalizedInput, requiresOwnerAuth };
}

function isOriginAllowed(origin: string, allowlist: Set<string>): boolean {
  if (!origin) {
    return false;
  }
  if (allowlist.has(origin)) {
    return true;
  }
  let host = "";
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  for (const item of allowlist) {
    const token = item.trim().toLowerCase();
    if (!token) {
      continue;
    }
    if (token.startsWith("*.")) {
      const suffix = token.slice(2);
      if (host === suffix || host.endsWith(`.${suffix}`)) {
        return true;
      }
      continue;
    }
    if (token === host) {
      return true;
    }
    if (token === `http://${host}` || token === `https://${host}`) {
      return true;
    }
  }
  return false;
}
