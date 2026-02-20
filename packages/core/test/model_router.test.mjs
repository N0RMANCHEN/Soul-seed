import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  resolveModelForRoute,
  mergeModelRoutingConfig,
  formatModelRoutingConfig,
  listRoutingModels,
  initPersonaPackage,
  patchCognitionState,
  ensureCognitionStateArtifacts
} from "../dist/index.js";

// ── resolveModelForRoute ───────────────────────────────────────────────────────

test("resolveModelForRoute returns defaultModel when no modelRouting", () => {
  const cognition = { modelRouting: undefined };
  assert.equal(resolveModelForRoute("instinct", cognition, "default-model"), "default-model");
  assert.equal(resolveModelForRoute("deliberative", cognition, "default-model"), "default-model");
  assert.equal(resolveModelForRoute("meta", cognition, "default-model"), "default-model");
});

test("resolveModelForRoute returns configured model for route", () => {
  const cognition = {
    modelRouting: {
      instinct: "fast-model",
      deliberative: "slow-model",
      meta: "meta-model"
    }
  };
  assert.equal(resolveModelForRoute("instinct", cognition, "default"), "fast-model");
  assert.equal(resolveModelForRoute("deliberative", cognition, "default"), "slow-model");
  assert.equal(resolveModelForRoute("meta", cognition, "default"), "meta-model");
});

test("resolveModelForRoute falls back to defaultModel for unconfigured routes", () => {
  const cognition = {
    modelRouting: { instinct: "fast-model" }
  };
  assert.equal(resolveModelForRoute("instinct", cognition, "default"), "fast-model");
  assert.equal(resolveModelForRoute("deliberative", cognition, "default"), "default");
  assert.equal(resolveModelForRoute("meta", cognition, "default"), "default");
});

test("resolveModelForRoute falls back when route value is empty string", () => {
  const cognition = {
    modelRouting: { instinct: "  " }
  };
  assert.equal(resolveModelForRoute("instinct", cognition, "default"), "default");
});

// ── mergeModelRoutingConfig ────────────────────────────────────────────────────

test("mergeModelRoutingConfig creates config from scratch", () => {
  const result = mergeModelRoutingConfig(undefined, { instinct: "fast" });
  assert.equal(result.instinct, "fast");
  assert.equal(result.deliberative, undefined);
});

test("mergeModelRoutingConfig merges with existing", () => {
  const existing = { instinct: "fast", deliberative: "slow" };
  const result = mergeModelRoutingConfig(existing, { meta: "meta-model" });
  assert.equal(result.instinct, "fast");
  assert.equal(result.deliberative, "slow");
  assert.equal(result.meta, "meta-model");
});

test("mergeModelRoutingConfig removes key when set to empty string", () => {
  const existing = { instinct: "fast", deliberative: "slow" };
  const result = mergeModelRoutingConfig(existing, { instinct: "" });
  assert.equal(result.instinct, undefined);
  assert.equal(result.deliberative, "slow");
});

test("mergeModelRoutingConfig trims model names", () => {
  const result = mergeModelRoutingConfig(undefined, { deliberative: "  model-x  " });
  assert.equal(result.deliberative, "model-x");
});

// ── formatModelRoutingConfig ───────────────────────────────────────────────────

test("formatModelRoutingConfig shows (default) for unconfigured routes", () => {
  const formatted = formatModelRoutingConfig(undefined, "default-model");
  assert.ok(formatted.includes("default-model (default)"));
  assert.ok(formatted.includes("instinct="));
  assert.ok(formatted.includes("deliberative="));
  assert.ok(formatted.includes("meta="));
});

test("formatModelRoutingConfig shows configured models", () => {
  const routing = { instinct: "fast", deliberative: "slow", meta: "meta" };
  const formatted = formatModelRoutingConfig(routing, "default");
  assert.ok(formatted.includes("instinct=fast"));
  assert.ok(formatted.includes("deliberative=slow"));
  assert.ok(formatted.includes("meta=meta"));
  assert.ok(!formatted.includes("(default)"));
});

// ── listRoutingModels ──────────────────────────────────────────────────────────

test("listRoutingModels includes only defaultModel when no routing", () => {
  const models = listRoutingModels(undefined, "default");
  assert.deepEqual(models, ["default"]);
});

test("listRoutingModels includes all distinct models", () => {
  const routing = { instinct: "fast", deliberative: "default", meta: "meta" };
  const models = listRoutingModels(routing, "default");
  assert.ok(models.includes("fast"));
  assert.ok(models.includes("default"));
  assert.ok(models.includes("meta"));
  assert.equal(models.length, 3);
});

test("listRoutingModels deduplicates models", () => {
  const routing = { instinct: "same", deliberative: "same", meta: "same" };
  const models = listRoutingModels(routing, "same");
  assert.equal(models.length, 1);
  assert.deepEqual(models, ["same"]);
});

// ── patchCognitionState with modelRouting ──────────────────────────────────────

let tempDir;
test("patchCognitionState saves modelRouting to disk", async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "soulseed-mr-"));
  await initPersonaPackage(tempDir, { persona: { displayName: "TestRouting" } });

  const updated = await patchCognitionState(tempDir, {
    modelRouting: { instinct: "fast-model", deliberative: "deep-model" }
  });
  assert.equal(updated.modelRouting?.instinct, "fast-model");
  assert.equal(updated.modelRouting?.deliberative, "deep-model");
  assert.equal(updated.modelRouting?.meta, undefined);
});

test("patchCognitionState loads modelRouting from disk after save", async () => {
  const loaded = await ensureCognitionStateArtifacts(tempDir);
  assert.equal(loaded.modelRouting?.instinct, "fast-model");
  assert.equal(loaded.modelRouting?.deliberative, "deep-model");
});

test("patchCognitionState merges modelRouting incrementally", async () => {
  const updated = await patchCognitionState(tempDir, {
    modelRouting: { meta: "meta-model" }
  });
  assert.equal(updated.modelRouting?.instinct, "fast-model");
  assert.equal(updated.modelRouting?.deliberative, "deep-model");
  assert.equal(updated.modelRouting?.meta, "meta-model");
});

test("patchCognitionState clears modelRouting when null", async () => {
  const updated = await patchCognitionState(tempDir, { modelRouting: null });
  assert.equal(updated.modelRouting, undefined);
  await rm(tempDir, { recursive: true, force: true });
});
