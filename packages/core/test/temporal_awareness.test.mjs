import test from "node:test";
import assert from "node:assert/strict";

import { deriveTemporalAnchor, evaluateTemporalReplyQuality } from "../dist/index.js";

test("deriveTemporalAnchor computes cross-day gap and label", () => {
  const nowMs = Date.parse("2026-02-23T09:30:00.000Z");
  const lastUserAtMs = Date.parse("2026-02-21T21:30:00.000Z");
  const lastAssistantAtMs = Date.parse("2026-02-21T21:35:00.000Z");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs, lastAssistantAtMs });

  assert.equal(anchor.silenceMinutes, 2155);
  assert.equal(anchor.silenceLabel, "1d");
  assert.equal(anchor.crossedDayBoundary, true);
});

test("evaluateTemporalReplyQuality flags denial despite explicit anchor", () => {
  const anchor = deriveTemporalAnchor({
    nowMs: Date.parse("2026-02-23T09:30:00.000Z"),
    lastUserAtMs: Date.parse("2026-02-22T21:30:00.000Z"),
    lastAssistantAtMs: Date.parse("2026-02-22T21:35:00.000Z")
  });
  const issues = evaluateTemporalReplyQuality("……不知道。你刚才没让我看表。", anchor);
  assert.equal(issues.some((i) => i.code === "missing_time_awareness"), true);
});

test("evaluateTemporalReplyQuality passes grounded timed response", () => {
  const anchor = deriveTemporalAnchor({
    nowMs: Date.parse("2026-02-23T09:30:00.000Z"),
    lastUserAtMs: Date.parse("2026-02-22T21:30:00.000Z"),
    lastAssistantAtMs: Date.parse("2026-02-22T21:35:00.000Z")
  });
  const issues = evaluateTemporalReplyQuality(
    "你上次是昨晚九点半左右来过，这次隔了大概十二小时。",
    anchor
  );
  assert.equal(issues.length, 0);
});
