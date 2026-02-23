import test from "node:test";
import assert from "node:assert/strict";

import { deriveTemporalAnchor, enforceTemporalPhraseGuard } from "../dist/index.js";

test("temporal phrase guard downscopes immediate words for long gap", () => {
  const nowMs = Date.parse("2026-02-23T09:30:00+08:00");
  const lastUserAtMs = Date.parse("2026-02-22T21:30:00+08:00");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs });
  const result = enforceTemporalPhraseGuard("你刚才说的那个点我记得。", { anchor });
  assert.equal(result.corrected, true);
  assert.equal(result.text.includes("刚才"), false);
  assert.equal(result.text.includes("昨晚") || result.text.includes("之前"), true);
});

test("temporal phrase guard downscopes distant words for short gap", () => {
  const nowMs = Date.parse("2026-02-23T09:30:00+08:00");
  const lastUserAtMs = Date.parse("2026-02-23T09:24:00+08:00");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs });
  const result = enforceTemporalPhraseGuard("这是很久之前我们聊过的事。", { anchor });
  assert.equal(result.corrected, true);
  assert.equal(result.text.includes("很久之前"), false);
  assert.equal(result.text.includes("刚才") || result.text.includes("刚刚"), true);
});

test("temporal phrase guard uses neutral earlier wording for mid gap", () => {
  const nowMs = Date.parse("2026-02-23T15:30:00+08:00");
  const lastUserAtMs = Date.parse("2026-02-23T10:00:00+08:00");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs });
  const result = enforceTemporalPhraseGuard("这是很久以前你提过的。", { anchor });
  assert.equal(result.corrected, true);
  assert.equal(result.text.includes("很久以前"), false);
  assert.equal(result.text.includes("之前"), true);
});

test("temporal phrase guard prefers last-night wording for cross-day gap", () => {
  const nowMs = Date.parse("2026-02-23T09:30:00+08:00");
  const lastUserAtMs = Date.parse("2026-02-22T23:40:00+08:00");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs });
  const result = enforceTemporalPhraseGuard("你刚刚提到那个点。", { anchor });
  assert.equal(result.corrected, true);
  assert.equal(result.text.includes("刚刚"), false);
  assert.equal(result.text.includes("昨晚"), true);
});

test("temporal phrase guard rewrites hard time-denial line when anchor exists", () => {
  const nowMs = Date.parse("2026-02-23T10:10:00+08:00");
  const lastUserAtMs = Date.parse("2026-02-23T09:40:00+08:00");
  const anchor = deriveTemporalAnchor({ nowMs, lastUserAtMs });
  const result = enforceTemporalPhraseGuard("不知道。你刚才没让我看表。", { anchor });
  assert.equal(result.corrected, true);
  assert.equal(result.text.includes("你刚才没让我看表"), false);
  assert.equal(result.text.includes("距离你上一次发言大约"), true);
});
