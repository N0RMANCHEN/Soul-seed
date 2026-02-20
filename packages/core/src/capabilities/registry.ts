import type { CapabilityName, CapabilityRiskLevel } from "../types.js";

export interface CapabilityDefinition {
  name: CapabilityName;
  risk: CapabilityRiskLevel;
  ownerOnly: boolean;
  requiresConfirmation: boolean;
  description: string;
}

const DEFINITIONS: CapabilityDefinition[] = [
  {
    name: "session.capability_discovery",
    risk: "low",
    ownerOnly: false,
    requiresConfirmation: false,
    description: "Show capability summary when user asks what assistant can do."
  },
  {
    name: "session.show_modes",
    risk: "low",
    ownerOnly: false,
    requiresConfirmation: false,
    description: "Show current strict/adult safety mode status."
  },
  {
    name: "session.owner_auth",
    risk: "high",
    ownerOnly: true,
    requiresConfirmation: false,
    description: "Validate owner token and open short-lived owner session auth."
  },
  {
    name: "session.read_file",
    risk: "medium",
    ownerOnly: false,
    requiresConfirmation: true,
    description: "Read local text file by explicit path, first-time path requires confirmation."
  },
  {
    name: "session.fetch_url",
    risk: "medium",
    ownerOnly: false,
    requiresConfirmation: false,
    description: "Fetch a URL and extract readable text content for use in conversation context."
  },
  {
    name: "session.proactive_status",
    risk: "low",
    ownerOnly: false,
    requiresConfirmation: false,
    description: "Show proactive engine runtime status."
  },
  {
    name: "session.proactive_tune",
    risk: "medium",
    ownerOnly: false,
    requiresConfirmation: false,
    description: "Adjust proactive tendency (compatibility with slash proactive commands)."
  },
  {
    name: "session.set_mode",
    risk: "high",
    ownerOnly: true,
    requiresConfirmation: true,
    description: "Update sensitive mode switches. Requires owner auth and confirmation."
  },
  {
    name: "session.exit",
    risk: "high",
    ownerOnly: false,
    requiresConfirmation: true,
    description: "Exit conversation after explicit confirmation."
  }
];

export function listCapabilityDefinitions(): CapabilityDefinition[] {
  return [...DEFINITIONS];
}

export function getCapabilityDefinition(name: CapabilityName): CapabilityDefinition | undefined {
  return DEFINITIONS.find((item) => item.name === name);
}
