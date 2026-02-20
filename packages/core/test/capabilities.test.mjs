import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCapabilityIntent,
  evaluateCapabilityPolicy,
  computeProactiveStateSnapshot,
  decideProactiveEmission
} from "../dist/index.js";

test("resolveCapabilityIntent recognizes proactive and mode intents", () => {
  const proactiveStatus = resolveCapabilityIntent("/proactive status");
  assert.equal(proactiveStatus.matched, true);
  assert.equal(proactiveStatus.request?.name, "session.proactive_status");

  const modeUpdate = resolveCapabilityIntent("strict_memory_grounding on confirmed=true");
  assert.equal(modeUpdate.matched, true);
  assert.equal(modeUpdate.request?.name, "session.set_mode");
});

test("evaluateCapabilityPolicy enforces owner and confirmation gates", () => {
  const rejected = evaluateCapabilityPolicy(
    {
      name: "session.set_mode",
      input: { modeKey: "adult_mode", modeValue: true, confirmed: true },
      source: "dialogue"
    },
    {
      cwd: process.cwd(),
      ownerKey: "secret"
    }
  );
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.reason, "owner_auth_failed");

  const allowed = evaluateCapabilityPolicy(
    {
      name: "session.set_mode",
      input: {
        ownerToken: "secret",
        modeKey: "adult_mode",
        modeValue: true,
        confirmed: true
      },
      source: "dialogue"
    },
    {
      cwd: process.cwd(),
      ownerKey: "secret"
    }
  );
  assert.equal(allowed.status, "allow");
});

test("proactive engine snapshot + decision are bounded", () => {
  const snapshot = computeProactiveStateSnapshot({
    curiosity: 0.3,
    annoyanceBias: -0.1,
    silenceMinutes: 10
  });
  assert.equal(snapshot.probability >= 0.01 && snapshot.probability <= 0.92, true);

  const decisionHit = decideProactiveEmission(snapshot, 0);
  assert.equal(decisionHit.emitted, true);
});
