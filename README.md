# Agent Workbench

Agent Workbench 是一个本地优先的通用 Agent 工作台，用来统一管理自媒体、编码、运营等场景里的任务、Agent、Agent Team、Skills、Workflow Plugins、团队知识库、MCP / CLI 连接器、审批和产物。

项目目标不是再造一个单体 Agent，而是做一个可视化控制台：用户在页面里创建任务、配置团队、绑定工具和知识，后端把任务、运行事件、审批、工作流和产物写入 SQLite，后续可以逐步接入真实 Runtime、MCP client 和发布渠道。

## 当前状态

- P0 已完成：任务中心、SSE 运行事件、Agent CRUD、Agent Team 串行执行、知识库、MCP / CLI 连接器、审批、Skill 扫描、Workflow Plugin 扫描。
- P1 已启动并完成第一批闭环：Artifact 持久化、Workflow 持久化、生产静态服务、自动打包、GitHub Actions 构建与 smoke test。
- 当前实现适合本地迭代和产品验证，Runtime Adapter 与 MCP client 仍是简化版本。

## 技术栈

- Vite 8
- React 19
- TypeScript 6
- Ant Design 6
- Node.js HTTP server
- Node.js `node:sqlite`
- pnpm 9

## 核心功能

### 工作台

- 任务列表、任务详情、状态流转。
- 任务可指向单 Agent、Agent Team 或 Workflow Plugin。
- 运行事件通过 SSE 实时展示。
- 支持追加测试事件，验证 event / SSE 链路。

### Agents 与 Agent Teams

- 创建 Agent：runtime、模型、系统提示词、skills、知识范围、权限策略。
- 创建 Agent Team：选择成员并按顺序串行执行。
- Agent Team 可作为任务目标，启动后写入 `team.started`、`agent.started`、`agent.completed`、`team.completed` 等事件。

### Skills 与 Workflow Plugins

- 扫描 `skills/*/SKILL.md`，读取名称、说明、权限和风险等级。
- 扫描 `plugins/*/plugin.json` 与 `SKILL.md`，读取 pipeline、skills、MCP tools、CLI commands、knowledge scopes 和 capabilities。
- 插件启动前会生成 capability gate 审批。

### 知识库

- 新增团队或项目知识。
- 支持 SOP、品牌、平台规则、决策、代码文档等类型。
- 支持标签和可见范围，为后续检索引用做准备。

### MCP / CLI 连接器

- 注册 MCP Server 或 CLI Command。
- 支持自检和试运行。
- 低风险 CLI 可真实执行。
- 中高风险 MCP / CLI 调用会进入审批队列，不会直接执行。

### 审批

- 统一展示待审批能力调用。
- 支持允许本次或拒绝。
- 审批结果会联动任务状态，并写入运行事件。

### Workflow

- 一句话生成工作流草案。
- DAG layer 预览。
- 内置工作流模板。
- 保存工作流到 SQLite。
- 已保存工作流可重新打开。

### Artifact Studio / 资产库

- Runtime 会登记 Codex diff 或内容草稿 artifact。
- 资产库从 SQLite 读取 artifacts。
- 支持手动登记交付物。
- 当前保存的是 artifact manifest，文件内容写入和版本管理属于后续 P2。

## 项目结构

```text
agent-workbench/
  .github/workflows/        GitHub Actions 自动构建与打包
  docs/                     调研、API、P0/P1 状态文档
  plugins/                  Workflow Plugin 示例
  scripts/                  打包脚本
  server/                   本地 API、SQLite、SSE、生产静态服务
  skills/                   Skill 示例
  src/                      React + Ant Design 前端
  package.json              脚本与依赖
  vite.config.ts            Vite dev server 与 /api 代理
```

## 本地开发

安装依赖：

```bash
pnpm install
```

初始化 SQLite schema：

```bash
pnpm db:init
```

启动 API：

```bash
pnpm api
```

另开一个终端启动前端：

```bash
pnpm dev
```

开发地址：

```text
http://127.0.0.1:5173
```

Vite 会把 `/api` 代理到：

```text
http://127.0.0.1:8787
```

SQLite 默认位置：

```text
.agent-workbench/data/workbench.sqlite
```

`.agent-workbench` 已被 `.gitignore` 忽略，不会进入 Git。

## 生产运行

构建前端：

```bash
pnpm build
```

启动生产 server：

```bash
pnpm start
```

生产模式下，同一个 Node server 会同时提供：

- API：`http://127.0.0.1:8787/api/health`
- 前端页面：`http://127.0.0.1:8787`

可配置环境变量：

```bash
AGENT_WORKBENCH_API_HOST=127.0.0.1
AGENT_WORKBENCH_API_PORT=8787
AGENT_WORKBENCH_DATA_DIR=.agent-workbench/data
```

## 打包

生成可上传或分发的压缩包：

```bash
pnpm package
```

产物位置：

```text
.agent-workbench/release/agent-workbench-0.1.0.tgz
```

压缩包包含：

- `dist`
- `server`
- `package.json`
- `pnpm-lock.yaml`
- `README.md`
- `docs`
- `skills`
- `plugins`

解压后可以直接运行生产 server：

```bash
tar -xzf agent-workbench-0.1.0.tgz
pnpm start
```

## GitHub 自动打包运行

已配置 GitHub Actions：

```text
.github/workflows/build-and-package.yml
```

触发条件：

- push 到 `main`
- pull request
- 手动 `workflow_dispatch`

Workflow 会执行：

1. Checkout 代码。
2. 安装 pnpm 与 Node.js 24。
3. `pnpm install --frozen-lockfile`。
4. `pnpm db:init` 初始化 SQLite schema。
5. `pnpm lint` 类型检查。
6. `pnpm build` 构建前端。
7. `pnpm package` 生成 `.tgz`。
8. `pnpm start` 启动生产 server。
9. `curl /api/health` 和 `/` 做 smoke test。
10. 上传 `agent-workbench-package` artifact。

## 常用命令

```bash
pnpm db:init      # 初始化本地 SQLite schema
pnpm api          # 仅启动 API
pnpm dev          # 启动 Vite 开发服务
pnpm lint         # TypeScript 类型检查
pnpm build        # 构建前端
pnpm start        # 生产模式运行 API + dist
pnpm package      # 构建并打包 release tgz
```

## API 文档

详见 [docs/backend-api.md](docs/backend-api.md)。

核心资源：

- `tasks`
- `runs`
- `events`
- `agents`
- `agent_teams`
- `knowledge_items`
- `connectors`
- `approvals`
- `artifacts`
- `workflows`

## 调研与状态文档

- [agency-orchestrator 调研与应用记录](docs/research/agency-orchestrator-analysis.md)
- [Workbench API 与 SQLite 说明](docs/backend-api.md)
- [P0 完成清单](docs/p0-status.md)
- [P1 完成清单](docs/p1-status.md)

## 安全边界

- 低风险 CLI 会真实执行，请只注册可信命令。
- 中高风险连接器会进入审批队列。
- 当前没有用户体系和多租户权限隔离。
- 当前没有 Secret 管理，不要把真实密钥写入仓库或 SQLite。
- MCP 调用仍是模拟 health-call，真实 MCP client 属于后续阶段。

## 后续路线

### P1 后续

- Artifact 文件内容写入 `.agent-workbench/artifacts` 并做版本管理。
- Workflow YAML 导入导出。
- 从指定 step 重跑与 feedback 返工。
- 更细的 connector allowlist。

### P2

- 真实 MCP client。
- Runtime Adapter 插件化。
- Secret 管理。
- 用户与团队权限。
- Artifact 检索、引用和导出。
- GitHub Release 自动发布。
