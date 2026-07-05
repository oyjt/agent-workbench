# 调研决策摘要

## 背景

目标产品是一款通用 Agent 工作台，主要服务自媒体、编码、运营等复合型任务。它需要支持 skills、MCP、受控 CLI、多 Agent 配置、团队知识库、图形化管理、任务运行观测、权限审批、模型配置、工作流与长期资产沉淀。

## 调研对象结论

| 项目 | 适合程度 | 可借鉴点 | 不建议作为主底座的原因 |
| --- | --- | --- | --- |
| WeSight | 高 | Electron 控制台、外部 CLI adapter、SkillHub、Agent Team、SQLite、runtime dashboard、权限提示 | Engine 硬编码较多，多 Agent 偏串行流程，云端团队化能力需要重构 |
| OpenCode | 高 | 编码 Agent 底座、skills、plugins、MCP、subagents、权限与配置模型 | 不是面向运营/自媒体的完整图形工作台 |
| GenericAgent | 中高 | 浏览器/桌面/真实世界执行、自增长 skill、个人助手方向 | 工程治理、安全、UI 管理台需要补齐 |
| CyberCode CLI | 中 | 轻量 Python worker、SSE API、npm 一键启动、HyperFrames 视频技能 | 模型网关强绑定、SSL/DNS 处理不适合生产、安全模型弱 |
| Open Design | 高，作为创意/产物工作台参考 | Adapter-first、DESIGN.md、workflow plugin、MCP/CLI 安装、artifact 预览与导出、设计/PPT/视频产物 | 过于偏设计生产，不适合直接作为通用 Agent 主底座；部分插件规范仍偏规划 |
| Pi | 中低 | TypeScript harness、agent loop 实验 | UI、权限、多 Agent、管理台都要从底层补 |
| OpenHands | 高但偏开发 | Agent Canvas、自动化、团队控制台、多 agent runner | 更偏开发/代码任务，运营/内容任务需要扩展 worker |
| Dify / n8n | 中 | 业务工作流、RAG、低代码自动化 | 不适合作为本地 coding agent 执行底座 |

## 推荐产品策略

采用“控制台 + 多 runtime adapter + worker 能力池”的组合架构。

### 第一层：图形控制台

借鉴 WeSight：

- 会话与任务中心
- Agent / Team 配置
- Skill 市场与启停
- 团队知识库与项目 SOP
- MCP 与 CLI 连接器管理
- Workflow Plugin 管理
- Creative Studio 与 Artifact Studio
- Runtime dashboard
- 工具调用流、文件变更、审批弹窗
- 本地 SQLite 或轻量数据库

### 第二层：Agent Runtime Adapter

优先接入成熟执行器：

- OpenCode / Codex：编码主力
- GenericAgent worker：浏览器、桌面、运营执行
- CyberCode-style worker：轻量内容/视频生成实验
- Dify / n8n：固定业务流程与外部 SaaS 自动化
- MCP servers：工具扩展标准化
- CLI commands：将成熟命令行能力封装为可审批工具
- Open Design-style workflow plugins：将设计、自媒体、PPT、视频、运营素材生产沉淀为可复用业务包

### 第三层：业务 Agent 与 Skills

围绕自媒体、编码、运营建立预设 Agent：

- 内容选题 Agent
- 文案写作 Agent
- 视频脚本 Agent
- 设计素材 Agent
- 发布运营 Agent
- 数据分析 Agent
- 代码工程师 Agent
- 测试工程师 Agent
- 审核员 Agent

## 关键产品判断

1. 不做“一个万能单体 Agent”。主产品应是控制台和调度层。
2. 不把 CLI 输出解析作为唯一协议。优先支持 HTTP/SSE、JSON-RPC、ACP、MCP 等稳定接口。
3. 任何真实账号操作必须有权限、审计和回滚设计。
4. Skills 需要从“提示词文档”升级为“可声明权限、依赖、入口、风险等级”的包。
5. MCP 和 CLI 需要作为项目级连接器管理，不能只作为 skill 的附属实现。
6. 团队知识库需要支持来源、版本、引用、权限和检索，不应混同于单个 Agent 的短期 memory。
7. 多 Agent 初期先做可解释流程编排，不急于做全自主黑盒协作。
8. Open Design 的价值在机制：不要重写 agent loop，应该吸收 adapter、plugin、设计/内容契约和 artifact-first 工作流。
9. 自媒体场景需要 `BRAND.md` / `CONTENT.md` / 平台规则等团队契约，不能只依赖通用知识检索。

## MVP 推荐范围

第一版只做“本地单用户工作台”：

- 本地 Web / Electron 控制台
- OpenCode 或 Codex adapter
- GenericAgent-style browser worker adapter
- Agent/Skill 管理
- 团队知识库管理
- MCP/CLI 连接器管理
- 任务队列与运行日志
- 权限审批
- 自媒体内容工作流模板
- 基础资产库
- Artifact Studio 基础预览
- Workflow Plugin capability gate

暂缓：

- 多租户团队权限
- 云端托管 runner
- 复杂 agent 自主协商
- 公开 skill 商店
- 企业级计费
