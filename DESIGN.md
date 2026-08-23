---
name: Agent Workbench
description: 克制、专业、高密度的本地 Agent 任务控制塔
colors:
  control-blue: "#1e40af"
  action-blue: "#2563eb"
  ink: "#172033"
  body-ink: "#39465a"
  muted-ink: "#5b6678"
  placeholder-ink: "#6b7280"
  canvas: "#f4f6f8"
  subtle-surface: "#f7f8fa"
  hover-surface: "#edf0f4"
  panel: "#ffffff"
  border: "#dbe2ea"
  strong-border: "#a9b7ca"
  track-border: "#cfd7e3"
  track-node: "#aeb9c8"
  selected: "#edf3ff"
  selected-border: "#c9d8f7"
  success: "#15803d"
  success-ink: "#166534"
  success-surface: "#ecfdf3"
  success-border: "#86efac"
  warning: "#a16207"
  warning-ink: "#854d0e"
  warning-surface: "#fffbeb"
  warning-border: "#f4d38a"
  danger: "#b42318"
  danger-surface: "#fee4e2"
  danger-tag-surface: "#fef3f2"
  danger-border: "#fda29b"
  approval-surface: "#fffaf0"
  approval-border: "#d6a651"
  code-surface: "#101827"
  code-text: "#d8e2f0"
  selection: "#cddcff"
typography:
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "40px"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  selected-row:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px"
---

# Design System: Agent Workbench

## Overview

**Creative North Star: "本地任务控制塔"**

界面像一座紧凑的本地任务控制塔：状态、会话、权限和产物必须能够快速扫描，视觉表达服务于判断和操作。整体气质克制、专业、高密度，品牌存在于精确的间距、明确的状态和稳定的交互中，而不是装饰性场景。

组件保持克制、精细和轻量。层次主要由面板底色、细边框与有限的控制蓝建立；阴影只在输入焦点、浮层和小屏抽屉等需要脱离背景的场景出现。

**Key Characteristics:**

- 三栏操作型应用壳，信息结构优先于视觉表演。
- 冷静的蓝灰中性色，控制蓝只标记主操作、选中和焦点。
- 紧凑但不拥挤，重复使用 8–32px 的间距节奏。
- 状态同时依靠文字、图标或结构表达，不单独依赖颜色。

## Colors

颜色体系以控制蓝和冷静蓝灰中性色为核心；危险、成功和审批色只承担明确语义。

### Primary

- **控制蓝：** 用于焦点环、选中指示和需要明确控制权的交互。
- **行动蓝：** Ant Design 主操作按钮和主要 CTA 的现有颜色。

### Neutral

- **深墨蓝：** 标题、主要正文和品牌字形。
- **辅助墨灰：** 次级信息、时间和元数据；保持足够对比度。
- **占位墨灰：** 输入提示的最低对比度基线，不得回退到半透明黑色。
- **控制台底色：** 页面与侧栏之间的低对比背景层。
- **面板白：** 会话主区、卡片、表单和内容表面。
- **结构边框：** 面板、输入、卡片和分隔线的主要层次工具。
- **选中浅蓝：** 当前会话、用户消息和选中状态的轻量强调。

### Named Rules

**The Sparse Blue Rule.** 控制蓝用于操作、焦点和当前状态，不把整块工作区染成品牌色。

**The Semantic Color Rule.** 成功、危险和审批颜色只表达对应状态，并始终配合文字或结构提示。

**The AA Text Rule.** 正文、次级文字、占位符和小型状态标签在其实际表面上均须达到 4.5:1；控件与焦点指示至少达到 3:1。

## Typography

**Display Font:** 系统无衬线字体栈，以 Segoe UI、PingFang SC 和 Microsoft YaHei 为中文回退。

**Body Font:** 同一系统无衬线字体栈。

**Label/Mono Font:** 元数据沿用系统无衬线；运行 ID、代码与产物预览使用 SFMono-Regular / Consolas 等宽栈。

**Character:** 字体系统中性、清晰、跨平台，不依赖网络字体。层级主要通过字号、字重和布局位置建立，避免多字体制造噪声。

### Hierarchy

- **Display：** 仅用于欢迎页主问题，由 Ant Design 标题层级提供。
- **Headline：** 会话标题和主要状态标题，紧凑排列且单行截断。
- **Title：** 设置分区、事件名称和卡片标题，使用中等或半粗字重。
- **Body：** 默认正文保持 16px 基线和约 1.5 行高，长内容限制在约 760px 阅读宽度。
- **Label：** 12px 半粗体，用于作者、时间、工作区标签和元数据；不得用于长正文。

### Named Rules

**The One Family Rule.** UI 文本统一使用系统无衬线，只有代码、路径和机器标识切换到等宽字体。

## Layout

桌面采用 272px 左侧会话栏、弹性主会话区和 336px 详情栏。主内容把阅读宽度控制在约 760–800px，输入器固定在会话底部的视觉轨道中。

间距以 8px 为基础节奏，常用层级为 8、12、16、24 和 32px。1120px 以下将详情栏转为右侧浮层；760px 以下收敛为单列，左侧栏成为抽屉，设置表单从双列变为单列，示例卡片纵向排列。

**The Scan First Rule.** 每个区域先暴露名称、状态和主操作，再通过详情、折叠内容或设置分区呈现复杂信息。

## Elevation & Depth

系统默认扁平，以背景色差和 1px 边框建立结构。阴影是功能性例外：会话输入器使用轻柔环境阴影保持悬浮感，焦点增加控制蓝光环，小屏抽屉使用方向性阴影与主内容分离。

### Shadow Vocabulary

- **输入器环境阴影：** `0 10px 32px rgba(25,39,64,.1)`，仅用于底部组合输入器。
- **焦点光环：** `0 0 0 3px rgba(30,64,175,.12)`，与清晰边框共同出现。
- **侧栏浮层阴影：** `12px 0 36px rgba(25,39,64,.16)`，仅在移动端抽屉状态使用。

### Named Rules

**The Border Before Shadow Rule.** 优先用边框和色块分层；只有浮层、焦点和固定输入器可以使用阴影。

## Shapes

形状语言是轻度圆角的工具界面。小型代码块和状态表面使用 8px；按钮、输入和列表项使用约 10px；卡片使用 12px；会话气泡与组合输入器使用 16px。发送按钮是唯一稳定使用圆形轮廓的主要控件。

边框保持细且连续，避免发光描边、玻璃材质和高装饰性轮廓。

## Components

### Buttons

- **Shape:** 主按钮使用中等圆角；图标按钮维持至少 44×44px 点击区域。
- **Primary:** 行动蓝底、白字，无装饰阴影；新建会话按钮高度 40px。
- **Hover / Focus:** 焦点使用 2px 控制蓝轮廓并外移 2px；交互不得造成布局位移。
- **Secondary / Ghost:** 使用透明或白色背景、结构边框和深墨蓝文字。

### Chips

- **Style:** 标签承担状态或权限摘要，颜色必须匹配语义。
- **State:** 标签不是主操作；需要操作时使用按钮或分段控件。

### Cards / Containers

- **Corner Style:** 常规卡片使用 10–12px 圆角。
- **Background:** 默认面板白；工具事件和设置表单使用极浅灰色块。
- **Shadow Strategy:** 静态卡片不使用阴影。
- **Border:** 1px 结构边框。
- **Internal Padding:** 12–16px；欢迎示例可提高到 14px 并保持较大点击面积。

### Inputs / Fields

- **Style:** 面板白背景、结构边框、中等圆角，触控高度至少 44px。
- **Focus:** 控制蓝边框与低透明度焦点光环同时出现。
- **Error / Disabled:** 依赖 Ant Design 的语义状态，同时保留清晰文字反馈。
- **Placeholder:** 使用明确的占位墨灰，不使用依赖背景合成的低透明度灰。

### Navigation

左栏为一级会话导航，当前项使用选中浅蓝和左侧控制蓝指示线。设置位于侧栏底部并由分隔线区分；移动端导航转为可关闭抽屉，不与主会话并列挤压。

### Conversation Stream

初始提示和后续用户消息使用浅蓝、右下角收紧的气泡；智能体文本保持开放阅读面。工具、审批和运行事件进入带节点的纵向轨道，避免把机器事件伪装成人类对话。

## Do's and Don'ts

### Do:

- **Do** 优先保证状态、主操作和当前上下文可以快速扫描。
- **Do** 使用边框、面板色差和有限控制蓝建立层次。
- **Do** 保持 8–32px 的紧凑间距节奏和至少 44px 的交互目标。
- **Do** 为危险、审批、失败和离线状态提供文字恢复路径。
- **Do** 将浮层焦点限制在当前任务，并在关闭后恢复到触发控件。

### Don't:

- **Don't** 使用营销型渐变、大面积玻璃拟态或无意义装饰动画。
- **Don't** 通过过度极简、低对比度或大量留白牺牲工作效率。
- **Don't** 使用游戏化霓虹、发光边框或赛博朋克视觉语言。
- **Don't** 让阴影取代结构边框，也不要让颜色成为唯一状态信号。
