import test from "node:test";
import assert from "node:assert/strict";

import { inspectRuntimeModelConfig, resolveRuntimeModelConfig } from "../dist/index.js";

function withEnv(overrides, fn) {
  const backup = new Map();
  for (const key of Object.keys(overrides)) {
    backup.set(key, process.env[key]);
    const value = overrides[key];
    if (value === null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      const prev = backup.get(key);
      if (typeof prev === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = prev;
      }
    }
  }
}

test("resolveRuntimeModelConfig prefers SOULSEED_* env over legacy", () => {
  withEnv(
    {
      SOULSEED_API_KEY: "sk-soulseed",
      SOULSEED_BASE_URL: "https://example.com/v1",
      SOULSEED_MODEL: "model-a",
      DEEPSEEK_API_KEY: "sk-legacy",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1",
      DEEPSEEK_MODEL: "deepseek-chat"
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.equal(config.apiKey, "sk-soulseed");
      assert.equal(config.baseUrl, "https://example.com/v1");
      assert.equal(config.chatModel, "model-a");
    }
  );
});

test("resolveRuntimeModelConfig falls back to legacy DEEPSEEK_* env", () => {
  withEnv(
    {
      SOULSEED_API_KEY: null,
      SOULSEED_BASE_URL: null,
      SOULSEED_MODEL: null,
      DEEPSEEK_API_KEY: "sk-legacy",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com/v1",
      DEEPSEEK_MODEL: "deepseek-chat"
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.equal(config.apiKey, "sk-legacy");
      assert.equal(config.baseUrl, "https://api.deepseek.com/v1");
      assert.equal(config.chatModel, "deepseek-chat");
    }
  );
});

test("resolveRuntimeModelConfig defaults deepseek model when provider inferred from deepseek endpoint", () => {
  withEnv(
    {
      SOULSEED_API_KEY: "sk-soulseed",
      SOULSEED_BASE_URL: "https://api.deepseek.com/v1",
      SOULSEED_MODEL: null,
      DEEPSEEK_API_KEY: null,
      DEEPSEEK_BASE_URL: null,
      DEEPSEEK_MODEL: null
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.equal(config.provider, "deepseek");
      assert.equal(config.chatModel, "deepseek-chat");
      assert.deepEqual(config.candidateModels, ["deepseek-chat"]);
    }
  );
});

test("inspectRuntimeModelConfig catches provider/model mismatch", () => {
  withEnv(
    {
      SOULSEED_PROVIDER: "deepseek",
      SOULSEED_API_KEY: "sk-soulseed",
      SOULSEED_BASE_URL: "https://api.deepseek.com/v1",
      SOULSEED_MODEL: "claude-sonnet-4-5"
    },
    () => {
      const inspected = inspectRuntimeModelConfig();
      assert.equal(inspected.ok, false);
      assert.equal(
        inspected.errors.some((item) => item.includes("provider_model_mismatch")),
        true
      );
    }
  );
});

test("resolveRuntimeModelConfig builds candidate model chain from env", () => {
  withEnv(
    {
      SOULSEED_PROVIDER: "deepseek",
      SOULSEED_API_KEY: "sk-soulseed",
      SOULSEED_BASE_URL: "https://api.deepseek.com/v1",
      SOULSEED_MODEL: "deepseek-reasoner",
      SOULSEED_MODEL_CANDIDATES: "deepseek-chat,deepseek-chat,deepseek-v3"
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.deepEqual(config.candidateModels, [
        "deepseek-reasoner",
        "deepseek-chat",
        "deepseek-v3"
      ]);
    }
  );
});

test("resolveRuntimeModelConfig infers anthropic default model from anthropic endpoint", () => {
  withEnv(
    {
      SOULSEED_PROVIDER: null,
      SOULSEED_API_KEY: "sk-anthropic",
      SOULSEED_BASE_URL: "https://api.anthropic.com/v1",
      SOULSEED_MODEL: null
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.equal(config.provider, "anthropic");
      assert.equal(config.chatModel, "claude-3-5-sonnet-latest");
    }
  );
});

test("resolveRuntimeModelConfig trims trailing slash in base URL", () => {
  withEnv(
    {
      SOULSEED_PROVIDER: "deepseek",
      SOULSEED_API_KEY: "sk-test",
      SOULSEED_BASE_URL: "https://api.deepseek.com/v1///",
      SOULSEED_MODEL: "deepseek-chat"
    },
    () => {
      const config = resolveRuntimeModelConfig();
      assert.equal(config.baseUrl, "https://api.deepseek.com/v1");
    }
  );
});
