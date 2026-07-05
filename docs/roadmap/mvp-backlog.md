# MVP Backlog

## P0

| 编号 | 事项 | 验收 |
| --- | --- | --- |
| P0-01 | 初始化 Workbench API 与 SQLite | 能创建 task/run/event |
| P0-02 | 实现任务中心 UI | 能展示队列、详情、状态 |
| P0-03 | 实现 SSE 运行事件 | UI 能实时更新输出 |
| P0-04 | 接入 OpenCode 或 Codex adapter | 能完成一个代码修改任务 |
| P0-05 | 审批服务 | shell/file write 动作可审批 |
| P0-06 | Agent CRUD | 能创建、编辑、禁用 Agent |
| P0-07 | Skill 扫描 | 能读取本地 skill 元数据 |
| P0-08 | 串行 Agent Team | 能按顺序执行多个 Agent |
| P0-09 | 团队知识库基础管理 | 能创建知识库、新增条目、绑定给 Agent |
| P0-10 | MCP 连接器注册 | 能注册 MCP server 并展示健康状态 |
| P0-11 | CLI 连接器注册 | 能注册受控命令模板并绑定给 Agent |
| P0-12 | Workflow Plugin 扫描 | 能读取 `SKILL.md` + `plugin.json` 并展示依赖 |
| P0-13 | Plugin capability gate | 启动插件前展示所需权限并记录授权 |

## P1

| 编号 | 事项 | 验收 |
| --- | --- | --- |
| P1-01 | BrowserOps worker | 能采集网页并保存截图 |
| P1-02 | 自媒体周更 workflow plugin | 能生成文章草稿、封面 brief 和发布包 |
| P1-03 | Artifact Studio | 任务产物进入产物工作台并可预览 manifest |
| P1-04 | Runtime metrics | 记录 token、耗时、工具调用 |
| P1-05 | Skill 权限 manifest | UI 显示权限与风险 |
| P1-06 | 运行回放 | 能按事件重放任务过程 |
| P1-07 | 知识引用与检索 | Agent 输出可展示知识引用来源 |
| P1-08 | MCP/CLI 调用审计 | 每次调用记录参数、审批和结果 |
| P1-09 | 品牌与内容契约 | 项目可维护 `BRAND.md` / `CONTENT.md` 并注入运行 |

## P2

| 编号 | 事项 | 验收 |
| --- | --- | --- |
| P2-01 | Workflow visual builder | 可视化编辑节点 |
| P2-02 | Dify/n8n bridge | 可调用外部工作流 |
| P2-03 | Video worker | 能生成短视频草稿 |
| P2-04 | Team mode | 多用户项目和 RBAC |
| P2-05 | Skill / Plugin marketplace | GitHub/SkillHub/Plugin registry 安装更新 |
| P2-06 | 知识审核流 | 支持 Agent 建议更新、人工审核、过期提醒 |
| P2-07 | Creative Studio 扩展导出 | 支持 PPT、HTML、PDF、ZIP 多格式导出 |
