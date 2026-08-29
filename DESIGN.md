---
name: Agent Workbench
description: 安静、熟悉、内容优先的本地 AI 共同写作工作台
colors:
  ink: "#202123"
  body: "#343541"
  muted: "#676767"
  placeholder: "#707070"
  line: "#deded8"
  line-strong: "#b8b8b0"
  canvas: "#f7f7f5"
  sidebar: "#f3f3f0"
  panel: "#ffffff"
  hover: "#e9e9e5"
  selected: "#e5e5df"
  accent: "#202123"
  accent-contrast: "#ffffff"
  success: "#18794e"
  success-soft: "#eaf6ef"
  warning: "#8a5b12"
  warning-soft: "#fff7df"
  danger: "#b42318"
  danger-soft: "#fff0ef"
  code: "#17181c"
  code-text: "#e8e8ec"
  selection: "#cfe8df"
typography:
  display:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(28px, 3vw, 38px)"
    letterSpacing: "-.03em"
  mobile-display:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "30px"
    fontWeight: 600
  settings-title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "20px"
    fontWeight: 600
    letterSpacing: "-.02em"
  action-icon:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "18px"
    fontWeight: 400
  title:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  compact:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 400
  mobile-body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
  meta:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "11px"
    fontWeight: 400
  micro:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "10px"
    fontWeight: 400
  mono:
    fontFamily: '"SFMono-Regular", Consolas, monospace'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  caret: "3px"
  bubble-tail: "5px"
  sm: "8px"
  glyph: "9px"
  md: "12px"
  mark: "14px"
  lg: "16px"
  composer: "18px"
components:
  button-new-session:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  button-send:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "50%"
    size: "44px"
  search-input:
    backgroundColor: "rgba(255, 255, 255, .58)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
  selected-session-row:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 3px 0 0"
  user-message:
    backgroundColor: "#f1f1ef"
    textColor: "{colors.body}"
    rounded: "18px 18px 5px 18px"
    padding: "11px 16px"
  assistant-message:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    width: "700px"
  composer:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "18px"
    padding: "10px 10px 9px 15px"
  approval-panel:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.body}"
    rounded: "{rounded.lg}"
    padding: "16px"
  activity-item:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    padding: "0 0 18px"
  artifact-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px"
  settings-modal:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.composer}"
    width: "900px"
  settings-tab-active:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: Agent Workbench

## Overview

**Creative North Star: "安静的共同写作桌"**

Agent Workbench 像一张安静、长期使用的共同写作桌：界面熟悉到不需要学习，正文始终占据视觉中心，用户可以从起草、改写到续写一直留在同一段对话中。工艺来自稳定的阅读宽度、温暖中性纸面、克制墨色和可预期的控件，而不是强品牌隐喻或装饰性舞台。

复杂度按需出现。会话列表提供连续性，底部输入器保持随时可写；运行日志、工具详情、上下文和产物进入右侧活动抽屉，不与写作正文争夺注意力。整体气质克制、熟悉、耐久，并以清晰反馈、键盘可达和可靠语义承担专业感。

**Key Characteristics:**

- 左侧会话、中间开放对话、底部持续输入的低学习成本结构。
- 温暖中性墨色、纸面白与柔和灰阶，强调来自稀少而明确的深色动作。
- 正文开放呈现，用户消息轻量成泡；机器活动与交付信息进入右侧抽屉。
- 组件克制、熟悉、耐久，状态始终由颜色之外的文字或结构共同表达。

## Colors

调色板以温暖中性纸面和近黑墨色建立安静的阅读环境；绿色、琥珀和淡红只承担真实状态语义。

### Primary

- **温暖墨色：** 主要文字、品牌字形、发送动作与键盘焦点的共同锚点；它不是装饰性品牌色。
- **纸面白：** 主对话、输入器、抽屉和卡片的主要内容表面。

### Neutral

- **正文墨灰：** 长段回复和说明文字，弱于标题但保持舒适阅读对比。
- **辅助墨灰：** 时间、连接说明、活动摘要和次级标签。
- **占位墨灰：** 输入提示的明确基线，不使用依赖背景合成的低透明度文字。
- **暖纸底色：** 页面与细分表面的低对比背景层。
- **侧栏纸灰：** 仅用于会话导航，与主内容形成温和分区。
- **柔和悬停与选中：** 通过轻微明度变化标记可操作和当前状态，不产生高饱和色块。
- **结构线与强调线：** 细边框、分隔线和输入轮廓的主要层次工具。

### Semantic

- **完成绿：** 在线、运行中与成功状态，并配合文字或状态点结构。
- **审批琥珀：** 等待确认与审批表面，只用于需要用户判断的情境。
- **淡红危险语义：** 删除、失败、高风险和离线状态；大面积背景只使用柔和危险表面。
- **代码深面：** 活动详情与产物预览中的机器文本容器，不扩展为主界面主题。

### Named Rules

**The Quiet Ink Rule.** 深墨色负责文字、焦点和少量主动作，不把整块界面染成品牌色。

**The Semantic Color Rule.** 成功、审批和危险色只表达对应状态，并始终配合文字、图标或结构提示。

**The Accessible Signal Rule.** 正文与小型状态文字保持可读对比，控件和焦点指示清晰可辨；颜色永远不是唯一信号。

## Typography

**Display Font:** 系统无衬线字体栈，以 Segoe UI、PingFang SC 和 Microsoft YaHei 为中文回退。

**Body Font:** 同一系统无衬线字体栈。

**Label/Mono Font:** 元数据沿用系统无衬线；运行 ID、代码与产物预览使用 SFMono-Regular / Consolas 等宽栈。

**Character:** 字体中性、清晰、跨平台，像熟悉的写作工具而不是品牌海报。层级依靠字号、字重、行距和留白建立，避免多字体制造噪声。

### Hierarchy

- **Display：** 只用于空状态欢迎问题，保持紧凑字距和简短句式。
- **Title：** 会话标题、活动标题和主要状态标题，单行场景允许截断。
- **Body：** 对话正文采用舒展行距，桌面阅读轨道控制在约 700–780px；移动端略收紧字号与行距。
- **Label：** 作者、分区标题和状态摘要使用半粗字重，避免在长段文字中使用。
- **Meta：** 时间、连接状态和辅助提示保持紧凑，并对数字使用等宽数字特性。
- **Mono：** 仅用于运行 ID、代码、路径和机器内容。

### Named Rules

**The Reading First Rule.** 长内容优先获得舒展行距和受控行长；只有代码、路径和机器标识切换到等宽字体。

## Layout

桌面是两列应用壳：272px 左侧会话栏与弹性主区。主区由 64px 标题栏、可滚动对话和底部输入轨道组成；对话正文最大宽度约 780px，输入器沿约 820px 的中心轨道持续可用。右侧活动区不是常驻第三栏，而是按需覆盖打开的抽屉，宽度不超过 420px。

900px 以下侧栏收窄为 244px，对话和欢迎示例同步收敛。760px 以下进入单列：左侧会话栏变为最大 288px、占视口 88% 的模态抽屉，右侧活动抽屉占满视口，主内容保留约 14px 的左右阅读余量；输入器贴近安全区并隐藏非必要键盘提示。

常见内部节奏来自 4、8、10、12、14、16、20、24 和 32px 的已实现间距。所有主要图标按钮与表单控件维持至少 44px 的可操作尺寸。

**The Conversation First Rule.** 会话正文与输入器始终是主层；运行日志、工具记录、上下文和产物只在活动抽屉中按需出现。

## Elevation & Depth

系统默认扁平，主要依靠纸面色差、细边框和遮罩建立层次。输入器使用轻柔环境阴影保持持续可写感，输入焦点叠加低透明度墨色光环；右侧活动抽屉和移动端会话抽屉使用方向性阴影与主内容分离。

### Shadow Vocabulary

- **输入器环境阴影：** `0 8px 26px rgba(32, 33, 35, .08)`，仅用于底部持续输入器。
- **输入焦点光环：** `0 0 0 3px rgba(32, 33, 35, .08)` 或表单控件使用的 `.12` 强度，与清晰边框共同出现。
- **活动抽屉阴影：** `-16px 0 40px rgba(32, 33, 35, .12)`，表达从右侧覆盖进入。
- **移动会话抽屉阴影：** `14px 0 36px rgba(32, 33, 35, .14)`，表达从左侧覆盖进入。

### Named Rules

**The Border Before Shadow Rule.** 静态内容优先用边框和纸面色差分层；阴影只服务于输入焦点和覆盖式浮层。

## Shapes

形状语言温和但不软萌。基础圆角由 8px、12px 和 16px 三档组成：机器文本与小型控件最紧，导航项和卡片居中，审批面板与欢迎卡片更舒展。持续输入器与用户消息使用 18px 轮廓；用户气泡右下角收紧为 5px，形成轻量方向性。圆形只用于发送按钮、状态点和活动轨道节点。

边框保持细且连续，避免玻璃拟态、发光描边、厚重卡片壳或为每段内容增加容器。

## Components

### Buttons

- **Shape:** 主要图标按钮使用 44×44px 圆形轮廓；新对话与侧栏操作使用中等圆角和同等高度。
- **Primary:** 发送按钮为温暖墨色底、纸面白图标，无装饰阴影；高风险审批的确认按钮沿用明确主操作语义。
- **Hover / Focus:** 悬停仅轻微提亮或改变纸面色；键盘焦点使用 2px 墨色轮廓并外移 2px，不造成布局位移。
- **Secondary / Ghost:** 透明或纸面背景、结构线和深墨文字；删除操作在悬停时切换为淡红危险表面。

### Chips

- **Style:** 任务状态和风险标签使用语义文字与柔和语义表面，不承担主操作。
- **State:** 移动端可隐藏冗余任务标签，但标题与连接状态仍保留可恢复信息。

### Cards / Containers

- **Corner Style:** 欢迎示例和审批面板使用大圆角，产物条目与设置表单使用中等圆角。
- **Background:** 默认纸面白；用户消息、选中会话和语义状态使用各自轻量表面。
- **Shadow Strategy:** 静态卡片不使用阴影。
- **Border:** 结构线承担卡片、输入和抽屉内部分隔。
- **Internal Padding:** 常规紧凑容器使用 12–16px；不为开放式智能体回复添加卡片壳。

### Inputs / Fields

- **Style:** 搜索框使用半透明纸面，常规字段与组合输入器使用纸面白和明确边框；表单控件最小高度为 44px。
- **Focus:** 墨色边框与低透明度焦点光环同时出现。
- **Error / Disabled:** 错误保留文字反馈；禁用发送按钮使用低对比灰面与禁用光标。
- **Composer:** 文本区开放在组合输入器顶部，智能体与权限控制位于底部，发送动作固定在右侧；输入可在 2–8 行之间增长。

### Navigation

左侧会话栏是唯一常驻一级导航。当前会话以柔和选中底色表达，悬停仅改变纸面明度；删除动作在桌面悬停或键盘聚焦时显现，在移动端始终可见。侧栏底部保留工作区与设置入口，并用细分隔线与会话列表区分。

移动端侧栏以模态抽屉打开，背景遮罩、Escape 关闭、焦点隔离和关闭后的触发点恢复必须保持完整。

### Conversation Stream

用户消息右对齐并使用轻量气泡；智能体回复左对齐、带小型墨色头像并保持开放阅读面。生成中使用低干扰光标或思考点；在 `prefers-reduced-motion` 下停止可见动画。审批卡留在对话中，因为它需要用户决定；普通运行事件和工具详情全部进入活动抽屉。

### Activity Drawer

活动、产物和上下文共享从右侧进入的模态抽屉。活动使用细线时间轨道和 24px 节点；工具节点可显示代码图标，普通节点使用中性点。工具载荷折叠后以深色等宽代码面显示，正文不会复制运行日志。

### Settings Modal

设置使用居中、受控宽度的模态工作区，而不是与正文竞争的第三栏。桌面端以约 210px 分类导航搭配单一滚动内容区；当前分类使用柔和选中纸面，不使用品牌色条。新增配置默认折叠成清晰操作行，展开后才显示完整表单。

移动端设置保持轻量弹窗轮廓，分类导航变为可横向滚动的图标文字标签，内容区独立纵向滚动。表单、权限说明和空状态始终位于当前分类内，不把所有配置堆叠成一个长页面。

## Do's and Don'ts

### Do:

- **Do** 让用户始终可以看到当前对话、持续输入器和明确的发送路径。
- **Do** 将运行日志、工具详情、上下文和产物放入右侧活动抽屉，保持正文纯净。
- **Do** 使用温暖纸面、墨色文字、细边框和有限阴影建立安静而耐久的层次。
- **Do** 保持至少 44px 的交互目标、清晰键盘焦点、Escape 关闭和浮层焦点恢复。
- **Do** 为成功、审批、失败、离线和危险操作提供颜色之外的文字或结构提示。
- **Do** 尊重 reduced-motion，并让流式状态在无动画时仍可理解。

### Don't:

- **Don't** 回到控制塔、常驻三栏、冷蓝仪表盘或高密度监控台的视觉叙事。
- **Don't** 让运行日志、工具调用或机器事件混入持续写作正文。
- **Don't** 使用录音室、指挥舱等强隐喻来替代熟悉的聊天与写作范式。
- **Don't** 用玻璃拟态、渐变、霓虹、发光描边或装饰动画制造品牌感。
- **Don't** 给开放式智能体回复套卡片，也不要让阴影取代结构线和纸面色差。
- **Don't** 让颜色成为状态、风险或当前选择的唯一信号。
