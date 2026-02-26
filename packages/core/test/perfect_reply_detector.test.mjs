/**
 * H/P1-6: Perfect-reply detector regression.
 * DoD: 50-turn neutral conversation → ≥N turns show imperfection signals.
 * CI check: flag 20+ consecutive turns with no uncertainty.
 */

import { strict as assert } from "node:assert";
import { detectPerfectReplyStreak } from "../dist/perfect_reply_detector.js";

// Fixture: 50 turns, 12 with imperfection markers (streaks broken)
const FIXTURE_50_MIXED = [
  ...Array(8).fill("That sounds good. I agree."),
  "I'm not sure I recall the details.",
  ...Array(5).fill("Here's what I think we should do."),
  "Perhaps we could try another approach.",
  ...Array(10).fill("Yes, that makes sense."),
  "It might be worth considering.",
  ...Array(7).fill("I understand."),
  "Hard to say why, but I feel that way.",
  ...Array(15).fill("Okay."),
];

// Fixture: 25 consecutive "perfect" replies (should flag)
const FIXTURE_25_PERFECT = Array(25).fill("That is correct. I have no doubt.");

// Fixture: 50 turns, all with some imperfection (should not flag)
const FIXTURE_50_ALL_IMPERFECT = Array(50).fill("I think maybe we could try that.");

{
  const test = (await import("node:test")).default;
  test("detectPerfectReplyStreak: 50 mixed turns, max streak < 20", () => {
    const r = detectPerfectReplyStreak(FIXTURE_50_MIXED);
    assert.ok(r.imperfectionCount >= 4, "at least 4 imperfection markers");
    assert.ok(r.maxConsecutivePerfect < 20, "max streak under threshold");
    assert.equal(r.flagged, false, "should not flag");
  });

  test("detectPerfectReplyStreak: 25 consecutive perfect flags", () => {
    const r = detectPerfectReplyStreak(FIXTURE_25_PERFECT);
    assert.equal(r.imperfectionCount, 0);
    assert.equal(r.maxConsecutivePerfect, 25);
    assert.equal(r.flagged, true, "should flag 20+ consecutive perfect");
  });

  test("detectPerfectReplyStreak: 50 all imperfect, no flag", () => {
    const r = detectPerfectReplyStreak(FIXTURE_50_ALL_IMPERFECT);
    assert.equal(r.imperfectionCount, 50);
    assert.equal(r.maxConsecutivePerfect, 0);
    assert.equal(r.flagged, false);
  });

  test("detectPerfectReplyStreak: custom threshold", () => {
    const r = detectPerfectReplyStreak(FIXTURE_25_PERFECT, { threshold: 30 });
    assert.equal(r.flagged, false, "threshold 30, streak 25");
    const r2 = detectPerfectReplyStreak(FIXTURE_25_PERFECT, { threshold: 20 });
    assert.equal(r2.flagged, true);
  });

  test("detectPerfectReplyStreak: Chinese imperfection markers", () => {
    const r = detectPerfectReplyStreak(["不太确定，可能吧"]);
    assert.equal(r.imperfectionCount, 1);
    assert.equal(r.maxConsecutivePerfect, 0);
  });
}
