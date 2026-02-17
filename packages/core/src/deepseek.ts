import type { ChatMessage, ModelAdapter, ModelStreamCallbacks } from "./types.js";

interface DeepSeekOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

interface DeepSeekChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
}

export class DeepSeekAdapter implements ModelAdapter {
  name = "deepseek";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: DeepSeekOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1";
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

    if (!this.apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY");
    }
  }

  async streamChat(
    messages: ChatMessage[],
    callbacks: ModelStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ content: string }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true
      }),
      signal
    });

    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(`DeepSeek request failed: ${res.status} ${text}`);
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

        let chunk: DeepSeekChunk;
        try {
          chunk = JSON.parse(data) as DeepSeekChunk;
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
}
