import type { ChatMessage, ModelAdapter, ModelStreamCallbacks } from "../types.js";
import { mergeRouteCandidates, resolveRuntimeModelConfig, type RuntimeProvider } from "./runtime_model_config.js";

interface AnthropicAdapterOptions {
  provider?: RuntimeProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  modelCandidates?: string[];
  fallbackModel?: string;
  onModelFallback?: (info: { from: string; to: string; reason: string; attempt: number }) => void;
}

interface AnthropicTextBlock {
  type?: string;
  text?: string;
}

interface AnthropicMessageResponse {
  content?: AnthropicTextBlock[];
}

export class AnthropicNativeAdapter implements ModelAdapter {
  name = "anthropic";

  private readonly provider: RuntimeProvider;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly candidateModels: string[];
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;
  private readonly maxOutputTokens: number;
  private readonly onModelFallback?: (info: { from: string; to: string; reason: string; attempt: number }) => void;

  constructor(options: AnthropicAdapterOptions = {}) {
    const resolved = resolveRuntimeModelConfig({
      provider: options.provider,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
      model: options.model,
      modelCandidates: options.modelCandidates,
      fallbackModel: options.fallbackModel
    });
    this.provider = resolved.provider;
    this.apiKey = resolved.apiKey;
    this.baseUrl = resolved.baseUrl;
    this.model = resolved.chatModel;
    this.candidateModels = mergeRouteCandidates(this.model, resolved.candidateModels);
    this.maxRetries = resolved.llmRetries;
    this.requestTimeoutMs = resolved.llmTimeoutMs;
    this.maxOutputTokens = clampInt(Number(process.env.SOULSEED_ANTHROPIC_MAX_TOKENS ?? 2048), 256, 8192, 2048);
    this.onModelFallback = options.onModelFallback;

    if (!this.apiKey) {
      throw new Error("Missing API key. Set SOULSEED_API_KEY for Anthropic provider.");
    }
    if (!this.baseUrl) {
      throw new Error("Missing base URL. Set SOULSEED_BASE_URL (e.g. https://api.anthropic.com/v1).");
    }
  }

  async streamChat(
    messages: ChatMessage[],
    callbacks: ModelStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ content: string }> {
    let lastError: unknown = null;
    const pool = this.candidateModels.length > 0 ? this.candidateModels : [this.model];
    for (let idx = 0; idx < pool.length; idx += 1) {
      const currentModel = pool[idx];
      try {
        return await this.chatWithModel(currentModel, messages, callbacks, signal);
      } catch (error) {
        lastError = error;
        const nextModel = pool[idx + 1];
        if (!nextModel) {
          throw error;
        }
        const errorKind = classifyAnthropicError(error);
        if (!shouldFallbackByErrorKind(errorKind)) {
          throw error;
        }
        this.onModelFallback?.({
          from: currentModel,
          to: nextModel,
          reason: errorKind,
          attempt: idx + 1
        });
      }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Anthropic request failed across candidate models: ${detail}`);
  }

  getModel(): string {
    return this.model;
  }

  getProvider(): RuntimeProvider {
    return this.provider;
  }

  private async chatWithModel(
    model: string,
    messages: ChatMessage[],
    callbacks: ModelStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ content: string }> {
    const transformed = toAnthropicMessages(messages);
    const body = {
      model,
      max_tokens: this.maxOutputTokens,
      ...(transformed.system ? { system: transformed.system } : {}),
      messages: transformed.messages,
      stream: false
    };
    const res = await this.fetchWithRetry(
      "/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(body)
      },
      signal
    );
    const parsed = (await res.json()) as AnthropicMessageResponse;
    const content = (parsed.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter((item) => item.length > 0)
      .join("\n");
    if (!content) {
      throw new Error("Anthropic response has no text content");
    }
    callbacks.onToken(content);
    callbacks.onDone?.();
    return { content };
  }

  private async fetchWithRetry(
    endpoint: string,
    init: RequestInit,
    upstreamSignal?: AbortSignal
  ): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      if (upstreamSignal?.aborted) {
        const abortErr = new Error("Aborted");
        abortErr.name = "AbortError";
        throw abortErr;
      }
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), this.requestTimeoutMs);
      const signal = upstreamSignal
        ? AbortSignal.any([upstreamSignal, timeoutController.signal])
        : timeoutController.signal;
      try {
        const res = await fetch(`${this.baseUrl}${endpoint}`, { ...init, signal });
        if (res.ok) {
          clearTimeout(timeoutId);
          return res;
        }
        const text = await res.text();
        const httpError = new Error(`Anthropic request failed: ${res.status} ${text}`);
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt >= this.maxRetries) {
          clearTimeout(timeoutId);
          throw httpError;
        }
        lastError = httpError;
      } catch (error) {
        if (upstreamSignal?.aborted) {
          clearTimeout(timeoutId);
          const abortErr = new Error("Aborted");
          abortErr.name = "AbortError";
          throw abortErr;
        }
        const timeout = timeoutController.signal.aborted;
        const retryable = timeout || isRetryableNetworkError(error);
        if (!retryable || attempt >= this.maxRetries) {
          clearTimeout(timeoutId);
          if (timeout) {
            throw new Error(`Anthropic request timeout after ${this.requestTimeoutMs}ms`);
          }
          throw error;
        }
        lastError = timeout ? new Error(`Anthropic request timeout after ${this.requestTimeoutMs}ms`) : error;
      } finally {
        clearTimeout(timeoutId);
      }
      const delayMs = Math.min(1200, 180 * (2 ** attempt));
      await sleep(delayMs);
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Anthropic request failed after retries: ${detail}`);
  }
}

function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemBlocks: string[] = [];
  const chatBlocks: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const item of messages) {
    const text = String(item.content ?? "").trim();
    if (!text) continue;
    if (item.role === "system") {
      systemBlocks.push(text);
      continue;
    }
    chatBlocks.push({
      role: item.role === "assistant" ? "assistant" : "user",
      content: text
    });
  }
  if (chatBlocks.length === 0) {
    chatBlocks.push({ role: "user", content: "你好" });
  }
  return {
    ...(systemBlocks.length > 0 ? { system: systemBlocks.join("\n\n") } : {}),
    messages: chatBlocks
  };
}

function isRetryableNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound") ||
    msg.includes("socket hang up")
  );
}

function classifyAnthropicError(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    message.includes("model_not_found") ||
    message.includes("model not found") ||
    message.includes("unknown model") ||
    message.includes("not_found_error")
  ) {
    return "model_not_exist";
  }
  if (message.includes(" 401 ") || message.includes(" 403 ")) {
    return "auth_error";
  }
  if (
    message.includes(" 429 ") ||
    message.includes(" 500 ") ||
    message.includes(" 502 ") ||
    message.includes(" 503 ") ||
    message.includes(" 504 ") ||
    message.includes("failed after retries")
  ) {
    return "provider_transient";
  }
  return "unknown_error";
}

function shouldFallbackByErrorKind(kind: string): boolean {
  return kind === "model_not_exist" || kind === "provider_transient";
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
