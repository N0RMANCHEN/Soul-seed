/**
 * mcp_budget.test.mjs
 * Verifies session budget enforcement in ToolRegistry.
 */
import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { initPersonaPackage, loadPersonaPackage } from "@soulseed/core";
import { createTestRegistry } from "../dist/tool_registry.js";

test("session budget exceeded after sessionMax calls", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-budget-"));
  const personaPath = path.join(tmp, "BudgetPersona.soulseedpersona");
  await initPersonaPackage(personaPath, "BudgetPersona");
  const personaPkg = await loadPersonaPackage(personaPath);

  // Override sessionMax to 2 for memory.inspect
  const registry = createTestRegistry({
    personaPath,
    personaPkg,
    budgetOverrides: {
      "memory.inspect": { sessionMax: 2 }
    }
  });

  // First call – ok
  const r1 = await registry.dispatch("memory.inspect", { id: "some-id-1" });
  assert.ok(!r1.isError);
  const p1 = JSON.parse(r1.content[0].text);
  // found:false is fine, just not a budget error
  assert.equal(typeof p1.found, "boolean");

  // Second call – ok
  const r2 = await registry.dispatch("memory.inspect", { id: "some-id-2" });
  assert.ok(!r2.isError);
  const p2 = JSON.parse(r2.content[0].text);
  assert.equal(typeof p2.found, "boolean");

  // Third call – must be budget exceeded
  const r3 = await registry.dispatch("memory.inspect", { id: "some-id-3" });
  assert.ok(r3.isError);
  const p3 = JSON.parse(r3.content[0].text);
  assert.equal(p3.error, "session_budget_exceeded");
});

test("different tools have independent budgets", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "ss-mcp-budget2-"));
  const personaPath = path.join(tmp, "BudgetPersona2.soulseedpersona");
  await initPersonaPackage(personaPath, "BudgetPersona2");
  const personaPkg = await loadPersonaPackage(personaPath);

  const registry = createTestRegistry({
    personaPath,
    personaPkg,
    budgetOverrides: {
      "memory.inspect": { sessionMax: 1 },
      "memory.search": { sessionMax: 2 }
    }
  });

  // Exhaust memory.inspect
  await registry.dispatch("memory.inspect", { id: "x" });
  const rOverBudget = await registry.dispatch("memory.inspect", { id: "y" });
  assert.equal(JSON.parse(rOverBudget.content[0].text).error, "session_budget_exceeded");

  // memory.search should still work
  const rSearch = await registry.dispatch("memory.search", { query: "test" });
  assert.ok(!rSearch.isError);
});
