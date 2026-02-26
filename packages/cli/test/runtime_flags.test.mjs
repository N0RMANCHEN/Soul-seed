import test from "node:test";
import assert from "node:assert/strict";

import { resolveReplyDisplayMode, resolveStreamReplyEnabled } from "../dist/runtime_flags.js";

test("resolveStreamReplyEnabled defaults to on", () => {
  const result = resolveStreamReplyEnabled({});
  assert.equal(result.enabled, true);
  assert.equal(result.source, "default_on");
});

test("resolveStreamReplyEnabled prefers SOULSEED_STREAM_REPLY", () => {
  const result = resolveStreamReplyEnabled({
    SOULSEED_STREAM_REPLY: "off",
    SOULSEED_STREAM_RAW: "1"
  });
  assert.equal(result.enabled, false);
  assert.equal(result.source, "soulseed_stream_reply");
});

test("resolveStreamReplyEnabled falls back to SOULSEED_STREAM_RAW", () => {
  const result = resolveStreamReplyEnabled({
    SOULSEED_STREAM_RAW: "0"
  });
  assert.equal(result.enabled, false);
  assert.equal(result.source, "legacy_stream_raw");
});

test("resolveReplyDisplayMode returns adjusted when streamed content was rewritten", () => {
  const mode = resolveReplyDisplayMode({
    streamed: true,
    shouldDisplayAssistant: true,
    adjustedByGuard: true,
    rawText: "原始输出",
    finalText: "最终输出"
  });
  assert.equal(mode, "adjusted");
});

test("resolveReplyDisplayMode returns none when streamed and unchanged", () => {
  const mode = resolveReplyDisplayMode({
    streamed: true,
    shouldDisplayAssistant: true,
    adjustedByGuard: false,
    rawText: "同一段文本",
    finalText: "同一段文本"
  });
  assert.equal(mode, "none");
});
