# P0 完成清单

## 已完成

- Workbench API：本地 HTTP API、SQLite 初始化、健康检查。
- 任务中心：任务创建、列表、状态更新、启动运行。
- 运行事件：事件落库、历史事件读取、SSE 实时订阅、前端运行面板展示。
- Runtime Adapter：按任务 runtime 生成简化执行事件，Codex 类任务写入 diff 摘要事件。
- 审批：创建审批、待审批列表、允许或拒绝决策、任务状态联动。
- Agents：创建、列表、状态字段、skill / knowledge / permission 元数据。
- Agent Teams：创建、列表、串行成员顺序、作为任务目标启动。
- 团队知识库：知识条目创建、类型、标签、团队或项目可见范围。
- MCP / CLI 连接器：注册、自检、低风险 CLI 执行、中高风险调用转审批。
- Skills：扫描 `skills/*/SKILL.md`，展示权限与风险。
- Workflow Plugins：扫描 `plugins/*/plugin.json` 与 `SKILL.md`，展示 pipeline、skills、MCP、CLI 和 capability gate。
- 前端管理台：Ant Design 风格的工作台、Agents、Skills、插件、知识库、连接器、工作流、资产和设置页面。

## 已验证

```bash
pnpm db:init
pnpm lint
pnpm build
```

本机 API 验证覆盖：

- `GET /api/health`
- `GET /api/skills/scan`
- `GET /api/plugins/scan`
- 创建 Agent、Agent Team、Task
- 启动 Agent Team 任务并读取运行事件
- 低风险 CLI 调用真实执行
- 高风险 CLI 调用不会执行命令，会创建审批
- SSE 能收到历史事件和新增事件广播

## P0 边界

- 当前 Runtime Adapter 是可验证闭环，不是完整的模型执行调度器。
- MCP 调用是模拟结果，后续 P1 再接真实 MCP client。
- Artifact Studio 在 P0 仍是前端预览；P1 已补充 artifact 持久化，见 `p1-status.md`。
- Workflow DAG 在 P0 已有前端模型和预览；P1 已补充工作流持久化，导入导出和从步骤重跑仍待后续实现。
- Secret 管理、用户体系、权限隔离、远程部署不在 P0。
