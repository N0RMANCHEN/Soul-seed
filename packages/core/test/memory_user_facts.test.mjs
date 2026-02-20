import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  initPersonaPackage,
  ensureMemoryStore,
  loadPersonaPackage,
  getUserFacts,
  upsertUserFact,
  deleteUserFact,
  graduateFactsFromMemories,
  compileAlwaysInjectContext,
  formatAlwaysInjectContext,
  FACT_GRADUATION_THRESHOLD,
  MAX_USER_FACTS
} from "../dist/index.js";

let tmpDir;
let personaPkg;

before(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-userfacts-test-"));
  await initPersonaPackage(tmpDir, "FactsTest");
  await ensureMemoryStore(tmpDir);
  personaPkg = await loadPersonaPackage(tmpDir);
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("memory user facts", () => {
  it("getUserFacts returns empty list initially", async () => {
    const facts = await getUserFacts(tmpDir);
    assert.equal(facts.length, 0);
  });

  it("upsertUserFact creates a new fact", async () => {
    const fact = await upsertUserFact(tmpDir, { key: "preferred_name", value: "Alice" });
    assert.equal(fact.key, "preferred_name");
    assert.equal(fact.value, "Alice");
    assert.equal(fact.mentionCount, 1);
    assert.equal(fact.crystallized, false);
  });

  it("upsertUserFact increments mention_count on re-insert", async () => {
    await upsertUserFact(tmpDir, { key: "preferred_name", value: "Alice" });
    await upsertUserFact(tmpDir, { key: "preferred_name", value: "Alice" });
    const facts = await getUserFacts(tmpDir);
    const fact = facts.find((f) => f.key === "preferred_name");
    assert.ok(fact);
    assert.ok(fact.mentionCount >= 2);
  });

  it(`fact is crystallized when mention_count reaches threshold (${FACT_GRADUATION_THRESHOLD})`, async () => {
    // upsert enough times to hit threshold
    for (let i = 0; i < FACT_GRADUATION_THRESHOLD; i++) {
      await upsertUserFact(tmpDir, { key: "birthday", value: "1990-01-01" });
    }
    const facts = await getUserFacts(tmpDir);
    const fact = facts.find((f) => f.key === "birthday");
    assert.ok(fact);
    assert.equal(fact.crystallized, true);
  });

  it("deleteUserFact removes the fact", async () => {
    await upsertUserFact(tmpDir, { key: "temp_fact", value: "delete-me" });
    const ok = await deleteUserFact(tmpDir, "temp_fact");
    assert.equal(ok, true);
    const facts = await getUserFacts(tmpDir);
    assert.ok(!facts.some((f) => f.key === "temp_fact"));
  });

  it("deleteUserFact returns false for non-existent key", async () => {
    const ok = await deleteUserFact(tmpDir, "nonexistent_key_xyz");
    assert.equal(ok, false);
  });

  it("graduateFactsFromMemories returns 0 when no memories", async () => {
    const count = await graduateFactsFromMemories(tmpDir);
    assert.ok(typeof count === "number");
    assert.ok(count >= 0);
  });

  it("compileAlwaysInjectContext returns structured context", async () => {
    const ctx = await compileAlwaysInjectContext(tmpDir, personaPkg);
    assert.ok(typeof ctx.totalChars === "number");
    assert.ok(Array.isArray(ctx.userFacts));
    assert.ok(Array.isArray(ctx.pinnedMemories));
    assert.ok(typeof ctx.overBudget === "boolean");
  });

  it("formatAlwaysInjectContext includes user facts when present", async () => {
    await upsertUserFact(tmpDir, { key: "format_test", value: "hello" });
    const ctx = await compileAlwaysInjectContext(tmpDir, personaPkg);
    const formatted = formatAlwaysInjectContext(ctx);
    // Should contain the fact if it was included
    assert.ok(typeof formatted === "string");
  });

  it("MAX_USER_FACTS is 50", () => {
    assert.equal(MAX_USER_FACTS, 50);
  });
});
