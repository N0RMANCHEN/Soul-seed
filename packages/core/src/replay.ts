import { decide } from "./orchestrator.js";
import type { DecisionTrace, PersonaPackage } from "./types.js";

export interface ReplayResult {
  input: string;
  trace: DecisionTrace;
}

export function runDecisionReplay(
  personaPkg: PersonaPackage,
  model: string,
  userInputs: string[]
): ReplayResult[] {
  return userInputs.map((input) => ({
    input,
    trace: decide(personaPkg, input, model)
  }));
}
