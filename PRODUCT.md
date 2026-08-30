# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- 需要在本地管理内容生产、编码实现、运营分析和交付资产的个人或小团队。
- 自媒体运营者、开发者、运营或产品团队，以及验证多 Agent 编排和工具接入的 Agent 构建者。
- 主要用户优先级仍是开放决策；未来若收窄市场，不应仅凭当前示例推断唯一受众。

## Product Purpose

Agent Workbench 是本地优先的通用 Agent 工作台。用户从任务目标出发，在同一会话中配置执行角色和权限，观察运行事件与工具调用，处理高风险审批，并沉淀可追踪、可版本化的交付产物。

成功意味着用户无需理解底层执行器，也能在一个可视化控制台中完成任务创建、Agent 与团队配置、知识和工具绑定、审批、工作流运行及产物管理。

## Positioning

产品以“本地执行控制 + 显式风险审批 + 运行事件审计 + 产物版本化”为完整机制，而不是仅提供通用聊天界面或单一 Agent 封装。

## Operating Context

- 单用户在本机项目工作区中运行 Web 控制台。
- 左侧管理 Workspace 与历史 Session，中间持续处理目标，右侧查看 Run、Files 和 Context。
- Settings 管理 Agent、Team、Skills、Plugins、Knowledge、Workflow、Connector、Model 与 Permission。
- Node 本地服务提供 API、SSE 和静态资源，SQLite 保存核心业务状态；模型通过 OpenAI-compatible Chat Completions 连接，API Key 保存于本机受限凭据文件。

## Capabilities and Constraints

- 核心对象包括 Task、Run、Agent、Agent Team、Skill、Workflow Plugin、Knowledge Item、Connector、Approval 和 Artifact。
- CLI 与 MCP 调用经过 Capability、Policy 和 Approval 管线；中高风险动作必须可见、可拒绝、可审计。
- API Key 不写入 SQLite，也不通过设置接口返回；本地无鉴权模型服务可显式跳过密钥。
- 当前范围是本地单用户工作台，不包含远程登录、多租户、分布式任务队列或云端 Secret 托管。
- Web 使用同一 API 与 SQLite 数据源，不维护浏览器静态状态副本。
- 界面与文档默认使用简体中文；Agent、Skill、Workflow、MCP、CLI 等产品术语可保留英文。

## Brand Commitments

- 产品名称：Agent Workbench / 智能体工作台。
- 现有产品语言直接、克制、任务导向，不虚构模型能力、运行结果或外部证明。
- 主工作区采用用户确认的标准 AI 写作工作台范式，并以 ChatGPT 的低学习成本、持续对话和内容优先体验作为工艺基准；运行日志与工具记录不得混入写作正文。
- 现有技术栈为 React、Ant Design、TypeScript 和 Vite；该事实不是永久视觉约束，但后续工作应尊重真实的平台能力。

## Evidence on Hand

- 产品与需求资料位于 `docs/product/`。
- 架构、安全和 API 资料位于 `docs/architecture/` 与 `docs/technical/`。
- 当前可运行界面位于 `src/app/session-app.tsx`，视觉基线位于 `src/styles.css`。
- 仓库没有客户案例、用户规模、性能基准、商业定价或第三方背书；未来界面不得自行编造。

## Product Principles

- 本地优先：默认把数据和执行控制留在用户机器上。
- 审批优先：风险能力在执行前必须经过明确策略和人工确认。
- 产物优先：运行结果尽量形成可查看、可追踪、可版本化的资产。
- 目标优先：让用户从任务开始，逐步暴露复杂配置，而不是要求先理解底层架构。
- 真实反馈：明确区分已执行、等待、失败和未配置状态，不以模拟结果冒充真实运行。
