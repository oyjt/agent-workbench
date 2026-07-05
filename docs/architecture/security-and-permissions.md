# 安全与权限方案

## 1. 风险原则

任何能影响用户真实文件、真实账号、真实费用、真实发布结果的动作都需要进入权限系统。

## 2. 权限类型

| 权限 | 示例 |
| --- | --- |
| `files:read` | 读取工作区文件 |
| `files:write` | 创建、修改文件 |
| `shell:run` | 执行命令 |
| `network:read` | 抓取网页 |
| `network:write` | 调用外部 API 写入 |
| `browser:view` | 浏览页面 |
| `browser:input` | 填写表单 |
| `browser:submit` | 提交、发布、下单、发送 |
| `secret:use` | 使用密钥但不暴露明文 |
| `dependency:install` | 安装依赖 |
| `mcp:read` | 调用只读 MCP tool |
| `mcp:write` | 调用有副作用 MCP tool |
| `cli:run` | 执行登记过的 CLI command |
| `knowledge:read` | 检索团队知识 |
| `knowledge:write` | 新增或修改团队知识 |
| `plugin:run` | 启动 workflow plugin |
| `plugin:install` | 安装本地或远程 plugin |
| `artifact:export` | 导出产物或发布包 |

## 3. 风险等级

| 等级 | 说明 | 默认策略 |
| --- | --- | --- |
| 低 | 只读、无副作用 | 可自动允许 |
| 中 | 写文件、填表、调用非关键 API | 人工审批或会话允许 |
| 高 | 删除、发布、转账、发送消息、安装依赖 | 每次人工审批 |

## 4. 策略模板

### 自动化

适合纯本地草稿任务。

- 允许只读网络
- 允许工作区内写文件
- shell 命令按 allowlist 执行

### 协作

默认策略。

- 只读自动允许
- 写入需要审批
- 浏览器提交需要审批
- shell 命令需要审批

### 保守

适合真实账号、生产仓库、客户数据。

- 所有外部写入需要审批
- 所有 shell 命令需要审批
- 所有未明确标低风险的 MCP/CLI 调用需要审批
- 禁止自动安装依赖
- 禁止自动发布

## 5. Secret 管理

要求：

- Secret 不写入 prompt、日志、artifact。
- Worker 只拿到临时 token 或 scoped env。
- UI 展示 masked value。
- 审计日志记录 secret 使用事件，但不记录明文。

MVP 可使用系统 keychain 或本地加密文件。团队版接入 Vault 或云 KMS。

## 6. 浏览器安全

浏览器 worker 必须：

- 使用独立 profile。
- 区分读取、填表、提交三个权限。
- 提交、发布、发送消息、删除等动作必须审批。
- 任务完成后保存截图和操作摘要。
- 默认不复用用户主浏览器的所有标签。

## 7. 依赖安装

依赖安装属于高风险动作：

- 展示包名、版本、来源、安装目录。
- 优先使用 lockfile。
- 记录安装日志。
- 支持 dry-run 或只生成命令。

## 8. 知识库安全

团队知识库需要防止“错误知识被 Agent 当事实使用”：

- 知识条目区分草稿、已审核、已废弃。
- Agent 默认只能检索已审核知识。
- Agent 可建议更新知识，但写入需要人工审核。
- 过期知识在检索结果中降权并标记。
- 回答或发布包中引用团队知识时保留 citation。

## 9. MCP/CLI 安全

MCP 与 CLI 连接器统一遵循最小权限：

- Agent 只能调用显式绑定的 MCP tools 和 CLI commands。
- CLI 使用 command template，不开放任意 shell。
- 参数必须通过 JSON schema 校验。
- env secret 使用引用，不进入 prompt。
- 写操作、发布操作、删除操作和安装操作默认高风险。

## 10. Plugin Capability Gate

Workflow plugin 启动前必须生成 capability gate。用户看到的不是抽象“允许插件运行”，而是清楚看到它将获得哪些能力：

| 能力 | 展示信息 | 默认策略 |
| --- | --- | --- |
| `prompt:inject` | 注入哪些 skill、契约、知识范围 | 允许 |
| `files:read` | 可读取目录和资产 | 低风险自动或会话允许 |
| `files:write` | 可写入目录和 artifact 类型 | 协作策略下审批 |
| `mcp:*` | MCP server、tool allowlist、transport | 写操作审批 |
| `cli:run` | command template、参数 schema、cwd、timeout | 中高风险审批 |
| `network:*` | 访问域名或外部 API | 未知域名审批 |
| `browser:*` | 页面、表单、提交边界 | 提交/发布每次审批 |
| `connector:*` | GitHub、飞书、Notion 等账号范围 | OAuth 与写操作审批 |

授权记录必须绑定 plugin provenance：

- plugin id
- plugin version
- source path / git sha / digest
- granted capabilities
- scope：once / project / global
- granted by / granted at

当 plugin 升级、来源变化或请求新增高风险能力时，必须重新授权。

## 11. 审计日志

每条审计记录包含：

- 时间
- 用户
- task/run
- Agent
- runtime
- action type
- connector type
- input 摘要
- 风险等级
- 审批结果
- 执行结果
