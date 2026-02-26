import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  createContextBusState,
  checkAccessPermission,
  postMessage,
  getVisibleMessages,
  assertNoLeakage,
  buildMemoryIsolationFilter,
} from "../dist/index.js";

function makeConfig(isolationLevel, participants, currentActorId) {
  return { isolationLevel, participants, currentActorId };
}

function makeMessage(channel, fromActorId, content, timestamp, toActorId) {
  const msg = { channel, fromActorId, content, timestamp };
  if (toActorId !== undefined) msg.toActorId = toActorId;
  return msg;
}

describe("multi_persona_context_bus", () => {
  describe("createContextBusState", () => {
    test("returns empty initial state with Record for privateMessages", () => {
      const s = createContextBusState();
      assert.deepEqual(s.sharedMessages, []);
      assert.deepEqual(s.privateMessages, {});
      assert.deepEqual(s.accessLog, []);
    });

    test("state serializes to JSON correctly", () => {
      const s = createContextBusState();
      const json = JSON.stringify(s);
      const parsed = JSON.parse(json);
      assert.deepEqual(parsed.privateMessages, {});
    });
  });

  describe("checkAccessPermission", () => {
    test("non-participant is denied", () => {
      const cfg = makeConfig("shared", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "c", "a", "shared", "read");
      assert.equal(r.allowed, false);
      assert.equal(r.reason, "not_a_participant");
    });

    test("self-access always allowed", () => {
      for (const level of ["strict", "shared", "hybrid"]) {
        const cfg = makeConfig(level, ["a", "b"], "a");
        for (const ch of ["shared", "private"]) {
          for (const action of ["read", "write"]) {
            const r = checkAccessPermission(cfg, "a", "a", ch, action);
            assert.equal(r.allowed, true, `${level}/${ch}/${action} self-access`);
            assert.equal(r.reason, "self_access");
          }
        }
      }
    });

    test("strict mode blocks cross-actor private reads", () => {
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "private", "read");
      assert.equal(r.allowed, false);
      assert.match(r.reason, /strict/);
    });

    test("strict mode blocks cross-actor private writes", () => {
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "private", "write");
      assert.equal(r.allowed, false);
    });

    test("strict mode allows shared channel reads cross-actor", () => {
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "shared", "read");
      assert.equal(r.allowed, true);
    });

    test("shared mode allows cross-actor private reads", () => {
      const cfg = makeConfig("shared", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "private", "read");
      assert.equal(r.allowed, true);
    });

    test("shared mode denies cross-actor private writes", () => {
      const cfg = makeConfig("shared", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "private", "write");
      assert.equal(r.allowed, false);
    });

    test("hybrid mode denies cross-actor private reads", () => {
      const cfg = makeConfig("hybrid", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "private", "read");
      assert.equal(r.allowed, false);
    });

    test("hybrid mode allows shared reads", () => {
      const cfg = makeConfig("hybrid", ["a", "b"], "a");
      const r = checkAccessPermission(cfg, "a", "b", "shared", "read");
      assert.equal(r.allowed, true);
    });
  });

  describe("postMessage", () => {
    test("adds shared message successfully", () => {
      const state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const msg = makeMessage("shared", "a", "hello", "2025-01-01T00:00:00Z");

      const { nextState, accessRecord } = postMessage(state, cfg, msg);
      assert.equal(nextState.sharedMessages.length, 1);
      assert.equal(nextState.sharedMessages[0].content, "hello");
      assert.equal(accessRecord.allowed, true);
    });

    test("adds private message to sender bucket (self-access)", () => {
      const state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const msg = makeMessage("private", "a", "secret", "2025-01-01T00:00:00Z");

      const { nextState, accessRecord } = postMessage(state, cfg, msg);
      assert.equal(nextState.privateMessages["a"].length, 1);
      assert.equal(nextState.privateMessages["a"][0].content, "secret");
      assert.equal(accessRecord.allowed, true);
    });

    test("cross-actor private write is denied in strict mode", () => {
      const state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const msg = makeMessage("private", "a", "probe", "2025-01-01T00:00:00Z", "b");

      const { nextState, accessRecord } = postMessage(state, cfg, msg);
      assert.equal(accessRecord.allowed, false);
      assert.match(accessRecord.reason, /strict/);
      assert.equal(accessRecord.targetActorId, "b");
      assert.equal(nextState.accessLog.length, 1);
      assert.equal(Object.keys(nextState.privateMessages).length, 0);
    });

    test("access log capped at 500", () => {
      let state = createContextBusState();
      const cfg = makeConfig("strict", ["a"], "a");

      for (let i = 0; i < 510; i++) {
        const msg = makeMessage("shared", "a", `m${i}`, `2025-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`);
        const result = postMessage(state, cfg, msg);
        state = result.nextState;
      }

      assert.ok(state.accessLog.length <= 500);
    });

    test("message arrays capped at 200", () => {
      let state = createContextBusState();
      const cfg = makeConfig("strict", ["a"], "a");

      for (let i = 0; i < 210; i++) {
        const msg = makeMessage("shared", "a", `m${i}`, `2025-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`);
        const result = postMessage(state, cfg, msg);
        state = result.nextState;
      }

      assert.ok(state.sharedMessages.length <= 200);
    });
  });

  describe("getVisibleMessages", () => {
    test("strict: actor sees shared + own private only", () => {
      let state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");

      let result;
      result = postMessage(state, cfg, makeMessage("shared", "a", "shared-a", "2025-01-01T00:00:01Z"));
      state = result.nextState;

      result = postMessage(state, cfg, makeMessage("private", "a", "priv-a", "2025-01-01T00:00:02Z"));
      state = result.nextState;

      result = postMessage(state, { ...cfg, currentActorId: "b" }, makeMessage("private", "b", "priv-b", "2025-01-01T00:00:03Z"));
      state = result.nextState;

      const visible = getVisibleMessages(state, cfg, "a");
      const contents = visible.map((m) => m.content);
      assert.ok(contents.includes("shared-a"));
      assert.ok(contents.includes("priv-a"));
      assert.ok(!contents.includes("priv-b"));
    });

    test("shared: actor sees all messages", () => {
      let state = createContextBusState();
      const cfg = makeConfig("shared", ["a", "b"], "a");

      let result;
      result = postMessage(state, cfg, makeMessage("shared", "a", "shared-a", "2025-01-01T00:00:01Z"));
      state = result.nextState;

      result = postMessage(state, cfg, makeMessage("private", "a", "priv-a", "2025-01-01T00:00:02Z"));
      state = result.nextState;

      result = postMessage(state, { ...cfg, currentActorId: "b" }, makeMessage("private", "b", "priv-b", "2025-01-01T00:00:03Z"));
      state = result.nextState;

      const visible = getVisibleMessages(state, cfg, "a");
      const contents = visible.map((m) => m.content);
      assert.ok(contents.includes("shared-a"));
      assert.ok(contents.includes("priv-a"));
      assert.ok(contents.includes("priv-b"));
    });

    test("hybrid: actor sees shared + own private, not others private", () => {
      let state = createContextBusState();
      const cfg = makeConfig("hybrid", ["a", "b"], "a");

      let result;
      result = postMessage(state, { ...cfg, currentActorId: "b" }, makeMessage("shared", "b", "shared-b", "2025-01-01T00:00:01Z"));
      state = result.nextState;

      result = postMessage(state, cfg, makeMessage("private", "a", "priv-a", "2025-01-01T00:00:02Z"));
      state = result.nextState;

      result = postMessage(state, { ...cfg, currentActorId: "b" }, makeMessage("private", "b", "priv-b", "2025-01-01T00:00:03Z"));
      state = result.nextState;

      const visible = getVisibleMessages(state, cfg, "a");
      const contents = visible.map((m) => m.content);
      assert.ok(contents.includes("shared-b"));
      assert.ok(contents.includes("priv-a"));
      assert.ok(!contents.includes("priv-b"));
    });

    test("messages returned sorted by timestamp", () => {
      let state = createContextBusState();
      const cfg = makeConfig("strict", ["a"], "a");

      let result;
      result = postMessage(state, cfg, makeMessage("private", "a", "second", "2025-01-01T00:00:02Z"));
      state = result.nextState;

      result = postMessage(state, cfg, makeMessage("shared", "a", "first", "2025-01-01T00:00:01Z"));
      state = result.nextState;

      const visible = getVisibleMessages(state, cfg, "a");
      assert.equal(visible[0].content, "first");
      assert.equal(visible[1].content, "second");
    });
  });

  describe("assertNoLeakage", () => {
    test("clean state has no violations", () => {
      const state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const { ok, violations } = assertNoLeakage(state, cfg);
      assert.equal(ok, true);
      assert.equal(violations.length, 0);
    });

    test("correctly denied cross-actor access is NOT a leakage violation", () => {
      const state = createContextBusState();
      state.accessLog.push({
        timestamp: "2025-01-01T00:00:00Z",
        actorId: "a",
        targetActorId: "b",
        channel: "private",
        action: "read",
        allowed: false,
        reason: "strict_private_cross_actor_denied",
      });

      const cfg = makeConfig("strict", ["a", "b"], "a");
      const { ok, violations } = assertNoLeakage(state, cfg);
      assert.equal(ok, true);
      assert.equal(violations.length, 0);
    });

    test("allowed cross-actor private access in strict mode IS a leakage violation", () => {
      const state = createContextBusState();
      state.accessLog.push({
        timestamp: "2025-01-01T00:00:00Z",
        actorId: "a",
        targetActorId: "b",
        channel: "private",
        action: "read",
        allowed: true,
        reason: "anomalous_access",
      });

      const cfg = makeConfig("strict", ["a", "b"], "a");
      const { ok, violations } = assertNoLeakage(state, cfg);
      assert.equal(ok, false);
      assert.equal(violations.length, 1);
    });

    test("self-access is never flagged even if on private channel", () => {
      const state = createContextBusState();
      state.accessLog.push({
        timestamp: "2025-01-01T00:00:00Z",
        actorId: "a",
        targetActorId: "a",
        channel: "private",
        action: "read",
        allowed: true,
        reason: "self_access",
      });

      const cfg = makeConfig("strict", ["a"], "a");
      const { ok, violations } = assertNoLeakage(state, cfg);
      assert.equal(ok, true);
      assert.equal(violations.length, 0);
    });

    test("cross-actor private access in shared mode is not flagged", () => {
      const state = createContextBusState();
      state.accessLog.push({
        timestamp: "2025-01-01T00:00:00Z",
        actorId: "a",
        targetActorId: "b",
        channel: "private",
        action: "read",
        allowed: true,
        reason: "shared_mode_cross_actor_read_allowed",
      });

      const cfg = makeConfig("shared", ["a", "b"], "a");
      const { ok, violations } = assertNoLeakage(state, cfg);
      assert.equal(ok, true);
      assert.equal(violations.length, 0);
    });

    test("end-to-end: postMessage cross-actor denied, assertNoLeakage clean", () => {
      let state = createContextBusState();
      const cfg = makeConfig("strict", ["a", "b"], "a");

      const msg = makeMessage("private", "a", "probe", "2025-01-01T00:00:00Z", "b");
      const result = postMessage(state, cfg, msg);
      state = result.nextState;

      assert.equal(result.accessRecord.allowed, false);
      const { ok } = assertNoLeakage(state, cfg);
      assert.equal(ok, true);
    });
  });

  describe("buildMemoryIsolationFilter", () => {
    test("strict: only own speaker_id", () => {
      const cfg = makeConfig("strict", ["a", "b"], "a");
      const filter = buildMemoryIsolationFilter(cfg, "a");
      assert.deepEqual(filter.speakerIdWhitelist, ["a"]);
    });

    test("shared: null whitelist (no filter)", () => {
      const cfg = makeConfig("shared", ["a", "b"], "a");
      const filter = buildMemoryIsolationFilter(cfg, "a");
      assert.equal(filter.speakerIdWhitelist, null);
    });

    test("hybrid: own speaker_id", () => {
      const cfg = makeConfig("hybrid", ["a", "b"], "a");
      const filter = buildMemoryIsolationFilter(cfg, "a");
      assert.deepEqual(filter.speakerIdWhitelist, ["a"]);
    });
  });
});
