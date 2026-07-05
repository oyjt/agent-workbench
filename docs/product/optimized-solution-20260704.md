# 优化方案：通用 Agent 工作台 2.0

## 1. 优化结论

结合 WeSight、OpenCode、GenericAgent、CyberCode CLI、Open Design 的调研，Agent Workbench 的最佳定位应从“多 Agent 管理台”升级为“本地优先的 Agent 操作系统工作台”：

- 不重写 Agent loop，而是接入 Codex、OpenCode、Claude Code、Cursor、Gemini、GenericAgent 等已有执行器。
- 以图形控制台承载任务、审批、产物、团队知识、插件、MCP、CLI 和运行观测。
- 以 workflow plugin 组织自媒体、编码、运营、设计、视频等业务流程。
- 以团队知识库和品牌/内容契约约束 Agent 输出，减少重复解释和风格漂移。
- 以 artifact-first 的方式沉淀真实产物，而不是只保留聊天记录。

## 2. 产品模块升级

| 模块 | 原方案 | 优化后 |
| --- | --- | --- |
| 工作台 | 任务队列与审批 | 任务指挥中心，展示运行、审批、成本、产物和风险 |
| Agents | 单 Agent / Team | Runtime adapter + capability negotiation + fallback |
| Skills | 技能包管理 | Skill + Plugin 双层：Skill 是能力说明，Plugin 是可复用业务工作流 |
| 知识库 | SOP/资料检索 | 团队知识、项目知识、品牌契约、内容契约、决策记录和引用治理 |
| 连接器 | MCP/CLI 注册 | MCP、受控 CLI、外部 connector 统一进入 capability gate |
| 工作流 | 模板编排 | Plugin pipeline：discovery → plan → generate → critique → handoff |
| 资产 | 任务产物列表 | Artifact Studio：文档、网页、PPT、图片、视频、diff、发布包预览与导出 |
| 设置 | 模型与策略 | Runtime、Provider、Secrets、MCP、CLI、审计、权限策略统一管理 |

## 3. Open Design 借鉴点

Open Design 最值得吸收的不是具体 UI，而是四个产品机制：

1. **Adapter-first**：工作台只负责发现 CLI、注入上下文、收集流式事件，Agent loop 交给成熟 CLI。
2. **DESIGN.md 类契约**：用文件化规范管理品牌、视觉、语气、反模式，驱动每次生成。
3. **Plugin sidecar**：在 `SKILL.md` 之外增加机器可读 manifest，声明输入、产物、MCP、CLI、pipeline、权限和预览。
4. **Artifact-first**：所有输出都是可预览、可下载、可版本化的真实文件。

这些机制可泛化为 Agent Workbench 的 `WORKFLOW.md`、`BRAND.md`、`CONTENT.md`、`plugin.json` 和 artifact manifest。

## 4. 新增核心对象

| 对象 | 说明 |
| --- | --- |
| Runtime Adapter | 接入 Codex/OpenCode/Claude Code/GenericAgent 等执行器，声明能力差异 |
| Workflow Plugin | 一个可复用业务流程包，包含 skill、manifest、assets、MCP/CLI 依赖和产物定义 |
| Artifact Project | 一次任务或项目的文件化工作区，保存输入、输出、历史和引用 |
| Capability Grant | 用户对插件、Agent、MCP、CLI 的能力授权记录 |
| Team Contract | 团队知识、品牌语气、内容规范和反模式的组合上下文 |
| Creative Studio | 面向自媒体、设计、PPT、短视频和运营素材的产物工作区 |

## 5. MVP 调整

MVP 不再只证明“能跑一个 Agent”，而要证明“能把一个业务流程跑成可管理产物”。

### MVP 必须覆盖

- Codex 或 OpenCode adapter。
- GenericAgent-style browser worker adapter。
- Agent、Skill、Plugin、知识库、MCP、CLI 基础管理。
- 自媒体周更 workflow plugin。
- Artifact Studio：正文、封面、发布包、代码 diff、运行日志预览。
- Capability Gate：文件写入、CLI、MCP 写操作、浏览器发布、外部 API 写入审批。
- 团队知识引用：回答和发布包必须展示 citation。

### MVP 可以暂缓

- 公开插件市场。
- 多租户组织管理。
- 自动跨平台真实发布。
- 完整视频渲染 farm。
- 云端 runner pool。

## 6. 第一条标杆流程

建议将“自媒体周更”作为首个端到端样板：

1. 用户选择“自媒体周更”插件。
2. 系统绑定内容团队知识、品牌语气、平台规则。
3. 选题 Agent 调用浏览器/搜索类能力生成候选题。
4. 写作 Agent 输出正文、标题、摘要。
5. 设计 Agent 生成封面 brief 或 HTML 海报。
6. 审核 Agent 根据知识库 SOP 打分。
7. 发布 Agent 只生成发布包；真实平台提交必须人工审批。
8. 所有产物进入 Artifact Studio，可导出 zip。

## 7. 设计方向

高保真原型采用 Ant Design 参考风格：

- 左侧导航 + 顶部工具栏 + 内容卡片。
- 以 Table、Tabs、Tag、Steps、Timeline、Drawer、Modal、Segmented、Statistic 承载高密度信息。
- 页面首屏即工作台，不做营销式 hero。
- 视觉使用 Ant 蓝、功能色和中性灰，减少装饰。
- 高风险操作使用抽屉或弹窗，展示来源、参数、风险和授权范围。

## 8. 架构方向

推荐架构分为六层：

1. UI Shell：Web/Electron 控制台与 Artifact Preview。
2. Workbench API：项目、任务、Agent、插件、知识库、连接器、审批。
3. Orchestrator：任务状态机、插件 pipeline、运行恢复、事件聚合。
4. Runtime Adapters：Codex/OpenCode/Claude Code/GenericAgent/Workflow Bridge。
5. Capability Layer：Skill、MCP、CLI、Connector、Secrets、权限策略。
6. Local Stores：SQLite、artifact 文件目录、知识索引、审计日志。

## 9. 成功标准

- 用户能在 10 分钟内完成一次自媒体发布包生成。
- 用户能看到每个 Agent 调用了什么工具、引用了什么知识、生成了什么产物。
- 高风险动作 100% 进入审批或审计。
- 一个 workflow plugin 可以被 UI、CLI、MCP 三种入口调用。
- 产物可在 Artifact Studio 中预览、版本化和导出。
