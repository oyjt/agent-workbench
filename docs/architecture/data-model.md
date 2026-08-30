# 数据模型草案

> 本文保留目标数据模型，包含尚未落地的 `knowledge_bases`、`workflow_plugins`、独立 MCP/CLI 表等设计。当前 SQLite schema 的唯一实现来源是 `server/db/schema.mjs`，当前表包括：`tasks`、`runs`、`events`、`model_providers`、`agents`、`knowledge_items`、`connectors`、`approvals`、`pending_capability_executions`、`agent_teams`、`agent_team_members`、`artifacts`、`artifact_versions` 和 `workflows`。

当前实现把 MCP/CLI 统一存储为 `connectors`，把运行事件存储为 `events`，把审批后需要恢复的调用存储为 `pending_capability_executions`。目标模型中的拆表命名不代表当前数据库字段。

## 1. 核心表

### `agents`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| description | text | 描述 |
| runtime_id | text | 默认 runtime |
| model | text | 默认模型 |
| system_prompt | text | 系统提示词 |
| permission_profile | text | 权限策略 |
| enabled | boolean | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### `agent_teams`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| workflow | text | `lead_sequential` / `parallel_review` / `router` |
| description | text | 描述 |
| enabled | boolean | 是否启用 |

### `agent_team_members`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| team_id | text | 团队 ID |
| agent_id | text | Agent ID |
| role | text | 角色 |
| order_index | integer | 顺序 |

### `skills`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| version | text | 版本 |
| source | text | 来源 |
| path | text | 本地路径 |
| permissions_json | text | 权限声明 |
| risk | text | `low` / `medium` / `high` |
| enabled | boolean | 是否启用 |

### `agent_skills`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| agent_id | text | Agent ID |
| skill_id | text | Skill ID |

### `workflow_plugins`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| version | text | 版本 |
| scenario | text | `content` / `coding` / `ops` / `design` / `media` |
| source | text | 来源：built_in / local / github |
| path | text | 本地路径 |
| manifest_json | text | `plugin.json` 原始解析结果 |
| inputs_schema_json | text | 输入表单 schema |
| pipeline_json | text | stage 定义 |
| capabilities_json | text | 声明能力 |
| risk | text | 风险等级 |
| enabled | boolean | 是否启用 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### `plugin_grants`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| plugin_id | text | Plugin ID |
| plugin_version | text | 授权时版本 |
| source_digest | text | 来源摘要或 git sha |
| granted_capabilities_json | text | 已授权能力 |
| scope | text | `once` / `project` / `global` |
| granted_by | text | 授权用户 |
| created_at | datetime | 创建时间 |
| expires_at | datetime | 过期时间 |

### `knowledge_bases`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| scope | text | `team` / `project` |
| project_id | text | 项目 ID |
| description | text | 描述 |
| visibility | text | 可见范围 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### `knowledge_items`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| knowledge_base_id | text | 知识库 ID |
| title | text | 标题 |
| type | text | `sop` / `decision` / `brand` / `platform_rule` / `technical` |
| content | text | 正文 |
| source_url | text | 来源 |
| tags_json | text | 标签 |
| status | text | `draft` / `reviewed` / `deprecated` |
| author | text | 作者 |
| reviewed_by | text | 审核人 |
| expires_at | datetime | 过期时间 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### `agent_knowledge_scopes`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| agent_id | text | Agent ID |
| knowledge_base_id | text | 知识库 ID |
| tags_json | text | 可检索标签范围 |
| access_level | text | `read` / `suggest_update` |

### `knowledge_references`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| run_id | text | Run ID |
| knowledge_item_id | text | 知识条目 ID |
| message_id | text | 消息 ID |
| excerpt | text | 引用片段 |
| created_at | datetime | 创建时间 |

### `mcp_servers`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| transport | text | `stdio` / `sse` / `http` |
| command | text | stdio 启动命令 |
| url | text | SSE/HTTP 地址 |
| args_json | text | 参数 |
| env_refs_json | text | secret 引用 |
| tool_allowlist_json | text | 允许工具 |
| risk | text | 风险等级 |
| enabled | boolean | 是否启用 |
| last_check_at | datetime | 最近检查 |
| last_check_result | text | 检查结果 |

### `cli_commands`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 名称 |
| command_template | text | 命令模板 |
| args_schema_json | text | 参数 schema |
| cwd_policy | text | 工作目录策略 |
| env_refs_json | text | 环境变量引用 |
| timeout_ms | integer | 超时 |
| output_parser | text | `text` / `json` / `diff` / `junit` |
| risk | text | 风险等级 |
| enabled | boolean | 是否启用 |

### `agent_connectors`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| agent_id | text | Agent ID |
| connector_type | text | `mcp_tool` / `cli_command` |
| connector_id | text | MCP tool 或 CLI command ID |

### `tasks`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| title | text | 标题 |
| prompt | text | 用户输入 |
| target_type | text | `agent` / `team` / `workflow` |
| target_id | text | 目标 ID |
| status | text | 状态 |
| workspace_id | text | 工作区 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间 |

### `runs`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| task_id | text | 任务 ID |
| agent_id | text | Agent ID |
| runtime_id | text | Runtime ID |
| status | text | 状态 |
| started_at | datetime | 开始时间 |
| completed_at | datetime | 完成时间 |
| error | text | 错误 |

### `run_events`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| run_id | text | Run ID |
| type | text | 事件类型 |
| payload_json | text | 事件内容 |
| created_at | datetime | 创建时间 |

### `approval_requests`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| run_id | text | Run ID |
| agent_id | text | Agent ID |
| action_type | text | 操作类型 |
| risk | text | 风险等级 |
| input_json | text | 操作参数 |
| status | text | `pending` / `allowed` / `denied` |
| decision_json | text | 审批结果 |
| created_at | datetime | 创建时间 |
| resolved_at | datetime | 处理时间 |

### `artifacts`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| task_id | text | 任务 ID |
| run_id | text | Run ID |
| type | text | 文档、图片、视频、diff、发布包 |
| name | text | 文件名 |
| path | text | 本地路径 |
| metadata_json | text | 元数据 |
| created_at | datetime | 创建时间 |

### `artifact_versions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| artifact_id | text | Artifact ID |
| parent_version_id | text | 父版本 |
| source_agent_id | text | 来源 Agent |
| source_plugin_id | text | 来源 Plugin |
| knowledge_reference_ids_json | text | 使用的知识引用 |
| contract_versions_json | text | `BRAND.md` / `CONTENT.md` 等契约版本 |
| export_formats_json | text | 可导出格式 |
| manifest_json | text | artifact manifest |
| created_at | datetime | 创建时间 |

### `runtime_metrics`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| run_id | text | Run ID |
| input_tokens | integer | 输入 token |
| output_tokens | integer | 输出 token |
| ttft_ms | integer | 首 token 延迟 |
| duration_ms | integer | 总耗时 |
| tool_call_count | integer | 工具调用数 |
| estimated_cost | real | 估算成本 |

## 2. 索引建议

- `tasks(status, updated_at)`
- `runs(task_id, started_at)`
- `run_events(run_id, created_at)`
- `approval_requests(status, created_at)`
- `artifacts(task_id, created_at)`
- `skills(enabled, risk)`
- `workflow_plugins(enabled, scenario, risk)`
- `plugin_grants(plugin_id, scope)`
- `knowledge_items(knowledge_base_id, type, updated_at)`
- `knowledge_items(title, content)`，MVP 可用 SQLite FTS
- `mcp_servers(enabled, risk)`
- `cli_commands(enabled, risk)`

## 3. 本地文件布局

```text
~/.agent-workbench/
  workspaces/
    default/
      artifacts/
      browser-profiles/
      logs/
      temp/
  skills/
  knowledge/
  connectors/
  mcp/
  plugins/
  contracts/
    BRAND.md
    CONTENT.md
    WORKFLOW.md
  db.sqlite
  secrets/
```
