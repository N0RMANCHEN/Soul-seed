# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-02-25

### Added
- Added roadmap governance rules for execution planning:
  complexity/coupling/risk-based task batching (`parallel` vs `serial`) before implementation.
- Added roadmap release discipline:
  when a full Phase is completed, bump the middle version number (minor).
- Added roadmap phase-onboarding rule:
  when starting a new Phase, complete phase-level ownership/work-split planning first.

### Changed
- Updated project/package versions to `0.3.0` across root/workspaces and lockfile references.
- Updated default persona schema references and H0 compat constants to `0.3.0`.
- Archived Phase G from active roadmap and retained completion record in changelog/Git history.
- Aligned workspace package metadata license with repository `LICENSE` to `CC-BY-NC-ND-4.0` (replacing stale `MIT` declarations).
- Added roadmap-level assessment and delivery plan for conversation experience gaps (interest/attention/proactive continuity), introducing `Phase J` with scheduled tasks.
- Added mandatory `Phase split rule` in roadmap to enforce domain-bounded phase scoping and split triggers by scale/coupling/verification boundary.
- Replanned the full active roadmap without task loss, adding a dedicated `Phase K` for multi-persona chat system delivery (arbitration, turn scheduling, context boundary, CLI flows, and quality gates).

## [0.2.0] - 2026-02-25

### Added
- Added semantic routing tier model (`L1/L2/L3/L4`) and persisted routing evidence in `DecisionTrace`.
- Added unified safety fallback gateway and prompt leak guard with structured trace fields:
  `leak_type`, `source_stage`, `rewrite_applied`.
- Added Lx quality metrics to scorecard path:
  `L1HitRate`, `L2HitRate`, `L3ArbitrationRate`, `L4RegexFallbackRate`, `BusinessPathRegexRate`.
- Added core-level autonomy utterance generator (`greeting/proactive/farewell/exit_confirm`) with
  LLM-first generation, normalization, anti-template guard, and degraded fallback reason codes.
- Added autonomy persistence coverage in chat interaction tests:
  greeting + exit_confirm + farewell are recorded into `life.log` as `assistant_message`.

### Changed
- Migrated capability intent/recall navigation/pronoun role checks to semantic-first path with regex fallback.
- Enhanced capability tool loop to include preflight confirmation explanation, post-success explanation, and failure retry guidance.
- Unified autonomy audit payload fields on assistant messages:
  `autonomyMode`, `autonomySource`, `autonomyReasonCodes`.
- Updated exit-confirm autonomy memory policy to be auditable but non-recallable
  (`memoryMeta.excludedFromRecall=true`) to avoid control-prompt pollution.
- Completed and archived Phase G roadmap scope (control-plane closure, safety fallback convergence, prompt leak governance, degraded persona integrity, latency profiling, group participation control, autonomy utterance naturalization).
