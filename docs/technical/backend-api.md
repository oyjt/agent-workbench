# Workbench API 与 SQLite

本地后端用于支撑任务、运行事件、Agent、Agent Team、知识库、MCP / CLI 连接器、审批、Artifact、Workflow 和本地插件扫描。它使用 Node.js 内置 `node:sqlite`，不依赖外部数据库服务。`server/index.mjs` 是最小启动入口，依赖装配位于 `server/application.mjs`；Capability、Policy、provider、服务、数据库和 transport 均有独立模块边界。

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
- `pending_capability_executions`
- `artifacts`
- `artifact_versions`
- `workflows`
- `secrets`

## 核心端点

### Health

- `GET /api/health`

### Harness Extensions

- `GET /api/extensions`

返回当前已注册 Capability（不暴露执行函数）和 Runtime Adapter 清单，用于运行时诊断与扩展观测。

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

Connector 由 `ConnectorProviderRegistry` 按注册顺序解析。目前内置 CLI、MCP stdio 和 MCP HTTP provider；新增 provider 不需要修改中心执行 switch。所有 invoke 均先注册为 Capability，并共用 Harness Policy pipeline。

低风险 CLI 会通过 `spawnSync` 在项目根目录执行命令，并把 stdout / stderr 摘要写入事件。中高风险 MCP / CLI 调用不会直接执行，而是创建 `approvals` 与 `pending_capability_executions` 记录并返回 `approval_required`。

MCP stdio 连接器支持最小 JSON-RPC client：

- `initialize`
- `notifications/initialized`
- `tools/list`
- `tools/call`

未传 `toolName` 时，试运行默认执行 `tools/list`；传入 `toolName` 与 `toolArgs` 时执行 `tools/call`。HTTP MCP endpoint 当前只登记和标记，不直接发起远程调用。

### Approvals

- `GET /api/approvals`
- `GET /api/approvals?status=pending`
- `POST /api/approvals/:approvalId/respond`

审批决策支持 `allow_once`、`allow_session` 和 `deny`。拒绝后任务进入 `paused`；允许后服务读取持久化的待执行 Capability，以一次性 `approvalGranted` 上下文重新进入 Policy pipeline，执行原 CLI/MCP provider，并把结果或错误写回 `pending_capability_executions`。响应中的 `execution` 字段包含恢复执行结果。

### Skills / Workflow Plugins

- `GET /api/skills/scan`
- `GET /api/plugins/scan`

扫描规则：

- `skills/*/SKILL.md` 解析 `name`、`description`、`permissions`、`risk`
- `plugins/*/plugin.json` 与 `plugins/*/SKILL.md` 组合为 Workflow Plugin 元数据
- Plugin manifest 支持 `skills`、`mcpTools`、`cliCommands`、`knowledgeScopes`、`capabilities`、`pipeline`

### Artifacts

- `GET /api/artifacts`
- `POST /api/artifacts`
- `GET /api/artifacts/:artifactId/content`
- `GET /api/artifacts/:artifactId/versions`
- `POST /api/artifacts/:artifactId/versions`

任务启动后会把 Codex diff 或内容草稿登记为 Artifact。带 `content` 字段创建 Artifact 时，后端会把内容写入 `.agent-workbench/artifacts`，并创建 `artifact_versions` 首版记录。后续版本通过 `POST /api/artifacts/:artifactId/versions` 追加。

### Workflows

- `GET /api/workflows`
- `POST /api/workflows`
- `GET /api/workflows/:workflowId/yaml`
- `POST /api/workflows/import`
- `POST /api/workflows/:workflowId/run`

工作流保存 `name`、`description`、`provider`、`concurrency`、`tags` 和 `steps`，用于把前端 DAG 草案持久化。YAML 端点使用 Agent Workbench 自有的简单 YAML 格式，适合导入导出和版本管理。

运行工作流时支持：

- 完整 DAG 执行
- `fromStepId` 指定步骤重跑
- `feedback` 返工说明注入

每次运行会创建一个 workflow task、run events 和 workflow artifact。

### Secrets

- `GET /api/secrets`
- `POST /api/secrets`
- `DELETE /api/secrets/:secretId`

Secret 管理只保存环境变量引用，例如 `OPENAI_API_KEY`，返回 `available` / `missing` 状态和脱敏预览，不保存真实密钥明文。

## 生产静态服务

执行 `pnpm build` 后运行 `pnpm web`。该命令检查 `dist`、启动同一个 Node server 提供 API 与静态文件，并默认打开浏览器：

```text
http://127.0.0.1:8787
```

这也是 GitHub Actions 打包产物的运行方式。

可选参数：`pnpm web --no-open`、`pnpm web --port 8080`、`pnpm web --host 0.0.0.0`。`pnpm start` 等价于不自动打开浏览器的 Web 服务。

## 当前边界

- Runtime Adapter 是简化实现：用于验证任务状态、事件、审批、Artifact 和 Workflow 闭环，还不是完整模型执行器。
- MCP stdio 已支持最小协议调用；HTTP MCP endpoint 当前只登记，不执行远程调用。
- Artifact 已落库并写入本地版本目录，尚未实现全文检索、引用图谱和外部对象存储。
- Workflow 已支持 YAML、DAG 执行、指定 step 重跑和 feedback 返工；尚未实现真实并发调度和长任务队列。
- 当前是本地单用户工作台，Secret 以环境变量引用方式管理，不提供远程登录和多租户会话。
- `node:sqlite` 在当前 Node 版本仍属于实验能力，脚本里已隐藏 ExperimentalWarning。
