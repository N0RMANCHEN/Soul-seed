import type { CognitionState, ModelRoutingConfig } from "../types.js";

// ── types ─────────────────────────────────────────────────────────────────────

export type RouteTag = "instinct" | "deliberative" | "meta";

// ── resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolve the model name for a given route tag.
 * Priority: cognitionState.modelRouting[routeTag] → defaultModel
 */
export function resolveModelForRoute(
  routeTag: RouteTag,
  cognitionState: Pick<CognitionState, "modelRouting">,
  defaultModel: string
): string {
  const routing = cognitionState.modelRouting;
  if (!routing) {
    return defaultModel;
  }
  return routing[routeTag]?.trim() || defaultModel;
}

/**
 * Build a ModelRoutingConfig from partial options, merging with existing config.
 */
export function mergeModelRoutingConfig(
  existing: ModelRoutingConfig | undefined,
  patch: Partial<ModelRoutingConfig>
): ModelRoutingConfig {
  const base: ModelRoutingConfig = { ...(existing ?? {}) };
  if (typeof patch.instinct === "string") {
    base.instinct = patch.instinct.trim() || undefined;
  }
  if (typeof patch.deliberative === "string") {
    base.deliberative = patch.deliberative.trim() || undefined;
  }
  if (typeof patch.meta === "string") {
    base.meta = patch.meta.trim() || undefined;
  }
  // Remove undefined keys
  if (!base.instinct) delete base.instinct;
  if (!base.deliberative) delete base.deliberative;
  if (!base.meta) delete base.meta;
  return base;
}

/**
 * Format the routing config for display.
 */
export function formatModelRoutingConfig(
  routing: ModelRoutingConfig | undefined,
  defaultModel: string
): string {
  const instinct = routing?.instinct ?? `${defaultModel} (default)`;
  const deliberative = routing?.deliberative ?? `${defaultModel} (default)`;
  const meta = routing?.meta ?? `${defaultModel} (default)`;
  return `instinct=${instinct}  deliberative=${deliberative}  meta=${meta}`;
}

/**
 * Return all distinct model names in use across routes.
 */
export function listRoutingModels(
  routing: ModelRoutingConfig | undefined,
  defaultModel: string
): string[] {
  const models = new Set<string>();
  models.add(defaultModel);
  if (routing?.instinct) models.add(routing.instinct);
  if (routing?.deliberative) models.add(routing.deliberative);
  if (routing?.meta) models.add(routing.meta);
  return [...models];
}
