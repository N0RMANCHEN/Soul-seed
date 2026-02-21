import test from "node:test";
import assert from "node:assert/strict";

import {
  RELATIONSHIP_LATENT_DIM,
  createRelationshipLatentBaseline,
  projectRelationshipLatent,
  updateRelationshipLatent,
  isRelationshipLatentValid,
  createInitialRelationshipState,
  evolveRelationshipState
} from "../dist/index.js";

test("EB-5: RELATIONSHIP_LATENT_DIM is 64", () => {
  assert.equal(RELATIONSHIP_LATENT_DIM, 64);
});

test("EB-5: createRelationshipLatentBaseline returns 64-dim vector", () => {
  const z = createRelationshipLatentBaseline();
  assert.equal(z.length, RELATIONSHIP_LATENT_DIM);
  assert.equal(z[0], 0.45, "trust baseline");
  assert.equal(z[1], 0.48, "safety baseline");
  assert.equal(z[2], 0.25, "intimacy baseline");
  assert.ok(z.slice(6).every(v => v === 0.0), "higher dims start at 0");
});

test("EB-5: projectRelationshipLatent extracts named dimensions", () => {
  const z = createRelationshipLatentBaseline();
  z[0] = 0.9; // trust
  z[2] = 0.8; // intimacy
  const proj = projectRelationshipLatent(z);
  assert.equal(proj.trust, 0.9);
  assert.equal(proj.intimacy, 0.8);
});

test("EB-5: updateRelationshipLatent applies small-step update", () => {
  const z = createRelationshipLatentBaseline();
  const updated = updateRelationshipLatent(z, { trust: 0.1, intimacy: 0.05 });
  assert.ok(updated[0] > z[0], "trust should increase");
  assert.ok(updated[2] > z[2], "intimacy should increase");
  // Small-step: full alpha=0.15 → trust increases by 0.15*0.1 = 0.015
  assert.ok(updated[0] < 0.9, "trust should not jump to 0.9");
  // Higher dims should not change
  assert.equal(updated[6], 0.0);
});

test("EB-5: isRelationshipLatentValid validates correctly", () => {
  const valid = new Array(RELATIONSHIP_LATENT_DIM).fill(0.5);
  assert.equal(isRelationshipLatentValid(valid), true);
  assert.equal(isRelationshipLatentValid([1, 2, 3]), false, "wrong length");
  assert.equal(isRelationshipLatentValid("not array"), false);
  assert.equal(isRelationshipLatentValid(null), false);
});

test("EB-5: createInitialRelationshipState includes relationshipLatent", () => {
  const state = createInitialRelationshipState();
  assert.ok(Array.isArray(state.relationshipLatent), "latent should be array");
  assert.equal(state.relationshipLatent.length, RELATIONSHIP_LATENT_DIM);
  // Dims 0-5 should match dimension values
  assert.equal(state.relationshipLatent[0], state.dimensions.trust);
  assert.equal(state.relationshipLatent[2], state.dimensions.intimacy);
});

test("EB-5: evolveRelationshipState updates latent alongside named dims", () => {
  const state = createInitialRelationshipState();
  const evolved = evolveRelationshipState(state, "谢谢你，我很感激！", []);
  assert.ok(Array.isArray(evolved.relationshipLatent));
  assert.equal(evolved.relationshipLatent.length, RELATIONSHIP_LATENT_DIM);
  // Dims 0-5 should stay in sync with named dimensions after evolution
  assert.equal(evolved.relationshipLatent[0], evolved.dimensions.trust);
  assert.equal(evolved.relationshipLatent[2], evolved.dimensions.intimacy);
});

test("EB-5: named dimensions are backward compatible projections", () => {
  const state = createInitialRelationshipState();
  // All named dimensions should be within [0,1]
  const { trust, safety, intimacy, reciprocity, stability, libido } = state.dimensions;
  [trust, safety, intimacy, reciprocity, stability, libido].forEach(v => {
    assert.ok(v >= 0 && v <= 1, `dimension ${v} should be in [0,1]`);
  });
  // State and overall should still work
  assert.ok(["neutral-unknown", "friend", "peer", "intimate"].includes(state.state));
  assert.ok(state.overall >= 0 && state.overall <= 1);
});
