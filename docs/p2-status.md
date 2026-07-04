# P2 完成清单

## 已完成

- Artifact 文件内容写入：带 `content` 创建 Artifact 时会写入 `.agent-workbench/artifacts`。
- Artifact 版本管理：新增 `artifact_versions` 表，支持读取内容、查看版本、追加版本。
- Workflow YAML：支持导出保存的工作流为 YAML，也支持从 YAML 导入为 SQLite workflow。
- DAG 执行器：支持完整执行工作流，生成 task、run events 和 workflow artifact。
- Step 重跑与 feedback 返工：`POST /api/workflows/:workflowId/run` 支持 `fromStepId` 和 `feedback`。
- MCP stdio 最小 client：支持 `initialize`、`tools/list` 和 `tools/call`。
- IndexedDB 离线工作区：Static Local Mode 优先使用 IndexedDB，并保留 `localStorage` 兼容兜底。
- Secret 引用管理：新增 `/api/secrets`，只保存环境变量名和状态，不保存真实密钥明文。
- 本地团队权限策略：设置页展示 Owner、Operator、Reviewer、Viewer 的本地权限边界。
- 前端交互：工作流页支持运行、导入 YAML、导出 YAML、指定 step 重跑、带反馈返工；资产页支持查看、下载、新增版本和批量导出。

## 已验证

```bash
pnpm db:init
pnpm lint
node --check server/index.mjs
```

新增 API smoke test 覆盖：

- `POST /api/artifacts`
- `GET /api/artifacts/:artifactId/content`
- `POST /api/artifacts/:artifactId/versions`
- `POST /api/workflows/import`
- `POST /api/workflows/:workflowId/run`
- `GET /api/runs/:runId/events.json`
- `POST /api/secrets`

## 当前边界

- Runtime Adapter 仍是本地模拟执行器，还没有接入真实模型运行队列。
- MCP HTTP endpoint 仅登记和标记，当前真实调用覆盖 stdio transport。
- Workflow DAG 现在按 layer 顺序执行，尚未做真实并发 worker 调度。
- 当前是本地单用户工作台；多用户登录、团队空间和远程权限后端属于后续扩展。
- Artifact 支持内容与版本，但全文检索、引用图谱和外部对象存储仍待后续实现。
