/**
 * mcp_reject.test.mjs
 * Tests deny-by-default behavior and error handling.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { initPersonaPackage, loadPersonaPackage } from "@soulseed/core";
import { createTestRegistry } from "../dist/tool_registry.js";

test("unknown tool name returns tool_not_allowed error", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-reject-"));
  const personaPath = path.join(tmp, "RejectPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "RejectPersona");
  const personaPkg = await loadPersonaPackage(personaPath);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("dangerous.shell", { cmd: "rm -rf /" });

  assert.ok(result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.error, "tool_not_allowed");
});

test("unknown tool: fs.read returns tool_not_allowed", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-reject2-"));
  const personaPath = path.join(tmp, "RejectPersona2.soulseedpersona");
  await initPersonaPackage(personaPath, "RejectPersona2");
  const personaPkg = await loadPersonaPackage(personaPath);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("fs.read", { path: "/etc/passwd" });

  assert.ok(result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.error, "tool_not_allowed");
});

test("persona.get_context with empty userInput returns handler_error", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-reject-err-"));
  const personaPath = path.join(tmp, "ErrPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "ErrPersona");
  const personaPkg = await loadPersonaPackage(personaPath);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("persona.get_context", { userInput: "" });

  assert.ok(result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.ok(parsed.error.startsWith("handler_error"));
});

test("empty string tool name returns tool_not_allowed", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-reject-empty-"));
  const personaPath = path.join(tmp, "EmptyPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "EmptyPersona");
  const personaPkg = await loadPersonaPackage(personaPath);
  const registry = createTestRegistry({ personaPath, personaPkg });

  const result = await registry.dispatch("", {});

  assert.ok(result.isError);
  const parsed = JSON.parse(result.content[0].text);
  assert.equal(parsed.error, "tool_not_allowed");
});
