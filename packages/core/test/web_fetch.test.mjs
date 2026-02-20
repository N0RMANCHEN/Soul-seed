import test from "node:test";
import assert from "node:assert/strict";

import { fetchUrlContent } from "../dist/index.js";

test("fetchUrlContent rejects unsupported content type", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response("binary", {
        status: 200,
        headers: { "content-type": "image/png" }
      });
    await assert.rejects(() => fetchUrlContent("https://example.com/file.png"), /unsupported_content_type/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchUrlContent rejects streamed body exceeding byte limit", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const oversized = "x".repeat(2_100_000);
    globalThis.fetch = async () =>
      new Response(oversized, {
        status: 200,
        headers: { "content-type": "text/plain" }
      });
    await assert.rejects(() => fetchUrlContent("https://example.com/big.txt"), /response_too_large/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
