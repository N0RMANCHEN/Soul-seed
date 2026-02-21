import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";

import {
  initPersonaPackage,
  doctorPersona,
  MOOD_STATE_FILENAME,
  MOOD_LATENT_DIM,
  VOICE_LATENT_DIM,
  BELIEF_LATENT_DIM,
  RELATIONSHIP_LATENT_DIM,
  createVoiceLatentBaseline,
  createBeliefLatentBaseline,
  createMoodLatentBaseline,
  createRelationshipLatentBaseline
} from "../dist/index.js";

async function makePersonaDir() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-fa2-"));
  const personaPath = path.join(tmpDir, "TestFA2.soulseedpersona");
  await initPersonaPackage(personaPath, "TestFA2");
  return personaPath;
}

test("FA-2: freshly initialized persona has no latent_invalid / latent_excessive_drift issues", async () => {
  const personaPath = await makePersonaDir();
  const report = await doctorPersona(personaPath);
  const latentIssues = report.issues.filter(i =>
    i.code === "latent_invalid" || i.code === "latent_excessive_drift"
  );
  assert.equal(latentIssues.length, 0, `unexpected latent issues: ${JSON.stringify(latentIssues)}`);
});

test("FA-2: invalid voiceLatent (wrong length) triggers latent_invalid warning", async () => {
  const personaPath = await makePersonaDir();
  const cognPath = path.join(personaPath, "cognition_state.json");
  const cogn = JSON.parse(await readFile(cognPath, "utf8"));
  cogn.voiceLatent = [0.1, 0.2]; // wrong length
  await writeFile(cognPath, JSON.stringify(cogn));

  const report = await doctorPersona(personaPath);
  const issue = report.issues.find(i => i.code === "latent_invalid" && i.message.includes("voiceLatent"));
  assert.ok(issue, "should report latent_invalid for voiceLatent");
  assert.equal(issue.severity, "warning");
});

test("FA-2: invalid beliefLatent (contains NaN) triggers latent_invalid warning", async () => {
  const personaPath = await makePersonaDir();
  const cognPath = path.join(personaPath, "cognition_state.json");
  const cogn = JSON.parse(await readFile(cognPath, "utf8"));
  cogn.beliefLatent = new Array(BELIEF_LATENT_DIM).fill(0);
  cogn.beliefLatent[5] = null; // invalid element
  await writeFile(cognPath, JSON.stringify(cogn));

  const report = await doctorPersona(personaPath);
  const issue = report.issues.find(i => i.code === "latent_invalid" && i.message.includes("beliefLatent"));
  assert.ok(issue, "should report latent_invalid for beliefLatent");
});

test("FA-2: homogeneous voiceLatent (all same value) triggers latent_homogeneous hint", async () => {
  const personaPath = await makePersonaDir();
  const cognPath = path.join(personaPath, "cognition_state.json");
  const cogn = JSON.parse(await readFile(cognPath, "utf8"));
  // All zeros → variance = 0
  cogn.voiceLatent = new Array(VOICE_LATENT_DIM).fill(0.5);
  await writeFile(cognPath, JSON.stringify(cogn));

  const report = await doctorPersona(personaPath);
  const issue = report.issues.find(i => i.code === "latent_homogeneous" && i.message.includes("voiceLatent"));
  assert.ok(issue, "should report latent_homogeneous for flat voiceLatent");
  assert.equal(issue.severity, "hint");
});

test("FA-2: drifted beliefLatent triggers latent_excessive_drift warning", async () => {
  const personaPath = await makePersonaDir();
  const cognPath = path.join(personaPath, "cognition_state.json");
  const cogn = JSON.parse(await readFile(cognPath, "utf8"));
  const baseline = createBeliefLatentBaseline();
  // Push dim[0] far from its baseline (baseline[0]=0.5, set to 1.0 → drift=0.5 > threshold 0.45)
  const drifted = [...baseline];
  drifted[0] = 1.0;
  cogn.beliefLatent = drifted;
  await writeFile(cognPath, JSON.stringify(cogn));

  const report = await doctorPersona(personaPath);
  const issue = report.issues.find(i => i.code === "latent_excessive_drift" && i.message.includes("beliefLatent"));
  assert.ok(issue, "should report latent_excessive_drift for beliefLatent");
  assert.equal(issue.severity, "warning");
});

test("FA-2: drifted moodLatent triggers latent_excessive_drift warning", async () => {
  const personaPath = await makePersonaDir();
  const moodPath = path.join(personaPath, MOOD_STATE_FILENAME);
  let mood;
  try { mood = JSON.parse(await readFile(moodPath, "utf8")); } catch { mood = {}; }
  const baseline = createMoodLatentBaseline();
  const drifted = [...baseline];
  drifted[3] = 1.0; // dim[3] baseline=0, drift=1.0 >> 0.45
  mood.moodLatent = drifted;
  await writeFile(moodPath, JSON.stringify(mood));

  const report = await doctorPersona(personaPath);
  const issue = report.issues.find(i => i.code === "latent_excessive_drift" && i.message.includes("moodLatent"));
  assert.ok(issue, "should report latent_excessive_drift for moodLatent");
});

test("FA-2: valid drifted-within-threshold voiceLatent does not trigger drift warning", async () => {
  const personaPath = await makePersonaDir();
  const cognPath = path.join(personaPath, "cognition_state.json");
  const cogn = JSON.parse(await readFile(cognPath, "utf8"));
  const baseline = createVoiceLatentBaseline();
  // Drift all dims by 0.2 (below 0.45 threshold)
  const mild = baseline.map(v => Math.min(1, v + 0.2));
  cogn.voiceLatent = mild;
  await writeFile(cognPath, JSON.stringify(cogn));

  const report = await doctorPersona(personaPath);
  const driftIssue = report.issues.find(i => i.code === "latent_excessive_drift" && i.message.includes("voiceLatent"));
  assert.equal(driftIssue, undefined, "should NOT report drift for mild offset");
});
