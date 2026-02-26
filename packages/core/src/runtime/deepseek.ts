import type { ChatMessage, ModelAdapter, ModelStreamCallbacks } from "../types.js";
import { mergeRouteCandidates, resolveRuntimeModelConfig, type RuntimeProvider } from "./runtime_model_config.js";

interface LLMAdapterOptions {
  provider?: RuntimeProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  modelCandidates?: string[];
  fallbackModel?: string;
  onModelFallback?: (info: { from: string; to: string; reason: string; attempt: number }) => void;
}

interface ChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

/**
 * Provider-agnostic adapter for any OpenAI-compatible chat completions API.
 *
 * Environment variables (new generic names preferred, legacy DEEPSEEK_* still supported):
 *   SOULSEED_API_KEY   / DEEPSEEK_API_KEY    — required
 *   SOULSEED_BASE_URL  / DEEPSEEK_BASE_URL   — required (no hardcoded default)
 *   SOULSEED_MODEL     / DEEPSEEK_MODEL      — no global hardcoded default
 */
export class OpenAICompatAdapter implements ModelAdapter {
  name = "openai-compat";

  private readonly provider: RuntimeProvider;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly candidateModels: string[];
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;
  private readonly onModelFallback?: (info: { from: string; to: string; reason: string; attempt: number }) => void;

  constructor(options: LLMAdapterOptions = {}) {
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
    this.onModelFallback = options.onModelFallback;

    if (!this.apiKey) {
      throw new Error(
        "Missing API key. Set SOULSEED_API_KEY (or legacy DEEPSEEK_API_KEY) in your .env file."
      );
    }
    if (!this.baseUrl) {
      throw new Error(
        "Missing base URL. Set SOULSEED_BASE_URL in your .env file " +
        "(e.g. https://your-provider.com/v1)."
      );
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
        return await this.streamChatWithModel(currentModel, messages, callbacks, signal);
      } catch (error) {
        lastError = error;
        const nextModel = pool[idx + 1];
        if (!nextModel) {
          throw error;
        }
        const errorKind = classifyModelError(error);
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
    throw new Error(`LLM request failed across candidate models: ${detail}`);
  }

  private async streamChatWithModel(
    model: string,
    messages: ChatMessage[],
    callbacks: ModelStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ content: string }> {
    const body = JSON.stringify({
      model,
      messages,
      stream: true
    });
    const res = await this.fetchWithRetry("/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body
    }, signal);

    if (!res.body) {
      throw new Error("LLM request failed: empty response body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }

        const data = trimmed.replace(/^data:\s*/, "");
        if (data === "[DONE]") {
          callbacks.onDone?.();
          return { content };
        }

        let chunk: ChatCompletionChunk;
        try {
          chunk = JSON.parse(data) as ChatCompletionChunk;
        } catch {
          continue;
        }

        const token = chunk.choices?.[0]?.delta?.content;
        if (token) {
          content += token;
          callbacks.onToken(token);
        }
      }
    }

    callbacks.onDone?.();
    return { content };
  }

  getModel(): string {
    return this.model;
  }

  getProvider(): RuntimeProvider {
    return this.provider;
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
        const httpError = new Error(`LLM request failed: ${res.status} ${text}`);
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
            throw new Error(`LLM request timeout after ${this.requestTimeoutMs}ms`);
          }
          throw error;
        }
        lastError = timeout ? new Error(`LLM request timeout after ${this.requestTimeoutMs}ms`) : error;
      } finally {
        clearTimeout(timeoutId);
      }

      const delayMs = Math.min(1200, 180 * (2 ** attempt));
      await sleep(delayMs);
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`LLM request failed after retries: ${detail}`);
  }
}

/** @deprecated Use OpenAICompatAdapter instead */
export const DeepSeekAdapter = OpenAICompatAdapter;

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

function isModelNotExistError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("model not exist") ||
    message.includes("model_not_found") ||
    message.includes("no such model")
  );
}

function isAuthError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return message.includes(" 401 ") || message.includes(" 403 ");
}

function isRateLimitOrServerError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes(" 429 ") ||
    message.includes(" 500 ") ||
    message.includes(" 502 ") ||
    message.includes(" 503 ") ||
    message.includes(" 504 ") ||
    message.includes("failed after retries")
  );
}

function classifyModelError(error: unknown): string {
  if (isModelNotExistError(error)) return "model_not_exist";
  if (isAuthError(error)) return "auth_error";
  if (isRateLimitOrServerError(error)) return "provider_transient";
  return "unknown_error";
}

function shouldFallbackByErrorKind(kind: string): boolean {
  return kind === "model_not_exist" || kind === "provider_transient";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
