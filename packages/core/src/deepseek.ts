import type { ChatMessage, ModelAdapter, ModelStreamCallbacks } from "./types.js";

interface LLMAdapterOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
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
 *   SOULSEED_MODEL     / DEEPSEEK_MODEL      — default: claude-sonnet-4-6
 */
export class OpenAICompatAdapter implements ModelAdapter {
  name = "openai-compat";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;

  constructor(options: LLMAdapterOptions = {}) {
    this.apiKey = options.apiKey
      ?? process.env.SOULSEED_API_KEY
      ?? process.env.DEEPSEEK_API_KEY
      ?? "";
    const isLegacyDeepseek = !process.env.SOULSEED_API_KEY && !!process.env.DEEPSEEK_API_KEY;
    const legacyBaseUrl = isLegacyDeepseek ? "https://api.deepseek.com/v1" : "";
    const legacyModel = isLegacyDeepseek ? "deepseek-chat" : "claude-sonnet-4-6";
    this.baseUrl = options.baseUrl
      ?? process.env.SOULSEED_BASE_URL
      ?? process.env.DEEPSEEK_BASE_URL
      ?? legacyBaseUrl;
    this.model = options.model
      ?? process.env.SOULSEED_MODEL
      ?? process.env.DEEPSEEK_MODEL
      ?? legacyModel;
    this.maxRetries = clampInt(Number(process.env.SOULSEED_LLM_RETRIES ?? 2), 0, 5, 2);
    this.requestTimeoutMs = clampInt(Number(process.env.SOULSEED_LLM_TIMEOUT_MS ?? 35000), 5000, 120000, 35000);

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
    const body = JSON.stringify({
      model: this.model,
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

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
