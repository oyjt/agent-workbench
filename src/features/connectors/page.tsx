import { AuditOutlined, CodeOutlined, SafetyOutlined } from "@ant-design/icons";
import { Button, Card, Col, Flex, Row, Space, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import type { ConnectorRecord, RiskLevel } from "../../domain/workbench";

const { Paragraph, Text } = Typography;
const risk: Record<RiskLevel, [string, string]> = { low: ["success", "低风险"], medium: ["warning", "中风险"], high: ["error", "高风险"] };

export function ConnectorsPage({ connectors, onCreateMcp, onCreateCli, onCheck, onInvoke }: { connectors: ConnectorRecord[]; onCreateMcp: () => void; onCreateCli: () => void; onCheck: (id: string) => void | Promise<void>; onInvoke: (id: string) => void | Promise<void> }) {
  return <Space orientation="vertical" size={16} className="full-width"><Card title="MCP 与 CLI 连接器" extra={<Space wrap><Button onClick={onCreateCli}>注册 CLI</Button><Button type="primary" onClick={onCreateMcp}>添加 MCP</Button></Space>}><Row gutter={[16, 16]}>{connectors.map((connector) => <Col xs={24} md={12} xl={6} key={connector.key}><Card title={connector.name} extra={<Tag color={connector.kind === "MCP" ? "blue" : "purple"}>{connector.kind}</Tag>} actions={[<Button key="check" type="text" onClick={() => void onCheck(connector.key)}>自检</Button>, <Button key="invoke" type="text" onClick={() => void onInvoke(connector.key)}>试运行</Button>]}><Paragraph>{connector.description}</Paragraph><Space wrap><Tag>{connector.status}</Tag><Tag color={risk[connector.risk][0]}>{risk[connector.risk][1]}</Tag><Tag>{connector.binding}</Tag></Space></Card></Col>)}</Row></Card><Card title="调用策略"><Row gutter={[16, 16]}><Col xs={24} md={8}><PolicyItem icon={<SafetyOutlined />} title="Allowlist" text="Agent 只能调用绑定范围内的 MCP tools 和 CLI commands。" /></Col><Col xs={24} md={8}><PolicyItem icon={<AuditOutlined />} title="Approval" text="中高风险命令进入统一审批队列，记录参数与来源。" /></Col><Col xs={24} md={8}><PolicyItem icon={<CodeOutlined />} title="Audit" text="执行结果写入运行事件，支持任务回放和失败诊断。" /></Col></Row></Card></Space>;
}

function PolicyItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <Flex gap={12} align="flex-start"><div className="policy-icon">{icon}</div><div><Text strong>{title}</Text><Paragraph type="secondary" className="compact-copy">{text}</Paragraph></div></Flex>;
}

