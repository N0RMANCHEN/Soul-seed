import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  inferCompatMode,
  doctorPersona,
  migrateToFull,
  rollbackMigration,
  computeDerivedParams,
  getDefaultDerivedParams,
  runShadowMode,
} from "../dist/index.js";

test("compat regression: full lifecycle — legacy → migrate → shadow → rollback", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "compat-regr-"));
  const personaPath = path.join(tmp, "Regr.soulseedpersona");

  // 1. Create a fresh persona
  await initPersonaPackage(personaPath, "Regr");

  // Simulate a legacy persona by overwriting genome source to "inferred_legacy"
  const genomePath = path.join(personaPath, "genome.json");
  const origGenome = JSON.parse(await readFile(genomePath, "utf-8"));
  origGenome.source = "inferred_legacy";
  await writeFile(genomePath, JSON.stringify(origGenome, null, 2), "utf-8");

  // 2. Verify it loads as "legacy" compat mode
  let pkg = await loadPersonaPackage(personaPath);
  assert.equal(inferCompatMode(pkg), "legacy");

  // 3. Doctor must pass
  let report = await doctorPersona(personaPath);
  assert.equal(report.ok, true, `doctor failed (legacy): ${JSON.stringify(report.issues)}`);

  // 4. Migrate to full
  const migration = await migrateToFull(personaPath);
  assert.equal(migration.success, true, `migration failed: ${migration.errors.join(", ")}`);

  // 5. Reload and verify compat mode is "full"
  pkg = await loadPersonaPackage(personaPath);
  assert.equal(inferCompatMode(pkg), "full");

  // 6. Doctor must pass again
  report = await doctorPersona(personaPath);
  assert.equal(report.ok, true, `doctor failed (full): ${JSON.stringify(report.issues)}`);

  // 7. Derived params parity — genome at trait=0.5 should match legacy defaults
  const derived = computeDerivedParams(pkg.genome, pkg.epigenetics);
  const defaults = getDefaultDerivedParams();
  assert.deepStrictEqual(derived, defaults);

  // 8. Shadow mode — evaluate gates without applying
  // Hb-1-3: mood gate requires evidence for strong attribution (|delta| > 0.12); oversized delta with evidence → clamp
  const fakeEventHash = "evt-00000000000000000000000000000001";
  const proposal = {
    turnId: "shadow-test-001",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: "+0.1", arousal: "+0.05" },
        confidence: 0.8,
        supportingEventHashes: [],
        notes: "test mood delta",
      },
      {
        type: "mood",
        targetId: "self",
        patch: { valence: "+0.9" },
        confidence: 0.8,
        supportingEventHashes: [fakeEventHash],
        notes: "oversized mood delta — should be clamped (evidence provided)",
      },
      {
        type: "value",
        targetId: "self",
        patch: { honesty: "+0.1" },
        confidence: 0.1,
        supportingEventHashes: [],
        notes: "low-confidence identity delta — should be rejected",
      },
    ],
  };
  const context = { personaRoot: personaPath, lifeEventHashes: new Set([fakeEventHash]) };
  const shadow = runShadowMode(proposal, context);

  assert.equal(shadow.turnId, "shadow-test-001");
  assert.equal(shadow.proposalCount, 3);
  assert.equal(shadow.accepted + shadow.rejected + shadow.clamped, 3);
  assert.ok(shadow.rejected >= 1, "expected at least one rejection (low-confidence value)");
  assert.ok(shadow.clamped >= 1, "expected at least one clamp (oversized mood with evidence)");
  assert.ok(shadow.gateResults.length > 0);
  assert.ok(shadow.wouldHaveApplied.length < 3, "not all deltas should pass");

  // 9. Rollback migration
  const rolled = await rollbackMigration(personaPath);
  assert.equal(rolled, true);

  // 10. Reload and verify compat mode is "legacy" again
  pkg = await loadPersonaPackage(personaPath);
  assert.equal(inferCompatMode(pkg), "legacy");

  // 11. Doctor must pass one more time
  report = await doctorPersona(personaPath);
  assert.equal(report.ok, true, `doctor failed (post-rollback): ${JSON.stringify(report.issues)}`);

  await rm(tmp, { recursive: true });
});
