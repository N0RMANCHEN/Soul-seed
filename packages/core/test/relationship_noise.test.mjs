import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateRelationshipCardsWithNoiseGuard,
  ensureRelationshipArtifacts,
} from "../dist/index.js";

test("generateRelationshipCardsWithNoiseGuard respects maxCards", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "rel-noise-"));
  try {
    await writeFile(
      join(tmpDir, "people_registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        entities: [
          { entityId: "e1", canonicalName: "Alice", aliases: [], tags: [], addedAt: new Date().toISOString() },
          { entityId: "e2", canonicalName: "Bob", aliases: [], tags: [], addedAt: new Date().toISOString() },
        ],
        updatedAt: new Date().toISOString(),
      }),
      "utf8"
    );
    const { relationshipState } = await ensureRelationshipArtifacts(tmpDir);
    const cards = await generateRelationshipCardsWithNoiseGuard(
      tmpDir,
      "Alice and Bob said hello",
      relationshipState,
      { maxCardsPerTurn: 1 }
    );
    assert.equal(cards.length, 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
