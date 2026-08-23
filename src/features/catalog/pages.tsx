import { Button, Card, Col, Descriptions, Empty, Row, Space, Steps, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ApiSkill, ApiWorkflowPlugin } from "../../api";
import type { KnowledgeItem, RiskLevel } from "../../domain/workbench";

const { Paragraph, Text } = Typography;

const riskMeta: Record<RiskLevel, { color: string; label: string }> = {
  low: { color: "success", label: "低风险" },
  medium: { color: "warning", label: "中风险" },
  high: { color: "error", label: "高风险" },
};

export function SkillsPage({ skills }: { skills: ApiSkill[] }) {
  const columns: ColumnsType<ApiSkill> = [
    { title: "Skill", dataIndex: "name", render: (_, record) => <Space orientation="vertical" size={0}><Text strong>{record.name}</Text><Text type="secondary">{record.description || "未填写描述"}</Text></Space> },
    { title: "权限", dataIndex: "permissions", render: (permissions: string[]) => <Space wrap>{permissions.length ? permissions.map((item) => <Tag key={item}>{item}</Tag>) : <Tag>none</Tag>}</Space> },
    { title: "风险", dataIndex: "risk", width: 112, render: (risk: RiskLevel) => <Tag color={riskMeta[risk].color}>{riskMeta[risk].label}</Tag> },
    { title: "路径", dataIndex: "path", ellipsis: true },
  ];
  return <Row gutter={[16, 16]}><Col xs={24} xl={16}><Card title="本地 Skills" extra={<Tag color="processing">scan /skills</Tag>}>{skills.length ? <Table<ApiSkill> rowKey="id" pagination={false} columns={columns} dataSource={skills} /> : <Empty description="暂无扫描到的本地 Skill" />}</Card></Col><Col xs={24} xl={8}><Card title="接入规则"><Steps direction="vertical" size="small" current={2} items={[{ title: "读取 SKILL.md" }, { title: "解析权限与风险" }, { title: "绑定 Agent / Plugin" }, { title: "进入审批与审计" }]} /></Card></Col></Row>;
}

const fallbackPlugins: ApiWorkflowPlugin[] = [
  { id: "weekly-media-post", name: "自媒体周更", description: "热榜采集、正文生成、封面 brief、审核、发布包", version: "demo", path: "plugins/weekly-media-post", skills: ["content-planner", "web-access"], mcpTools: ["browser.search", "filesystem.read"], cliCommands: [], knowledgeScopes: ["BRAND.md", "CONTENT.md"], capabilities: ["network:read", "knowledge:read", "files:write", "browser:input"], pipeline: ["discovery", "plan", "generate", "critique", "handoff"] },
  { id: "coding-task", name: "代码需求实现", description: "需求澄清、代码修改、测试、diff 审批、变更摘要", version: "demo", path: "plugins/coding-task", skills: ["code-implementer"], mcpTools: ["filesystem.read", "github.pull_request"], cliCommands: ["pnpm build"], knowledgeScopes: ["架构决策", "代码文档"], capabilities: ["files:write", "cli:run", "mcp:read"], pipeline: ["plan", "patch", "test", "review", "handoff"] },
  { id: "launch-kit", name: "产品上线宣传包", description: "Landing page、PPT、社媒图、短视频脚本和导出包", version: "demo", path: "plugins/launch-kit", skills: ["content-planner"], mcpTools: [], cliCommands: [], knowledgeScopes: ["BRAND.md"], capabilities: ["knowledge:read", "files:write"], pipeline: ["brief", "copy", "visual", "export"] },
];

export function PluginsPage({ plugins, onStart }: { plugins: ApiWorkflowPlugin[]; onStart: () => void }) {
  const rows = plugins.length ? plugins : fallbackPlugins;
  return <Card title="Workflow Plugins" extra={<Button type="primary">安装插件</Button>}><Row gutter={[16, 16]}>{rows.map((plugin) => <Col xs={24} lg={8} key={plugin.id}><Card className="plugin-card" title={plugin.name} extra={<Tag color={plugin.version === "demo" ? "default" : "success"}>{plugin.version}</Tag>} actions={[<Button key="start" type={plugin.id === "weekly-media-post" ? "primary" : "default"} onClick={onStart}>启动</Button>]}><Paragraph>{plugin.description}</Paragraph><Space wrap>{plugin.pipeline.map((step) => <Tag key={step}>{step}</Tag>)}</Space><Descriptions column={1} size="small" className="top-gap"><Descriptions.Item label="Skills">{plugin.skills.join(", ") || "none"}</Descriptions.Item><Descriptions.Item label="MCP">{plugin.mcpTools.join(", ") || "none"}</Descriptions.Item><Descriptions.Item label="CLI">{plugin.cliCommands.join(", ") || "none"}</Descriptions.Item></Descriptions><Space wrap className="row-meta">{plugin.capabilities.map((item) => <Tag key={item}>{item}</Tag>)}</Space></Card></Col>)}</Row></Card>;
}

export function KnowledgePage({ knowledgeItems, onCreate }: { knowledgeItems: KnowledgeItem[]; onCreate: () => void }) {
  const labels = ["全部", "SOP", "品牌", "平台规则", "决策"];
  return <Row gutter={[16, 16]}><Col xs={24} xl={15}><Card title="团队知识库" extra={<Button type="primary" onClick={onCreate}>新增知识</Button>}><Tabs items={labels.map((label) => { const data = label === "全部" ? knowledgeItems : knowledgeItems.filter((item) => item.type === label); return { key: label, label, children: data.length ? <div className="list-panel">{data.map((item) => <div className="list-row" key={item.key}><div><Text strong>{item.title}</Text><Space wrap className="row-meta"><Text type="secondary">{item.meta}</Text>{item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></div><Tag color={item.status === "将过期" ? "warning" : item.status === "草稿" ? "default" : "success"}>{item.status}</Tag></div>)}</div> : <Empty description="暂无知识条目" /> }; })} /></Card></Col><Col xs={24} xl={9}><Card title="Agent 知识范围"><Paragraph>自媒体内容团队可读取内容 SOP、品牌契约、平台规则、竞品资料；可建议更新，不可直接写入。</Paragraph><Space wrap><Tag>BRAND.md</Tag><Tag>CONTENT.md</Tag><Tag>平台规则</Tag><Tag>竞品资料</Tag></Space></Card><Card title="检索策略" className="top-gap"><Steps size="small" current={2} items={[{ title: "范围过滤" }, { title: "状态过滤" }, { title: "FTS 召回" }, { title: "引用返回" }]} /></Card></Col></Row>;
}

