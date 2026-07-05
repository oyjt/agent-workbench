# 实施路线图

## Phase 0：工程起步

目标：建立可运行骨架。

- 初始化 monorepo
- 建立 UI 原型到 React 页面
- 建立 SQLite schema
- 建立 task/run/event 基础模型
- 建立 SSE 事件通道

验收：

- 可以创建一个任务
- UI 能看到任务状态变化
- run events 能持久化

## Phase 1：Coding Agent MVP

目标：接入一个成熟 coding runtime。

- OpenCode 或 Codex adapter
- 流式消息
- 工具调用事件
- 文件 diff artifact
- 命令审批

验收：

- 用户能发起编码任务
- 能看到命令、输出、文件变更
- 高风险命令进入审批

## Phase 2：Skills、知识库与连接器管理

目标：可配置 Agent、Skill、Workflow Plugin、知识范围和连接器。

- Agent CRUD
- Agent Team 串行流程
- Skill 扫描
- Skill 启用/禁用
- Skill 权限 manifest
- Workflow Plugin 扫描与安装
- Plugin capability gate
- 团队知识库 CRUD
- `BRAND.md` / `CONTENT.md` 契约草稿
- MCP server 注册
- CLI command template 注册

验收：

- 用户能创建内容 Agent
- 用户能绑定 skill
- 用户能绑定知识库范围
- 用户能绑定 MCP tool 和 CLI command
- 用户能运行串行 Agent Team
- 用户能启动一个 workflow plugin 并看到授权清单

## Phase 3：BrowserOps Worker

目标：支持运营和自媒体真实网页任务。

- HTTP/SSE worker 协议
- 浏览器 profile 管理
- 页面截图 artifact
- DOM 摘要 artifact
- 浏览器提交审批

验收：

- 用户能完成网页资料采集
- 发布前填表动作必须等待审批

## Phase 4：自媒体工作流

目标：形成第一条业务闭环。

- 自媒体周更 workflow plugin
- 选题、写作、审核、发布包节点
- Artifact Studio 基础预览
- 品牌与内容契约注入
- 发布包导出

验收：

- 从一个主题生成完整发布包
- 产物自动进入 Artifact Studio
- 产物 manifest 记录来源 Agent、知识引用和契约版本

## Phase 5：观测与稳定性

目标：让系统可长期使用。

- runtime metrics
- 错误聚合
- 失败重试
- 运行回放
- 日志导出

验收：

- 用户能定位失败原因
- 用户能比较不同 runtime 成本和耗时

## Phase 6：扩展能力

目标：提高平台化程度。

- Dify/n8n bridge
- Video worker
- Creative Studio：PPT、landing page、图片、视频脚本
- 知识库审核流
- SkillHub/GitHub 安装
- Plugin marketplace / registry
- 团队权限
