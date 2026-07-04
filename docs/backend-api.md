# Workbench API 与 SQLite

这是 P0-01 的本地后端地基：用 Node.js 内置 `node:sqlite` 创建 Workbench API，并持久化任务、运行和事件。

## 运行

```bash
pnpm api
```

默认监听：

```text
http://127.0.0.1:8787
```

默认数据库：

```text
.agent-workbench/data/workbench.sqlite
```

## 初始化

```bash
pnpm db:init
```

会创建三张基础表：

- `tasks`
- `runs`
- `events`

## 端点

### `GET /api/health`

返回服务状态和 SQLite 文件路径。

### `GET /api/tasks`

返回已创建任务。

### `POST /api/tasks`

创建 task、run 和初始 event。

```json
{
  "title": "公众号周更：AI Agent 工作流",
  "prompt": "生成正文草稿、封面 brief 和发布包",
  "targetType": "agent_team",
  "targetId": "team_content_ops",
  "owner": "内容团队",
  "runtime": "BrowserOps",
  "priority": "normal",
  "requiresApproval": true
}
```

### `GET /api/runs/:runId/events`

返回 SSE 事件流。

### `GET /api/runs/:runId/events.json`

返回指定 run 的事件列表。

### `POST /api/runs/:runId/events`

追加运行事件。

```json
{
  "type": "message.delta",
  "payload": {
    "role": "assistant",
    "text": "正在读取项目上下文"
  }
}
```

## 当前边界

- `node:sqlite` 在当前 Node 版本仍会输出 ExperimentalWarning。
- 目前只完成 task / run / event 的数据地基。
- 还未实现 Agent、知识库、连接器、审批、Artifact 的数据库表。
- SSE 已有端点，但前端尚未订阅真实事件流。
