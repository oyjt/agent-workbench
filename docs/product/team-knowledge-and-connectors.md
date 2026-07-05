# 团队知识库与 MCP/CLI 连接器需求

## 1. 设计动机

通用 Agent 工作台不能只依赖单次 prompt 或单个 Agent 的 memory。团队会持续沉淀项目背景、账号规则、品牌语气、发布 SOP、技术决策和客户资料。Agent 在执行任务时需要可靠地检索这些知识，并能说明引用来源。

Open Design 的 `DESIGN.md` 说明了一个关键方向：团队知识不应全部塞进普通文档库，品牌、内容、平台规则和反模式应该形成可版本化的“契约文件”。Agent Workbench 建议支持 `BRAND.md`、`CONTENT.md`、`WORKFLOW.md`、`DECISIONS.md` 等结构化契约，并在每次运行中记录所使用的契约版本。

同时，项目能力不能只有 skills。真实工作中大量能力来自 MCP servers 和 CLI 工具，例如 GitHub MCP、文件系统 MCP、飞书 MCP、`gh`、`pnpm`、`ffmpeg`、`playwright`、`opencode`、内部脚本等。它们需要项目级注册、权限控制、健康检查和审计。

## 2. 团队知识库

### 2.1 知识类型

| 类型 | 示例 |
| --- | --- |
| 项目资料 | 产品介绍、目标用户、业务指标、客户资料 |
| SOP | 公众号发布流程、代码发布流程、运营日报流程 |
| 决策记录 | 为什么选择 OpenCode、为什么不用某个 API |
| 品牌规范 | 语气、禁用词、排版规则、视觉规范 |
| 内容契约 | 栏目定位、标题规则、平台格式、可复用表达 |
| 平台规则 | 小红书标签策略、公众号格式、飞书同步规则 |
| 技术资料 | 架构说明、API 文档、代码约定 |
| 外部资料 | 竞品页面、文章、网页摘要 |

### 2.2 核心能力

- 知识库按团队、项目、频道、标签管理。
- 支持导入 Markdown、PDF、网页、表格摘要、会议纪要。
- 支持人工编辑和 Agent 自动建议更新。
- 每条知识包含来源、作者、更新时间、适用项目、可信度。
- Agent 检索结果必须可追溯，并可在 UI 展示引用。
- 支持过期提醒和冲突检测，例如同一平台规则出现两种版本。
- 支持从知识库条目生成或更新 `BRAND.md`、`CONTENT.md` 契约草稿。
- 每次 Agent 运行记录使用的契约版本，产物可追溯到当时的品牌/内容规则。

### 2.3 Agent 使用方式

Agent 不默认访问所有知识。每个 Agent 或 Agent Team 需要显式绑定知识范围：

- 全局团队知识
- 项目知识库
- 某些标签或频道
- 某些 SOP
- 只读或可建议更新

## 3. MCP 连接器

### 3.1 管理字段

| 字段 | 说明 |
| --- | --- |
| 名称 | GitHub MCP、Filesystem MCP、飞书 MCP |
| transport | stdio、SSE、HTTP |
| command/url | 启动命令或服务地址 |
| env | 环境变量引用，不展示 secret 明文 |
| tool allowlist | 允许暴露给 Agent 的工具 |
| 权限等级 | 低、中、高 |
| 健康状态 | 在线、异常、未启动 |

### 3.2 使用原则

- MCP tool 需要被 Agent 显式绑定。
- 写操作 MCP tool 默认需要审批。
- MCP tool 的入参和结果进入 run events。
- MCP server 失败需要可诊断：启动失败、鉴权失败、工具不可用、超时。

## 4. CLI 连接器

### 4.1 管理字段

| 字段 | 说明 |
| --- | --- |
| 名称 | `pnpm build`、`gh pr view`、`ffmpeg render` |
| command template | 命令模板，参数由 schema 填充 |
| args schema | JSON schema，限定可传参数 |
| cwd policy | 固定工作目录或项目根目录 |
| env policy | 允许使用的环境变量 |
| timeout | 超时时间 |
| output parser | text、json、junit、diff |
| risk | 低、中、高 |

### 4.2 使用原则

- CLI 不等于任意 shell。MVP 只支持登记过的 command template。
- 高风险 CLI 每次审批，例如安装依赖、删除文件、发布、推送。
- CLI 输出进入工具结果，必要时生成 artifact。
- CLI 可作为 skill 内部能力，也可独立暴露给 Agent。

## 5. MVP 要求

1. UI 能创建项目知识库并新增知识条目。
2. Agent 能绑定知识库范围。
3. UI 能注册 MCP server，展示健康状态。
4. UI 能注册 CLI command template。
5. 任务运行中 MCP/CLI 调用进入统一工具流。
6. 高风险 MCP/CLI 调用进入审批。
7. Workflow plugin 能声明需要的 MCP tools、CLI commands 和知识范围。
8. Plugin 启动时 UI 展示 capability gate，包括 `mcp`、`cli:run`、`network`、`files:write`、`browser:submit` 等高风险能力。
