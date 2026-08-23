import type { WorkflowPlan } from "../../domain/workbench";

export const workflowTemplates: WorkflowPlan[] = [
  { key: "product-review", name: "产品需求评审", description: "产品、架构、UX 与安全并行评审后汇总结论。", provider: "codex-cli", concurrency: 3, tags: ["DAG", "并行评审", "人工结论"], steps: [
    { id: "analyze", role: "product/product-manager", task: "分析 PRD，提取目标、用户、约束和验收标准。", output: "requirements", dependsOn: [] },
    { id: "tech_review", role: "engineering/software-architect", task: "评估技术可行性、模块边界和风险。", output: "tech_report", dependsOn: ["analyze"] },
    { id: "design_review", role: "design/ux-researcher", task: "评估用户体验、信息架构和操作成本。", output: "design_report", dependsOn: ["analyze"] },
    { id: "security_review", role: "security/security-engineer", task: "检查权限、数据、命令执行和外部账号风险。", output: "security_report", dependsOn: ["analyze"] },
    { id: "summary", role: "product/product-manager", task: "综合结论并输出 Go / No-Go。", output: "decision", dependsOn: ["tech_review", "design_review", "security_review"] },
  ] },
  { key: "content-publish", name: "自媒体发布闭环", description: "选题、正文、封面、审批和发布包生成。", provider: "deepseek", concurrency: 2, tags: ["内容", "审批", "Artifact"], steps: [
    { id: "research", role: "marketing/trend-researcher", task: "收集热榜、竞品和历史素材。", output: "research_pack", dependsOn: [] },
    { id: "outline", role: "content/content-strategist", task: "生成大纲、角度和标题候选。", output: "outline", dependsOn: ["research"] },
    { id: "draft", role: "content/writer", task: "撰写正文并标注知识引用。", output: "draft", dependsOn: ["outline"] },
    { id: "cover", role: "design/visual-storyteller", task: "生成封面 brief 与配图建议。", output: "cover_brief", dependsOn: ["outline"] },
    { id: "approval", role: "human", task: "确认浏览器写入草稿箱的能力授权。", dependsOn: ["draft", "cover"], type: "approval" },
    { id: "handoff", role: "ops/publisher", task: "生成发布包和复盘清单。", output: "publish_pack", dependsOn: ["approval"] },
  ] },
  { key: "dev-pr-review", name: "代码变更评审", description: "代码、安全、性能并行检查后汇总。", provider: "codex-cli", concurrency: 3, tags: ["Coding", "PR", "安全"], steps: [
    { id: "scan", role: "engineering/code-reviewer", task: "读取 diff，识别行为变化和测试缺口。", output: "code_findings", dependsOn: [] },
    { id: "security", role: "security/application-security", task: "检查鉴权、输入校验和 secret 风险。", output: "security_findings", dependsOn: ["scan"] },
    { id: "performance", role: "engineering/performance-engineer", task: "检查性能、包体积和渲染成本。", output: "perf_findings", dependsOn: ["scan"] },
    { id: "final", role: "engineering/tech-lead", task: "汇总阻塞项、建议和可合并条件。", output: "review_summary", dependsOn: ["security", "performance"] },
  ] },
];

