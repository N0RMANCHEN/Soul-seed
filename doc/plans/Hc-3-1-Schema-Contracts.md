# Hc-3-1 — Schema Contracts

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-3-1  
> **Task**: H/P1-17  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-3-Schema-Access.md`  
> **Source**: `doc/Roadmap.md`, `01-Spec.md` §28, `04-Archive.md` 附录示例结构, `doc/plans/Hc-Verification-Governance.md` §6.1

---

## 1. Objective

Convert Appendix example structures into schema contracts with version validation rules. Foundation for H/P1-18 (Appendix A schemas).

---

## 2. Approach

- Define schema contract framework (versioned, validation rules)
- Map Appendix example structures to schema definitions
- Version migration strategy (1.0 baseline, explicit upgrade path)
- Lint/compile stage structure validation

---

## 3. Key Deliverables

- [ ] Schema contract framework (types, version validation)
- [ ] Appendix example structure → schema mapping
- [ ] Version validation rules (e.g., schemaVersion field, migration)
- [ ] Integration with Persona Package layout (H/P1-4)

---

## 4. Dependency

- H/P1-4 (Persona Package v0.4)
- F/P0-4

---

## 5. DoD

- Example structures pass schema validation
- Version upgrade path documented
- Legacy schema compatible read adapter available

---

## 6. Rollback

Allow legacy schema compatible reading; new validation optional.
