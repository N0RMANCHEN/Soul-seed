# Appendix B — Access-Point Checklist (H/P1-19)

> Spec §29, 04-Archive Appendix B. Each item has code anchor + verification status.

## H-Scope (verified in Phase Hc)

| # | Access Point | Code Anchor | Verification |
|---|--------------|-------------|--------------|
| 2 | **Context Budget** (Context Compile) | `packages/core/src/recall_budget_policy.ts`, `invariant_table.ts` | Invariant-table budgets enforced; recall topK, cards cap from genome |
| 3 | **State Delta Pipeline** (after meta-review, before commit) | `packages/core/src/execution_protocol.ts` (meta_review → commit), `state_delta_apply.ts` | `proposal → gates → apply` wired; `scripts/check_direct_writes.mjs` enforces no bypass |
| 6 | **Emotion Expression Policy** (conversation_policy output) | `packages/core/src/affect_context_injector.ts`, `conversation_control.ts` | Emoji/emotion frequency from policy; expression protocol in prompt |

## J/K-Scope (contract stubs only in Hc)

| # | Access Point | Expected Insertion Point | Phase |
|---|--------------|--------------------------|-------|
| 1 | **Engagement Controller** | Before `executeTurnProtocol` in main message handler | J |
| 4 | **Proactive Planner** | After trigger engine in proactive/tick pipeline | J |
| 5 | **Group Arbitration** | In group-chat message dispatch layer | K |

## Verification Commands

- **Direct writes**: `node scripts/check_direct_writes.mjs`
- **Governance regression**: `node scripts/regression/governance.mjs`
