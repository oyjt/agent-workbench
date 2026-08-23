import { Button, Card, Col, Empty, Flex, Form, Input, Progress, Row, Segmented, Select, Space, Statistic, Tabs, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import type { WorkflowPlan } from "../../domain/workbench";
import { affectedWorkflowSteps, buildWorkflowLevels, serializeWorkflowYaml } from "./model";
import { workflowTemplates } from "./templates";

const { Paragraph, Text } = Typography;
type RunOptions = { fromStepId?: string; feedback?: string };
type Props = { savedWorkflows: WorkflowPlan[]; onSave: (plan: WorkflowPlan) => void | Promise<void>; onRun: (plan: WorkflowPlan, options?: RunOptions) => void | Promise<void>; onExportYaml: (plan: WorkflowPlan) => void | Promise<void>; onImportYaml: (file?: File) => void | Promise<void> };

export function WorkflowsPage({ savedWorkflows, onSave, onRun, onExportYaml, onImportYaml }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("把一个自媒体选题做成可发布的公众号文章，并生成封面 brief 和发布包");
  const [provider, setProvider] = useState("codex-cli");
  const [concurrency, setConcurrency] = useState(2);
  const [plan, setPlan] = useState(workflowTemplates[1]);
  const [step, setStep] = useState(plan.steps[0].id);
  const [feedback, setFeedback] = useState("保留已完成步骤，只重写正文和发布包，语气更克制。");
  useEffect(() => setStep(plan.steps[0]?.id ?? ""), [plan]);

  function compose() {
    setPlan({ key: `compose_${Date.now()}`, name: "AI 自动组队方案", description: prompt, provider, concurrency, tags: ["一句话编排", "自动组队", "待保存"], steps: [
      { id: "intent", role: "product/task-planner", task: "澄清目标、输出物和验收标准。", output: "task_brief", dependsOn: [] },
      { id: "research", role: "research/domain-analyst", task: "收集背景、案例和约束。", output: "research", dependsOn: ["intent"] },
      { id: "plan", role: "product/workflow-designer", task: "拆解阶段、选择 Team 和连接器。", output: "workflow_plan", dependsOn: ["intent"] },
      { id: "risk_gate", role: "security/capability-auditor", task: "识别高风险能力并生成 gate。", output: "risk_gate", dependsOn: ["plan"] },
      { id: "draft", role: "content-or-code/executor", task: "根据计划生成首版产物。", output: "artifact_draft", dependsOn: ["research", "risk_gate"] },
      { id: "review", role: "quality/reviewer", task: "审核事实、质量、引用和风险。", output: "review_report", dependsOn: ["draft"] },
    ] });
  }

  return <Space orientation="vertical" size={16} className="full-width">
    <input ref={inputRef} type="file" accept=".yml,.yaml,text/yaml" hidden onChange={(event) => void onImportYaml(event.target.files?.[0])} />
    <Row gutter={[16, 16]}><Col xs={24} xl={9}><Card title="一句话自动编排"><Form layout="vertical"><Form.Item label="任务目标"><Input.TextArea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></Form.Item><Row gutter={12}><Col span={12}><Select className="full-width" value={provider} onChange={setProvider} options={["codex-cli", "claude-code", "deepseek", "ollama"].map((value) => ({ value, label: value }))} /></Col><Col span={12}><Segmented block options={[1, 2, 3, 4]} value={concurrency} onChange={(value) => setConcurrency(Number(value))} /></Col></Row><Button className="top-gap" type="primary" block onClick={compose}>生成工作流计划</Button></Form></Card></Col><Col xs={24} xl={15}><Dag plan={plan} onSave={onSave} onRun={onRun} onExport={onExportYaml} /></Col></Row>
    <Console plan={plan} selected={step} feedback={feedback} onSelect={setStep} onRun={onRun} />
    <Row gutter={[16, 16]}><Col xs={24} xl={15}><Card title="内置工作流模板"><div className="list-panel">{workflowTemplates.map((item) => <div className="list-row" key={item.key}><div><Text strong>{item.name}</Text><Text type="secondary" className="row-meta">{item.description}</Text><Space wrap className="row-meta">{item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space></div><Button onClick={() => setPlan(item)}>套用</Button></div>)}</div></Card></Col><Col xs={24} xl={9}><Card title="已保存工作流">{savedWorkflows.length ? <div className="list-panel">{savedWorkflows.slice(0, 4).map((item) => <div className="list-row" key={item.key}><Text strong>{item.name}</Text><Space><Button onClick={() => void onRun(item)}>运行</Button><Button onClick={() => setPlan(item)}>打开</Button></Space></div>)}</div> : <Empty description="暂无保存的工作流" />}</Card></Col></Row>
    <Card title="Resume / Feedback" extra={<Space><Button onClick={() => inputRef.current?.click()}>导入 YAML</Button><Button onClick={() => void onExportYaml(plan)}>导出 YAML</Button></Space>}><Row gutter={16}><Col xs={24} md={8}><Select className="full-width" value={step} onChange={setStep} options={plan.steps.map((item) => ({ value: item.id, label: item.id }))} /><Button className="top-gap" onClick={() => void onRun(plan, { fromStepId: step })}>从此步骤重跑</Button></Col><Col xs={24} md={10}><Input.TextArea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} /></Col><Col xs={24} md={6}><Button type="primary" onClick={() => void onRun(plan, { fromStepId: step, feedback })}>带反馈返工</Button></Col></Row></Card>
  </Space>;
}

function Dag({ plan, onSave, onRun, onExport }: { plan: WorkflowPlan; onSave: Props["onSave"]; onRun: Props["onRun"]; onExport: Props["onExportYaml"] }) {
  return <Card title={plan.name} extra={<Space><Tag>{plan.provider}</Tag><Tag>并发 {plan.concurrency}</Tag><Button type="primary" onClick={() => void onRun(plan)}>运行</Button><Button onClick={() => void onExport(plan)}>YAML</Button><Button onClick={() => void onSave(plan)}>保存</Button></Space>}><Paragraph type="secondary">{plan.description}</Paragraph><div className="dag-board">{buildWorkflowLevels(plan.steps).map((level, index) => <div className="dag-level" key={index}><Text type="secondary">Layer {index + 1}</Text>{level.map((item) => <div className="dag-step" key={item.id}><Flex justify="space-between"><Text strong>{item.id}</Text><Tag color={item.type ? "warning" : "success"}>{item.type ?? "normal"}</Tag></Flex><Text type="secondary" className="row-meta">{item.role}</Text><Paragraph className="compact-copy">{item.task}</Paragraph></div>)}</div>)}</div></Card>;
}

function Console({ plan, selected, feedback, onSelect, onRun }: { plan: WorkflowPlan; selected: string; feedback: string; onSelect: (id: string) => void; onRun: Props["onRun"] }) {
  const levels = buildWorkflowLevels(plan.steps);
  const affected = new Set(affectedWorkflowSteps(plan.steps, selected).map((item) => item.id));
  const terminal = [`$ ao run ${plan.key}.workflow.yml --provider ${plan.provider} --concurrency ${plan.concurrency}`, ...levels.map((level, index) => `# layer ${index + 1}: ${level.map((item) => item.id).join(", ")}`), feedback ? `feedback: ${feedback}` : ""].filter(Boolean).join("\n");
  return <Card title="运行控制台" extra={<Button type="primary" onClick={() => void onRun(plan)}>运行</Button>}><Row gutter={16}><Col xs={24} lg={18}><Space wrap>{plan.steps.map((item) => <Button key={item.id} type={item.id === selected ? "primary" : "default"} onClick={() => onSelect(item.id)}>{item.id}</Button>)}</Space></Col><Col xs={24} lg={6}><Row><Col span={8}><Statistic title="Steps" value={plan.steps.length} /></Col><Col span={8}><Statistic title="Layers" value={levels.length} /></Col><Col span={8}><Statistic title="Gates" value={plan.steps.filter((item) => item.type).length} /></Col></Row><Progress percent={Math.round(100 / Math.max(levels.length, 1))} showInfo={false} /></Col></Row><Tabs items={[{ key: "results", label: "结果视图", children: <div className="workflow-result-list">{plan.steps.map((item) => <div className={`workflow-result-step ${affected.has(item.id) ? "is-affected" : ""}`} key={item.id}><Flex justify="space-between"><Text strong>{item.id}</Text><Button size="small" onClick={() => void onRun(plan, { fromStepId: item.id })}>从此步重跑</Button></Flex><Paragraph>{item.task}</Paragraph><Tag>{item.role}</Tag></div>)}</div> }, { key: "terminal", label: "终端视图", children: <pre className="workflow-terminal-preview">{terminal}</pre> }, { key: "yaml", label: "YAML", children: <pre className="workflow-yaml-preview">{serializeWorkflowYaml(plan)}</pre> }]} /></Card>;
}

