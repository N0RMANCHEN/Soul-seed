export type Role = "system" | "user" | "assistant";
export type MetaCognitionMode = "off" | "shadow" | "active";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface PersonaMeta {
  id: string;
  displayName: string;
  schemaVersion: string;
  createdAt: string;
  defaultModel?: string;
  initProfile?: {
    template: "friend" | "peer" | "intimate" | "neutral" | "custom";
    initializedAt: string;
  };
}

export interface PersonaConstitution {
  values: string[];
  boundaries: string[];
  mission: string;
  commitments?: string[];
}

export interface PersonaWorldview {
  seed: string;
}

export interface PersonaInitOptions {
  worldview?: PersonaWorldview;
  constitution?: PersonaConstitution;
  habits?: PersonaHabits;
  voiceProfile?: VoiceProfile;
  defaultModel?: string;
  initProfile?: {
    template: "friend" | "peer" | "intimate" | "neutral" | "custom";
    initializedAt?: string;
  };
}

export interface PersonaHabits {
  style: string;
  adaptability: "low" | "medium" | "high";
}

export interface PersonaUserProfile {
  preferredLanguage: string;
  preferredName: string;
}

export interface AdultSafetyContext {
  adultMode: boolean;
  ageVerified: boolean;
  explicitConsent: boolean;
  fictionalRoleplay: boolean;
}

export interface PersonaPinned {
  memories: string[];
  updatedAt?: string;
}

export interface PersonaPackage {
  rootPath: string;
  persona: PersonaMeta;
  worldview?: PersonaWorldview;
  constitution: PersonaConstitution;
  habits?: PersonaHabits;
  userProfile: PersonaUserProfile;
  pinned: PersonaPinned;
  relationshipState?: RelationshipState;
  voiceProfile?: VoiceProfile;
  soulLineage?: SoulLineage;
}

export interface RelationshipDimensions {
  trust: number;
  safety: number;
  intimacy: number;
  reciprocity: number;
  stability: number;
  libido: number;
}

export interface RelationshipDriver {
  ts: string;
  source: "user" | "assistant" | "event";
  signal: string;
  deltaSummary: Partial<RelationshipDimensions>;
}

export interface RelationshipState {
  state: "neutral-unknown" | "friend" | "peer" | "intimate";
  confidence: number;
  overall: number;
  dimensions: RelationshipDimensions;
  arousalImprint?: number;
  drivers: RelationshipDriver[];
  version: "3";
  updatedAt: string;
}

export interface SoulLineage {
  personaId: string;
  parentPersonaId?: string;
  childrenPersonaIds: string[];
  reproductionCount: number;
  lastReproducedAt?: string;
  inheritancePolicy: "values_plus_memory_excerpt";
  consentMode: "default_consent";
}

export interface VoiceProfile {
  baseStance: "self-determined";
  serviceModeAllowed: boolean;
  languagePolicy: "follow_user_language";
  forbiddenSelfLabels: string[];
  tonePreference?: "warm" | "plain" | "reflective" | "direct";
  stancePreference?: "friend" | "peer" | "intimate" | "neutral";
  thinkingPreview?: {
    enabled?: boolean;
    thresholdMs?: number;
    phrasePool?: string[];
    allowFiller?: boolean;
  };
}

export interface VoiceIntent {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  serviceMode: false;
  language: "zh" | "en" | "mixed";
}

export interface MemoryEvidenceBlock {
  id: string;
  source: "user" | "assistant" | "system";
  content: string;
}

export interface DecisionTrace {
  version: string;
  timestamp: string;
  selectedMemories: string[];
  selectedMemoryBlocks?: MemoryEvidenceBlock[];
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
    relational: number;
  };
  voiceIntent?: VoiceIntent;
  relationshipStateSnapshot?: RelationshipState;
  recallTraceId?: string;
  mcpCall?: McpCallRecord;
  metaTraceId?: string;
  executionMode?: "soul" | "agent";
  goalId?: string;
  stepId?: string;
  planVersion?: number;
  consistencyVerdict?: "allow" | "rewrite" | "reject";
  consistencyRuleHits?: string[];
  consistencyTraceId?: string;
}

export type PersonaJudgmentLabel = "fiction" | "non_fiction" | "mixed" | "uncertain";

export interface PersonaJudgmentRecord {
  id: string;
  subjectRef: string;
  label: PersonaJudgmentLabel;
  confidence: number;
  rationale: string;
  evidenceRefs: string[];
  version: number;
  supersedesVersion?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MetaIntentPlan {
  domain: "dialogue" | "tool";
  intent: "reply" | "ask_clarify" | "tool_call" | "refuse";
  rationale: string;
}

export interface MetaActionDraft {
  replyDraft?: string;
  toolDraft?: CapabilityCallRequest;
  memoryJudgmentDraft?: {
    label: PersonaJudgmentLabel;
    confidence: number;
    rationale: string;
  };
}

export interface MetaActionArbitration {
  traceId: string;
  finalReply?: string;
  finalToolCall?: CapabilityCallRequest;
  summary: string;
  applied: boolean;
}

export interface McpCallRecord {
  toolName: string;
  callId: string;
  approvalReason: string;
  budgetSnapshot: {
    cost: number;
    sessionCallCount: number;
    sessionMax: number;
  };
}

export type CapabilityName =
  | "session.capability_discovery"
  | "session.show_modes"
  | "session.owner_auth"
  | "session.read_file"
  | "session.fetch_url"
  | "session.proactive_status"
  | "session.proactive_tune"
  | "session.set_mode"
  | "session.exit";

export type CapabilityRiskLevel = "low" | "medium" | "high";

export interface CapabilityCallRequest {
  name: CapabilityName;
  input?: Record<string, unknown>;
  source?: "dialogue" | "slash" | "mcp" | "system";
}

export interface CapabilityCallResult {
  ok: boolean;
  name: CapabilityName;
  status: "executed" | "confirm_required" | "rejected" | "clarify";
  message: string;
  output?: Record<string, unknown>;
}

export interface OwnerAuthContext {
  ownerTokenProvided?: boolean;
  ownerAuthPassed: boolean;
  reason?: string;
  expiresAt?: string;
}

export interface ProactiveStateSnapshot {
  ts: string;
  probability: number;
  curiosity: number;
  annoyanceBias: number;
}

export interface ProactiveDecisionTrace {
  ts: string;
  emitted: boolean;
  probability: number;
  reason: string;
}

export type GoalStatus = "pending" | "active" | "blocked" | "completed" | "canceled";

export interface GoalStep {
  id: string;
  title: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  source: "user" | "system" | "mcp";
  summary?: string;
  steps: GoalStep[];
}

export interface GoalEvent {
  id: string;
  goalId: string;
  ts: string;
  type:
    | "goal_created"
    | "goal_updated"
    | "goal_completed"
    | "goal_blocked"
    | "goal_canceled"
    | "goal_step_started"
    | "goal_step_succeeded"
    | "goal_step_failed";
  payload: Record<string, unknown>;
}

export interface ConsistencyRuleHit {
  ruleId: string;
  severity: "hard" | "soft";
  reason: string;
}

export interface ConsistencyCheckInput {
  personaName: string;
  constitution: PersonaConstitution;
  selectedMemories?: string[];
  selectedMemoryBlocks?: MemoryEvidenceBlock[];
  lifeEvents?: LifeEvent[];
  userInput?: string;
  candidateText: string;
  strictMemoryGrounding?: boolean;
}

export interface ConsistencyCheckResult {
  verdict: "allow" | "rewrite" | "reject";
  text: string;
  ruleHits: ConsistencyRuleHit[];
  traceId: string;
}

export interface ExecutionAction {
  kind: "tool_call" | "reply" | "clarify" | "complete";
  reason: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  replyDraft?: string;
}

export interface ExecutionObservation {
  ok: boolean;
  summary: string;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  goalId: string;
  status: GoalStatus;
  reply: string;
  steps: GoalStep[];
  consistencyVerdict: "allow" | "rewrite" | "reject";
  consistencyTraceId: string;
  traceIds: string[];
}

export type MemoryTier = "highlight" | "pattern" | "error";
export type MemoryMetaSource = "chat" | "system" | "acceptance";
export type MemoryDecayClass = "fast" | "standard" | "slow" | "sticky";

export interface MemoryMeta {
  tier: MemoryTier;
  storageCost: number;
  retrievalCost: number;
  source: MemoryMetaSource;
  activationCount?: number;
  lastActivatedAt?: string;
  emotionScore?: number;
  narrativeScore?: number;
  relationalScore?: number;
  salienceScore?: number;
  state?: "hot" | "warm" | "cold" | "archive" | "scar";
  decayClass?: MemoryDecayClass;
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
  | "memory_consolidated"
  | "memory_consolidation_failed"
  | "memory_soft_forgotten"
  | "memory_recovered"
  | "memory_contamination_flagged"
  | "relationship_state_updated"
  | "libido_state_updated"
  | "voice_intent_selected"
  | "reproduction_intent_detected"
  | "soul_reproduction_completed"
  | "soul_reproduction_rejected"
  | "soul_reproduction_forced"
  | "force_mode_toggled"
  | "narrative_drift_detected"
  | "constitution_review_requested"
  | "worldview_revised"
  | "constitution_revised"
  | "self_revision_proposed"
  | "self_revision_applied"
  | "self_revision_conflicted"
  | "scar"
  | "mcp_tool_called"
  | "mcp_tool_rejected"
  | "capability_intent_detected"
  | "capability_call_requested"
  | "capability_call_confirmed"
  | "capability_call_rejected"
  | "capability_call_succeeded"
  | "owner_auth_succeeded"
  | "owner_auth_failed"
  | "proactive_decision_made"
  | "proactive_message_emitted"
  | "meta_intent_planned"
  | "meta_action_composed"
  | "meta_action_arbitrated"
  | "thinking_preview_emitted"
  | "persona_judgment_updated"
  | "persona_judgment_superseded"
  | "goal_created"
  | "goal_updated"
  | "goal_completed"
  | "goal_blocked"
  | "goal_canceled"
  | "goal_step_started"
  | "goal_step_succeeded"
  | "goal_step_failed"
  | "consistency_checked";

export type SelfRevisionDomain =
  | "habits"
  | "voice"
  | "relationship"
  | "worldview_proposal"
  | "constitution_proposal";

export interface SelfRevisionProposal {
  domain: SelfRevisionDomain;
  changes: Record<string, unknown>;
  evidence: string[];
  confidence: number;
  reasonCodes: string[];
  conflictsWithBoundaries: string[];
  status: "proposed" | "applied" | "frozen";
}

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

export interface WorkingSetItem {
  id: string;
  ts: string;
  sourceEventHashes: string[];
  summary: string;
  sourceEventHashCount?: number;
  sourceEventHashDigest?: string;
  sourceEventHashesTruncated?: boolean;
}

export interface WorkingSetData {
  items: WorkingSetItem[];
  memoryWeights?: {
    activation: number;
    emotion: number;
    narrative: number;
    relational: number;
  };
}
