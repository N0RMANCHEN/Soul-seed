import test from "node:test";
import assert from "node:assert/strict";

import { createToolSessionState, executeToolCall } from "../dist/index.js";

test("toolbus deny-by-default rejects missing approval", async () => {
  const session = createToolSessionState();
  const outcome = await executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [process.cwd()] },
    session,
    run: async () => ({ ok: true })
  });
  assert.equal(outcome.status, "rejected");
  assert.match(outcome.reason, /deny-by-default/i);
});

test("toolbus allows approved call and increases session count", async () => {
  const session = createToolSessionState();
  const outcome = await executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [process.cwd()] },
    session,
    approval: {
      approved: true,
      reason: "test approved",
      budget: { maxCallsPerSession: 2, maxDurationMs: 1000 },
      allowedReadRoots: [process.cwd()]
    },
    run: async () => ({ value: 42 })
  });
  assert.equal(outcome.status, "ok");
  assert.equal(outcome.result?.value, 42);
  assert.equal(session.callCount, 1);
});

test("toolbus rejects path outside approved read roots", async () => {
  const session = createToolSessionState();
  const outside = "/tmp/outside-file.txt";
  const outcome = await executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [outside] },
    session,
    approval: {
      approved: true,
      reason: "test approved",
      budget: { maxCallsPerSession: 2, maxDurationMs: 1000 },
      allowedReadRoots: [process.cwd()]
    },
    run: async () => ({ ok: true })
  });
  assert.equal(outcome.status, "rejected");
  assert.match(outcome.reason, /out of approved scope/i);
});

test("toolbus enforces maxCallsPerSession", async () => {
  const session = createToolSessionState();
  const approval = {
    approved: true,
    reason: "test approved",
    budget: { maxCallsPerSession: 1, maxDurationMs: 1000 },
    allowedReadRoots: [process.cwd()]
  };
  const first = await executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [process.cwd()] },
    session,
    approval,
    run: async () => ({ ok: true })
  });
  const second = await executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [process.cwd()] },
    session,
    approval,
    run: async () => ({ ok: true })
  });
  assert.equal(first.status, "ok");
  assert.equal(second.status, "rejected");
  assert.match(second.reason, /session call budget exceeded/i);
});

test("toolbus aborts when signal is aborted", async () => {
  const session = createToolSessionState();
  const abortController = new AbortController();
  const outcomePromise = executeToolCall({
    toolName: "fs.read_text",
    impact: { readPaths: [process.cwd()] },
    session,
    signal: abortController.signal,
    approval: {
      approved: true,
      reason: "test approved",
      budget: { maxCallsPerSession: 2, maxDurationMs: 1000 },
      allowedReadRoots: [process.cwd()]
    },
    run: async (signal) => {
      while (!signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
  });

  setTimeout(() => abortController.abort("ctrl+c"), 20);
  const outcome = await outcomePromise;
  assert.equal(outcome.status, "aborted");
});
