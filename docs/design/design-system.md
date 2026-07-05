# 设计系统草案

## 色彩

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#f5f5f5` | 页面背景，参考 Ant Design Layout |
| `--surface` | `#ffffff` | 面板、卡片 |
| `--surface-soft` | `#fafafa` | 次级背景 |
| `--text` | `#262626` | 主文本 |
| `--muted` | `#8c8c8c` | 次级文本 |
| `--line` | `#f0f0f0` | 分割线 |
| `--primary` | `#1677ff` | 主操作、选中状态 |
| `--success` | `#52c41a` | 成功、运行中 |
| `--warning` | `#faad14` | 等待审批、警示 |
| `--error` | `#ff4d4f` | 错误、高风险 |
| `--info` | `#13c2c2` | 信息、连接器在线 |

## 字体

- Font family：`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
- 页面标题：20px / 28px / 600
- 区块标题：16px / 24px / 600
- 正文：14px / 21px / 400
- 表格与标签：12px / 18px / 500
- 数字：使用 tabular numbers

## 间距

- 基础单位：4px
- 卡片内边距：16px
- 区块间距：16px / 20px
- 表格行高：44px 到 52px
- 图标按钮尺寸：36px 到 40px
- 页面内容间距：24px 桌面、16px 平板、12px 手机

## 组件

### 状态徽标

- `Running`：青绿色
- `Waiting Approval`：琥珀色
- `Failed`：红色
- `Completed`：蓝灰色

### 审批卡片

审批卡片必须展示：

- 来源 Agent
- 操作类型
- 目标对象
- 风险等级
- 参数摘要
- 允许、拒绝、编辑参数

### Runtime 卡片

Runtime 卡片必须展示：

- 运行器类型
- 在线状态
- 当前任务数
- 平均 TTFT
- 最近错误

### Skill 卡片

Skill 卡片必须展示：

- 名称和版本
- 权限声明
- 依赖状态
- 绑定 Agent 数
- 启用开关

### 知识卡片

知识卡片必须展示：

- 知识标题
- 类型：SOP、决策、平台规则、品牌规范、技术资料
- 来源和更新时间
- 可见范围
- 引用次数
- 审核状态

### 连接器卡片

连接器卡片必须展示：

- 类型：MCP 或 CLI
- transport 或 command template
- 健康状态
- 权限等级
- 可用工具数或参数 schema
- 最近一次调用结果

### Workflow Plugin 卡片

Plugin 卡片必须展示：

- 名称、版本和来源
- 支持场景：自媒体、编码、运营、设计、视频
- 输入 schema 数量
- Pipeline stage：discovery、plan、generate、critique、handoff
- 依赖的 skills、MCP、CLI
- Capability gate 风险摘要

### Artifact Studio

Artifact Studio 必须支持：

- HTML、Markdown、PPT、图片、视频脚本、diff、zip 等类型
- 来源 Agent、来源 plugin、父版本
- 知识引用与契约版本
- 预览、下载、导出发布包
- 评论与二次修改入口
