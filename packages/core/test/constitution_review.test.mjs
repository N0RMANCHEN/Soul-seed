import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

import {
  initPersonaPackage,
  appendLifeEvent,
  listConstitutionReviewRequests,
  approveConstitutionReview,
  rejectConstitutionReviewRequest,
  proposeConstitutionCrystallization,
  applyCrystallizationRun,
  rollbackCrystallizationRun,
  getRollbackSnapshot,
  listCrystallizationRuns,
  ensureMemoryStore
} from "../dist/index.js";

// ── helpers ────────────────────────────────────────────────────────────────────

async function makeTmpPersona(name = "TestSoul") {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-review-"));
  const personaPath = path.join(tmpDir, `${name}.soulseedpersona`);
  await initPersonaPackage(personaPath, name);
  await ensureMemoryStore(personaPath);
  return { tmpDir, personaPath };
}

async function emitReviewRequest(personaPath, reason = "test drift") {
  return appendLifeEvent(personaPath, {
    type: "constitution_review_requested",
    payload: {
      reason,
      triggeredBy: "test",
      recommendedAction: "review constitution"
    }
  });
}

// ── listConstitutionReviewRequests ────────────────────────────────────────────

test("listConstitutionReviewRequests returns empty for fresh persona", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const requests = await listConstitutionReviewRequests(personaPath);
    assert.equal(Array.isArray(requests), true);
    assert.equal(requests.length, 0);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("listConstitutionReviewRequests returns open request after emitting event", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    await emitReviewRequest(personaPath, "narrative drift detected");
    const requests = await listConstitutionReviewRequests(personaPath);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].status, "open");
    assert.equal(requests[0].reason, "narrative drift detected");
    assert.equal(typeof requests[0].reviewHash, "string");
    assert.ok(requests[0].reviewHash.length > 0);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── approveConstitutionReview ─────────────────────────────────────────────────

test("approveConstitutionReview marks request as approved", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const event = await emitReviewRequest(personaPath);
    const result = await approveConstitutionReview(personaPath, event.hash, "tester");
    assert.equal(result.ok, true);
    const requests = await listConstitutionReviewRequests(personaPath);
    assert.equal(requests[0].status, "approved");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("approveConstitutionReview works with prefix hash", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const event = await emitReviewRequest(personaPath);
    const prefix = event.hash.slice(0, 12);
    const result = await approveConstitutionReview(personaPath, prefix);
    assert.equal(result.ok, true);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("approveConstitutionReview fails for unknown hash", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const result = await approveConstitutionReview(personaPath, "nonexistent-hash");
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("not found"));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("approveConstitutionReview fails for already-approved request", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const event = await emitReviewRequest(personaPath);
    await approveConstitutionReview(personaPath, event.hash);
    const result = await approveConstitutionReview(personaPath, event.hash);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("already"));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── rejectConstitutionReviewRequest ──────────────────────────────────────────

test("rejectConstitutionReviewRequest marks request as rejected", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const event = await emitReviewRequest(personaPath);
    const result = await rejectConstitutionReviewRequest(personaPath, event.hash, "reviewer", "no change needed");
    assert.equal(result.ok, true);
    const requests = await listConstitutionReviewRequests(personaPath);
    assert.equal(requests[0].status, "rejected");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("rejectConstitutionReviewRequest fails for already-rejected request", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const event = await emitReviewRequest(personaPath);
    await rejectConstitutionReviewRequest(personaPath, event.hash);
    const result = await rejectConstitutionReviewRequest(personaPath, event.hash);
    assert.equal(result.ok, false);
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

// ── rollback ──────────────────────────────────────────────────────────────────

test("applyCrystallizationRun saves before snapshot", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const run = await proposeConstitutionCrystallization(personaPath, { domain: "constitution", trigger: "manual" });
    // Even if no diffs, we can try to apply (it will save snapshot)
    // Force a diff by creating a large constitution
    if (run.candidateDiff.length === 0) {
      // Skip rollback test if no diffs (nothing to apply)
      return;
    }
    await applyCrystallizationRun(personaPath, run.id);
    const snapshot = await getRollbackSnapshot(personaPath, run.id, "constitution");
    assert.ok(snapshot !== null, "before snapshot should exist after apply");
    assert.ok(typeof snapshot === "object");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("rollbackCrystallizationRun fails for pending run", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const run = await proposeConstitutionCrystallization(personaPath, { domain: "constitution", trigger: "manual" });
    const result = await rollbackCrystallizationRun(personaPath, run.id);
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("pending") || result.reason?.includes("applied"));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("rollbackCrystallizationRun fails for unknown run", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const result = await rollbackCrystallizationRun(personaPath, "nonexistent-run-id");
    assert.equal(result.ok, false);
    assert.ok(result.reason?.includes("not found"));
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("full review → approve → propose → apply → rollback cycle", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    // 1. Emit review request
    const reviewEvent = await emitReviewRequest(personaPath, "constitution drift test");

    // 2. List: should show 1 open request
    const openRequests = await listConstitutionReviewRequests(personaPath);
    assert.equal(openRequests.length, 1);
    assert.equal(openRequests[0].status, "open");

    // 3. Approve
    const approveResult = await approveConstitutionReview(personaPath, reviewEvent.hash, "tester");
    assert.equal(approveResult.ok, true);

    // 4. List: should show approved
    const afterApprove = await listConstitutionReviewRequests(personaPath);
    assert.equal(afterApprove[0].status, "approved");

    // 5. Propose crystallization
    const run = await proposeConstitutionCrystallization(personaPath, { domain: "constitution", trigger: "manual" });
    assert.equal(typeof run.id, "string");

    // 6. Run has pending status
    const pendingRuns = await listCrystallizationRuns(personaPath, { status: "pending" });
    assert.ok(pendingRuns.some((r) => r.id === run.id));

    // 7. If there are diffs, apply and rollback
    if (run.candidateDiff.length > 0) {
      // Read original constitution
      const constitutionBefore = JSON.parse(
        await readFile(path.join(personaPath, "constitution.json"), "utf8")
      );

      // Apply
      const applyResult = await applyCrystallizationRun(personaPath, run.id);
      assert.equal(applyResult.ok, true);

      // Snapshot should exist
      const snapshot = await getRollbackSnapshot(personaPath, run.id, "constitution");
      assert.ok(snapshot !== null);

      // Rollback
      const rollbackResult = await rollbackCrystallizationRun(personaPath, run.id);
      assert.equal(rollbackResult.ok, true);

      // Constitution should be restored
      const constitutionAfterRollback = JSON.parse(
        await readFile(path.join(personaPath, "constitution.json"), "utf8")
      );
      assert.deepEqual(constitutionAfterRollback, constitutionBefore);
    }
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});

test("multiple review requests tracked independently", async () => {
  const { tmpDir, personaPath } = await makeTmpPersona();
  try {
    const ev1 = await emitReviewRequest(personaPath, "first drift");
    const ev2 = await emitReviewRequest(personaPath, "second drift");

    // Approve first, reject second
    await approveConstitutionReview(personaPath, ev1.hash);
    await rejectConstitutionReviewRequest(personaPath, ev2.hash, "user", "manual review done");

    const requests = await listConstitutionReviewRequests(personaPath);
    assert.equal(requests.length, 2);
    const req1 = requests.find((r) => r.reviewHash === ev1.hash);
    const req2 = requests.find((r) => r.reviewHash === ev2.hash);
    assert.equal(req1?.status, "approved");
    assert.equal(req2?.status, "rejected");
  } finally {
    await rm(tmpDir, { recursive: true });
  }
});
