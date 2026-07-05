# API 合同草案

## 1. Realtime

### `GET /api/runs/:runId/events`

SSE 事件流。

```http
event: runtime
data: {"type":"message.delta","runId":"run_123","role":"assistant","text":"正在读取仓库..."}
```

## 2. Tasks

### `POST /api/tasks`

创建任务。

```json
{
  "title": "公众号周更：AI 工具选题",
  "prompt": "整理本周 AI 工具方向选题并生成正文草稿",
  "targetType": "agent_team",
  "targetId": "team_content_ops",
  "workspaceId": "ws_local",
  "skillIds": ["web-access", "content-planner"]
}
```

响应：

```json
{
  "taskId": "task_01J...",
  "runId": "run_01J...",
  "status": "queued"
}
```

### `POST /api/tasks/:taskId/stop`

停止任务。

### `POST /api/tasks/:taskId/retry`

从失败点重试。

## 3. Agents

### `GET /api/agents`

返回 Agent 列表。

### `POST /api/agents`

```json
{
  "name": "内容选题 Agent",
  "description": "负责热榜、竞品、资料收集和选题评分",
  "runtimeId": "browserops",
  "model": "gpt-5.5",
  "systemPrompt": "你是内容团队中的选题研究员...",
  "skillIds": ["web-access", "content-planner"],
  "permissionProfile": "collaborative"
}
```

## 4. Agent Teams

### `POST /api/agent-teams`

```json
{
  "name": "自媒体内容团队",
  "workflow": "lead_sequential",
  "members": [
    {"agentId": "agent_topic", "role": "选题", "order": 0},
    {"agentId": "agent_writer", "role": "写作", "order": 1},
    {"agentId": "agent_reviewer", "role": "审核", "order": 2}
  ],
  "skillIds": ["web-access"]
}
```

## 5. Skills

### `GET /api/skills`

返回已安装 skills。

### `POST /api/skills/install`

```json
{
  "source": "github",
  "url": "https://github.com/org/skills/tree/main/content-planner"
}
```

### `POST /api/skills/:skillId/check`

运行依赖和权限自检。

## 5.1 Workflow Plugins

### `GET /api/plugins`

返回 workflow plugin 列表。

### `POST /api/plugins/install`

```json
{
  "source": "local",
  "path": "/Users/me/agent-workbench/plugins/weekly-media-post"
}
```

### `POST /api/plugins/:pluginId/check`

校验 `SKILL.md`、`plugin.json`、assets、MCP/CLI 依赖和权限声明。

### `POST /api/plugins/:pluginId/apply`

根据输入生成任务草稿和 capability gate。

```json
{
  "projectId": "proj_content_ops",
  "inputs": {
    "topic": "AI Agent 工作流",
    "platform": "wechat"
  }
}
```

响应：

```json
{
  "draftTaskId": "draft_123",
  "requiredCapabilities": ["network:read", "files:write", "mcp:read", "browser:input"],
  "pipeline": ["discovery", "plan", "generate", "critique", "handoff"]
}
```

### `POST /api/plugins/:pluginId/run`

确认授权后创建任务并开始运行。

```json
{
  "draftTaskId": "draft_123",
  "grant": {
    "scope": "once",
    "capabilities": ["network:read", "files:write", "mcp:read"]
  }
}
```

## 6. Knowledge Bases

### `GET /api/knowledge-bases`

返回团队和项目知识库。

### `POST /api/knowledge-bases`

```json
{
  "name": "内容运营知识库",
  "scope": "project",
  "projectId": "proj_content_ops",
  "description": "选题、平台规则、品牌语气和发布 SOP"
}
```

### `POST /api/knowledge-items`

```json
{
  "knowledgeBaseId": "kb_content_ops",
  "title": "公众号发布前审核 SOP",
  "type": "sop",
  "content": "发布前检查事实、标题、封面、敏感词和引用来源...",
  "tags": ["公众号", "审核", "发布"],
  "sourceUrl": "file://docs/publishing.md",
  "visibility": "team"
}
```

### `POST /api/knowledge/search`

```json
{
  "query": "公众号发布前要检查什么",
  "scope": {
    "projectId": "proj_content_ops",
    "agentId": "agent_reviewer"
  },
  "limit": 6
}
```

响应：

```json
{
  "hits": [
    {
      "itemId": "ki_123",
      "title": "公众号发布前审核 SOP",
      "excerpt": "发布前检查事实、标题、封面、敏感词和引用来源...",
      "citation": "内容运营知识库 / SOP / 2026-07-04",
      "confidence": 0.91
    }
  ]
}
```

## 7. Connectors

### `GET /api/connectors`

返回 MCP 和 CLI 连接器。

### `POST /api/connectors/mcp`

```json
{
  "name": "GitHub MCP",
  "transport": "stdio",
  "command": "github-mcp-server",
  "args": ["stdio"],
  "envRefs": ["GITHUB_TOKEN"],
  "toolAllowlist": ["issues.list", "pulls.get", "pulls.comment"],
  "risk": "medium"
}
```

### `POST /api/connectors/cli`

```json
{
  "name": "pnpm build",
  "commandTemplate": "pnpm build",
  "argsSchema": {
    "type": "object",
    "properties": {}
  },
  "cwdPolicy": "project_root",
  "timeoutMs": 120000,
  "risk": "low",
  "outputParser": "text"
}
```

### `POST /api/connectors/:connectorId/check`

运行健康检查。

### `POST /api/agents/:agentId/connectors`

将 MCP tools 或 CLI commands 绑定给 Agent。

```json
{
  "mcpToolIds": ["github.pulls.get", "github.pulls.comment"],
  "cliCommandIds": ["cli_pnpm_build"]
}
```

## 8. Approvals

### `GET /api/approvals?status=pending`

获取待审批动作。

### `POST /api/approvals/:requestId/respond`

```json
{
  "decision": "allow_once",
  "editedInput": null,
  "reason": "仅写入草稿箱，不提交发布"
}
```

可选 decision：

- `allow_once`
- `allow_session`
- `deny`
- `edit_and_allow`

## 9. Artifacts

### `GET /api/tasks/:taskId/artifacts`

返回任务产物。

### `GET /api/artifacts/:artifactId/manifest`

返回产物来源、版本、知识引用和导出能力。

```json
{
  "artifactId": "artifact_123",
  "type": "markdown",
  "sourceAgentId": "agent_writer",
  "sourcePluginId": "weekly-media-post",
  "knowledgeReferenceIds": ["kr_1", "kr_2"],
  "contractVersions": {
    "BRAND.md": "2026-07-04T09:42:00Z",
    "CONTENT.md": "2026-07-04T10:10:00Z"
  },
  "exportFormats": ["md", "pdf", "zip"]
}
```

### `GET /api/artifacts/:artifactId/download`

下载文件。

## 10. Runtime Workers

Worker 需要实现：

### `POST /worker/runs`

启动运行。

### `GET /worker/runs/:runId/events`

返回 SSE 事件。

### `POST /worker/runs/:runId/stop`

停止运行。

### `POST /worker/approvals/:requestId/respond`

审批响应。
