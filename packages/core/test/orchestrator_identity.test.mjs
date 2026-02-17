import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { compileContext, decide, initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("compileContext enforces provider-identity guardrail", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-orch-identity-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  const pkg = await loadPersonaPackage(personaPath);
  const trace = decide(pkg, "你知道DeepSeek是什么", "deepseek-chat");
  const messages = compileContext(pkg, "你知道DeepSeek是什么", trace);

  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /Never claim you are created by/i);
  assert.match(messages[0].content, /persistent identity is defined by local persona files/i);
  assert.match(messages[0].content, /Relationship policy:/i);
  assert.match(messages[0].content, /only use details explicitly present in Selected memories/i);
  assert.match(messages[0].content, /You are Roxy/);
});
