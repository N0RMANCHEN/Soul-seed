import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  initPersonaPackage,
  loadSocialGraph,
  addSocialPerson,
  removeSocialPerson,
  searchSocialPersons,
  updatePersonMention,
  validateSocialGraph,
  compileRelatedPersonContext,
  MAX_SOCIAL_PERSONS,
  createEmptySocialGraph
} from "../dist/index.js";

let tmpDir;

before(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "soulseed-socialgraph-test-"));
  await initPersonaPackage(tmpDir, "SocialTest");
});

after(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("social graph", () => {
  it("loadSocialGraph returns empty graph for new persona", async () => {
    const graph = await loadSocialGraph(tmpDir);
    assert.equal(graph.persons.length, 0);
    assert.equal(graph.schemaVersion, "1.0");
  });

  it("addSocialPerson adds a person to the graph", async () => {
    const result = await addSocialPerson(tmpDir, {
      name: "Alice",
      relationship: "colleague",
      facts: ["works at Acme", "likes coffee"]
    });
    assert.equal(result.ok, true);
    assert.ok(result.person);
    assert.equal(result.person.name, "Alice");
    assert.equal(result.person.relationship, "colleague");
    assert.equal(result.person.facts.length, 2);
  });

  it("addSocialPerson returns error for duplicate name", async () => {
    const result = await addSocialPerson(tmpDir, {
      name: "Alice",
      relationship: "friend"
    });
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("already exists"));
  });

  it("loadSocialGraph reflects added persons", async () => {
    const graph = await loadSocialGraph(tmpDir);
    assert.ok(graph.persons.some((p) => p.name === "Alice"));
  });

  it("searchSocialPersons finds person by name", async () => {
    const results = await searchSocialPersons(tmpDir, "alice");
    assert.ok(results.length >= 1);
    assert.ok(results[0].name === "Alice");
  });

  it("updatePersonMention increments mention count", async () => {
    const before = await loadSocialGraph(tmpDir);
    const alice = before.persons.find((p) => p.name === "Alice");
    const prevCount = alice?.mentionCount ?? 0;

    const updated = await updatePersonMention(tmpDir, "Alice");
    assert.ok(updated !== null);
    assert.equal(updated.mentionCount, prevCount + 1);
  });

  it("removeSocialPerson removes person from graph", async () => {
    await addSocialPerson(tmpDir, { name: "Bob", relationship: "friend" });
    const result = await removeSocialPerson(tmpDir, "Bob");
    assert.equal(result.ok, true);

    const graph = await loadSocialGraph(tmpDir);
    assert.ok(!graph.persons.some((p) => p.name === "Bob"));
  });

  it("removeSocialPerson returns error for non-existent person", async () => {
    const result = await removeSocialPerson(tmpDir, "NonExistent");
    assert.equal(result.ok, false);
  });

  it("compileRelatedPersonContext returns info when person mentioned in input", async () => {
    const ctx = await compileRelatedPersonContext(tmpDir, "我最近和Alice聊了很多");
    assert.ok(typeof ctx === "string");
    // Alice is in the graph, so context should mention her
    assert.ok(ctx.includes("Alice"));
  });

  it("compileRelatedPersonContext returns empty string when no match", async () => {
    const ctx = await compileRelatedPersonContext(tmpDir, "今天天气很好");
    assert.equal(ctx, "");
  });

  it("validateSocialGraph detects over-limit persons", () => {
    const graph = createEmptySocialGraph();
    for (let i = 0; i <= MAX_SOCIAL_PERSONS; i++) {
      graph.persons.push({
        id: `id${i}`,
        name: `Person${i}`,
        relationship: "friend",
        facts: [],
        lastMentionedAt: new Date().toISOString(),
        mentionCount: 1,
        addedAt: new Date().toISOString()
      });
    }
    const issues = validateSocialGraph(graph);
    assert.ok(issues.some((issue) => issue.code === "too_many_persons"));
  });

  it("validateSocialGraph returns no issues for valid graph", async () => {
    const graph = await loadSocialGraph(tmpDir);
    const issues = validateSocialGraph(graph);
    assert.equal(issues.length, 0);
  });

  it("MAX_SOCIAL_PERSONS is 20", () => {
    assert.equal(MAX_SOCIAL_PERSONS, 20);
  });

  it("persona init creates social_graph.json", async () => {
    const { existsSync } = await import("node:fs");
    assert.ok(existsSync(path.join(tmpDir, "social_graph.json")));
  });
});
