import { Button, Card, Descriptions, Space, Table, Tag } from "antd";
import type { ArtifactRecord } from "../../domain/workbench";

export function AssetsPage({ artifacts, onCreate, onOpen, onVersion, onExport }: { artifacts: ArtifactRecord[]; onCreate: () => void | Promise<void>; onOpen: (artifact: ArtifactRecord) => void | Promise<void>; onVersion: (artifact: ArtifactRecord) => void | Promise<void>; onExport: () => void }) {
  return <Card title="资产库" extra={<Space wrap><Button onClick={() => void onCreate()}>登记产物</Button><Button onClick={onExport}>批量导出</Button></Space>}><Table rowKey="key" pagination={false} columns={[{ title: "文件", dataIndex: "file" }, { title: "类型", dataIndex: "type", render: (value) => <Tag color="blue">{value}</Tag> }, { title: "来源", dataIndex: "source" }, { title: "摘要", dataIndex: "summary" }, { title: "更新时间", dataIndex: "updatedAt" }, { title: "操作", width: 180, render: (_, record) => <Space wrap><Button size="small" onClick={() => void onOpen(record)}>查看</Button><Button size="small" onClick={() => void onVersion(record)}>新版本</Button></Space> }]} dataSource={artifacts} expandable={{ expandedRowRender: (record) => <Descriptions column={1} size="small"><Descriptions.Item label="路径">{record.path}</Descriptions.Item><Descriptions.Item label="版本">{record.versions?.length ?? "未加载"}</Descriptions.Item></Descriptions> }} /></Card>;
}

