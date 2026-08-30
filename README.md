# Agent Workbench

Agent Workbench 是一个本地优先的 Agent Session 工作台。用户从一个目标开始，在同一条会话流中查看运行事件、工具调用、审批和产物；Agent、Skills、Workflow、知识库与连接器作为能力配置收纳在 Settings 中。

它的目标不是再造一个单体 Agent，而是提供一个可视化控制台：用户在页面中编排任务、绑定工具和知识、处理高风险动作审批，并把运行事件、工作流、产物和版本沉淀为可追踪资产。

## 核心体验

- Sessions：左侧选择 Workspace 与历史 Session，中间持续处理目标。
- Execution stream：消息、Runtime、CLI/MCP、Capability 与审批共享一条运行轨道。
- Details：右侧集中查看 Run、Produced Files 和 Context。
- Settings：统一管理 Agent presets、Capabilities、Knowledge、Workflows、Models 与 Permissions。

## 构建并运行 Web

Node server 会自动初始化 SQLite，同时提供 API、SSE 和构建后的前端资源：

```bash
pnpm install
pnpm build
pnpm web
```

默认会打开：

```text
http://127.0.0.1:8787
```

模型连接通过 Settings 配置，支持实现 OpenAI Chat Completions 协议的云端或本地服务。启动后在“设置 → 模型连接”填写连接名称、Base URL、默认模型和 API Key；本地无鉴权服务可打开“此服务无需 API Key”。密钥保存在权限受限的本地凭据文件中，不写入 SQLite，也不会通过设置接口返回。

使用 `pnpm web --no-open` 可只启动服务，`--port 8080` 可修改端口。开发时仍可分别运行 `pnpm api` 与 `pnpm dev` 使用 Vite HMR。

## 常用命令

```bash
pnpm db:init      # 初始化本地 SQLite schema
pnpm db:reset     # 删除本地 SQLite 数据并按当前 schema 重建
pnpm api          # 启动本地 API
pnpm dev          # 启动前端开发服务
pnpm lint         # TypeScript 类型检查
pnpm build        # 构建前端
pnpm web          # 运行构建后的 Web 并打开浏览器
pnpm start        # 运行 Web 但不打开浏览器
pnpm package      # 构建并打包本地 release
```

## 项目结构

```text
agent-workbench/
  docs/            产品、需求、设计、架构和技术文档
  plugins/         Workflow Plugin 示例
  scripts/         本地打包脚本
  server/          本地 API、SQLite、SSE 和静态服务
    application.mjs 应用依赖装配与 API composition
    connectors/    可注册 CLI / MCP providers
    db/            SQLite schema 与 prepared statements
    harness/       Capability、Event Bus 与 Policy pipeline
    plugins/       Runtime 与 Catalog capability providers
    repositories/  SQLite row mappers
    services/      Run Event、Approval 与 Artifact 服务
    transport/     HTTP body、CORS response 与静态文件传输
  skills/          Skill 示例
  src/             React + Ant Design 前端
    app/           Session / Composer / Details 应用壳
    domain/        Workbench 领域模型
    features/      可独立测试的 Workflow 领域算法
```

## 文档

- [文档目录](docs/README.md)
- [产品概览](docs/product/product-brief.md)
- [需求说明](docs/product/requirements.md)
- [完整 PRD](docs/product/prd.md)
- [当前架构概览](docs/architecture/architecture-summary.md)
- [Harness 重构说明](docs/architecture/harness-refactor.md)
- [设计文档](docs/design/design-brief.md)
- [后端 API](docs/technical/backend-api.md)

## 安全边界

- 当前定位是本地单用户工作台，不包含远程登录、多租户和服务端会话。
- 低风险 CLI 会真实执行，请只登记可信命令。
- 中高风险 MCP / CLI 调用会进入审批队列。
- 模型连接的 API Key 保存在本地受限凭据文件中，不写入 SQLite。
- Web 不再维护浏览器静态副本；连接失败时会明确提示启动 `pnpm web`，避免产生两套状态。

## Harness 扩展

后端通过轻量 Harness 注册 Capability。Runtime adapter 发现、Skill 扫描与 Workflow Plugin 扫描均已从单体服务器迁入 provider；Connector 使用可注册 provider registry，CLI/MCP 共用 Capability → Policy → Approval 管线，并支持审批后恢复执行。`server/index.mjs` 仅保留启动入口，`GET /api/extensions` 可查看当前 Capability 和 Runtime adapter 清单。
