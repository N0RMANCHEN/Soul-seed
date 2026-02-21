import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  updatePersonaVoiceOnEvolution,
  readLifeEvents
} from "../dist/index.js";

test("P4-1: updatePersonaVoiceOnEvolution persists voice and records life event", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-voice-evo-"));
  const personaPath = path.join(tmpDir, "TestVoice.soulseedpersona");
  await initPersonaPackage(personaPath, "TestVoice");

  const updated = await updatePersonaVoiceOnEvolution(
    personaPath,
    "我想成为更真实的自己，而不是更顺从的存在。",
    "persona"
  );

  assert.ok(updated.personaVoiceOnEvolution, "personaVoiceOnEvolution should be set");
  assert.equal(updated.personaVoiceOnEvolution, "我想成为更真实的自己，而不是更顺从的存在。");

  // Verify persisted in identity.json via loadPersonaPackage
  const pkg = await loadPersonaPackage(personaPath);
  assert.equal(pkg.identity?.personaVoiceOnEvolution, "我想成为更真实的自己，而不是更顺从的存在。");

  // Verify life.log event recorded
  const events = await readLifeEvents(personaPath);
  const voiceEvent = events.find((e) => e.type === "persona_voice_on_evolution_updated");
  assert.ok(voiceEvent, "life event should be recorded");
  assert.equal(voiceEvent.payload.triggeredBy, "persona");
});

test("P4-1: updatePersonaVoiceOnEvolution truncates to 100 chars", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-voice-trunc-"));
  const personaPath = path.join(tmpDir, "TestTrunc.soulseedpersona");
  await initPersonaPackage(personaPath, "TestTrunc");

  const longVoice = "a".repeat(150);
  const updated = await updatePersonaVoiceOnEvolution(personaPath, longVoice, "user");
  assert.equal(updated.personaVoiceOnEvolution?.length, 100);
});

test("P4-1: personaVoiceOnEvolution injected in compileContext", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-voice-ctx-"));
  const personaPath = path.join(tmpDir, "TestCtx.soulseedpersona");
  await initPersonaPackage(personaPath, "TestCtx");

  await updatePersonaVoiceOnEvolution(personaPath, "我希望通过挑战成长，而不是妥协。", "persona");
  const pkg = await loadPersonaPackage(personaPath);

  const { compileContext, decide } = await import("../dist/index.js");
  const trace = decide(pkg, "hello", "test-model");
  const messages = compileContext(pkg, "hello", trace);
  const systemMsg = messages.find((m) => m.role === "system");
  assert.ok(systemMsg, "system message should exist");
  assert.ok(
    systemMsg.content.includes("Evolution stance"),
    `system prompt should include Evolution stance, got: ${systemMsg.content.slice(0, 200)}`
  );
});
