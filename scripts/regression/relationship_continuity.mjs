#!/usr/bin/env node
/**
 * H/P1-8 — Relationship continuity regression
 *
 * Runs scenarios against linkEntity and generateRelationshipCardsForInput.
 * Reports entity hit rate, card injection accuracy.
 */
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..", "..");

async function run() {
  const core = await import(join(root, "packages/core/dist/index.js"));
  const scenariosDir = join(root, "test/regression/relationship/scenarios");
  let scenarioFiles = [];
  try {
    scenarioFiles = await readdir(scenariosDir);
  } catch {
    scenarioFiles = [];
  }
  scenarioFiles = scenarioFiles.filter((f) => f.endsWith(".json"));

  const results = { entityHits: 0, entityTotal: 0, cardHits: 0, cardTotal: 0, scenarios: [] };

  for (const file of scenarioFiles) {
    const scenario = JSON.parse(await readFile(join(scenariosDir, file), "utf8"));
    const tmpDir = await mkdtemp(join(tmpdir(), "rel-cont-"));
    try {
      const registryPath = join(tmpDir, "people_registry.json");
      const registry = {
        schemaVersion: "1.0",
        entities: scenario.registry?.entities ?? [],
        updatedAt: new Date().toISOString(),
      };
      await writeFile(registryPath, JSON.stringify(registry, null, 2), "utf8");
      const { relationshipState } = await core.ensureRelationshipArtifacts(tmpDir);

      for (const turn of scenario.turns ?? []) {
        const mention = (turn.userInput ?? "").trim().split(/\s+/)[0] || turn.userInput?.trim() || "";
        if (!mention) continue;
        const linkResult = await core.linkEntity(tmpDir, mention);
        const expectedIds = new Set(turn.expectedEntityIds ?? []);
        if (expectedIds.size > 0) {
          results.entityTotal++;
          if (linkResult && expectedIds.has(linkResult.entityId)) results.entityHits++;
        }
        const cards = await core.generateRelationshipCardsForInput(tmpDir, turn.userInput, relationshipState);
        results.cardTotal += 1;
        if (cards.length > 0 && expectedIds.size > 0) results.cardHits++;
      }
      results.scenarios.push({ file, turns: scenario.turns?.length ?? 0 });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  const entityHitRate = results.entityTotal > 0 ? results.entityHits / results.entityTotal : 1;
  const cardRate = results.cardTotal > 0 ? results.cardHits / results.cardTotal : 1;
  const thresholds = JSON.parse(
    await readFile(join(root, "config/regression/relationship_thresholds.json"), "utf8")
  );
  const pass = entityHitRate >= thresholds.entityHitRate;

  const report = {
    ok: pass,
    entityHitRate,
    cardInjectionRate: cardRate,
    entityHits: results.entityHits,
    entityTotal: results.entityTotal,
    scenarios: results.scenarios,
    thresholds,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
