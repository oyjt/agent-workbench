import { Button, Card, Col, Descriptions, Row, Tabs } from "antd";
import { useState } from "react";
import { ArticlePreview, CoverPreview, DeckPreview, DiffPreview, LandingPreview } from "./previews";

export function CreativePage() {
  const [artifact, setArtifact] = useState("正文");
  const preview = { 正文: <ArticlePreview />, Landing: <LandingPreview />, PPT: <DeckPreview />, 封面: <CoverPreview />, Diff: <DiffPreview /> }[artifact];
  return <Row gutter={[16, 16]}><Col xs={24} xl={16}><Card title="Creative Studio" extra={<Button type="primary">导出发布包</Button>}><Tabs activeKey={artifact} onChange={setArtifact} items={["正文", "Landing", "PPT", "封面", "Diff"].map((key) => ({ key, label: key }))} /><div className="artifact-preview">{preview}</div></Card></Col><Col xs={24} xl={8}><Card title="Artifact Manifest"><Descriptions column={1} size="small"><Descriptions.Item label="来源 Agent">文案 Agent</Descriptions.Item><Descriptions.Item label="来源 Plugin">自媒体周更</Descriptions.Item><Descriptions.Item label="知识引用">2 条</Descriptions.Item><Descriptions.Item label="契约版本">BRAND.md / CONTENT.md</Descriptions.Item><Descriptions.Item label="导出格式">MD / PDF / ZIP</Descriptions.Item></Descriptions></Card></Col></Row>;
}

