# Session-first Web 设计说明

## 设计目标

Agent Workbench 是本地 Agent 工作界面，不是能力管理后台。页面唯一核心任务是：选择 Workspace，用自然语言启动或继续一个 Session，并在同一上下文中处理工具调用、审批和产物。

## 信息架构

```text
Session rail          Conversation / Composer          Details
Workspace             User goal                        Run
Session history       Execution event track            Produced files
Search                Inline approval                  Context
Settings              Follow-up input
```

一级入口只有 New Session、Workspace、Sessions 和 Settings。Agents、Skills、Plugins、Connectors、Knowledge、Workflows、Secrets 不再占据一级导航，统一作为 Settings 内的渐进式配置。

## 视觉方向

- 中性石墨文字、白色内容面和低饱和蓝交互色，不使用泛化“AI 紫色”。
- 8px/4px 间距节奏，紧凑但保留约 44px 的主要交互区域。
- 消息流左侧的“执行轨道”是唯一签名元素，用连续细线连接 Runtime、Tool、Approval 与 Artifact 事实。
- 工具调用使用浅灰容器，审批使用克制的暖色容器；颜色不作为唯一状态提示。
- 动效仅用于侧栏与详情展开，且遵循 `prefers-reduced-motion`。

## 关键交互

1. New Session 清空当前选择，焦点回到 Composer。
2. Enter 发送，Shift + Enter 换行。
3. 中高风险能力直接在执行轨道中显示 Allow once / Deny，不跳转到独立审批页。
4. Produced Files 位于右侧 Details，可在 Modal 中查看内容。
5. 窄屏下 Session rail 与 Details 变为可开合覆盖层，主 Composer 始终可用。
6. API 不可用时显示明确恢复动作，不自动切换到浏览器静态副本。

## 可访问性

- 提供 Skip link，所有图标按钮具有可访问名称。
- 键盘焦点可见，Tab 顺序与三栏视觉顺序一致。
- 正文不低于 4.5:1 对比度，状态同时使用文本与颜色。
- 支持 375px、768px、1024px 和 1440px，不产生横向滚动。
