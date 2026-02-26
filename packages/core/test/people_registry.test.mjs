/**
 * H/P1-3 — People Registry & Relationship State tests
 */
import test from "node:test";
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadPeopleRegistry,
  addPersonToRegistry,
  linkEntity,
  generateRelationshipCard,
  generateRelationshipCardsForInput,
  runRelationshipDecayJob,
  createInitialRelationshipState
} from "../dist/index.js";

test("loadPeopleRegistry returns empty when file missing", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    const reg = await loadPeopleRegistry(tmpDir);
    assert.strictEqual(reg.schemaVersion, "1.0");
    assert.strictEqual(reg.entities.length, 0);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("addPersonToRegistry adds entity", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    const result = await addPersonToRegistry(tmpDir, {
      canonicalName: "Alice",
      aliases: ["Ali"],
      tags: ["friend"]
    });
    assert.strictEqual(result.ok, true);
    assert.ok(result.entity);
    assert.strictEqual(result.entity.canonicalName, "Alice");
    assert.deepStrictEqual(result.entity.aliases, ["Ali"]);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("addPersonToRegistry rejects duplicate", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    await addPersonToRegistry(tmpDir, { canonicalName: "Bob" });
    const dup = await addPersonToRegistry(tmpDir, { canonicalName: "Bob" });
    assert.strictEqual(dup.ok, false);
    assert.ok(dup.reason?.includes("already"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("linkEntity resolves canonical name", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    await addPersonToRegistry(tmpDir, { canonicalName: "Charlie", aliases: ["Chuck"] });
    const link = await linkEntity(tmpDir, "Charlie");
    assert.ok(link);
    assert.strictEqual(link.canonicalName, "Charlie");
    assert.strictEqual(link.confidence, 1.0);
    assert.strictEqual(link.matchedAs, "canonical");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("linkEntity resolves alias", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    await addPersonToRegistry(tmpDir, { canonicalName: "David", aliases: ["Dave"] });
    const link = await linkEntity(tmpDir, "Dave");
    assert.ok(link);
    assert.strictEqual(link.canonicalName, "David");
    assert.strictEqual(link.matchedAs, "alias");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("linkEntity returns null for unknown", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    const link = await linkEntity(tmpDir, "UnknownPerson");
    assert.strictEqual(link, null);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("generateRelationshipCard produces short string", () => {
    const state = createInitialRelationshipState();
    const card = generateRelationshipCard(null, state);
    assert.ok(typeof card === "string");
    assert.ok(card.length <= 180);
    assert.ok(card.includes("Relationship"));
});

test("generateRelationshipCardsForInput returns cards", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    const state = createInitialRelationshipState();
    const cards = await generateRelationshipCardsForInput(tmpDir, "hello", state);
    assert.ok(Array.isArray(cards));
    assert.ok(cards.length <= 2);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runRelationshipDecayJob returns ok", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-people-"));
  try {
    const result = await runRelationshipDecayJob(tmpDir);
    assert.strictEqual(result.ok, true);
    assert.ok(typeof result.reason === "string");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
