# Workbench API 与 SQLite

本地后端用于支撑 P0 的任务、运行事件、Agent、Agent Team、知识库、MCP / CLI 连接器、审批和本地插件扫描。它使用 Node.js 内置 `node:sqlite`，不依赖外部数据库服务。

## 运行

```bash
pnpm api
```

默认监听：

```text
http://127.0.0.1:8787
```

默认数据库：

```text
.agent-workbench/data/workbench.sqlite
```

## 初始化

```bash
pnpm db:init
```

会创建这些表：

- `tasks`
- `runs`
- `events`
- `agents`
- `agent_teams`
- `agent_team_members`
- `knowledge_items`
- `connectors`
- `approvals`

## 核心端点

### Health

- `GET /api/health`

### Tasks / Runs / Events

- `GET /api/tasks`
- `POST /api/tasks`
- `POST /api/tasks/:taskId/status`
- `POST /api/tasks/:taskId/start`
- `GET /api/runs/:runId/events`
- `GET /api/runs/:runId/events.json`
- `POST /api/runs/:runId/events`

`GET /api/runs/:runId/events` 返回 SSE 事件流。创建、追加或启动任务时，事件会写入 SQLite 并广播给在线订阅者。

创建任务示例：

```json
{
  "title": "公众号周更：AI Agent 工作流",
  "prompt": "生成正文草稿、封面 brief 和发布包",
  "targetType": "agent_team",
  "targetId": "team_content_ops",
  "owner": "内容团队",
  "runtime": "BrowserOps",
  "priority": "normal",
  "requiresApproval": true
}
```

### Agents / Agent Teams

- `GET /api/agents`
- `POST /api/agents`
- `POST /api/agents/:agentId/status`
- `GET /api/agent-teams`
- `POST /api/agent-teams`

Agent Team 当前使用串行执行模型：`startTask` 会按 `agent_team_members.member_order` 写入 `agent.started`、`message.delta`、`agent.completed` 和 `team.completed` 事件。

### Knowledge

- `GET /api/knowledge-items`
- `POST /api/knowledge-items`

知识条目支持类型、标签、可见范围和状态字段，用于后续接入检索与引用治理。

### MCP / CLI Connectors

- `GET /api/connectors`
- `POST /api/connectors`
- `POST /api/connectors/:connectorId/check`
- `POST /api/connectors/:connectorId/invoke`

低风险 CLI 会通过 `spawnSync` 在项目根目录执行命令，并把 stdout / stderr 摘要写入事件。中高风险 MCP / CLI 调用不会直接执行，而是创建 `approval` 记录并返回 `approval_required`。

### Approvals

- `GET /api/approvals`
- `GET /api/approvals?status=pending`
- `POST /api/approvals/:approvalId/respond`

审批决策支持 `allow_once`、`allow_session` 和 `deny`。允许后任务状态进入 `running`，拒绝后进入 `paused`。

### Skills / Workflow Plugins

- `GET /api/skills/scan`
- `GET /api/plugins/scan`

扫描规则：

- `skills/*/SKILL.md` 解析 `name`、`description`、`permissions`、`risk`
- `plugins/*/plugin.json` 与 `plugins/*/SKILL.md` 组合为 Workflow Plugin 元数据
- Plugin manifest 支持 `skills`、`mcpTools`、`cliCommands`、`knowledgeScopes`、`capabilities`、`pipeline`

## 当前边界

- Runtime Adapter 是 P0 简化实现：用于验证任务状态、事件、审批和串行团队执行闭环，还不是完整模型执行器。
- MCP 调用当前是模拟 health-call；CLI 低风险命令可真实执行。
- Artifact Studio 当前是前端预览，尚未落库为 artifact 表。
- `node:sqlite` 在当前 Node 版本仍属于实验能力，脚本里已隐藏 ExperimentalWarning。
