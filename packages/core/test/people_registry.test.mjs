import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createEmptyPeopleRegistry,
  upsertPerson,
  resolveMentionedPeople,
  savePeopleRegistry,
  loadPeopleRegistry,
  compilePeopleRelationshipContext,
} from "../dist/index.js";

test("upsert and resolve mentioned people", () => {
  let registry = createEmptyPeopleRegistry();
  ({ registry } = upsertPerson(registry, {
    canonicalName: "Alice",
    aliases: ["Al"],
    tags: ["friend"],
    oneLineWho: "college friend",
    nowIso: "2026-02-26T00:00:00.000Z",
  }));

  ({ registry } = upsertPerson(registry, {
    canonicalName: "Bob",
    tags: ["teammate"],
  }));

  const mentions = resolveMentionedPeople(registry, "I met Al today", 2);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].canonicalName, "Alice");
});

test("compilePeopleRelationshipContext returns card lines", async () => {
  const root = await mkdtemp(join(tmpdir(), "soulseed-people-registry-"));
  try {
    let registry = createEmptyPeopleRegistry();
    ({ registry } = upsertPerson(registry, {
      canonicalName: "Alice",
      aliases: ["A姐"],
      tags: ["friend"],
      oneLineWho: "known since high school",
    }));
    await savePeopleRegistry(root, registry);

    const loaded = await loadPeopleRegistry(root);
    assert.equal(loaded.entries.length, 1);

    const block = await compilePeopleRelationshipContext(root, "今天跟A姐聊了很久", { maxCards: 2 });
    assert.ok(block.includes("[PersonCard]"));
    assert.ok(block.includes("Alice"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
