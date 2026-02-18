import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  compileContext,
  decide,
  initPersonaPackage,
  loadPersonaPackage,
  updateUserProfile
} from "../dist/index.js";

test("continuity: preferred name survives reload and is injected into context", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-continuity-test-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");

  await initPersonaPackage(personaPath, "Roxy");
  await updateUserProfile(personaPath, { preferredName: "博飞" });

  const reloaded = await loadPersonaPackage(personaPath);
  assert.equal(reloaded.userProfile.preferredName, "博飞");

  const userInput = "你应该怎么称呼我？";
  const trace = decide(reloaded, userInput, "deepseek-chat");
  const messages = compileContext(reloaded, userInput, trace);

  assert.match(messages[0].content, /Selected memories:/);
  assert.match(messages[0].content, /user_preferred_name=博飞/);
  assert.match(messages[0].content, /Current timestamp \(system local, ISO8601\):/);
});
