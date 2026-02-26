import type { PersonaPackage } from "../types.js";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type CompatMode = "legacy" | "full";

export function inferCompatMode(personaPkg: PersonaPackage): CompatMode {
  if (personaPkg.genome && personaPkg.genome.source !== "inferred_legacy") {
    return "full";
  }
  return "legacy";
}

export function hasExplicitGenome(personaRoot: string): boolean {
  return existsSync(join(personaRoot, "genome.json"));
}

export function useStateDeltaPipeline(mode: CompatMode): boolean {
  return mode === "full";
}
