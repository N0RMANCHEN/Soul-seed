import test from "node:test";
import assert from "node:assert/strict";

import { AnthropicNativeAdapter } from "../dist/index.js";

test("AnthropicNativeAdapter parses text response", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          content: [
            { type: "text", text: "你好，我在。" }
          ]
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    const adapter = new AnthropicNativeAdapter({
      provider: "anthropic",
      apiKey: "sk-test",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-3-5-sonnet-latest"
    });
    let received = "";
    const out = await adapter.streamChat(
      [{ role: "user", content: "你好" }],
      {
        onToken: (chunk) => {
          received += chunk;
        }
      }
    );
    assert.equal(out.content, "你好，我在。");
    assert.equal(received, "你好，我在。");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AnthropicNativeAdapter falls back on model_not_found", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (_url, init) => {
      calls += 1;
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.model === "claude-bad-model") {
        return new Response("not_found_error: model not found", { status: 400 });
      }
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "fallback-ok" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };
    const switched = [];
    const adapter = new AnthropicNativeAdapter({
      provider: "anthropic",
      apiKey: "sk-test",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-bad-model",
      modelCandidates: ["claude-bad-model", "claude-3-5-sonnet-latest"],
      onModelFallback: (info) => switched.push(info)
    });
    const out = await adapter.streamChat(
      [{ role: "user", content: "test" }],
      { onToken: () => {} }
    );
    assert.equal(out.content, "fallback-ok");
    assert.equal(calls, 2);
    assert.equal(switched.length, 1);
    assert.equal(switched[0].from, "claude-bad-model");
    assert.equal(switched[0].to, "claude-3-5-sonnet-latest");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
