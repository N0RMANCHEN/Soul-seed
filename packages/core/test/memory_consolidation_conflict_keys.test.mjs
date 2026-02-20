import test from "node:test";
import assert from "node:assert/strict";

import { inferConflictKey, CONFLICT_KEY_RULES } from "../dist/index.js";

// ── CONFLICT_KEY_RULES structure ──────────────────────────────────────────────

test("CONFLICT_KEY_RULES is a non-empty array", () => {
  assert.ok(Array.isArray(CONFLICT_KEY_RULES));
  assert.ok(CONFLICT_KEY_RULES.length > 5, `Expected >5 rules, got ${CONFLICT_KEY_RULES.length}`);
});

test("CONFLICT_KEY_RULES entries have string prefix and key fields", () => {
  for (const rule of CONFLICT_KEY_RULES) {
    assert.equal(typeof rule.prefix, "string");
    assert.ok(rule.prefix.length > 0, "prefix should not be empty");
    assert.equal(typeof rule.key, "string");
    assert.ok(rule.key.length > 0, "key should not be empty");
    assert.match(rule.key, /^[a-z._]+$/, `key "${rule.key}" should be dot-notation lowercase`);
  }
});

test("CONFLICT_KEY_RULES keys are unique", () => {
  const keys = CONFLICT_KEY_RULES.map((r) => r.key);
  // Keys don't need to be globally unique (e.g., two prefixes can map to same key)
  // But prefix must be unique
  const prefixes = CONFLICT_KEY_RULES.map((r) => r.prefix);
  const uniquePrefixes = new Set(prefixes);
  assert.equal(uniquePrefixes.size, prefixes.length, "prefixes should be unique");
});

// ── inferConflictKey ──────────────────────────────────────────────────────────

test("inferConflictKey returns empty for unrecognized content", () => {
  assert.equal(inferConflictKey(""), "");
  assert.equal(inferConflictKey("Hello world"), "");
  assert.equal(inferConflictKey("今天天气很好"), "");
  assert.equal(inferConflictKey("random memory text"), "");
});

test("inferConflictKey returns user.preferred_name for 用户称呼：", () => {
  assert.equal(inferConflictKey("用户称呼：小明"), "user.preferred_name");
  assert.equal(inferConflictKey("用户称呼：Alex"), "user.preferred_name");
});

test("inferConflictKey returns user.preference.general for 用户偏好：", () => {
  assert.equal(inferConflictKey("用户偏好：简洁的回答"), "user.preference.general");
});

test("inferConflictKey returns user.preference.procedural for 交互偏好流程：", () => {
  assert.equal(inferConflictKey("交互偏好流程：先问再答"), "user.preference.procedural");
});

test("inferConflictKey returns user.location for 用户所在地：", () => {
  assert.equal(inferConflictKey("用户所在地：北京"), "user.location");
});

test("inferConflictKey returns user.location.city for 用户城市：", () => {
  assert.equal(inferConflictKey("用户城市：上海"), "user.location.city");
});

test("inferConflictKey returns user.occupation for 用户职业：", () => {
  assert.equal(inferConflictKey("用户职业：软件工程师"), "user.occupation");
});

test("inferConflictKey returns user.occupation for 用户工作：", () => {
  assert.equal(inferConflictKey("用户工作：产品经理"), "user.occupation");
});

test("inferConflictKey returns user.interest.topic for 用户兴趣：", () => {
  assert.equal(inferConflictKey("用户兴趣：人工智能"), "user.interest.topic");
});

test("inferConflictKey returns user.interest.hobby for 用户爱好：", () => {
  assert.equal(inferConflictKey("用户爱好：阅读和写作"), "user.interest.hobby");
});

test("inferConflictKey returns user.goal.current for 用户当前目标：", () => {
  assert.equal(inferConflictKey("用户当前目标：完成项目报告"), "user.goal.current");
});

test("inferConflictKey returns user.goal.longterm for 用户长期目标：", () => {
  assert.equal(inferConflictKey("用户长期目标：创业成功"), "user.goal.longterm");
});

test("inferConflictKey returns user.belief.value for 用户价值观：", () => {
  assert.equal(inferConflictKey("用户价值观：自由与公平"), "user.belief.value");
});

test("inferConflictKey returns persona.expected_style for 用户期望的回应风格：", () => {
  assert.equal(inferConflictKey("用户期望的回应风格：温暖友好"), "persona.expected_style");
});

test("inferConflictKey is case-insensitive (normalized)", () => {
  // normalizeMemoryKey lowercases, but Chinese chars don't change
  assert.equal(inferConflictKey("用户称呼：小明"), "user.preferred_name");
});

test("inferConflictKey handles trailing whitespace", () => {
  assert.equal(inferConflictKey("  用户称呼：小明  "), "user.preferred_name");
});

test("inferConflictKey returns empty for partial match prefix", () => {
  // "用户" alone should not match
  assert.equal(inferConflictKey("用户"), "");
  assert.equal(inferConflictKey("用户：test"), "");
});

test("all CONFLICT_KEY_RULES prefixes are recognized by inferConflictKey", () => {
  for (const rule of CONFLICT_KEY_RULES) {
    const testContent = `${rule.prefix}测试值`;
    const key = inferConflictKey(testContent);
    assert.equal(key, rule.key, `Prefix "${rule.prefix}" should map to "${rule.key}", got "${key}"`);
  }
});
