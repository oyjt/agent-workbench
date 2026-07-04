# Agent Workbench

本项目是通用 Agent 工作台的首版代码工程，基于前期产品蓝图启动编码。

## 技术栈

- Vite
- React
- TypeScript
- Ant Design

## MVP 范围

- 任务工作台
- Agent / Runtime 概览
- Workflow Plugin 授权入口
- 团队知识库
- MCP / CLI 连接器
- Creative Studio 产物预览

## 当前已实现

- 本地 Workbench API，使用 SQLite 持久化 task / run / event
- 工作台任务队列、任务详情、真实 SSE 运行事件和状态操作
- 新建任务表单，支持 Agent、Agent Team、Workflow Plugin 三类目标
- 审批队列与 capability gate 记录，支持允许或拒绝
- Agent 创建抽屉，包含 runtime、模型、skills、知识范围和权限策略
- Agent Team 创建与展示，支持串行成员顺序，并可作为任务运行目标
- 团队知识库新增草稿，支持类型、标签和可见范围
- MCP / CLI 连接器注册、自检和试运行，非低风险调用进入审批队列
- 本地 Skills 与 Workflow Plugins 扫描，展示权限、风险、pipeline、MCP 与 CLI 绑定
- Workflow Plugin 启动前能力确认，并生成待审批任务
- 工作流页支持一句话自动编排、DAG 预览、模板套用、团队 Loadout 和返工入口
- Artifact Studio 基础预览与 manifest 信息展示
- 简化 Runtime Adapter，可模拟 Codex / OpenCode / BrowserOps 执行并写入事件
- 低风险 CLI 连接器可真实执行命令，高风险 MCP / CLI 调用会创建审批

## 调研记录

- [agency-orchestrator 调研与应用记录](docs/research/agency-orchestrator-analysis.md)
- [Workbench API 与 SQLite 说明](docs/backend-api.md)
- [P0 完成清单](docs/p0-status.md)

## 本地运行

```bash
pnpm install
pnpm api
pnpm dev
```

默认 API 地址为 `http://127.0.0.1:8787`，Vite 会把 `/api` 代理到该地址。
SQLite 数据文件默认位于 `.agent-workbench/data/workbench.sqlite`，该目录不会进入 Git。

## 验证

```bash
pnpm db:init
pnpm lint
pnpm build
```
