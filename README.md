# Agent Workbench

Agent Workbench 是一个本地优先的通用 Agent 工作台，用来管理自媒体、编码、运营等场景中的任务、Agent Team、Skills、Workflow Plugins、团队知识库、MCP / CLI 连接器、审批和产物。

它的目标不是再造一个单体 Agent，而是提供一个可视化控制台：用户在页面中编排任务、绑定工具和知识、处理高风险动作审批，并把运行事件、工作流、产物和版本沉淀为可追踪资产。

## 核心能力

- 任务中心：创建任务、查看运行事件、流转任务状态。
- Agent / Team：配置 Agent 元数据，按顺序组织多 Agent 协作。
- Skills / Plugins：扫描本地 Skill 与 Workflow Plugin，展示能力、权限和风险。
- 知识库：管理 SOP、品牌、平台规则、决策和代码文档。
- MCP / CLI：登记连接器，低风险命令可执行，中高风险动作进入审批。
- Workflow：生成和保存 DAG 计划，支持 YAML 导入导出、指定 step 重跑和 feedback 返工。
- Artifact：登记、查看、下载和版本化交付物。
- Secret：只保存环境变量引用，不保存真实密钥明文。

## 运行模式

### 本地 API 模式

适合开发和真实本机使用。Node server 提供 API、SSE 和前端静态文件，数据写入本地 SQLite。

```bash
pnpm install
pnpm db:init
pnpm api
pnpm dev
```

开发地址：

```text
http://127.0.0.1:5173
```

API 默认地址：

```text
http://127.0.0.1:8787
```

### 静态本地模式

当前端无法连接 API 时会自动进入 `Static Local`。数据优先保存到浏览器 IndexedDB，并用 `localStorage` 作为兼容兜底。该模式适合演示、轻量个人工作台和离线原型，但不能直接执行本机 CLI、访问 SQLite 或运行 MCP stdio server。

## 常用命令

```bash
pnpm db:init      # 初始化本地 SQLite schema
pnpm api          # 启动本地 API
pnpm dev          # 启动前端开发服务
pnpm lint         # TypeScript 类型检查
pnpm build        # 构建前端
pnpm start        # 生产模式运行 API + dist
pnpm package      # 构建并打包本地 release
```

## 项目结构

```text
agent-workbench/
  docs/            产品、需求、设计、架构和技术文档
  plugins/         Workflow Plugin 示例
  scripts/         本地打包脚本
  server/          本地 API、SQLite、SSE 和静态服务
  skills/          Skill 示例
  src/             React + Ant Design 前端
```

## 文档

- [文档目录](docs/README.md)
- [产品概览](docs/product/product-brief.md)
- [需求说明](docs/product/requirements.md)
- [完整 PRD](docs/product/prd.md)
- [架构文档](docs/architecture/architecture.md)
- [设计文档](docs/design/design-brief.md)
- [后端 API](docs/technical/backend-api.md)

## 安全边界

- 当前定位是本地单用户工作台，不包含远程登录、多租户和服务端会话。
- 低风险 CLI 会真实执行，请只登记可信命令。
- 中高风险 MCP / CLI 调用会进入审批队列。
- Secret 管理只登记环境变量名，不保存真实密钥。
- 静态本地模式的数据保存在当前浏览器，清缓存或换浏览器前请先导出工作区 JSON。
