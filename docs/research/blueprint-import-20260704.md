# Blueprint 导入映射 20260704

来源目录：

```text
/Users/ouyang/Desktop/agent-workbench-blueprint-20260704
```

本次整理目标是把桌面蓝图工程包中的可复用资料纳入项目仓库，并按后续开发迭代的使用场景归档。系统文件 `.DS_Store` 未导入；原蓝图 `README.md` 的目录说明已合并到 [文档目录](../README.md)，未作为独立文件保留。

## 导入结果

| 来源文件 | 项目位置 | 说明 |
| --- | --- | --- |
| `01-product/prd.md` | `docs/product/prd.md` | 完整产品需求文档 |
| `01-product/feature-map.md` | `docs/product/feature-map.md` | MVP 功能地图和能力矩阵 |
| `01-product/optimized-solution-20260704.md` | `docs/product/optimized-solution-20260704.md` | 优化版产品方案 |
| `01-product/team-knowledge-and-connectors.md` | `docs/product/team-knowledge-and-connectors.md` | 团队知识库、MCP、CLI 需求 |
| `01-product/research-decision-summary.md` | `docs/research/research-decision-summary.md` | 前期调研决策摘要 |
| `02-design/design-brief.md` | `docs/design/design-brief.md` | 高保真设计说明 |
| `02-design/design-system.md` | `docs/design/design-system.md` | 设计系统草案 |
| `02-design/prototype/*` | `docs/design/prototype/` | 可交互静态高保真原型 |
| `03-architecture/architecture.md` | `docs/architecture/architecture.md` | 产品架构方案 |
| `03-architecture/api-contract.md` | `docs/architecture/api-contract.md` | API 合同草案 |
| `03-architecture/data-model.md` | `docs/architecture/data-model.md` | 数据模型草案 |
| `03-architecture/knowledge-base-and-connectors.md` | `docs/architecture/knowledge-base-and-connectors.md` | 知识库与连接器架构细化 |
| `03-architecture/security-and-permissions.md` | `docs/architecture/security-and-permissions.md` | 安全与权限方案 |
| `04-iteration/implementation-roadmap.md` | `docs/roadmap/implementation-roadmap.md` | 实施路线图 |
| `04-iteration/mvp-backlog.md` | `docs/roadmap/mvp-backlog.md` | MVP Backlog |

## 现有文档关系

- `docs/product/product-brief.md`、`docs/product/requirements.md`、`docs/architecture/architecture-summary.md` 和 `docs/design/design-guidelines.md` 是当前项目的精简版工作文档。
- 本次导入的 `prd.md`、`feature-map.md`、`architecture/*.md` 等文件保留更多蓝图细节，适合作为后续需求拆解和架构演进参考。
- `docs/status/` 继续作为阶段性实现记录，不作为主要产品入口。
