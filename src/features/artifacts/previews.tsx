import { Tag, Typography } from "antd";

const { Paragraph, Title } = Typography;

export function ArticlePreview() {
  return <article className="doc-preview"><Tag color="processing">Markdown</Tag><Title>AI Agent 工作流：从工具到团队协作</Title><Paragraph>本文从自媒体、编码、运营三个场景切入，解释为什么通用 Agent 产品不应重写单体 Agent，而应成为任务、工具、知识和产物的工作台。</Paragraph><ul><li>引用：公众号发布前审核 SOP</li><li>契约：CONTENT.md v2026-07-04</li></ul></article>;
}
export function LandingPreview() {
  return <div className="landing-preview"><Tag color="processing">HTML</Tag><Title>Agent Workbench Launch Kit</Title><Paragraph>本地优先的多 Agent 控制台，把任务、工具、知识和产物放进一个可审批工作流。</Paragraph></div>;
}
export function DeckPreview() {
  return <div className="deck-preview"><Tag color="success">PPT</Tag><Title>从 Agent 到 Agent Team</Title><Paragraph>10 页产品说明 · 4 个图表 · 2 条决策记录引用</Paragraph></div>;
}
export function CoverPreview() { return <div className="cover-preview">Agent Workbench</div>; }
export function DiffPreview() { return <pre className="diff-preview">{`+ plugin_grants 表记录授权来源
+ task_status 支持 queued / paused / cancelled
+ connectors 统一 MCP 与 CLI 注册表
- 旧资产仅记录本地路径`}</pre>; }

