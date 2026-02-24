export type RuntimeProvider = "deepseek" | "openai" | "anthropic" | "openai_compat" | "custom";

export interface RuntimeModelConfig {
  provider: RuntimeProvider;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  candidateModels: string[];
  embeddingModel: string;
  embeddingDim: number;
  llmRetries: number;
  llmTimeoutMs: number;
  providerHint: RuntimeProvider;
}

export interface RuntimeModelConfigOverrides {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  modelCandidates?: string[];
  fallbackModel?: string;
  embeddingModel?: string;
  embeddingDim?: number;
}

export interface RuntimeModelInspection {
  ok: boolean;
  errors: string[];
  warnings: string[];
  config: RuntimeModelConfig;
}

export function inspectRuntimeModelConfig(
  overrides: RuntimeModelConfigOverrides = {}
): RuntimeModelInspection {
  const apiKey = firstNonEmpty(
    overrides.apiKey,
    process.env.SOULSEED_API_KEY,
    process.env.DEEPSEEK_API_KEY
  );
  const baseUrl = firstNonEmpty(
    overrides.baseUrl,
    process.env.SOULSEED_BASE_URL,
    process.env.DEEPSEEK_BASE_URL,
    inferLegacyDeepSeekBaseUrl(apiKey)
  );
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const provider = resolveProvider(
    firstNonEmpty(overrides.provider, process.env.SOULSEED_PROVIDER),
    baseUrl
  );
  const inferredModel = inferDefaultModel(provider, baseUrl);
  const chatModel = firstNonEmpty(
    overrides.model,
    process.env.SOULSEED_MODEL,
    process.env.DEEPSEEK_MODEL,
    inferredModel
  );
  const rawCandidates = firstNonEmpty(
    overrides.modelCandidates?.join(","),
    process.env.SOULSEED_MODEL_CANDIDATES,
    process.env.SOULSEED_FALLBACK_MODEL
  );
  const candidateModels = buildCandidateModels(chatModel, rawCandidates, overrides.fallbackModel);
  const embeddingModel = firstNonEmpty(
    overrides.embeddingModel,
    process.env.SOULSEED_EMBEDDING_MODEL,
    process.env.DEEPSEEK_EMBEDDING_MODEL,
    "text-embedding-3-small"
  );
  const embeddingDim = clampInt(
    Number(
      firstNonEmpty(
        String(overrides.embeddingDim ?? ""),
        process.env.SOULSEED_EMBEDDING_DIM,
        process.env.DEEPSEEK_EMBEDDING_DIM,
        "1024"
      )
    ),
    128,
    8192,
    1024
  );
  const llmRetries = clampInt(Number(process.env.SOULSEED_LLM_RETRIES ?? 2), 0, 5, 2);
  const llmTimeoutMs = clampInt(Number(process.env.SOULSEED_LLM_TIMEOUT_MS ?? 35000), 5000, 120000, 35000);

  const config: RuntimeModelConfig = {
    provider,
    apiKey,
    baseUrl: normalizedBaseUrl,
    chatModel,
    candidateModels,
    embeddingModel,
    embeddingDim,
    llmRetries,
    llmTimeoutMs,
    providerHint: provider
  };
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.apiKey) {
    errors.push("missing_api_key: set SOULSEED_API_KEY (or legacy DEEPSEEK_API_KEY).");
  }
  if (!config.baseUrl) {
    errors.push("missing_base_url: set SOULSEED_BASE_URL (or legacy DEEPSEEK_BASE_URL).");
  }
  if (!config.chatModel) {
    errors.push("missing_model: set SOULSEED_MODEL (or legacy DEEPSEEK_MODEL).");
  }
  if (config.baseUrl && config.chatModel && isModelProviderMismatch(config.provider, config.baseUrl, config.chatModel)) {
    errors.push(
      `provider_model_mismatch: provider=${config.provider}, baseUrl=${config.baseUrl}, model=${config.chatModel}.`
    );
  }
  if (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_MODEL) {
    warnings.push("legacy_env_detected: DEEPSEEK_* is deprecated; migrate to SOULSEED_*.");
  }
  if (process.env.SOULSEED_MODEL && process.env.DEEPSEEK_MODEL) {
    warnings.push("dual_model_env_detected: SOULSEED_MODEL overrides DEEPSEEK_MODEL.");
  }
  if (!process.env.SOULSEED_PROVIDER) {
    warnings.push("provider_not_explicit: infer from base URL/env; set SOULSEED_PROVIDER for stability.");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    config
  };
}

export function resolveRuntimeModelConfig(
  overrides: RuntimeModelConfigOverrides = {}
): RuntimeModelConfig {
  const inspection = inspectRuntimeModelConfig(overrides);
  if (!inspection.ok) {
    throw new Error(`Invalid runtime model config: ${inspection.errors.join(" ")}`);
  }
  return inspection.config;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function inferLegacyDeepSeekBaseUrl(apiKey: string): string {
  const hasLegacySignal =
    Boolean(process.env.DEEPSEEK_API_KEY) ||
    Boolean(process.env.DEEPSEEK_BASE_URL) ||
    Boolean(process.env.DEEPSEEK_MODEL);
  return hasLegacySignal && apiKey ? "https://api.deepseek.com/v1" : "";
}

function resolveProvider(raw: string, baseUrl: string): RuntimeProvider {
  const normalized = normalizeProvider(raw);
  if (normalized) return normalized;
  return inferProviderHint(baseUrl);
}

function normalizeProvider(raw: string): RuntimeProvider | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "deepseek") return "deepseek";
  if (normalized === "openai") return "openai";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "openai_compat" || normalized === "openai-compat" || normalized === "compat") return "openai_compat";
  if (normalized === "custom") return "custom";
  return null;
}

function inferProviderHint(baseUrl: string): RuntimeProvider {
  const lowered = baseUrl.toLowerCase();
  if (!lowered) return "custom";
  if (lowered.includes("deepseek")) return "deepseek";
  if (lowered.includes("anthropic")) return "anthropic";
  if (lowered.includes("api.openai.com")) return "openai";
  if (lowered.includes("openai")) return "openai_compat";
  if (lowered.includes("openrouter")) return "openai_compat";
  if (lowered.includes("/v1")) return "openai_compat";
  return "custom";
}

function inferDefaultModel(provider: RuntimeProvider, baseUrl: string): string {
  if (provider === "deepseek") return "deepseek-chat";
  if (provider === "openai" && baseUrl.toLowerCase().includes("api.openai.com")) return "gpt-4o-mini";
  if (provider === "anthropic" || baseUrl.toLowerCase().includes("anthropic")) return "claude-3-5-sonnet-latest";
  return "";
}

function buildCandidateModels(primaryModel: string, rawCandidates: string, fallbackModel?: string): string[] {
  const normalized = rawCandidates
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (fallbackModel && fallbackModel.trim()) {
    normalized.push(fallbackModel.trim());
  }
  const merged = [primaryModel, ...normalized].map((item) => item.trim()).filter((item) => item.length > 0);
  return [...new Set(merged)];
}

function isModelProviderMismatch(provider: RuntimeProvider, baseUrl: string, model: string): boolean {
  const lowerModel = model.toLowerCase();
  const lowerBase = baseUrl.toLowerCase();
  if (provider === "deepseek" || lowerBase.includes("deepseek")) {
    return lowerModel.includes("claude") || /^gpt[-_]/.test(lowerModel);
  }
  if (provider === "anthropic" || lowerBase.includes("anthropic")) {
    return lowerModel.includes("deepseek") || /^gpt[-_]/.test(lowerModel);
  }
  if (provider === "openai" || lowerBase.includes("api.openai.com")) {
    return lowerModel.includes("deepseek") || lowerModel.includes("claude");
  }
  return false;
}

export function formatRuntimeModelInspectionError(inspection: RuntimeModelInspection): string {
  if (inspection.ok) {
    return "runtime model config is valid";
  }
  const summary = [
    ...inspection.errors,
    `resolved provider=${inspection.config.provider}`,
    `resolved baseUrl=${inspection.config.baseUrl || "<empty>"}`,
    `resolved model=${inspection.config.chatModel || "<empty>"}`,
    `resolved candidates=${inspection.config.candidateModels.join(",") || "<empty>"}`
  ];
  return summary.join(" | ");
}

export function formatRuntimeModelInspectionWarnings(inspection: RuntimeModelInspection): string[] {
  return [...inspection.warnings];
}

export function formatModelProviderHint(config: RuntimeModelConfig): string {
  return `${config.provider} @ ${config.baseUrl}`;
}

export function inferProviderFromModel(model: string): RuntimeProvider {
  const lowered = model.trim().toLowerCase();
  if (lowered.includes("deepseek")) return "deepseek";
  if (lowered.includes("claude")) return "anthropic";
  if (lowered.startsWith("gpt-")) return "openai";
  return "custom";
}

export function isProviderCompatibleWithModel(config: RuntimeModelConfig): boolean {
  return !isModelProviderMismatch(config.provider, config.baseUrl, config.chatModel);
}

export function describeRuntimeModelConfig(config: RuntimeModelConfig): string {
  return `provider=${config.provider} model=${config.chatModel} base=${config.baseUrl}`;
}

export function hasLegacyDeepSeekEnv(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_BASE_URL || process.env.DEEPSEEK_MODEL);
}

export function resolveProviderHint(baseUrl: string): RuntimeProvider {
  return inferProviderHint(baseUrl);
}

export function isModelHintAnthropic(model: string): boolean {
  return model.toLowerCase().includes("claude");
}

export function isModelHintDeepSeek(model: string): boolean {
  return model.toLowerCase().includes("deepseek");
}

export function isModelHintOpenAI(model: string): boolean {
  return /^gpt[-_]/i.test(model);
}

export function normalizeCandidateModels(models: string[]): string[] {
  return [...new Set(models.map((item) => item.trim()).filter((item) => item.length > 0))];
}

export function mergeRouteCandidates(primary: string, shared: string[]): string[] {
  return normalizeCandidateModels([primary, ...shared]);
}

export function buildProviderMismatchMessage(config: RuntimeModelConfig): string {
  return `provider/model mismatch: provider=${config.provider}, baseUrl=${config.baseUrl}, model=${config.chatModel}`;
}

export function isModelProviderMismatchError(config: RuntimeModelConfig): boolean {
  return isModelProviderMismatch(config.provider, config.baseUrl, config.chatModel);
}

export function hasAnyRuntimeModelSignal(): boolean {
  return Boolean(
    process.env.SOULSEED_API_KEY ||
      process.env.SOULSEED_BASE_URL ||
      process.env.SOULSEED_MODEL ||
      process.env.DEEPSEEK_API_KEY ||
      process.env.DEEPSEEK_BASE_URL ||
      process.env.DEEPSEEK_MODEL
  );
}

export function resolveDefaultDeepSeekConfig(): Pick<RuntimeModelConfig, "provider" | "baseUrl" | "chatModel"> {
  return {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    chatModel: "deepseek-chat"
  };
}

export function resolveDefaultOpenAIConfig(): Pick<RuntimeModelConfig, "provider" | "baseUrl" | "chatModel"> {
  return {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    chatModel: "gpt-4o-mini"
  };
}

export function resolveDefaultAnthropicCompatConfig(): Pick<RuntimeModelConfig, "provider" | "baseUrl" | "chatModel"> {
  return {
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    chatModel: "claude-3-5-sonnet-latest"
  };
}

export function isRuntimeModelConfigured(): boolean {
  try {
    const inspected = inspectRuntimeModelConfig();
    return inspected.ok;
  } catch {
    return false;
  }
}

export function resolveRuntimeModelCandidates(overrides: RuntimeModelConfigOverrides = {}): string[] {
  return resolveRuntimeModelConfig(overrides).candidateModels;
}

export function inferProviderHintFromModelAndBaseUrl(model: string, baseUrl: string): RuntimeProvider {
  const fromModel = inferProviderFromModel(model);
  if (fromModel !== "custom") return fromModel;
  return inferProviderHint(baseUrl);
}

export function isLikelyOpenAICompatBaseUrl(baseUrl: string): boolean {
  const lowered = baseUrl.toLowerCase();
  return lowered.includes("/v1") && !lowered.includes("api.openai.com");
}

export function isLikelyDeepSeekBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes("deepseek");
}

export function isLikelyOpenAIBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes("api.openai.com");
}

export function isLikelyAnthropicBaseUrl(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes("anthropic");
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
