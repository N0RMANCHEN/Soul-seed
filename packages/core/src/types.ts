export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface PersonaMeta {
  id: string;
  displayName: string;
  schemaVersion: string;
  createdAt: string;
}

export interface PersonaConstitution {
  values: string[];
  boundaries: string[];
  mission: string;
}

export interface PersonaUserProfile {
  preferredLanguage: string;
  preferredName: string;
}

export interface PersonaPinned {
  memories: string[];
}

export interface PersonaPackage {
  rootPath: string;
  persona: PersonaMeta;
  constitution: PersonaConstitution;
  userProfile: PersonaUserProfile;
  pinned: PersonaPinned;
  relationshipState?: RelationshipState;
  voiceProfile?: VoiceProfile;
}

export interface RelationshipState {
  state: "neutral-unknown" | "friend" | "peer" | "intimate";
  confidence: number;
  updatedAt: string;
}

export interface VoiceProfile {
  baseStance: "self-determined";
  serviceModeAllowed: boolean;
  languagePolicy: "follow_user_language";
  forbiddenSelfLabels: string[];
}

export interface VoiceIntent {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  serviceMode: false;
  language: "zh" | "en" | "mixed";
}

export interface DecisionTrace {
  version: string;
  timestamp: string;
  selectedMemories: string[];
  askClarifyingQuestion: boolean;
  refuse: boolean;
  riskLevel: "low" | "medium" | "high";
  reason: string;
  model: string;
  memoryBudget?: {
    maxItems: number;
    usedItems: number;
  };
  retrievalBreakdown?: {
    profile: number;
    pinned: number;
    lifeEvents: number;
    summaries: number;
  };
  memoryWeights?: {
    activation: number;
    emotion: number;
    narrative: number;
  };
  voiceIntent?: VoiceIntent;
  relationshipStateSnapshot?: RelationshipState;
}

export type MemoryTier = "highlight" | "pattern" | "error";
export type MemoryMetaSource = "chat" | "system" | "acceptance";

export interface MemoryMeta {
  tier: MemoryTier;
  storageCost: number;
  retrievalCost: number;
  source: MemoryMetaSource;
  activationCount?: number;
  lastActivatedAt?: string;
  emotionScore?: number;
  narrativeScore?: number;
  salienceScore?: number;
  state?: "hot" | "warm" | "cold" | "scar";
  compressedAt?: string;
  summaryRef?: string;
  credibilityScore?: number;
  contaminationFlags?: string[];
  excludedFromRecall?: boolean;
}

export type LifeEventType =
  | "user_message"
  | "assistant_message"
  | "assistant_aborted"
  | "conflict_logged"
  | "rename_requested"
  | "rename_applied"
  | "rename_rejected"
  | "rename_suggested_by_soul"
  | "rename_proposed_by_soul"
  | "rename_confirmed_via_chat"
  | "memory_weight_updated"
  | "memory_compacted"
  | "memory_contamination_flagged"
  | "relationship_state_updated"
  | "voice_intent_selected"
  | "narrative_drift_detected"
  | "constitution_review_requested"
  | "scar";

export interface LifeEvent {
  ts: string;
  type: LifeEventType;
  payload: Record<string, unknown> & {
    memoryMeta?: MemoryMeta;
  };
  prevHash: string;
  hash: string;
}

export interface LifeEventInput {
  type: LifeEventType;
  payload: Record<string, unknown> & {
    memoryMeta?: MemoryMeta;
  };
}

export interface ModelStreamCallbacks {
  onToken: (chunk: string) => void;
  onDone?: () => void;
}

export interface ModelAdapter {
  name: string;
  streamChat(
    messages: ChatMessage[],
    callbacks: ModelStreamCallbacks,
    signal?: AbortSignal
  ): Promise<{ content: string }>;
}

export interface DoctorIssue {
  code: string;
  severity: "error" | "warning";
  message: string;
  path: string;
}

export interface DoctorReport {
  ok: boolean;
  checkedAt: string;
  issues: DoctorIssue[];
}
