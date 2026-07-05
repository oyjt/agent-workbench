# 架构方案

## 总体结构

```text
React / Ant Design UI
        |
        | HTTP + SSE
        v
Node.js Workbench API
        |
        | node:sqlite + filesystem
        v
Local Workspace Data
```

Agent Workbench 采用前后端轻量分层。前端负责可视化配置、状态呈现和静态本地模式；后端负责 SQLite 持久化、SSE 事件、CLI/MCP 调用、Artifact 文件写入和静态生产服务。

## 前端模块

- Overview：任务中心和运行事件。
- Agents：Agent 与 Agent Team 管理。
- Skills：本地 Skill 扫描结果。
- Plugins：Workflow Plugin 扫描和 capability gate。
- Knowledge：团队知识库。
- Connectors：MCP / CLI 连接器管理。
- Workflows：DAG 编排、YAML 导入导出、重跑和返工。
- Assets：Artifact 查看、版本和导出。
- Settings：Secret 引用和本地权限策略。

## 后端模块

- API Router：基于 Node.js HTTP server 实现 REST API。
- SQLite Store：保存任务、运行、事件、Agent、Team、知识、连接器、审批、Artifact、Workflow 和 Secret 引用。
- Event Bus：写入事件并通过 SSE 广播。
- Runtime Adapter：当前提供本地可验证执行闭环，后续可替换为真实模型或 CLI provider。
- Connector Runner：执行低风险 CLI，并支持 MCP stdio 最小 JSON-RPC。
- Artifact Store：把产物内容写入 `.agent-workbench/artifacts` 并记录版本。
- Static Server：生产模式下提供 `dist`。

## 数据边界

- SQLite 数据默认写入 `.agent-workbench/data/workbench.sqlite`。
- Artifact 内容默认写入 `.agent-workbench/artifacts`。
- Secret 只保存环境变量名、作用域和状态。
- 浏览器静态模式优先使用 IndexedDB，并保留 `localStorage` 兜底。

## 执行边界

- 低风险 CLI 可真实执行。
- 中高风险 MCP / CLI 调用需要审批。
- MCP stdio 当前支持 `initialize`、`tools/list` 和 `tools/call`。
- HTTP MCP endpoint 当前只登记，不直接调用。
- Workflow DAG 当前按 layer 顺序执行，真实并发 worker 可后续扩展。

## 后续扩展点

- Runtime Adapter 插件化，接入 Codex CLI、OpenCode、BrowserOps 或本地模型。
- Connector allowlist、参数 schema、超时、并发和审计查询。
- Artifact 全文检索、引用图谱和外部对象存储。
- 多用户登录、团队空间和远程权限后端。
- 更完整的 Workflow step 状态和长任务恢复机制。
