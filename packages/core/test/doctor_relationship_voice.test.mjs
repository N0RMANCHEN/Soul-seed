import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

import { appendLifeEvent, doctorPersona, initPersonaPackage } from "../dist/index.js";

test("doctor rejects invalid relationship_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-rel-state-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await writeFile(
    path.join(personaPath, "relationship_state.json"),
    JSON.stringify({ state: "unknown", confidence: 9, updatedAt: "bad" }),
    "utf8"
  );

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_relationship_state"), true);
});

test("doctor rejects invalid voice_intent_selected event payload", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-voice-event-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await appendLifeEvent(personaPath, {
    type: "voice_intent_selected",
    payload: {
      voiceIntent: {
        stance: "assistant",
        tone: "soft",
        serviceMode: true,
        language: "jp"
      }
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_voice_intent_event"), true);
});

test("doctor rejects invalid soul_reproduction_forced payload", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-doctor-repro-event-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await appendLifeEvent(personaPath, {
    type: "soul_reproduction_forced",
    payload: {
      parentPersonaId: "",
      trigger: ""
    }
  });

  const report = await doctorPersona(personaPath);
  assert.equal(report.ok, false);
  assert.equal(report.issues.some((i) => i.code === "invalid_soul_reproduction_event"), true);
});
