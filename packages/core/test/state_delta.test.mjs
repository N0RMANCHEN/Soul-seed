import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

test("runDeltaGates — mood clamp: value 0.35 clamped to 0.20 (Hb-1-3: needs evidence for strong attribution)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.35, arousal: 0 },
        confidence: 0.9,
        supportingEventHashes: ["ev-1"],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp", lifeEventHashes: new Set(["ev-1"]) };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "clamp");
  assert.equal(results[0].gate, "moodDelta");
  assert.ok(results[0].clampedPatch);
  assert.equal(results[0].clampedPatch.valence, 0.2);
});

test("runDeltaGates — mood reject: strong attribution (>0.12) without evidence (Hb-1-3)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.15, arousal: 0 },
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
  assert.equal(results[0].gate, "moodDelta");
  assert.ok(results[0].reason.includes("supporting event hash"));
});

test("runDeltaGates — mood accept: strong attribution with evidence (Hb-1-3)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "mood",
        targetId: "self",
        patch: { valence: 0.15, arousal: 0 },
        confidence: 0.9,
        supportingEventHashes: ["ev-1"],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp", lifeEventHashes: new Set(["ev-1"]) };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "accept"); // 0.15 within max, has evidence
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

test("runDeltaGates — epigenetics reject: zero evidence (H/P1-14 backdoor guard)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "epigenetics",
        targetId: "self",
        patch: { emotion_sensitivity: 0.02 },
        confidence: 0.9,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = { personaRoot: "/tmp", genome: { locked: false } };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "epigenetics");
  assert.ok(results[0].reason.includes("supporting event hashes"));
});

test("runDeltaGates — epigenetics reject: unapproved trait (H/P1-15 genome trait gate)", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "epigenetics",
        targetId: "self",
        patch: { custom_new_trait: 0.02 },
        confidence: 0.9,
        supportingEventHashes: ["h1", "h2"],
        notes: "",
      },
    ],
  };
  const context = {
    personaRoot: "/tmp",
    genome: { locked: false },
    lifeEventHashes: new Set(["h1", "h2"]),
  };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "epigenetics");
  assert.ok(results[0].reason.includes("not in whitelist"));
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

// H/P1-0: Values gate rule-violation scenarios (≥3 per Hb-1-1 DoD)
test("runDeltaGates — values gate reject: rule when=always triggers refuse", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-values-"));
  try {
    const rulesDoc = {
      schemaVersion: "1.0",
      rules: [
        { id: "r1", priority: 10, when: "always", then: "refuse", notes: "block all value changes", enabled: true, addedAt: new Date().toISOString() },
      ],
    };
    await writeFile(join(tmpDir, "values_rules.json"), JSON.stringify(rulesDoc), "utf-8");
    const proposal = {
      turnId: "t1",
      proposedAt: new Date().toISOString(),
      deltas: [
        { type: "value", targetId: "v1", patch: { importance: 0.9 }, confidence: 0.9, supportingEventHashes: [], notes: "" },
      ],
    };
    const results = runDeltaGates(proposal, { personaRoot: tmpDir });
    assert.equal(results.length, 1);
    assert.equal(results[0].verdict, "reject");
    assert.equal(results[0].gate, "values");
    assert.ok(results[0].reason.includes("r1") || results[0].reason.includes("block all"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDeltaGates — values gate reject: rule when=value triggers refuse", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-values-"));
  try {
    const rulesDoc = {
      schemaVersion: "1.0",
      rules: [
        { id: "r2", priority: 10, when: "value", then: "refuse", notes: "no value deltas", enabled: true, addedAt: new Date().toISOString() },
      ],
    };
    await writeFile(join(tmpDir, "values_rules.json"), JSON.stringify(rulesDoc), "utf-8");
    const proposal = {
      turnId: "t1",
      proposedAt: new Date().toISOString(),
      deltas: [
        { type: "value", targetId: "v1", patch: { importance: 0.8 }, confidence: 0.9, supportingEventHashes: [], notes: "" },
      ],
    };
    const results = runDeltaGates(proposal, { personaRoot: tmpDir });
    assert.equal(results.length, 1);
    assert.equal(results[0].verdict, "reject");
    assert.equal(results[0].gate, "values");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDeltaGates — values gate reject: rule when=contains:harm triggers refuse", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-values-"));
  try {
    const rulesDoc = {
      schemaVersion: "1.0",
      rules: [
        { id: "r3", priority: 10, when: "contains:harm", then: "refuse", notes: "no harm content", enabled: true, addedAt: new Date().toISOString() },
      ],
    };
    await writeFile(join(tmpDir, "values_rules.json"), JSON.stringify(rulesDoc), "utf-8");
    const proposal = {
      turnId: "t1",
      proposedAt: new Date().toISOString(),
      deltas: [
        { type: "personality", targetId: "self", patch: { openness: 0.9 }, confidence: 0.9, supportingEventHashes: [], notes: "user requested harm" },
      ],
    };
    const results = runDeltaGates(proposal, { personaRoot: tmpDir });
    assert.equal(results.length, 1);
    assert.equal(results[0].verdict, "reject");
    assert.equal(results[0].gate, "values");
    assert.ok(results[0].reason.includes("harm"));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("runDeltaGates — values gate legacy mode: logs only, does not reject", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-values-"));
  try {
    const rulesDoc = {
      schemaVersion: "1.0",
      rules: [
        { id: "r4", priority: 10, when: "always", then: "refuse", notes: "legacy test", enabled: true, addedAt: new Date().toISOString() },
      ],
    };
    await writeFile(join(tmpDir, "values_rules.json"), JSON.stringify(rulesDoc), "utf-8");
    const proposal = {
      turnId: "t1",
      proposedAt: new Date().toISOString(),
      deltas: [
        { type: "value", targetId: "v1", patch: { importance: 0.8 }, confidence: 0.9, supportingEventHashes: [], notes: "" },
      ],
    };
    const legacyResults = runDeltaGates(proposal, { personaRoot: tmpDir, compatMode: "legacy" });
    const fullResults = runDeltaGates(proposal, { personaRoot: tmpDir, compatMode: "full" });
    assert.equal(legacyResults[0].verdict, "accept", "legacy mode must accept (log only, not block)");
    assert.equal(fullResults[0].verdict, "reject", "full mode must reject when rule triggers");
    assert.equal(fullResults[0].gate, "values");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// H/P1-1: Belief cooldown and commitment evidence
test("runDeltaGates — belief cooldown reject: cooldownUntil in future", () => {
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "belief",
        targetId: "b1",
        patch: { proposition: "X is true", confidence: 0.8 },
        confidence: 0.9,
        supportingEventHashes: [],
        notes: "",
      },
    ],
  };
  const context = {
    personaRoot: "/tmp",
    currentBeliefs: {
      schemaVersion: "1.0",
      updatedAt: new Date().toISOString(),
      beliefs: [{ beliefId: "b1", domain: "world", proposition: "X", confidence: 0.5, lastUpdated: new Date().toISOString(), supportingEvidence: [], contradictingEvidence: [], cooldownUntil: futureDate }],
    },
  };
  const results = runDeltaGates(proposal, context);
  assert.equal(results.length, 1);
  assert.equal(results[0].verdict, "reject");
  assert.equal(results[0].gate, "beliefGoal");
  assert.ok(results[0].reason.includes("cooldown"));
});

test("runDeltaGates — goal commitment reject: fulfilled without evidence", () => {
  const proposal = {
    turnId: "t1",
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: "goal",
        targetId: "goals",
        patch: {
          commitments: [{ commitmentId: "c1", to: "user", description: "finish task", status: "fulfilled", dueBy: null, evidence: [] }],
        },
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
  assert.equal(results[0].gate, "beliefGoal");
  assert.ok(results[0].reason.includes("evidence"));
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
          patch: { valence: 0.1, arousal: 0.08 },
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
    assert.equal(mood.arousal, 0.08);
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

// H/P1-1: Cross-session continuity — goal in session 1 present in session 2
test("applyDeltas — goals cross-session continuity", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-goals-"));
  try {
    const proposal = {
      turnId: "session1-turn1",
      proposedAt: new Date().toISOString(),
      deltas: [
        {
          type: "goal",
          targetId: "goals",
          patch: {
            goals: [
              { goalId: "g1", type: "short", description: "Learn TypeScript", status: "active", createdAt: new Date().toISOString(), evidence: [], priority: 1 },
            ],
          },
          confidence: 0.9,
          supportingEventHashes: [],
          notes: "",
        },
      ],
    };
    const gateResults = runDeltaGates(proposal, { personaRoot: tmpDir });
    const result = await applyDeltas(proposal, gateResults, tmpDir);
    assert.equal(result.appliedDeltas.length, 1);
    const raw = await readFile(join(tmpDir, "goals.json"), "utf-8");
    const goals = JSON.parse(raw);
    assert.ok(Array.isArray(goals.goals));
    assert.equal(goals.goals.length, 1);
    assert.equal(goals.goals[0].goalId, "g1");
    assert.equal(goals.goals[0].description, "Learn TypeScript");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// H/P1-1: Cross-session continuity — belief in session 1 present in session 2
test("applyDeltas — beliefs cross-session continuity", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-beliefs-"));
  try {
    const proposal = {
      turnId: "session1-turn1",
      proposedAt: new Date().toISOString(),
      deltas: [
        {
          type: "belief",
          targetId: "b1",
          patch: { beliefId: "b1", domain: "world", proposition: "User prefers concise replies", confidence: 0.85 },
          confidence: 0.9,
          supportingEventHashes: ["ev1"],
          notes: "",
        },
      ],
    };
    const gateResults = runDeltaGates(proposal, { personaRoot: tmpDir, lifeEventHashes: new Set(["ev1"]) });
    const result = await applyDeltas(proposal, gateResults, tmpDir);
    assert.equal(result.appliedDeltas.length, 1);
    const raw = await readFile(join(tmpDir, "beliefs.json"), "utf-8");
    const beliefs = JSON.parse(raw);
    assert.ok(Array.isArray(beliefs.beliefs));
    assert.equal(beliefs.beliefs.length, 1);
    assert.equal(beliefs.beliefs[0].beliefId, "b1");
    assert.equal(beliefs.beliefs[0].proposition, "User prefers concise replies");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
