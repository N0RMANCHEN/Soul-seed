export const PHASE_K_ENV_KEY = "SOULSEED_PHASE_K_ENABLE";

export function isPhaseKEnabled(): boolean {
  const val = (process.env[PHASE_K_ENV_KEY] ?? "0").trim().toLowerCase();
  return val === "1" || val === "true";
}
