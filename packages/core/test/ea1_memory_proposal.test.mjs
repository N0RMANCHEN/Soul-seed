import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  proposeMemory,
  loadPendingProposals,
  loadAllProposals,
  arbitrateMemoryProposals,
  persistArbitrationResult,
  commitApprovedProposals
} from "../dist/index.js";

test("EA-1: proposeMemory writes to pending pool", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea1-propose-"));

  const proposal = await proposeMemory(tmpDir, {
    kind: "semantic",
    content: "用户喜欢在下午工作。",
    evidenceRefs: ["tool:web_search"],
    confidence: 0.8,
    goalId: "goal-001"
  });

  assert.ok(proposal.id.length > 0, "proposal should have an id");
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.kind, "semantic");

  const pending = await loadPendingProposals(tmpDir);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, proposal.id);
});

test("EA-1: arbitrateMemoryProposals rejects low confidence", () => {
  const proposals = [
    {
      id: "p1", kind: "semantic", content: "低置信度信息",
      evidenceRefs: [], confidence: 0.3, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "pending"
    }
  ];
  const result = arbitrateMemoryProposals(proposals);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].rejectionReason.includes("confidence too low"));
});

test("EA-1: arbitrateMemoryProposals rejects open_question", () => {
  const proposals = [
    {
      id: "p2", kind: "open_question", content: "用户可能喜欢这个？",
      evidenceRefs: [], confidence: 0.9, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "pending"
    }
  ];
  const result = arbitrateMemoryProposals(proposals);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].rejectionReason.includes("open_question"));
});

test("EA-1: arbitrateMemoryProposals accepts high confidence non-question", () => {
  const proposals = [
    {
      id: "p3", kind: "preference", content: "用户喜欢简洁的回答。",
      evidenceRefs: ["goal:g1:step:2"], confidence: 0.75, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "pending"
    }
  ];
  const result = arbitrateMemoryProposals(proposals);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.accepted[0].status, "approved");
});

test("EA-1: persistArbitrationResult updates proposal status on disk", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea1-persist-"));

  const p1 = await proposeMemory(tmpDir, {
    kind: "semantic", content: "高置信度。", evidenceRefs: [], confidence: 0.9, goalId: "g1"
  });
  const p2 = await proposeMemory(tmpDir, {
    kind: "open_question", content: "问题？", evidenceRefs: [], confidence: 0.7, goalId: "g1"
  });

  const pending = await loadPendingProposals(tmpDir);
  const result = arbitrateMemoryProposals(pending);
  await persistArbitrationResult(tmpDir, result);

  const all = await loadAllProposals(tmpDir);
  const approved = all.filter(p => p.status === "approved");
  const rejected = all.filter(p => p.status === "rejected");
  assert.equal(approved.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(approved[0].id, p1.id);
  assert.equal(rejected[0].id, p2.id);
});

test("EA-1: commitApprovedProposals calls writeMemory for each accepted proposal", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-ea1-commit-"));
  const committed = [];
  const fakeWriteMemory = async (_rootPath, content, _meta) => {
    committed.push(content);
  };

  const accepted = [
    {
      id: "p4", kind: "semantic", content: "已批准的记忆内容。",
      evidenceRefs: [], confidence: 0.8, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "approved"
    },
    {
      id: "p5", kind: "preference", content: "另一条记忆。",
      evidenceRefs: [], confidence: 0.9, goalId: "g1",
      proposedAt: new Date().toISOString(), status: "approved"
    }
  ];

  const result = await commitApprovedProposals(tmpDir, accepted, fakeWriteMemory);
  assert.equal(result.length, 2, "should commit 2 proposals");
  assert.equal(committed.length, 2);
  assert.ok(committed[0].includes("已批准的记忆内容"));
});
