# Hb-1-3 — Affect 3-Layer State Machine

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-1-3 (Affect Module)  
> **Parent**: `doc/plans/Hb-1-State-Core.md`  
> **Tasks**: 1 (H/P1-5)  
> **Execution Strategy**: After sync-1 (H/P0-4 complete)  
> **Status**: `done`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §6, `03-Engineering` §3.3

---

## 1. Objective

Replace single-layer mood with three-layer affect: mood baseline (slow), emotion episodes (fast), temperament influence (trait). Decouple from response rendering.

---

## 2. Sync Point

**sync-1**: H/P1-5 depends on H/P0-4 (Genome & Epigenetics MVP). Person B must complete H/P0-4 before Person A can start H/P1-5. Genome traits `emotion_sensitivity` and `emotion_recovery` define delta scale and regression speed.

---

## 3. Task Detail

### 3.1 H/P1-5 — Affect 3-Layer State Machine

**Objective**: Mood baseline + emotion episodes + temperament. No "faking emotion via tone templates."

#### Layer 1: Mood Baseline (hours/days)

| Artifact | Description |
|----------|-------------|
| mood_state.json | valence, arousal, energy, stress; baseline; updatedAt |
| MoodUpdateHandler | Baseline regression at Genome emotion_recovery rate |
| MoodDeltaGate | Inertia; per-turn max shift; evidence for strong attribution |

#### Layer 2: Emotion Episodes (minutes)

| Artifact | Description |
|----------|-------------|
| Episode type | episodeId, at, trigger, label, intensity, decay, causeText, causeConfidence |
| EmotionEpisodeManager | Creation, decay, archival |
| Cue Extraction integration | Triggers episodes from Stage1 |

**"Not knowing why" is a feature**: causeConfidence can be low; system expresses uncertainty.

#### Layer 3: Temperament (weeks/months)

| Artifact | Description |
|----------|-------------|
| personality_profile.json (temperament section) | Susceptibility to mood shifts |
| Genome emotion_sensitivity | Delta scale |
| Epigenetics gate | Temperament changes (very slow, bounded) |

#### Decoupling from Response Rendering

- Affect state informs context injection, but does NOT control emoji/tone templates.
- Forbid: mood neutral → artificial warmth.

#### Key Deliverables

- mood_state.json schema
- Emotion episode type and storage
- MoodUpdateHandler, EmotionEpisodeManager
- MoodDeltaGate
- AffectContextInjector (mood/episode summary for context compile)
- Genome integration: emotion_sensitivity, emotion_recovery

---

## 4. DoD

- Evidence chain: every mood update traces to proposal (with evidence) or baseline regression.
- Fast/slow separation: mood at turn frequency; temperament unchanged across 100-turn session.
- Replay: export affect trace → replay → deterministic outcome.
- Uncertainty: low causeConfidence → "not sure why" expressed, not fabricated.

---

## 5. Rollback

Revert to old single-layer mood mode (disable episodes, temperament influence; use flat mood value).

---

## 6. Storage / Schema Gate (contributing_ai.md §5.3)

- `mood_state.json` already in DOMAIN_FILE_MAP. Emotion episode storage: if persisted, register if applicable.
- Schema: schemaVersion + migration strategy for mood_state changes.

---

## 7. Integration Points

- State Delta Pipeline: mood proposals → MoodDeltaGate → apply
- Cue Extraction: triggers emotion episodes
- Context Compile: mood summary card (budget-constrained)
- Invariant Table: mood shift bounds, episode intensity bounds
- Genome: emotion_sensitivity, emotion_recovery
- Persona Package (H/P1-4): mood_state.json in package

---

## 8. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Inertia | Mood extreme → 10 turns neutral → regression toward baseline |
| E2 | Episode lifecycle | Trigger → decay → archival |
| E3 | Evidence chain | Every update traceable |
| E4 | Fast/slow separation | Mood updates; temperament stable |
| E5 | Uncertainty expression | Low causeConfidence → "not sure why" |
