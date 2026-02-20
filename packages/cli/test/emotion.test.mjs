import test from "node:test";
import assert from "node:assert/strict";

import { inferEmotionFromText, parseEmotionTag, renderEmotionPrefix } from "../dist/emotion.js";

test("parseEmotionTag strips valid emotion prefix", () => {
  const parsed = parseEmotionTag("[emotion:smile] 你好呀");
  assert.equal(parsed.emotion, "smile");
  assert.equal(parsed.text, "你好呀");
});

test("parseEmotionTag supports bare token and strips chained tags", () => {
  const parsed = parseEmotionTag("[smile] [playful-serious] 你好呀");
  assert.equal(parsed.emotion, "smile");
  assert.equal(parsed.text, "你好呀");
});

test("parseEmotionTag ignores invalid emotion token", () => {
  const parsed = parseEmotionTag("[emotion:unknown] 你好呀");
  assert.equal(parsed.emotion, null);
  assert.equal(parsed.text, "你好呀");
});

test("parseEmotionTag strips localized chinese emotion tags", () => {
  const parsed = parseEmotionTag("[困惑 (?_?)] [困惑] 你好呀");
  assert.equal(parsed.emotion, "confused");
  assert.equal(parsed.text, "你好呀");
});

test("renderEmotionPrefix returns localized label", () => {
  assert.equal(renderEmotionPrefix("welcome"), "[欢迎回来 (^o^)/] ");
  assert.equal(renderEmotionPrefix(null), "");
});

test("inferEmotionFromText detects stage-direction style chinese cues", () => {
  const text = "（光晕轻轻左右晃动）现在...还只是光晕呢。（声音温柔）";
  assert.equal(inferEmotionFromText(text), "warm");
});
