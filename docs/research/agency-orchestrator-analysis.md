# agency-orchestrator 调研与应用记录

调研对象：https://github.com/jnMetaCode/agency-orchestrator

## 结论

`agency-orchestrator` 值得借鉴，但不建议把它整体并入当前项目。它的核心价值不在某个 UI 控件，而在一套清晰的“低门槛多角色协作”产品范式：

- 一句话输入，自动拆解任务和匹配角色
- YAML 描述工作流，DAG 负责依赖、并行和执行层级
- 角色库可复用，用户不用从零写 Agent
- 支持多 provider，尤其是本机已登录 CLI provider
- 运行输出按步骤保存，支持 resume、from step 和 feedback 返工

当前 Agent Workbench 的定位是“可视化 Agent 控制台 + 工具/知识/审批/产物管理”。因此更适合吸收它的编排模型和交互模式，而不是替换掉当前的 adapter-first 架构。

## 可借鉴点

### 0. Studio 工作台的信息架构

它的 Web Studio 不是单纯的“流程图编辑器”，而是围绕真实执行过程组织成三个中心：

- Workflows：模板卡片、搜索过滤、输入表单、运行面板、结果视图、终端视图、YAML 预览
- Roles：角色库、分类筛选、角色详情、单角色流式对话
- Runs：运行历史、步骤详情、耗时统计、从某一步恢复或返工

这对当前项目很有价值，因为 Agent Workbench 也需要同时服务“配置、运行、介入、复盘”。因此工作流页不应只展示 DAG，还要提供一个运行控制台，把步骤状态、产物结果、原始日志和 YAML 放在同一个操作面。

### 1. 一句话自动编排

`ao compose "..." --run` 的体验非常适合当前项目的入口层。用户不必先选择 Agent、Skill、MCP、CLI，而是先描述目标，再由系统生成一个可编辑的工作流草案。

应用方式：

- 在工作流页加入“一句话自动编排”
- 生成 `WorkflowPlan`
- 展示参与角色、依赖、并行层级、provider 和 capability gate

### 2. YAML / DAG 工作流模型

它的 step 字段很克制：`id`、`role`、`task`、`output`、`depends_on`、`condition`、`type`、`loop`。这比直接做大而全的可视化编排更适合作为 MVP 数据模型。

应用方式：

- 当前前端新增 `WorkflowPlan` / `WorkflowStepRecord`
- 工作流页按 layer 展示 DAG
- 后续可以映射到 API 合同中的 Workflow Plugin pipeline

### 3. 内置模板和团队 Loadout

它将常见场景沉淀为模板，例如 PR Review、产品需求评审、内容发布、周报等。这可以降低新用户首次配置成本。

应用方式：

- 当前前端新增“内置工作流模板”
- 新增“团队 Loadout”概念，用于保存角色组合
- 后续可与 Agent Team、Skill、MCP/CLI 绑定

### 4. Resume / Feedback 返工机制

多 Agent 任务经常不是一次成功。它把输出目录、步骤结果、从某步重跑、带反馈返工做成核心能力，这一点非常适合 Artifact-first 的产品路线。

应用方式：

- 当前工作流页加入 Resume / Feedback 入口说明
- 后续数据模型需要给 run、step、artifact 增加 parent / source / feedback 字段

### 5. 多 provider 与 CLI provider

它强调本机已登录的 Claude Code、Gemini CLI、Codex CLI 等可直接作为 provider 使用。这个方向与当前项目的 MCP/CLI Connector 非常一致。

应用方式：

- 当前工作流页 provider 选项加入 `codex-cli`、`claude-code`、`deepseek`、`ollama`
- 后续应把 provider 作为 Runtime Adapter 的一种，而不是只作为模型配置

### 6. 结构化事件流与原始终端双视图

Web Studio 的后端会把 CLI stdout/stderr 解析成结构化事件，例如 `step-start`、`step-content`、`step-done`、`workflow-summary`、`await-input`，同时保留原始终端输出。这种设计值得采用：

- 前端用结构化事件驱动步骤卡片、进度条和人工输入弹窗
- 调试时仍能看到原始 CLI 输出
- 产物、历史和回放都可以复用同一套 run event

当前项目已经有 `run_events` 和静态事件模拟，后续应把 workflow runtime 接到同一条事件流上。

### 7. YAML 与画布双向转换

`src/canvas/graph.ts` 的关键思路是：节点 `data` 保留完整 step 原始对象，画布只重算 `depends_on` 和 `meta.layout`。这可以避免图形编辑器来回保存时丢失字段。

当前项目后续做可视化编排时，应保持这个原则：

- YAML 是可移植合同
- 图形画布只是编辑视图
- 坐标等 UI 信息进入 `meta.layout`
- 未识别字段原样保留

### 8. 安全与人工介入

Web 服务中对浏览器运行设置了类似 `AO_NO_AT_FILE` 的保护，避免网页请求读取本机任意文件；`human_input` / `approval` 节点会通过 `await-input` 事件要求前端介入。

这与当前项目的 Capability Gate 和审批队列一致。后续真实执行时应继续遵循：

- 高风险 MCP / CLI 调用进入审批
- human input 节点必须暂停等待用户输入
- 本地文件、Secret、真实账号发布都要有范围边界

## 暂不直接采用

- 不直接复制它的工作流执行引擎：当前项目仍以 Workbench 为中心，Runtime Adapter 负责执行。
- 不直接复制角色库：可以学习“角色库”模式，但需要自己的 Agent Registry、权限范围和知识绑定。
- 不把 YAML 暴露为唯一入口：Workbench 应同时支持图形配置、plugin manifest 和 YAML 导入导出。
- 不默认并行执行 CLI provider：CLI provider 通常共享本机账号，应该受限并发或串行执行。

## 本轮已应用

- 工作流页新增“一句话自动编排”
- 新增 provider 与并发度选择
- 新增 DAG layer 预览
- 新增内置工作流模板
- 新增团队 Loadout
- 新增 Resume / Feedback 返工入口
- 新增运行控制台：步骤进度条、结果视图、终端视图、YAML 视图
- 支持在结果视图中选中步骤、查看返工影响范围、从单个步骤重跑
- 前端和本地 API 的 YAML 导入导出兼容 `depends_on`，同时保留旧 `dependsOn` 导入能力

## 后续迭代建议

1. 将运行控制台接入真实 SSE / run events。
2. 增加工作流模板搜索、分类和最近运行区。
3. 将 `WorkflowPlan` 持久化到本地数据库。
4. 将 DAG step 与 Agent、Skill、MCP、CLI、Knowledge Scope 建立绑定。
5. 将 approval / human_input 节点接入真实审批队列。
6. 将运行结果写入 Artifact Studio，并支持从某个 step 返工。
7. 增加 YAML / 画布双向编辑，保存时保留未知字段和 `meta.layout`。
