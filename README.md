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

- 工作台任务队列、任务详情、运行事件和状态操作
- 新建任务表单，支持 Agent、Agent Team、Workflow Plugin 三类目标
- 审批队列与 capability gate 记录，支持允许或拒绝
- Agent 创建抽屉，包含 runtime、模型、skills、知识范围和权限策略
- 团队知识库新增草稿，支持类型、标签和可见范围
- MCP / CLI 连接器注册，支持风险等级和默认绑定 Agent
- Workflow Plugin 启动前能力确认，并生成待审批任务
- 工作流页支持一句话自动编排、DAG 预览、模板套用、团队 Loadout 和返工入口
- Artifact Studio 基础预览与 manifest 信息展示

## 调研记录

- [agency-orchestrator 调研与应用记录](docs/research/agency-orchestrator-analysis.md)

## 本地运行

```bash
pnpm install
pnpm dev
```

## 验证

```bash
pnpm lint
pnpm build
```
