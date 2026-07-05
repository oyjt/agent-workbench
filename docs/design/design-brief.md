# 高保真设计说明

## 设计目标

Agent Workbench 的界面需要服务高频工作，而不是营销展示。设计重点是清晰、可扫描、可审批、可追踪。本轮高保真原型参考 Ant Design 的企业级后台风格：左侧导航、顶部工具栏、内容卡片、表格、标签、抽屉、弹窗、分段控制和步骤条。

## 设计原则

1. **任务优先**：首页即工作台，直接展示运行任务、审批、产物和状态。
2. **低噪声密度**：使用紧凑但不拥挤的信息布局，减少大面积装饰。
3. **风险可见**：高风险动作、账号授权、文件写入、命令执行必须有明确状态。
4. **能力可组合**：Agent、skills、knowledge、MCP、CLI、runtime、workflow 在界面中保持清晰关系。
5. **本地可信**：强调本地目录、数据留存、审计日志和权限策略。
6. **产物一等**：正文、网页、PPT、图片、视频脚本、代码 diff 等 artifact 有独立预览与版本信息。
7. **授权前置**：Workflow plugin 启动前必须展示 capability gate，明确它会使用哪些 MCP、CLI、文件、网络和浏览器能力。

## 主要界面

| 页面 | 目的 | 核心组件 |
| --- | --- | --- |
| 工作台 | 统一观察任务运行 | KPI、任务队列、审批、运行详情、产物 |
| Agents | 管理单 Agent 与团队 | Agent 表格、runtime、skills、团队编排 |
| Skills | 管理技能包 | Skill 卡片、权限、依赖、自检 |
| 知识库 | 管理团队和项目知识 | 知识条目、SOP、来源、引用、版本、检索范围 |
| 连接器 | 管理 MCP 与 CLI | MCP server、CLI command、健康检查、权限、审计 |
| 插件 | 管理 workflow plugin | 插件目录、输入 schema、pipeline、capability gate |
| Creative Studio | 管理创意产物 | Artifact 预览、品牌/内容契约、评论、导出 |
| 工作流 | 编排业务流程 | 节点流、触发器、审批节点 |
| 资产 | 查看任务产物 | 文档、图片、视频、发布包 |
| 设置 | 配置模型与安全 | Provider、策略、数据目录 |

## 视觉方向

- 产品类型：开发与运营控制台
- 风格：Ant Design 参考风格，清爽、理性、密集、可读
- 颜色：浅色底、深色文字，主色使用 Ant 蓝，绿色表示成功，橙色标记审批与风险，红色标记失败
- 字体：系统 UI 字体，优先保证中文可读性
- 卡片圆角：6px 到 8px
- 交互：Menu、Tabs、Segmented、Table、Tag、Steps、Timeline、Drawer、Modal、Statistic、Switch

## 关键交互

1. 左侧导航切换一级模块，移动端变为顶部横向导航。
2. 工作台可从任务队列选择任务，右侧运行详情同步切换。
3. 审批按钮打开 Drawer，展示动作来源、参数摘要、风险说明和授权范围。
4. 插件页面点击“启动”打开 capability modal，确认后进入对应 workflow。
5. Creative Studio 的 artifact 卡片可切换预览类型，并显示来源 Agent、知识引用和导出格式。

## 原型文件

打开 `prototype/index.html` 查看高保真原型。
