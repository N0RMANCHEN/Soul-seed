import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createEmptyProposal,
  createEmptyCommitResult,
  runDeltaGates,
  applyDeltas,
} from "../dist/index.js";

test("createEmptyProposal returns valid structure", () => {
  const p = createEmptyProposal("turn-1");
  assert.equal(p.turnId, "turn-1");
  assert.equal(p.deltas.length, 0);
  assert.ok(p.proposedAt);
});

test("createEmptyCommitResult returns valid structure", () => {
  const r = createEmptyCommitResult("turn-2");
  assert.equal(r.turnId, "turn-2");
  assert.deepEqual(r.appliedDeltas, []);
  assert.deepEqual(r.rejectedDeltas, []);
  assert.deepEqual(r.gateResults, []);
  assert.ok(r.committedAt);
});

test("runDeltaGates — accept path: mood delta within bounds", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.05, arousal: -0.1 },
        confidence: 0.9,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp" };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "accept");
});

test("runDeltaGates — relationship reject: |value| > 0.10", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "relationship",
        targetId: "user-1",
        patch: { trust: 0.15 },
        confidence: 0.9,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp" };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "relationshipDelta");
});

test("runDeltaGates — mood clamp: value 0.35 clamped to 0.20", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.35, arousal: 0 },
        confidence: 0.9,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp" };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "clamp");
  assert.equal(results[0].gate, "moodDelta");
  assert.ok(results[0].clampedPatch);
  assert.equal(results[0].clampedPatch.valence, 0.2);
});

test("runDeltaGates — recall grounding reject: supporting hashes not in context", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.05 },
        confidence: 0.9,
        supportingEventHashes: ["hash-not-in-context"],
        notes: "",
      },
    ],
  };
  const context = {
    personaRoot: "/tmp",
    lifeEventHashes: new Set(["other-hash"]),
  };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "recallGrounding");
});

test("runDeltaGates — epigenetics reject: genome locked", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "epigenetics",
        targetId: "self",
        patch: { emotion_sensitivity: 0.02 },
        confidence: 0.9,
        supportingEventHashes: ["h1", "h2"],
        notes: "",
      },
    ],
  };
  const context = {
    personaRoot: "/tmp",
    genome: { locked: true },
    lifeEventHashes: new Set(["h1", "h2"]),
  };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "epigenetics");
  assert.ok(results[0].reason.includes("locked"));
});

test("runDeltaGates — epigenetics reject: insufficient evidence (1 hash)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "epigenetics",
        targetId: "self",
        patch: { emotion_sensitivity: 0.02 },
        confidence: 0.9,
        supportingEventHashes: ["h1"],
        notes: "",
      },
    ],
  };
  const context = {
    personaRoot: "/tmp",
    genome: { locked: false },
    lifeEventHashes: new Set(["h1"]),
  };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "epigenetics");
  assert.ok(results[0].reason.includes("at least 2"));
});

test("runDeltaGates — belief reject: low confidence 0.2", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "belief",
        targetId: "b1",
        patch: { strength: 0.5 },
        confidence: 0.2,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp" };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "beliefGoal");
});

test("runDeltaGates — identity gate reject: value delta confidence 0.5", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "value",
        targetId: "v1",
        patch: { importance: 0.8 },
        confidence: 0.5,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp" };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "identityConstitution");
});

test("applyDeltas — applies accepted deltas", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-state-delta-"));
  try {
    const proposal = {
      turnId: "t1",
      proposedAt: new Date().toISOString(),
      deltas: [
        {
          type: "mood",
          targetId: "self",
          patch: { valence: 0.1, arousal: -0.05 },
          confidence: 0.9,
          supportingEventHashes: [],
          notes: "",
        },
      ],
    };
    const gateResults = runDeltaGates(proposal, { personaRoot: tmpDir });
    const result = await applyDeltas(proposal, gateResults, tmpDir);
    assert.equal(result.appliedDeltas.length, 1);
    const raw = await readFile(join(tmpDir, "mood_state.json"), "utf-8");
    const mood = JSON.parse(raw);
    assert.equal(mood.valence, 0.1);
    assert.equal(mood.arousal, -0.05);
    assert.ok(mood._lastDeltaAt);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("applyDeltas — rejects and traces", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-state-delta-"));
  try {
    const proposal = {
      turnId: "t2",
      proposedAt: new Date().toISOString(),
      deltas: [
        {
          type: "relationship",
          targetId: "user-1",
          patch: { trust: 0.2 },
          confidence: 0.9,
          supportingEventHashes: [],
          notes: "",
        },
      ],
    };
    const gateResults = runDeltaGates(proposal, { personaRoot: tmpDir });
    const result = await applyDeltas(proposal, gateResults, tmpDir);
    assert.equal(result.rejectedDeltas.length, 1);
    const tracePath = join(tmpDir, "delta_trace.jsonl");
    const raw = await readFile(tracePath, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    assert.equal(lines.length, 1);
    const trace = JSON.parse(lines[0]);
    assert.equal(trace.turnId, "t2");
    assert.equal(trace.rejectedDeltas.length, 1);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
