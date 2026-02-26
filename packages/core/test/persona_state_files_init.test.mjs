import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { initPersonaPackage } from "../dist/index.js";

test("initPersonaPackage creates H/P1 state files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "soulseed-persona-init-"));
  const personaPath = path.join(root, "Aria.soulseedpersona");
  try {
    await initPersonaPackage(personaPath, "Aria");
    const expected = [
      "values_rules.json",
      "personality_profile.json",
      "goals.json",
      "beliefs.json",
      "people_registry.json",
    ];
    for (const file of expected) {
      await access(path.join(personaPath, file));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
