# 架构方案

## 总体结构

```text
React / Ant Design feature modules
        │ HTTP + SSE
        ▼
server/index.mjs (startup)
        │
        ▼
application composition
  ├─ Harness capability registry + event bus
  ├─ Policy / Approval pipeline
  ├─ Runtime and Catalog plugins
  ├─ Connector provider registry (CLI / MCP)
  ├─ Domain services + repositories
  └─ HTTP / SSE / static transport
        │
        ▼
SQLite + Artifact filesystem
```

Agent Workbench 采用前后端轻量分层和可组合 Harness。前端是 Session-first 三栏工作台；后端通过 Capability Registry 组合 Runtime、Catalog 与 Connector provider，并在执行 provider 前统一经过 Policy 与 Approval。SQLite/SSE 事件是运行控制台、回放和审计的共同事实源。

## 前端模块

- Session rail：Workspace、Session 搜索与历史列表。
- Composer：目标输入、Agent preset 和访问策略选择。
- Execution stream：用户消息、Run Event、Tool Call 与 Approval 内联展示。
- Details：Run 状态、Produced Files 与当前 Context。
- Settings：Agents、Capabilities、Knowledge、Workflows、Models/Secrets 与 Permissions 的渐进式配置入口。

## 后端模块

- Composition root：`server/index.mjs` 只启动 `server/application.mjs`，后者负责装配依赖。
- Harness：Capability Registry、Event Bus、Plugin lifecycle 与 Policy pipeline。
- Plugins：Runtime discovery 和 Skill/Workflow Plugin catalog scan。
- Connector Provider Registry：按 provider 注册 CLI、MCP stdio 和 MCP HTTP，实现层无中心 switch。
- Services：Run Event、Approval、Artifact 等领域服务。
- Repository / DB：schema、prepared statements 和 row mapper 分离；保存任务、运行、事件、Agent、Team、知识、连接器、审批、待执行 Capability、Artifact、Workflow 和 Secret 引用。
- Transport：REST、SSE、CORS、请求体解析和生产静态文件。

## 数据边界

- SQLite 数据默认写入 `.agent-workbench/data/workbench.sqlite`。
- Artifact 内容默认写入 `.agent-workbench/artifacts`。
- Secret 只保存环境变量名、作用域和状态。
- 待审批调用保存在 `pending_capability_executions`，批准后可恢复原 Capability。
- 前端只使用本地 API，不维护 IndexedDB/localStorage 业务副本。

## 执行边界

- 低风险 CLI 可真实执行。
- 中高风险 MCP / CLI 调用需要审批。
- 审批通过后以一次性授权上下文重新进入同一 Policy pipeline，再执行原 provider。
- MCP stdio 当前支持 `initialize`、`tools/list` 和 `tools/call`。
- HTTP MCP endpoint 当前只登记，不直接调用。
- Workflow DAG 当前按 layer 顺序执行，真实并发 worker 可后续扩展。

## 后续扩展点

- 增加真实 Codex CLI、OpenCode、BrowserOps 或本地模型 Runtime provider。
- 完成 Agent/Team/Workflow step 的 Capability Scope 与 Profile/Loadout。
- Connector allowlist、参数 schema、超时、并发和审计查询。
- Artifact 全文检索、引用图谱和外部对象存储。
- 多用户登录、团队空间和远程权限后端。
- 更完整的 Workflow step 状态和长任务恢复机制。
