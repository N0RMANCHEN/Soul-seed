export type Role = "system" | "user" | "assistant";
export type MetaCognitionMode = "off" | "shadow" | "active";

export interface ChatMessage {
  role: Role;
  content: string;
}

export const PERSONA_SCHEMA_VERSION = "0.3.0";

export interface SharedSpaceConfig {
  /** Absolute path to the shared space root directory */
  path: string;
  /** Whether the shared space is currently enabled */
  enabled: boolean;
  /** ISO timestamp when created */
  createdAt: string;
}

export interface PersonaMeta {
  id: string;
  displayName: string;
  schemaVersion: string;
  createdAt: string;
  /** Per-persona adult safety defaults. CLI flags override these; system defaults are all false. */
  adultSafetyDefaults?: {
    adultMode?: boolean;
    ageVerified?: boolean;
    explicitConsent?: boolean;
    fictionalRoleplay?: boolean;
  };
  initProfile?: {
    template: "friend" | "peer" | "intimate" | "neutral" | "custom";
    initializedAt: string;
  };
  /** Per-persona memory rotation policy */
  memoryPolicy?: {
    /** Rotate life.log when entry count exceeds this limit */
    maxLifeLogEntries?: number;
    /** Disable golden example accumulation AND injection for this persona (default: false) */
    disableGoldenExamples?: boolean;
    /**
     * Quality threshold (0–1) for meta-review to auto-collect a turn as a golden example.
     * Default is 0.85. Lower values (e.g. 0.75) capture more examples but may include
     * mediocre turns. Useful for tool/guide personas that need faster library growth.
     */
    goldenExampleQualityThreshold?: number;
  };
  /** Shared space folder for bidirectional file exchange with user */
  sharedSpace?: SharedSpaceConfig;
  paths?: {
    identity?: string;
    worldview?: string;
    constitution?: string;
    habits?: string;
    userProfile?: string;
    pinned?: string;
    cognition?: string;
    soulLineage?: string;
    lifeLog?: string;
    memoryDb?: string;
    [key: string]: string | undefined;
  };
}

/**
 * P1-0: identity.json v2 schema
 * 身份锚点——不只是 personaId，而是"我是谁"的自我理解
 */
export interface PersonaIdentity {
  /** persona 唯一 ID（永不变） */
  personaId: string;
  /** 身份锚点（保向后兼容） */
  anchors: { continuity: boolean };
  /** schema 版本 */
  schemaVersion: "2.0";
  /** Roxy 用第一人称对自己的描述（≤200字）*/
  selfDescription?: string;
  /** 起源叙事摘要（≤150字）*/
  originStory?: string;
  /** 3-5 个核心性格词（自己认可的）*/
  personalityCore?: string[];
  /** 指向 life.log 中关键事件的 hash（最多5条）*/
  definingMomentRefs?: string[];
  /** P4-1: Roxy 对自己演化方向的立场表述（≤100字）*/
  personaVoiceOnEvolution?: string;
  /** 最近更新时间 */
  updatedAt?: string;
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
  initProfile?: {
    template: "friend" | "peer" | "intimate" | "neutral" | "custom";
    initializedAt?: string;
  };
}

export interface PersonaHabits {
  style: string;
  adaptability: "low" | "medium" | "high";
  /** P1-1: 典型行为特点（如"会在思考时用省略号"）*/
  quirks?: string[];
  /** P1-1: 让 persona 变活跃的话题标签（由 crystallization 自动涌现）*/
  topicsOfInterest?: string[];
  /** P1-1: 幽默风格 */
  humorStyle?: "dry" | "warm" | "playful" | "subtle" | null;
  /** P1-1: 冲突处理风格 */
  conflictBehavior?: "assertive" | "deflect" | "redirect" | "hold-ground" | null;
}

export interface PersonaUserProfile {
  preferredLanguage: string;
  preferredName: string;
}

export interface ModelRoutingConfig {
  instinct?: string;
  deliberative?: string;
  meta?: string;
}

export interface CognitionState {
  instinctBias: number;
  epistemicStance: "balanced" | "cautious" | "assertive";
  toolPreference: "auto" | "read_first" | "reply_first";
  updatedAt: string;
  modelRouting?: ModelRoutingConfig;
  /** EB-2: 可配置路由权重（可由 self_revision 自适应调整） */
  routingWeights?: {
    familiarity: number;
    relationship: number;
    emotion: number;
    risk: number;
  };
  /** EB-5: 可配置关系动力学常数（替代硬编码值，可由 self_revision 自适应调整） */
  relationshipDynamics?: {
    decayPerIdleInterval?: number;
    libidoDecayMultiplier?: number;
    softCeiling?: number;
  };
  /** EB-6: 16-dim 表达意图潜在向量；VoiceIntent 枚举字段为投影层 */
  voiceLatent?: number[];
  /** EB-6: 32-dim 信念/判断潜在向量；epistemicStance/PersonaJudgmentLabel 为投影层 */
  beliefLatent?: number[];
}

export interface AdultSafetyContext {
  adultMode: boolean;
  ageVerified: boolean;
  explicitConsent: boolean;
  fictionalRoleplay: boolean;
}

/** A single searchable block stored in persona_library (inside pinned.json). */
export interface PersonaLibraryBlock {
  id: string;
  title: string;
  /** Full content — up to 2000 chars. Use library.search for retrieval injection. */
  content: string;
  tags?: string[];
  createdAt?: string;
}

/** Hard budget constants — ≤5 entries, each ≤300 chars. */
export const MAX_PINNED_COUNT = 5;
export const MAX_PINNED_CHARS = 300;

export interface PersonaPinned {
  memories: string[];
  /** Optional searchable knowledge blocks (not injected every turn). */
  library?: PersonaLibraryBlock[];
  updatedAt?: string;
}

/**
 * P2-0: 内在情绪状态模型
 * 描述 persona 在某一时刻的情绪状态，独立于关系维度。
 */
export type DominantEmotion =
  | "calm"
  | "curious"
  | "playful"
  | "melancholic"
  | "tender"
  | "restless"
  | "warm"
  | "guarded";

export interface MoodState {
  /** EB-1: 情绪 Latent 向量（32维）— 真实内在情绪状态；valence/arousal 从此投影 */
  moodLatent?: number[];
  /** 情绪效价：-1(负面) ~ +1(正面)，基线 0.5（从 moodLatent 投影，向后兼容接口）*/
  valence: number;
  /** 情绪唤起度：0(平静) ~ 1(激动)，基线 0.3（从 moodLatent 投影，向后兼容接口）*/
  arousal: number;
  /** 主导情绪标签（从 moodLatent 投影，向后兼容接口）*/
  dominantEmotion: DominantEmotion;
  /** 引发当前情绪的事件 hash（最近3条）*/
  triggers: string[];
  /** Roxy 心里正挂着的一句话（≤60字）*/
  onMindSnippet: string | null;
  /** 每小时向基线衰减的比率（默认 0.08）*/
  decayRate: number;
  /** 最后更新时间 */
  updatedAt: string;
}

export interface PersonaPackage {
  rootPath: string;
  persona: PersonaMeta;
  identity?: PersonaIdentity;
  worldview?: PersonaWorldview;
  constitution: PersonaConstitution;
  habits?: PersonaHabits;
  userProfile: PersonaUserProfile;
  pinned: PersonaPinned;
  cognition: CognitionState;
  relationshipState?: RelationshipState;
  voiceProfile?: VoiceProfile;
  soulLineage?: SoulLineage;
  /** P2-0: 内在情绪状态 */
  moodState?: MoodState;
  /** P2-2: 自传体叙事 */
  autobiography?: {
    selfUnderstanding: string;
    chapterCount: number;
    lastDistilledAt: string | null;
  };
  /** P3-0: 兴趣分布摘要 */
  interests?: {
    topTopics: string[];
    curiosity: number;
    updatedAt: string;
  };
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
  /** EB-5: 64-dim relationship latent vector; dims[0-5] map to named dimensions */
  relationshipLatent?: number[];
}

export interface SoulLineage {
  personaId: string;
  parentPersonaId?: string;
  childrenPersonaIds: string[];
  reproductionCount: number;
  lastReproducedAt?: string;
  inheritancePolicy: "values_plus_memory_excerpt";
  consentMode: "default_consent" | "require_roxy_voice" | "roxy_veto";
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

export type EngagementTier = "IGNORE" | "REACT" | "LIGHT" | "NORMAL" | "DEEP";
export type TopicAction = "maintain" | "clarify" | "switch";
export type ResponsePolicy =
  | "safety_refusal"
  | "minimal_ack"
  | "reactive_brief"
  | "light_response"
  | "normal_response"
  | "deep_response";

export interface ConversationControlDecision {
  engagementTier: EngagementTier;
  topicAction: TopicAction;
  responsePolicy: ResponsePolicy;
  reasonCodes: string[];
  groupParticipation?: {
    mode: "speak" | "wait" | "brief_ack";
    score: number;
    isGroupChat: boolean;
    addressedToAssistant: boolean;
    cooldownHit: boolean;
    consecutiveAssistantTurns: number;
    reasonCodes: string[];
  };
}

export interface MemoryEvidenceBlock {
  id: string;
  source: "user" | "assistant" | "system";
  content: string;
  /** P4-0: 记忆不确定性分级 */
  uncertaintyLevel?: "certain" | "uncertain";
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
  recallBudgetPolicy?: {
    profile: string;
    reasonCodes: string[];
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
  conversationControl?: ConversationControlDecision;
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
  routeDecision?: "instinct" | "deliberative";
  routeReasonCodes?: string[];
  routing?: {
    tier: "L1" | "L2" | "L3" | "L4";
    reasonCodes: string[];
    isBusinessPath: boolean;
    fallbackReason?: string;
    arbitrationTriggered: boolean;
  };
  routeTag?: "instinct" | "deliberative" | "meta";
  modelUsed?: string;
  /** EB-0: 内容安全语义评估向量 [intent_risk, content_risk, relational_risk] */
  riskLatent?: [number, number, number];
  /** EB-0: 使用的风险评估路径 */
  riskAssessmentPath?: "semantic" | "regex_fallback";
  /** EA-0: Soul 对是否需要调用 Agent 的裁决 */
  agentRequest?: {
    needed: boolean;
    agentType: "retrieval" | "transform" | "capture" | "action";
    riskLevel: "low" | "medium" | "high";
    requiresConfirmation: boolean;
  };
  /** EA-0: Agent trace 关联的 Soul trace id */
  soulTraceId?: string;
  latencyBreakdown?: Partial<Record<"routing" | "recall" | "planning" | "llm_primary" | "llm_meta" | "guard" | "rewrite" | "emit", number>>;
  latencyTotalMs?: number;
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
  | "session.exit"
  | "session.list_personas"
  | "session.connect_to"
  | "session.create_persona"
  | "session.shared_space_setup"
  | "session.shared_space_list"
  | "session.shared_space_read"
  | "session.shared_space_write"
  | "session.shared_space_delete";

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
  isInQuietHours?: boolean;
  topicAffinity?: number;
  frequencyWindowHit?: boolean;
  gateReasons?: string[];
}

export interface ProactiveDecisionTrace {
  ts: string;
  emitted: boolean;
  probability: number;
  reason: string;
  suppressReason?: string; // 未触发时的抑制原因
  topicAffinity?: number;
  frequencyWindowHit?: boolean;
  gateReasons?: string[];
}

export type GoalStatus = "pending" | "active" | "blocked" | "completed" | "canceled" | "suspended";

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
    | "goal_suspended"
    | "goal_canceled"
    | "goal_step_started"
    | "goal_step_succeeded"
    | "goal_step_failed";
  payload: Record<string, unknown>;
}

export interface GoalContext {
  goalId: string;
  planVersion: number;
  lastObservation?: string;
  nextStepHint?: string;
  updatedAt: string;
}

export interface ConsistencyRuleHit {
  ruleId: string;
  severity: "hard" | "soft";
  reason: string;
}

export interface ConsistencyCheckInput {
  stage?: "pre_plan" | "pre_action" | "post_action" | "pre_reply";
  policy?: "soft" | "hard";
  personaName: string;
  constitution: PersonaConstitution;
  selectedMemories?: string[];
  selectedMemoryBlocks?: MemoryEvidenceBlock[];
  lifeEvents?: LifeEvent[];
  userInput?: string;
  candidateText: string;
  strictMemoryGrounding?: boolean;
  /** When true (adult mode fully enabled), skip service-tone / identity checks that misfire on intimate expression */
  isAdultContext?: boolean;
  /** Whether fictional roleplay mode is explicitly enabled for this session */
  fictionalRoleplayEnabled?: boolean;
}

export interface ConsistencyCheckResult {
  verdict: "allow" | "rewrite" | "reject";
  text: string;
  ruleHits: ConsistencyRuleHit[];
  degradeRecommended: boolean;
  degradeReasons: string[];
  explanations: string[];
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

export interface StepPolicy {
  strategy: "tool_first" | "reply_first" | "clarify_first";
  allowToolCalls: boolean;
  maxRetries: number;
}

export interface StopCondition {
  kind: "goal_completed" | "blocked_by_consistency" | "aborted" | "max_steps_reached" | "clarify_required";
  reason: string;
}

export interface PlanState {
  goalId: string;
  version: number;
  stepNo: number;
  plannerSource: "llm" | "fallback_rule";
  policy: StepPolicy;
  history: Array<{
    stepNo: number;
    action: string;
    observation: string;
    verdict: "allow" | "rewrite" | "reject";
  }>;
  lastUpdatedAt: string;
}

export interface ExecutionResult {
  goalId: string;
  status: GoalStatus;
  reply: string;
  steps: GoalStep[];
  consistencyVerdict: "allow" | "rewrite" | "reject";
  consistencyTraceId: string;
  consistencyRuleHits: string[];
  consistencyDegradeReasons: string[];
  traceIds: string[];
  planState?: PlanState;
  stopCondition?: StopCondition;
  /** EA-0: 关联的 Soul trace id，由 execution_protocol 注入 */
  soulTraceId?: string;
  /** EA-1: Agent 产生的记忆候选提案（未经元认知裁决，不写入 persona 记忆）*/
  memoryProposals?: Array<{
    kind: "semantic" | "preference" | "relational" | "open_question";
    content: string;
    evidenceRefs: string[];
    confidence: number;
    expiresAt?: string;
  }>;
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
  | "instinct_reflection_logged"
  | "cognition_state_updated"
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
  | "consistency_checked"
  | "memory_crystallized"
  | "constitution_crystallization_proposed"
  | "constitution_crystallization_applied"
  | "constitution_crystallization_rollback"
  | "constitution_review_approved"
  | "constitution_review_rejected"
  | "social_graph_person_proposed"
  | "social_graph_person_added"
  | "social_graph_person_removed"
  | "persona_voice_on_evolution_updated"
  | "reproduction_consent_statement"
  | "turn_latency_profiled";

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
  /** error / warning: affects ok; hint: informational only, does not affect ok */
  severity: "error" | "warning" | "hint";
  message: string;
  path: string;
}

export interface DoctorReport {
  ok: boolean;
  checkedAt: string;
  issues: DoctorIssue[];
}

export interface EnvCheckResult {
  component: string;
  ok: boolean;
  /** Short message shown in doctor output */
  message: string;
  /** Copy-paste install hint shown only when ok=false */
  hint?: string;
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
