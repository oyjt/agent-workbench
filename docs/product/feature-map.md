# 功能地图

## MVP 功能分层

```mermaid
mindmap
  root((Agent Workbench))
    工作台
      任务创建
      运行流
      审批队列
      文件变更
      运行指标
    Agents
      单 Agent
      Agent Team
      角色提示词
      Runtime 绑定
      Skills 绑定
      知识范围绑定
    Skills
      本地扫描
      启用禁用
      权限声明
      自检
      安装更新
    Workflow Plugins
      SKILL.md
      plugin.json
      输入 Schema
      Pipeline
      Capability Gate
    知识库
      项目资料
      SOP
      决策记录
      品牌语气
      内容契约
      BRAND.md
      CONTENT.md
      检索引用
      版本审核
    连接器
      MCP Servers
      CLI Commands
      环境变量
      健康检查
      权限审计
    Workflows
      自媒体流程
      编码流程
      运营日报
      定时任务
      人工审批节点
    Assets
      文档
      图片
      视频
      PPT
      HTML Artifact
      代码 Diff
      发布包
      任务产物
    Creative Studio
      Landing Page
      社媒素材
      视频脚本
      Artifact 预览
      导出包
    Settings
      模型提供商
      MCP
      CLI
      账号授权
      安全策略
      数据目录
```

## Runtime 能力矩阵

| Runtime | 主要用途 | 接入方式 | MVP |
| --- | --- | --- | --- |
| OpenCode | 编码、代码审查、测试 | CLI / server / plugin | 是 |
| Codex | 编码、本地任务、文件变更 | CLI / app-server / JSON-RPC | 可选 |
| GenericAgent worker | 浏览器操作、运营任务 | HTTP/SSE worker | 是 |
| CyberCode-style worker | 视频、轻量内容生成 | HTTP/SSE worker | 否，作为实验 |
| Open Design-inspired creative runtime | 设计、PPT、网页、图片、视频脚本产物 | Workflow plugin / artifact preview / CLI | P1 |
| Dify / n8n | 固定流程自动化 | HTTP API / webhook | P1 |
| MCP server | 工具扩展 | stdio / SSE / HTTP | 是 |
| CLI connector | 复用本地命令行能力 | command template / JSON schema | 是 |

## 核心对象关系

```mermaid
erDiagram
  AGENT ||--o{ AGENT_SKILL : binds
  SKILL ||--o{ AGENT_SKILL : used_by
  WORKFLOW_PLUGIN ||--o{ SKILL : uses
  WORKFLOW_PLUGIN ||--o{ MCP_SERVER : requires
  WORKFLOW_PLUGIN ||--o{ CLI_COMMAND : requires
  AGENT ||--o{ TASK : runs
  AGENT_TEAM ||--o{ TEAM_MEMBER : contains
  AGENT ||--o{ TEAM_MEMBER : joins
  TASK ||--o{ RUN_EVENT : emits
  TASK ||--o{ APPROVAL_REQUEST : requires
  TASK ||--o{ ARTIFACT : produces
  ARTIFACT ||--o{ ARTIFACT_VERSION : versions
  RUNTIME ||--o{ TASK : executes
  MCP_SERVER ||--o{ SKILL : extends
  CLI_COMMAND ||--o{ AGENT : exposed_to
  KNOWLEDGE_BASE ||--o{ KNOWLEDGE_ITEM : contains
  AGENT ||--o{ KNOWLEDGE_SCOPE : retrieves
```
