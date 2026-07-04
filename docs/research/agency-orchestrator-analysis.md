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

## 后续迭代建议

1. 增加 `workflow.yaml` 导入/导出。
2. 将 `WorkflowPlan` 持久化到本地数据库。
3. 将 DAG step 与 Agent、Skill、MCP、CLI、Knowledge Scope 建立绑定。
4. 将 approval / human_input 节点接入真实审批队列。
5. 将运行结果写入 Artifact Studio，并支持从某个 step 返工。
