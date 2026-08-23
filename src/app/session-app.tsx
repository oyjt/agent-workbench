import { CheckOutlined, CloseOutlined, CodeOutlined, FileTextOutlined, FolderOpenOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, SearchOutlined, SendOutlined, SettingOutlined, ToolOutlined } from "@ant-design/icons";
import { Badge, Button, Divider, Drawer, Empty, Input, Modal, Segmented, Select, Skeleton, Space, Tabs, Tag, Tooltip, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { appendRunEvent, createApiTask, getApiArtifactContent, listApiAgents, listApiAgentTeams, listApiApprovals, listApiArtifacts, listApiConnectors, listApiKnowledgeItems, listApiRunEvents, listApiSecrets, listApiTasks, listApiWorkflows, respondApiApproval, scanApiPlugins, scanApiSkills, startApiTask } from "../api";
import type { ApiAgent, ApiAgentTeam, ApiApproval, ApiArtifact, ApiConnector, ApiKnowledgeItem, ApiRunEvent, ApiSecret, ApiSkill, ApiTask, ApiWorkflow, ApiWorkflowPlugin } from "../api";

const { Text, Title, Paragraph } = Typography;
type DetailTab = "activity" | "files" | "context";
const statusMeta: Record<string, { label: string; color: string }> = { queued: { label: "Queued", color: "default" }, approval: { label: "Needs approval", color: "gold" }, running: { label: "Running", color: "processing" }, paused: { label: "Paused", color: "default" }, done: { label: "Completed", color: "success" }, failed: { label: "Failed", color: "error" }, cancelled: { label: "Cancelled", color: "default" } };

export default function SessionApp() {
  const [messageApi, contextHolder] = message.useMessage();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [events, setEvents] = useState<ApiRunEvent[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [teams, setTeams] = useState<ApiAgentTeam[]>([]);
  const [catalog, setCatalog] = useState<{ connectors: ApiConnector[]; knowledge: ApiKnowledgeItem[]; skills: ApiSkill[]; plugins: ApiWorkflowPlugin[]; workflows: ApiWorkflow[]; secrets: ApiSecret[] }>({ connectors: [], knowledge: [], skills: [], plugins: [], workflows: [], secrets: [] });
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [targetId, setTargetId] = useState("local");
  const [accessMode, setAccessMode] = useState<"collaborative" | "strict">("collaborative");
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth > 1120);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [detailTab, setDetailTab] = useState<DetailTab>("activity");
  const [artifactPreview, setArtifactPreview] = useState<{ artifact: ApiArtifact; content: string }>();

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const filteredTasks = useMemo(() => { const value = query.trim().toLowerCase(); return value ? tasks.filter((task) => `${task.title} ${task.prompt}`.toLowerCase().includes(value)) : tasks; }, [query, tasks]);
  const selectedApprovals = approvals.filter((item) => item.taskId === selectedTaskId && item.status === "pending");
  const selectedArtifacts = artifacts.filter((item) => item.taskId === selectedTaskId || item.runId === selectedTask?.runId);

  async function loadWorkspace() {
    setLoading(true);
    try {
      const [taskResult, agentResult, teamResult, approvalResult, artifactResult] = await Promise.all([listApiTasks(), listApiAgents(), listApiAgentTeams(), listApiApprovals(), listApiArtifacts()]);
      setTasks(taskResult.tasks); setAgents(agentResult.agents); setTeams(teamResult.teams); setApprovals(approvalResult.approvals); setArtifacts(artifactResult.artifacts);
      setSelectedTaskId((current) => current && taskResult.tasks.some((task) => task.id === current) ? current : taskResult.tasks[0]?.id);
      setConnected(true);
    } catch { setConnected(false); } finally { setLoading(false); }
  }

  useEffect(() => { void loadWorkspace(); }, []);
  useEffect(() => {
    if (!selectedTask?.runId || !connected) { setEvents([]); return; }
    let active = true;
    void listApiRunEvents(selectedTask.runId).then((result) => { if (active) setEvents(result.events); }).catch(() => undefined);
    const source = new EventSource(`/api/runs/${selectedTask.runId}/events`);
    source.onmessage = (event) => { const next = JSON.parse(event.data) as ApiRunEvent; setEvents((current) => current.some((item) => item.id === next.id) ? current : [...current, next]); };
    return () => { active = false; source.close(); };
  }, [connected, selectedTask?.runId]);

  async function createSession() {
    const prompt = composer.trim(); if (!prompt || submitting) return;
    setSubmitting(true);
    try {
      const target = resolveTarget(targetId, agents, teams);
      const result = await createApiTask({ title: titleFromPrompt(prompt), prompt, targetType: target.type, targetId: target.id, owner: "Local workspace", runtime: target.runtime, priority: accessMode === "strict" ? "high" : "normal", requiresApproval: false });
      setTasks((current) => [result.task, ...current]); setSelectedTaskId(result.task.id); setEvents(result.events); setComposer("");
      await startApiTask(result.task.id); await loadWorkspace();
    } catch { messageApi.error("无法启动 Session。请确认本地 Web 服务正在运行。"); setConnected(false); } finally { setSubmitting(false); }
  }

  async function sendFollowUp() {
    const text = composer.trim(); if (!selectedTask?.runId || !text || submitting) return;
    setSubmitting(true);
    try { const { event } = await appendRunEvent(selectedTask.runId, "user.message", { text }); setEvents((current) => [...current, event]); setComposer(""); }
    catch { messageApi.error("消息未写入当前 Session。"); } finally { setSubmitting(false); }
  }

  async function respond(approval: ApiApproval, decision: "allow_once" | "deny") {
    try { await respondApiApproval(approval.id, decision); setApprovals((await listApiApprovals()).approvals); await loadWorkspace(); }
    catch { messageApi.error("审批响应失败。"); }
  }

  async function openSettings() {
    setSettingsOpen(true);
    const results = await Promise.allSettled([listApiConnectors(), listApiKnowledgeItems(), scanApiSkills(), scanApiPlugins(), listApiWorkflows(), listApiSecrets()]);
    setCatalog({ connectors: fulfilled(results[0], "connectors"), knowledge: fulfilled(results[1], "knowledgeItems"), skills: fulfilled(results[2], "skills"), plugins: fulfilled(results[3], "plugins"), workflows: fulfilled(results[4], "workflows"), secrets: fulfilled(results[5], "secrets") });
  }

  async function previewArtifact(artifact: ApiArtifact) { try { const result = await getApiArtifactContent(artifact.id); setArtifactPreview({ artifact, content: result.content }); } catch { messageApi.error("无法读取产物内容。"); } }
  const pendingCount = approvals.filter((item) => item.status === "pending").length;

  return <div className={`workbench-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${detailsOpen ? "" : "details-collapsed"}`}>
    {contextHolder}<a className="skip-link" href="#session-main">跳到当前 Session</a>
    <aside className="session-sidebar" aria-label="Session 导航">
      <div className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">A</span><div><Text strong>Agent Workbench</Text><Text type="secondary">Local harness</Text></div><Tooltip title="收起侧栏"><Button type="text" icon={<MenuFoldOutlined />} aria-label="收起侧栏" onClick={() => setSidebarOpen(false)} /></Tooltip></div>
      <Button className="new-session-button" type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedTaskId(undefined); setComposer(""); if (window.innerWidth <= 760) setSidebarOpen(false); }}>New session</Button>
      <div className="workspace-label"><Text type="secondary">WORKSPACE</Text></div>
      <button className="workspace-row active" type="button"><FolderOpenOutlined /><span>agent-workbench</span><Badge status={connected ? "success" : "error"} /></button>
      <Input prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} allowClear placeholder="Search sessions" aria-label="搜索 Sessions" />
      <div className="session-list" role="list" aria-label="Sessions">{loading ? <Skeleton active paragraph={{ rows: 5 }} title={false} /> : filteredTasks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No sessions yet" /> : filteredTasks.map((task) => <button key={task.id} type="button" role="listitem" className={`session-row ${task.id === selectedTaskId ? "selected" : ""}`} onClick={() => { setSelectedTaskId(task.id); if (window.innerWidth <= 760) setSidebarOpen(false); }}><span className="session-row-title">{task.title}</span><span className="session-row-meta"><Badge status={badgeStatus(task.status)} />{statusMeta[task.status]?.label ?? task.status}<time>{shortTime(task.updatedAt)}</time></span></button>)}</div>
      <button type="button" className="settings-row" onClick={() => void openSettings()}><SettingOutlined /><span>Settings</span>{pendingCount > 0 && <Badge count={pendingCount} />}</button>
    </aside>

    <main className="session-main" id="session-main">
      <header className="session-header"><div className="mobile-panel-actions">{!sidebarOpen && <Button type="text" icon={<MenuUnfoldOutlined />} aria-label="打开 Session 列表" onClick={() => setSidebarOpen(true)} />}</div><div className="session-title-block"><Title level={4}>{selectedTask?.title ?? "New session"}</Title><Space size={6}><span className={`connection-dot ${connected ? "online" : "offline"}`} /><Text type="secondary">{connected ? "Local Web connected" : "Local Web unavailable"}</Text></Space></div><Space>{selectedTask && <Tag color={statusMeta[selectedTask.status]?.color}>{statusMeta[selectedTask.status]?.label ?? selectedTask.status}</Tag>}{!detailsOpen && <Button type="text" icon={<ToolOutlined />} aria-label="打开详情" onClick={() => setDetailsOpen(true)} />}</Space></header>
      {!connected ? <ConnectionState onRetry={() => void loadWorkspace()} /> : selectedTask ? <section className="conversation" aria-label="Session conversation"><div className="prompt-message"><span className="message-author">You</span><Paragraph>{selectedTask.prompt}</Paragraph></div><div className="execution-track">{events.length === 0 ? <div className="empty-track"><Text type="secondary">等待运行事件…</Text></div> : events.map((event) => <EventMessage key={event.id} event={event} />)}{selectedApprovals.map((approval) => <ApprovalMessage key={approval.id} approval={approval} onRespond={respond} />)}</div></section> : <Welcome onExample={setComposer} />}
      <div className="composer-wrap"><div className="composer"><Input.TextArea autoSize={{ minRows: 2, maxRows: 7 }} value={composer} onChange={(event) => setComposer(event.target.value)} placeholder={selectedTask ? "Continue this session…" : "Describe what you want to build"} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void (selectedTask ? sendFollowUp() : createSession()); } }} aria-label="Session message" /><div className="composer-controls"><Space wrap><Select variant="borderless" value={targetId} onChange={setTargetId} options={targetOptions(agents, teams)} aria-label="选择 Agent" /><Segmented size="small" value={accessMode} onChange={(value) => setAccessMode(value as typeof accessMode)} options={[{ label: "Workspace write", value: "collaborative" }, { label: "Ask first", value: "strict" }]} /></Space><Button type="primary" shape="circle" icon={<SendOutlined />} loading={submitting} disabled={!composer.trim() || !connected} aria-label={selectedTask ? "发送消息" : "启动 Session"} onClick={() => void (selectedTask ? sendFollowUp() : createSession())} /></div></div><Text type="secondary" className="composer-hint">Enter 发送 · Shift + Enter 换行 · 高风险能力会在消息流中请求审批</Text></div>
    </main>

    <aside className="details-panel" aria-label="Session 详情"><div className="details-header"><Text strong>Details</Text><Button type="text" icon={<CloseOutlined />} aria-label="关闭详情" onClick={() => setDetailsOpen(false)} /></div><Tabs activeKey={detailTab} onChange={(key) => setDetailTab(key as DetailTab)} items={[{ key: "activity", label: "Run", children: <RunDetails task={selectedTask} events={events} approvals={selectedApprovals} /> }, { key: "files", label: `Files ${selectedArtifacts.length || ""}`, children: <ArtifactList artifacts={selectedArtifacts} onOpen={previewArtifact} /> }, { key: "context", label: "Context", children: <ContextDetails task={selectedTask} agents={agents} teams={teams} /> }]} /></aside>
    <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} agents={agents} teams={teams} catalog={catalog} />
    <Modal title={artifactPreview?.artifact.name} open={Boolean(artifactPreview)} onCancel={() => setArtifactPreview(undefined)} footer={null} width={760}><pre className="artifact-content">{artifactPreview?.content || "No preview available."}</pre></Modal>
  </div>;
}

function EventMessage({ event }: { event: ApiRunEvent }) { const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}; const copy = String(payload.text ?? payload.summary ?? payload.message ?? humanEvent(event.type)); const isTool = /cli|mcp|capability|tool/.test(event.type); return <article className={`event-message ${isTool ? "tool-event" : ""}`}><span className="track-node" aria-hidden="true">{isTool ? <CodeOutlined /> : null}</span><div><div className="event-heading"><Text strong>{humanEvent(event.type)}</Text><time>{shortTime(event.createdAt)}</time></div><Paragraph>{copy}</Paragraph>{Object.keys(payload).length > 0 && isTool && <details><summary>View details</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>}</div></article>; }
function ApprovalMessage({ approval, onRespond }: { approval: ApiApproval; onRespond: (approval: ApiApproval, decision: "allow_once" | "deny") => void }) { return <article className="event-message approval-message"><span className="track-node" aria-hidden="true"><ToolOutlined /></span><div><div className="event-heading"><Text strong>Approval required</Text><Tag color={approval.risk === "high" ? "error" : "gold"}>{approval.risk}</Tag></div><Paragraph>{approval.reason}</Paragraph><Space><Button icon={<CloseOutlined />} onClick={() => onRespond(approval, "deny")}>Deny</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => onRespond(approval, "allow_once")}>Allow once</Button></Space></div></article>; }
function ConnectionState({ onRetry }: { onRetry: () => void }) { return <div className="center-state"><div className="state-mark"><CloseOutlined /></div><Title level={3}>Local Web is not running</Title><Paragraph type="secondary">Start the built application with <code>pnpm web</code>. Browser-only fallback has been removed so every Session uses SQLite and the same Harness pipeline.</Paragraph><Button type="primary" onClick={onRetry}>Try again</Button></div>; }
function Welcome({ onExample }: { onExample: (value: string) => void }) { return <div className="welcome"><div className="welcome-mark">A</div><Title>What are we building?</Title><Paragraph type="secondary">Start with a goal. Agent, tools, approvals and produced files stay inside one Session.</Paragraph><div className="example-grid">{["Summarize this repository and identify its main packages.", "Review the current changes and run the relevant tests.", "Create a content brief from the project knowledge base."].map((text) => <button type="button" key={text} onClick={() => onExample(text)}>{text}</button>)}</div></div>; }
function RunDetails({ task, events, approvals }: { task?: ApiTask; events: ApiRunEvent[]; approvals: ApiApproval[] }) { return task ? <div className="detail-stack"><Detail label="Status" value={statusMeta[task.status]?.label ?? task.status} /><Detail label="Runtime" value={task.runtime} /><Detail label="Target" value={task.targetId} /><Detail label="Run ID" value={task.runId ?? "Not started"} mono /><Divider /><Detail label="Events" value={String(events.length)} /><Detail label="Pending approvals" value={String(approvals.length)} /></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a Session" />; }
function ContextDetails({ task, agents, teams }: { task?: ApiTask; agents: ApiAgent[]; teams: ApiAgentTeam[] }) { if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No context" />; const target = [...agents, ...teams].find((item) => item.id === task.targetId); return <div className="detail-stack"><Detail label="Agent preset" value={target?.name ?? task.targetId} /><Detail label="Owner" value={task.owner} /><Detail label="Access" value={task.priority === "high" ? "Ask first" : "Workspace write"} /><Divider /><Text type="secondary">Capabilities are resolved by the Harness and narrowed by policy before execution.</Text></div>; }
function ArtifactList({ artifacts, onOpen }: { artifacts: ApiArtifact[]; onOpen: (artifact: ApiArtifact) => void }) { return artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpen(artifact)}><FileTextOutlined /><span><strong>{artifact.name}</strong><small>{artifact.summary}</small></span></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No produced files" />; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-row"><Text type="secondary">{label}</Text><Text className={mono ? "mono" : ""}>{value}</Text></div>; }

function SettingsDrawer({ open, onClose, agents, teams, catalog }: { open: boolean; onClose: () => void; agents: ApiAgent[]; teams: ApiAgentTeam[]; catalog: { connectors: ApiConnector[]; knowledge: ApiKnowledgeItem[]; skills: ApiSkill[]; plugins: ApiWorkflowPlugin[]; workflows: ApiWorkflow[]; secrets: ApiSecret[] } }) {
  const capabilities = [...catalog.skills.map((item) => ({ id: item.id, name: item.name, meta: `Skill · ${item.risk}` })), ...catalog.plugins.map((item) => ({ id: item.id, name: item.name, meta: `Plugin · ${item.version}` })), ...catalog.connectors.map((item) => ({ id: item.id, name: item.name, meta: `${item.kind} · ${item.risk}` }))];
  return <Drawer title="Settings" open={open} onClose={onClose} width={640} className="settings-drawer"><Tabs tabPosition="left" items={[{ key: "agents", label: "Agents", children: <SettingsList items={[...agents.map((item) => ({ id: item.id, name: item.name, meta: `${item.runtime} · ${item.model}` })), ...teams.map((item) => ({ id: item.id, name: item.name, meta: `Team · ${item.members.length} members` }))]} empty="No Agent presets" /> }, { key: "capabilities", label: "Capabilities", children: <SettingsList items={capabilities} empty="No capabilities found" /> }, { key: "knowledge", label: "Knowledge", children: <SettingsList items={catalog.knowledge.map((item) => ({ id: item.id, name: item.title, meta: `${item.type} · ${item.status}` }))} empty="No knowledge items" /> }, { key: "workflows", label: "Workflows", children: <SettingsList items={catalog.workflows.map((item) => ({ id: item.id, name: item.name, meta: `${item.steps.length} steps · ${item.provider}` }))} empty="No workflows" /> }, { key: "models", label: "Models & secrets", children: <SettingsList items={catalog.secrets.map((item) => ({ id: item.id, name: item.name, meta: `${item.envVar} · ${item.status}` }))} empty="No model secrets configured" /> }, { key: "permissions", label: "Permissions", children: <div className="settings-copy"><Title level={5}>Policy before execution</Title><Paragraph>Low-risk capabilities run automatically. Medium and high-risk providers pause in the Session and wait for approval.</Paragraph><Tag color="blue">Workspace write</Tag><Tag>Ask first</Tag></div> }]} /></Drawer>;
}
function SettingsList({ items, empty }: { items: Array<{ id: string; name: string; meta: string }>; empty: string }) { return items.length ? <div className="settings-list">{items.map((item) => <div key={item.id}><Text strong>{item.name}</Text><Text type="secondary">{item.meta}</Text></div>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />; }
function fulfilled<T, K extends keyof T>(result: PromiseSettledResult<T>, key: K): T[K] extends unknown[] ? T[K] : never { return (result.status === "fulfilled" ? result.value[key] : []) as T[K] extends unknown[] ? T[K] : never; }
function resolveTarget(id: string, agents: ApiAgent[], teams: ApiAgentTeam[]) { const agent = agents.find((item) => item.id === id); if (agent) return { type: "agent" as const, id: agent.id, runtime: agent.runtime }; const team = teams.find((item) => item.id === id); if (team) return { type: "agent_team" as const, id: team.id, runtime: "Workflow" }; return { type: "agent" as const, id: "local", runtime: "Codex" }; }
function targetOptions(agents: ApiAgent[], teams: ApiAgentTeam[]) { return [{ value: "local", label: "Local agent" }, ...agents.map((item) => ({ value: item.id, label: item.name })), ...teams.map((item) => ({ value: item.id, label: item.name }))]; }
function titleFromPrompt(prompt: string) { const line = prompt.split(/\r?\n/)[0].trim(); return line.length > 52 ? `${line.slice(0, 49)}…` : line; }
function humanEvent(type: string) { return type.replace(/[._/]/g, " ").replace(/\b\w/g, (value) => value.toUpperCase()); }
function shortTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function badgeStatus(status: string): "default" | "processing" | "success" | "error" | "warning" { if (status === "running") return "processing"; if (status === "done") return "success"; if (status === "failed") return "error"; if (status === "approval") return "warning"; return "default"; }
