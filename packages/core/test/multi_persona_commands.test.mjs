import { describe, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  isMultiPersonaCommand,
  handleMultiPersonaCommand,
  formatSpeakerLabel,
  initPersonaPackage,
  ensureMultiPersonaArtifacts,
  registerPersona,
  seedRegistryEntryFromPersona
} from "../dist/index.js";

async function setupPersonaWithEntries(names) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-cmd-"));
  const personaPath = path.join(tmpDir, "CmdTest.soulseedpersona");
  await initPersonaPackage(personaPath, "CmdTest");
  await ensureMultiPersonaArtifacts(personaPath);
  for (const name of names) {
    const entry = seedRegistryEntryFromPersona({
      personaId: `p-${name.toLowerCase()}`,
      displayName: name
    });
    await registerPersona(personaPath, entry);
  }
  return personaPath;
}

function makeCtx(personaRootPath, enabled = true) {
  return {
    personaRootPath,
    currentPersonaId: "p-cmdtest",
    currentPersonaDisplayName: "CmdTest",
    isPhaseKEnabled: enabled
  };
}

describe("isMultiPersonaCommand", () => {
  test("recognizes /who", () => {
    assert.equal(isMultiPersonaCommand("/who"), true);
  });

  test("recognizes /mute with argument", () => {
    assert.equal(isMultiPersonaCommand("/mute Alice"), true);
  });

  test("recognizes /mute without argument", () => {
    assert.equal(isMultiPersonaCommand("/mute"), true);
  });

  test("recognizes /solo with argument", () => {
    assert.equal(isMultiPersonaCommand("/solo Bob"), true);
  });

  test("recognizes /invite with argument", () => {
    assert.equal(isMultiPersonaCommand("/invite Carol"), true);
  });

  test("recognizes /mp status", () => {
    assert.equal(isMultiPersonaCommand("/mp status"), true);
  });

  test("recognizes bare /mp", () => {
    assert.equal(isMultiPersonaCommand("/mp"), true);
  });

  test("rejects non-mp commands", () => {
    assert.equal(isMultiPersonaCommand("/exit"), false);
    assert.equal(isMultiPersonaCommand("hello"), false);
    assert.equal(isMultiPersonaCommand("/proactive on"), false);
  });
});

describe("handleMultiPersonaCommand — phase K disabled", () => {
  test("returns not-enabled message", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-k-cmd-off-"));
    const personaPath = path.join(tmpDir, "Off.soulseedpersona");
    await initPersonaPackage(personaPath, "Off");
    const ctx = makeCtx(personaPath, false);

    const result = await handleMultiPersonaCommand("/who", ctx);
    assert.equal(result.handled, true);
    assert.ok(result.output.includes("not enabled"));
    assert.equal(result.action, "none");
  });
});

describe("handleMultiPersonaCommand — /who", () => {
  test("shows registered personas in table", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster", "Luna"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/who", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "who");
    assert.ok(result.output.includes("Aster"));
    assert.ok(result.output.includes("Luna"));
    assert.ok(result.output.includes("actorId"));
    assert.ok(result.output.includes("displayName"));
  });

  test("shows empty message when no personas", async () => {
    const personaPath = await setupPersonaWithEntries([]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/who", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "who");
    assert.ok(result.output.includes("No personas registered"));
  });
});

describe("handleMultiPersonaCommand — /mute", () => {
  test("mutes persona by display name (case-insensitive)", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/mute aster", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "mute");
    assert.equal(result.targetActorId, "p-aster");
    assert.ok(result.output.includes("Muted Aster"));
  });

  test("returns not-found for unknown name", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/mute Unknown", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "none");
    assert.ok(result.output.includes("No persona found"));
  });
});

describe("handleMultiPersonaCommand — /solo", () => {
  test("solos persona by display name", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster", "Luna"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/solo Luna", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "solo");
    assert.equal(result.targetActorId, "p-luna");
    assert.ok(result.output.includes("Solo mode"));
    assert.ok(result.output.includes("Luna"));
  });
});

describe("handleMultiPersonaCommand — /invite", () => {
  test("invites registered persona", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/invite Aster", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "invite");
    assert.equal(result.targetActorId, "p-aster");
    assert.ok(result.output.includes("Invited Aster"));
  });

  test("returns not-found for unregistered persona", async () => {
    const personaPath = await setupPersonaWithEntries([]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/invite Nobody", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "none");
    assert.ok(result.output.includes("No persona found"));
  });
});

describe("handleMultiPersonaCommand — /mp status", () => {
  test("returns status summary", async () => {
    const personaPath = await setupPersonaWithEntries(["Aster"]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/mp status", ctx);
    assert.equal(result.handled, true);
    assert.ok(result.output.includes("Arbitration"));
    assert.ok(result.output.includes("Isolation"));
    assert.ok(result.output.includes("Registered personas: 1"));
    assert.ok(result.output.includes("Active sessions:"));
  });
});

describe("handleMultiPersonaCommand — unknown /mp subcommand", () => {
  test("shows help text", async () => {
    const personaPath = await setupPersonaWithEntries([]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/mp unknown", ctx);
    assert.equal(result.handled, true);
    assert.equal(result.action, "none");
    assert.ok(result.output.includes("/who"));
    assert.ok(result.output.includes("/mute"));
    assert.ok(result.output.includes("/solo"));
    assert.ok(result.output.includes("/invite"));
    assert.ok(result.output.includes("/mp status"));
  });

  test("bare /mp shows help", async () => {
    const personaPath = await setupPersonaWithEntries([]);
    const ctx = makeCtx(personaPath);

    const result = await handleMultiPersonaCommand("/mp", ctx);
    assert.equal(result.handled, true);
    assert.ok(result.output.includes("Multi-persona commands"));
  });
});

describe("formatSpeakerLabel", () => {
  test("formats assistant label", () => {
    assert.equal(formatSpeakerLabel("assistant", "Aster"), "[assistant:Aster]");
  });

  test("formats system label", () => {
    assert.equal(formatSpeakerLabel("system", "Narrator"), "[system:Narrator]");
  });

  test("returns empty for user role", () => {
    assert.equal(formatSpeakerLabel("user", "Bob"), "");
  });

  test("returns empty when label is empty", () => {
    assert.equal(formatSpeakerLabel("assistant", ""), "");
  });
});
