# P1 完成清单

## 已完成

- Artifact 持久化：新增 `artifacts` 表、`GET /api/artifacts`、`POST /api/artifacts`。
- Runtime Artifact 写入：Codex 类任务生成 diff artifact，内容类任务生成 markdown draft artifact。
- 资产库接入真实 API：前端资产页读取 SQLite artifacts，并支持手动登记交付物。
- Workflow 持久化：新增 `workflows` 表、`GET /api/workflows`、`POST /api/workflows`。
- 工作流页保存能力：一句话编排或模板生成的 DAG 可以保存到 SQLite，并在“已保存工作流”中重新打开。
- 生产运行：`pnpm build` 后可通过 `pnpm start` 用同一个 Node server 提供 API 和前端静态文件。
- 浏览器本地静态模式：API 不可用时自动切到 `Static Local`，数据写入 `localStorage`。
- 工作区导入导出：支持导出当前工作区 JSON，也支持从 JSON 恢复到浏览器本地。
- 自动打包：`pnpm package` 会生成 `.agent-workbench/release/agent-workbench-0.1.0.tgz`。
- GitHub Actions：新增 Build and Package workflow，自动安装、初始化 SQLite、类型检查、构建、打包、启动生产服务做 smoke test，并上传 `.tgz` artifact。
- GitHub Pages：新增 Deploy Static Pages workflow，构建 `/agent-workbench/` base 的静态版；仓库 Pages 已启用时自动发布，未启用时保持构建成功并提示设置步骤。

## 已验证

```bash
pnpm db:init
pnpm lint
pnpm build
pnpm build:pages
pnpm package
node --check server/index.mjs
node --check scripts/package.mjs
```

本机 smoke test 覆盖：

- 生产 server 返回 `/api/health`。
- 生产 server 返回 `dist/index.html`。
- `GET /api/artifacts` 与 `POST /api/artifacts`。
- `GET /api/workflows` 与 `POST /api/workflows`。
- Pages 版 `dist/index.html` 资源路径包含 `/agent-workbench/`。
- Deploy Static Pages workflow 会先检查 Pages site，避免仓库未启用 Pages 时把 CI 跑红。

## 仍属于 P2 的事项

- 真正的 MCP client 协议调用。
- Artifact 文件内容写入与版本管理。
- IndexedDB 替代 `localStorage`，承载更大的离线工作区。
- Workflow YAML 导入导出。
- DAG 执行器、从指定 step 重跑、feedback 返工。
- 用户体系、Secret 管理、团队权限隔离。
