import test from "node:test";
import assert from "node:assert/strict";
import { scanForOverNumericalization } from "../dist/index.js";

test("scanForOverNumericalization — natural output passes", () => {
  const result = scanForOverNumericalization("I feel a bit better today. How are you?");
  assert.equal(result.pass, true);
  assert.equal(result.exposureCount, 0);
});

test("scanForOverNumericalization — single exposure passes (under default max 2)", () => {
  const result = scanForOverNumericalization("My trust: 0.85 is high for you.");
  assert.equal(result.pass, true);
  assert.ok(result.exposureCount >= 1);
});

test("scanForOverNumericalization — dashboard-style output fails", () => {
  const text = "trust: 0.72, mood valence: 0.65, emotion_sensitivity: 0.8";
  const result = scanForOverNumericalization(text);
  assert.equal(result.pass, false);
  assert.ok(result.exposureCount >= 2);
  assert.ok(result.matchedPatterns.length >= 2);
});

test("scanForOverNumericalization — custom maxExposuresPerResponse", () => {
  const text = "trust: 0.5";
  const result = scanForOverNumericalization(text, { maxExposuresPerResponse: 0 });
  assert.equal(result.pass, false);
});
