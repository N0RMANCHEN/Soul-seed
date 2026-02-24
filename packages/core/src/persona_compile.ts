import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadPersonaPackage } from "./persona.js";
import { lintPersona, type PersonaLintReport } from "./persona_lint.js";

export interface PersonaCompiledSnapshot {
  schemaVersion: string;
  compiledAt: string;
  sourcePersonaPath: string;
  personaId: string;
  displayName: string;
  budgetExpanded: {
    pinnedCountMax: number;
    pinnedCharsMax: number;
  };
  files: {
    persona: string;
    constitution: string;
    worldview: string;
    habits: string;
    cognition: string;
    pinned: string;
  };
  lint: {
    ok: boolean;
    errorCount: number;
    warningCount: number;
  };
  hash: string;
}

export async function compilePersonaSnapshot(
  personaPath: string,
  options?: { outPath?: string; strictLint?: boolean }
): Promise<{ snapshot: PersonaCompiledSnapshot; outPath: string; lint: PersonaLintReport }> {
  const lint = await lintPersona(personaPath, { strict: options?.strictLint });
  if (!lint.ok) {
    throw new Error(`persona lint failed: ${lint.errorCount} error(s)`);
  }

  const pkg = await loadPersonaPackage(personaPath);
  const snapshotWithoutHash: Omit<PersonaCompiledSnapshot, "hash"> = {
    schemaVersion: "compiled_snapshot/v1",
    compiledAt: new Date().toISOString(),
    sourcePersonaPath: personaPath,
    personaId: pkg.persona.id,
    displayName: pkg.persona.displayName,
    budgetExpanded: {
      pinnedCountMax: 5,
      pinnedCharsMax: 300
    },
    files: {
      persona: "persona.json",
      constitution: "constitution.json",
      worldview: "worldview.json",
      habits: "habits.json",
      cognition: "cognition_state.json",
      pinned: "pinned.json"
    },
    lint: {
      ok: lint.ok,
      errorCount: lint.errorCount,
      warningCount: lint.warningCount
    }
  };

  const hashInput = {
    schemaVersion: snapshotWithoutHash.schemaVersion,
    sourcePersonaPath: snapshotWithoutHash.sourcePersonaPath,
    personaId: snapshotWithoutHash.personaId,
    displayName: snapshotWithoutHash.displayName,
    budgetExpanded: snapshotWithoutHash.budgetExpanded,
    files: snapshotWithoutHash.files,
    lint: snapshotWithoutHash.lint
  };
  const canonical = canonicalStringify(hashInput);
  const hash = createHash("sha256").update(canonical).digest("hex");
  const snapshot: PersonaCompiledSnapshot = { ...snapshotWithoutHash, hash };

  const outPath = options?.outPath
    ? path.resolve(process.cwd(), options.outPath)
    : path.join(personaPath, "compiled_snapshot.json");
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return { snapshot, outPath, lint };
}

function canonicalStringify(obj: unknown): string {
  return JSON.stringify(sortObject(obj));
}

function sortObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((x) => sortObject(x));
  }
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input as Record<string, unknown>).sort()) {
      out[key] = sortObject((input as Record<string, unknown>)[key]);
    }
    return out;
  }
  return input;
}
