# Agent Workbench

Agent Workbench 是一个本地优先的通用 Agent 工作台，用来统一管理自媒体、编码、运营等场景里的任务、Agent、Agent Team、Skills、Workflow Plugins、团队知识库、MCP / CLI 连接器、审批和产物。

项目目标不是再造一个单体 Agent，而是做一个可视化控制台：用户在页面里创建任务、配置团队、绑定工具和知识，后端把任务、运行事件、审批、工作流、产物版本和 Secret 引用写入 SQLite，并能在浏览器静态模式下保存离线工作区。

## 当前状态

- P0 已完成：任务中心、SSE 运行事件、Agent CRUD、Agent Team 串行执行、知识库、MCP / CLI 连接器、审批、Skill 扫描、Workflow Plugin 扫描。
- P1 已启动并完成第一批闭环：Artifact 持久化、Workflow 持久化、浏览器本地静态模式、生产静态服务、自动打包、GitHub Actions 构建与 smoke test、GitHub Pages 静态部署。
- P2 已补齐最小可运行闭环：Artifact 文件内容和版本、IndexedDB 离线工作区、Workflow YAML 导入导出、DAG 执行、从指定 step 重跑、feedback 返工、MCP stdio 最小 client、Secret 引用管理和本地团队权限策略。
- 当前实现适合本地迭代、纯静态 Demo 和单用户本地使用；完整多用户登录、远程队列和生产级模型 Runtime 仍属于后续扩展。

## 技术栈

- Vite 8
- React 19
- TypeScript 6
- Ant Design 6
- Node.js HTTP server
- Node.js `node:sqlite`
- pnpm 9

## 运行模式

### Static Local Mode

纯静态模式适合 GitHub Pages、在线 Demo 和轻量个人工作台：

- 前端完全静态托管。
- API 不可用时自动切换到 `Static Local`。
- 数据优先保存到浏览器 IndexedDB，并用 `localStorage` 作为兼容兜底。
- 支持任务、Agent、Agent Team、知识库、连接器、审批、Artifact、Workflow、Secret 引用的本地增删与模拟运行。
- 支持 Workflow YAML 导入导出、DAG 模拟执行、从 step 重跑、feedback 返工和 Artifact 版本。
- 支持导出/导入工作区 JSON。

静态模式不能直接执行真实 CLI、访问本机 SQLite、扫描本地目录或运行 MCP stdio server。

### SQLite API Mode

完整本地模式适合真实使用和开发：

- Node server 提供 API、SSE 和 `dist` 静态文件。
- 数据保存到 `.agent-workbench/data/workbench.sqlite`。
- 支持低风险 CLI 真实执行。
- 支持 MCP stdio server 的 `initialize`、`tools/list` 和 `tools/call` 最小调用。
- 支持 Artifact 文件写入 `.agent-workbench/artifacts` 并记录版本。
- 支持 Workflow YAML 导入导出、DAG 执行、从指定 step 重跑和 feedback 返工。
- 支持 Secret 环境变量引用登记，不保存真实密钥明文。

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
- MCP stdio 支持最小 JSON-RPC client，可执行 `tools/list`，传入 tool 名称时可执行 `tools/call`。
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
- 支持导入/导出 Workflow YAML。
- 支持完整运行、从指定 step 重跑和带 feedback 返工。
- 每次运行会生成 Workflow Artifact 并写入运行事件。

### Artifact Studio / 资产库

- Runtime 会登记 Codex diff 或内容草稿 artifact。
- 资产库从 SQLite 读取 artifacts。
- 支持手动登记交付物。
- Artifact 内容会写入 `.agent-workbench/artifacts`。
- 支持查看内容、下载、登记新版本和批量导出 manifest。

### Secret 与权限

- Secret 管理只登记环境变量引用，例如 `OPENAI_API_KEY`，不在仓库或 SQLite 保存真实密钥明文。
- 设置页提供本地角色权限矩阵：Owner、Operator、Reviewer、Viewer。
- 中高风险连接器仍走统一审批队列。

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

## 纯静态运行

构建 GitHub Pages 版本：

```bash
pnpm build:pages
```

该命令会使用 `/agent-workbench/` 作为 Vite `base`，产物仍输出到 `dist`。

部署后访问：

```text
https://oyjt.github.io/agent-workbench/
```

GitHub 仓库的 Website 可以填写这个地址。页面会在无法连接 `/api` 时自动进入 `Static Local`，所有数据都保存在当前浏览器里。

首次使用 GitHub Pages 需要在仓库里启用一次：

1. 打开 `Settings -> Pages`。
2. 在 `Build and deployment` 中把 `Source` 设为 `GitHub Actions`。
3. 重新运行 `Deploy Static Pages` workflow，或向 `main` 再推送一次提交。

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

## GitHub Pages 静态部署

已配置 GitHub Pages workflow：

```text
.github/workflows/deploy-pages.yml
```

触发条件：

- push 到 `main`
- 手动 `workflow_dispatch`

Workflow 会执行：

1. 安装依赖。
2. `pnpm lint` 类型检查。
3. `pnpm build:pages` 构建纯静态版本。
4. `actions/configure-pages` 配置 Pages。
5. 上传 `dist` 并部署到 GitHub Pages。

Pages 地址：

```text
https://oyjt.github.io/agent-workbench/
```

## 常用命令

```bash
pnpm db:init      # 初始化本地 SQLite schema
pnpm api          # 仅启动 API
pnpm dev          # 启动 Vite 开发服务
pnpm lint         # TypeScript 类型检查
pnpm build        # 构建前端
pnpm build:pages  # 构建 GitHub Pages 静态版
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
- [P2 完成清单](docs/p2-status.md)

## 安全边界

- 低风险 CLI 会真实执行，请只注册可信命令。
- 中高风险连接器会进入审批队列。
- 当前是本地单用户工作台，不提供远程登录、多租户和服务端会话。
- Secret 管理登记的是环境变量名，不保存真实密钥值。
- MCP stdio 已支持最小协议调用；HTTP MCP endpoint 当前只登记和标记。
- Static Local Mode 的数据存在当前浏览器 IndexedDB，换浏览器或清缓存前请先导出工作区 JSON。

## 后续路线

- Runtime Adapter 插件化，接入真实 Codex / OpenCode / 浏览器自动化执行器。
- 更细粒度 connector allowlist、并发限制和审计查询。
- Artifact 全文检索、引用图谱和多格式导出。
- 远程多用户登录、团队空间和权限后端。
- GitHub Release 自动发布。
