# Runtime & Report Asset Governance

> 更新日期：2026-02-26  
> 作用：规范 `personas/`、`reports/` 的保留与归档策略，明确哪些产物仅本地留存、哪些可提交。  
> 适用范围：运行态人格资产、评测/验收报告。

---

## 1. personas/ 目录

| 路径 | 策略 | .gitignore | 说明 |
|------|------|------------|------|
| `personas/*.soulseedpersona/` | 仅本地 | ✓ 根 .gitignore | 用户创建的人格包，含私有数据，不提交 |
| `personas/defaults/` | 部分提交 | 子目录 .gitignore | 内置人格（Alpha、Beta）；仅定义文件（persona.json、identity.json、constitution.json 等）提交，runtime 数据（memory.db、life.log.jsonl、summaries/ 等）不提交 |
| `personas/_qa/` | 仅本地 | ✓ 根 .gitignore | 验收测试专用 QA 人格，禁止污染日常 persona |

---

## 2. reports/ 目录

| 路径 | 策略 | .gitignore | 说明 |
|------|------|------------|------|
| `reports/acceptance/` | 仅本地 | ✓ | 在线验收产物（acceptance-*.json、mcp-integration-*.md 等），不提交 |
| `reports/quality/` | 可选提交 | — | 质量评测报告（scorecard.json、delta-report.md）；CI 或本地生成，按需提交示例 |
| `reports/*` 其他 | 仅本地 | — | 其他报告子目录默认不提交，除非显式纳入版本控制 |

---

## 3. 其他运行态资产

| 路径/模式 | 策略 | 说明 |
|-----------|------|------|
| `*.db` | 仅本地 | SQLite 数据库，不提交 |
| `*.log` | 仅本地 | 日志文件，不提交 |

---

## 4. 与 .gitignore 一致性

本策略与根目录 `.gitignore` 及 `personas/defaults/.gitignore` 保持一致。新增忽略规则时需同步更新本文档。
