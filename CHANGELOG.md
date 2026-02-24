# Changelog

本项目遵循语义化版本（SemVer）。

## [0.2.0] - 2026-02-24

### Added
- 新增 `ss persona lint` 与 `ss persona compile` 命令。
- 新增 H0 gate 产物与 `h0:check` 校验。
- 新增 persona library 检索注入与回归测试。

### Changed
- 强化 persona 写路径并发稳定性（写锁 + SQLite busy 重试）。
- 升级代词/主语归因守卫，移除突兀补句，改为静默重写。
- 增加主语-动作绑定提示约束，减少你/我/他/她混淆。

### Docs
- 更新 Roadmap 结构与执行规则，精简归档说明。
- 补充上手与排错文档入口。
