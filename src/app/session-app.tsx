import { CheckOutlined, CloseOutlined, CodeOutlined, DeleteOutlined, FileTextOutlined, FolderOpenOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined, SearchOutlined, SendOutlined, SettingOutlined, ToolOutlined } from "@ant-design/icons";
import { Badge, Button, Divider, Empty, Input, Modal, Segmented, Select, Skeleton, Space, Tabs, Tag, Tooltip, Typography, message } from "antd";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { appendRunEvent, createApiTask, deleteApiTask, getApiArtifactContent, listApiAgents, listApiAgentTeams, listApiApprovals, listApiArtifacts, listApiConnectors, listApiKnowledgeItems, listApiRunEvents, listApiSecrets, listApiTasks, listApiWorkflows, respondApiApproval, scanApiPlugins, scanApiSkills, startApiTask } from "../api";
import type { ApiAgent, ApiAgentTeam, ApiApproval, ApiArtifact, ApiRunEvent, ApiTask } from "../api";
import type { SettingsCatalog } from "./settings-drawer";

const { Text, Title, Paragraph } = Typography;
const SettingsDrawer = lazy(() => import("./settings-drawer"));
type DetailTab = "activity" | "files" | "context";
const statusMeta: Record<string, { label: string }> = { queued: { label: "排队中" }, approval: { label: "等待审批" }, running: { label: "运行中" }, paused: { label: "已暂停" }, done: { label: "已完成" }, failed: { label: "失败" }, cancelled: { label: "已取消" } };

export default function SessionApp() {
  const [messageApi, contextHolder] = message.useMessage();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [streamConnected, setStreamConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [events, setEvents] = useState<ApiRunEvent[]>([]);
  const [approvals, setApprovals] = useState<ApiApproval[]>([]);
  const [artifacts, setArtifacts] = useState<ApiArtifact[]>([]);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [teams, setTeams] = useState<ApiAgentTeam[]>([]);
  const [catalog, setCatalog] = useState<SettingsCatalog>({ connectors: [], knowledge: [], skills: [], plugins: [], workflows: [], secrets: [] });
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [targetId, setTargetId] = useState("local");
  const [accessMode, setAccessMode] = useState<"collaborative" | "strict">("collaborative");
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string>();
  const [viewport, setViewport] = useState(() => ({ phone: window.innerWidth <= 760, compact: window.innerWidth <= 1120 }));
  const [detailsOpen, setDetailsOpen] = useState(() => window.innerWidth > 1120);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [detailTab, setDetailTab] = useState<DetailTab>("activity");
  const [artifactPreview, setArtifactPreview] = useState<{ artifact: ApiArtifact; content: string }>();
  const conversationRef = useRef<HTMLElement>(null);

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
    const syncPanels = () => {
      setViewport({ phone: window.innerWidth <= 760, compact: window.innerWidth <= 1120 });
      if (window.innerWidth <= 760) { setSidebarOpen(false); setDetailsOpen(false); }
      else if (window.innerWidth <= 1120) setDetailsOpen(false);
    };
    window.addEventListener("resize", syncPanels);
    return () => window.removeEventListener("resize", syncPanels);
  }, []);
  useEffect(() => {
    if (!selectedTask?.runId || !connected) { setEvents([]); setStreamConnected(null); return; }
    let active = true;
    void listApiRunEvents(selectedTask.runId).then((result) => { if (active) setEvents(result.events); }).catch(() => { if (active) setStreamConnected(false); });
    const source = new EventSource(`/api/runs/${selectedTask.runId}/events`);
    source.onopen = () => setStreamConnected(true);
    source.onerror = () => setStreamConnected(false);
    source.onmessage = (event) => { try { const next = JSON.parse(event.data) as ApiRunEvent; setEvents((current) => current.some((item) => item.id === next.id) ? current : [...current, next]); } catch { setStreamConnected(false); } };
    return () => { active = false; source.close(); };
  }, [connected, selectedTask?.runId]);
  useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }); }, [events, selectedTaskId]);

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
    try { const { event } = await appendRunEvent(selectedTask.runId, "user.message", { text }); setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]); setComposer(""); }
    catch { messageApi.error("消息未写入当前会话。"); } finally { setSubmitting(false); }
  }

  function confirmDeleteSession(task: ApiTask) {
    Modal.confirm({
      title: "删除会话？",
      content: `“${task.title}”的消息和运行记录将被永久删除。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      async onOk() {
        try {
          await deleteApiTask(task.id);
          setTasks((current) => current.filter((item) => item.id !== task.id));
          setApprovals((current) => current.filter((item) => item.taskId !== task.id));
          setArtifacts((current) => current.filter((item) => item.taskId !== task.id && item.runId !== task.runId));
          setSelectedTaskId((current) => current === task.id ? undefined : current);
          messageApi.success("会话已删除");
        } catch { messageApi.error("会话删除失败。"); }
      },
    });
  }

  async function respond(approval: ApiApproval, decision: "allow_once" | "deny") {
    try { await respondApiApproval(approval.id, decision); setApprovals((await listApiApprovals()).approvals); await loadWorkspace(); }
    catch { messageApi.error("审批响应失败。"); }
  }

  async function openSettings() {
    setSettingsOpen(true);
    await loadSettings();
  }

  async function loadSettings() {
    setSettingsLoading(true); setSettingsError(undefined);
    const results = await Promise.allSettled([listApiConnectors(), listApiKnowledgeItems(), scanApiSkills(), scanApiPlugins(), listApiWorkflows(), listApiSecrets()]);
    setCatalog({ connectors: fulfilled(results[0], "connectors"), knowledge: fulfilled(results[1], "knowledgeItems"), skills: fulfilled(results[2], "skills"), plugins: fulfilled(results[3], "plugins"), workflows: fulfilled(results[4], "workflows"), secrets: fulfilled(results[5], "secrets") });
    if (results.some((result) => result.status === "rejected")) setSettingsError("部分本地数据源没有响应。已保留成功加载的内容，你可以重试未完成的部分。");
    setSettingsLoading(false);
  }

  function openSidebar() { setDetailsOpen(false); setSidebarOpen(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(".session-sidebar")?.focus()); }
  function closeSidebar() { setSidebarOpen(false); requestAnimationFrame(() => document.getElementById("open-sidebar")?.focus()); }
  function openDetails() { setSidebarOpen(false); setDetailsOpen(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(".details-panel")?.focus()); }
  function closeDetails() { setDetailsOpen(false); requestAnimationFrame(() => document.getElementById("open-details")?.focus()); }

  async function previewArtifact(artifact: ApiArtifact) { try { const result = await getApiArtifactContent(artifact.id); setArtifactPreview({ artifact, content: result.content }); } catch { messageApi.error("无法读取产物内容。"); } }
  const pendingCount = approvals.filter((item) => item.status === "pending").length;
  const connectionLabel = !connected ? "本地服务不可用" : selectedTask?.runId && streamConnected === false ? "事件流重连中" : "本地服务已连接";
  const sidebarModal = viewport.phone && sidebarOpen;
  const detailsModal = viewport.compact && detailsOpen;

  return <div className={`workbench-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${detailsOpen ? "" : "details-collapsed"}`}>
    {contextHolder}<a className="skip-link" href="#session-main">跳到当前会话</a>
    {sidebarModal && <button className="panel-backdrop sidebar-backdrop" type="button" aria-label="关闭会话列表" onClick={closeSidebar} />}
    {detailsModal && <button className="panel-backdrop details-backdrop" type="button" aria-label="关闭会话详情" onClick={closeDetails} />}
    <aside className="session-sidebar" aria-label="会话导航" aria-hidden={!sidebarOpen} aria-modal={sidebarModal || undefined} role={sidebarModal ? "dialog" : undefined} inert={!sidebarOpen || detailsModal ? true : undefined} tabIndex={-1}>
      <div className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">A</span><div><Text strong>智能体工作台</Text><Text type="secondary">本地运行框架</Text></div><Tooltip title="收起侧栏"><Button type="text" icon={<MenuFoldOutlined />} aria-label="收起侧栏" onClick={closeSidebar} /></Tooltip></div>
      <Button className="new-session-button" type="primary" icon={<PlusOutlined />} onClick={() => { setSelectedTaskId(undefined); setComposer(""); if (window.innerWidth <= 760) setSidebarOpen(false); }}>新建会话</Button>
      <div className="workspace-label"><Text type="secondary">工作区</Text></div>
      <button className="workspace-row active" type="button" aria-current="page"><FolderOpenOutlined /><span>agent-workbench</span><Badge status={connected ? "success" : "error"} /></button>
      <Input prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} allowClear placeholder="搜索会话" aria-label="搜索会话" />
      <div className="session-list" role="list" aria-label="会话列表">{loading ? <Skeleton active paragraph={{ rows: 5 }} title={false} /> : filteredTasks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" /> : filteredTasks.map((task) => <div key={task.id} role="listitem" className={`session-row ${task.id === selectedTaskId ? "selected" : ""}`}><button className="session-row-select" type="button" onClick={() => { setSelectedTaskId(task.id); if (window.innerWidth <= 760) setSidebarOpen(false); }}><span className="session-row-title">{task.title}</span><span className="session-row-meta"><Badge status={badgeStatus(task.status)} />{statusMeta[task.status]?.label ?? task.status}<time>{shortTime(task.updatedAt)}</time></span></button><Tooltip title="删除会话"><Button className="session-delete" type="text" danger icon={<DeleteOutlined />} aria-label={`删除会话：${task.title}`} onClick={() => confirmDeleteSession(task)} /></Tooltip></div>)}</div>
      <button type="button" className="settings-row" onClick={() => void openSettings()}><SettingOutlined /><span>设置</span>{pendingCount > 0 && <Badge count={pendingCount} />}</button>
    </aside>

    <main className="session-main" id="session-main" inert={sidebarModal || detailsModal ? true : undefined}>
      <header className="session-header"><div className="mobile-panel-actions">{!sidebarOpen && <Button id="open-sidebar" type="text" icon={<MenuUnfoldOutlined />} aria-label="打开会话列表" onClick={openSidebar} />}</div><div className="session-title-block"><Title level={4}>{selectedTask?.title ?? "新建会话"}</Title><Space size={6} role="status"><span className={`connection-dot ${connected ? "online" : "offline"}`} aria-hidden="true" /><Text type="secondary">{connectionLabel}</Text></Space></div><Space>{selectedTask && <Tag className={`task-status task-status-${selectedTask.status}`}>{statusMeta[selectedTask.status]?.label ?? selectedTask.status}</Tag>}{!detailsOpen && <Button id="open-details" type="text" icon={<ToolOutlined />} aria-label="打开详情" onClick={openDetails} />}</Space></header>
      {!connected ? <ConnectionState onRetry={() => void loadWorkspace()} /> : selectedTask ? <section ref={conversationRef} className="conversation" aria-label="会话内容"><article className="chat-message user-message"><div className="chat-bubble"><span className="message-author">你</span><Paragraph>{selectedTask.prompt}</Paragraph></div></article><div className="execution-track">{events.length === 0 ? <div className="empty-track"><span className="streaming-pulse" aria-hidden="true" /><Text type="secondary">正在准备运行环境…</Text></div> : conversationEvents(events).map((event) => <EventMessage key={event.id} event={event} />)}{selectedApprovals.map((approval) => <ApprovalMessage key={approval.id} approval={approval} onRespond={respond} />)}</div></section> : <Welcome onExample={setComposer} />}
      <div className="composer-wrap"><div className="composer"><Input.TextArea autoSize={{ minRows: 2, maxRows: 7 }} value={composer} onChange={(event) => setComposer(event.target.value)} placeholder={selectedTask ? "继续当前会话…" : "描述你想完成的任务"} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void (selectedTask ? sendFollowUp() : createSession()); } }} aria-label="会话消息" /><div className="composer-controls"><Space wrap><Select variant="borderless" value={targetId} onChange={setTargetId} options={targetOptions(agents, teams)} aria-label="选择智能体" /><Segmented size="small" value={accessMode} onChange={(value) => setAccessMode(value as typeof accessMode)} options={[{ label: "可写工作区", value: "collaborative" }, { label: "操作前询问", value: "strict" }]} /></Space><Button className="send-button" type="primary" shape="circle" icon={<SendOutlined />} loading={submitting} disabled={!composer.trim() || !connected} aria-label={selectedTask ? "发送消息" : "启动会话"} onClick={() => void (selectedTask ? sendFollowUp() : createSession())} /></div></div><Text type="secondary" className="composer-hint">Enter 发送 · Shift + Enter 换行 · 高风险能力会在消息流中请求审批</Text></div>
    </main>

    <aside className="details-panel" aria-label="会话详情" aria-hidden={!detailsOpen} aria-modal={detailsModal || undefined} role={detailsModal ? "dialog" : undefined} inert={!detailsOpen || sidebarModal ? true : undefined} tabIndex={-1}><div className="details-header"><Text strong>详情</Text><Button type="text" icon={<CloseOutlined />} aria-label="关闭详情" onClick={closeDetails} /></div><Tabs activeKey={detailTab} onChange={(key) => setDetailTab(key as DetailTab)} items={[{ key: "activity", label: "运行", children: <RunDetails task={selectedTask} events={events} approvals={selectedApprovals} /> }, { key: "files", label: `文件 ${selectedArtifacts.length || ""}`, children: <ArtifactList artifacts={selectedArtifacts} onOpen={previewArtifact} /> }, { key: "context", label: "上下文", children: <ContextDetails task={selectedTask} agents={agents} teams={teams} /> }]} /></aside>
    {settingsOpen && <Suspense fallback={null}><SettingsDrawer open loading={settingsLoading} error={settingsError} onClose={() => setSettingsOpen(false)} onRetry={() => void loadSettings()} onChanged={loadSettings} agents={agents} teams={teams} catalog={catalog} /></Suspense>}
    <Modal title={artifactPreview?.artifact.name} open={Boolean(artifactPreview)} onCancel={() => setArtifactPreview(undefined)} footer={null} width={760}><pre className="artifact-content">{artifactPreview?.content || "暂无可预览内容。"}</pre></Modal>
  </div>;
}

function EventMessage({ event }: { event: ApiRunEvent }) { const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}; const copy = String(payload.text ?? payload.summary ?? payload.message ?? humanEvent(event.type)); const isTool = /cli|mcp|capability|tool|adapter/.test(event.type); const isUser = event.type === "user.message"; const isAssistant = /message\.delta|assistant\.(delta|message|error)|runtime\.unconfigured/.test(event.type); const isStreaming = event.type === "assistant.delta"; if (isUser) return <article className="chat-message user-message"><div className="chat-bubble"><div className="event-heading"><Text strong>你</Text><time>{shortTime(event.createdAt)}</time></div><Paragraph>{copy}</Paragraph></div></article>; if (isAssistant) return <article className={`chat-message assistant-message ${isStreaming ? "is-streaming" : ""}`} aria-live={isStreaming ? "polite" : undefined}><span className="assistant-avatar" aria-hidden="true">A</span><div className="assistant-content"><div className="event-heading"><Text strong>智能体</Text><time>{shortTime(event.createdAt)}</time></div><Paragraph>{copy}</Paragraph></div></article>; return <article className={`event-message system-event ${isTool ? "tool-event" : ""}`}><span className="track-node" aria-hidden="true">{isTool ? <CodeOutlined /> : null}</span><div><div className="event-heading"><Text strong>{humanEvent(event.type)}</Text><time>{shortTime(event.createdAt)}</time></div>{copy !== humanEvent(event.type) && <Paragraph>{copy}</Paragraph>}{Object.keys(payload).length > 0 && isTool && <details><summary>查看运行详情</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>}</div></article>; }
function ApprovalMessage({ approval, onRespond }: { approval: ApiApproval; onRespond: (approval: ApiApproval, decision: "allow_once" | "deny") => void }) { const risk = { low: "低风险", medium: "中风险", high: "高风险" }[approval.risk]; return <article className="event-message approval-message"><span className="track-node" aria-hidden="true"><ToolOutlined /></span><div><div className="event-heading"><Text strong>需要审批</Text><Tag className={`risk-tag risk-${approval.risk}`}>{risk}</Tag></div><Paragraph>{approval.reason}</Paragraph><Space><Button icon={<CloseOutlined />} onClick={() => onRespond(approval, "deny")}>拒绝</Button><Button type="primary" icon={<CheckOutlined />} onClick={() => onRespond(approval, "allow_once")}>仅允许一次</Button></Space></div></article>; }
function ConnectionState({ onRetry }: { onRetry: () => void }) { return <div className="center-state"><div className="state-mark"><CloseOutlined /></div><Title level={3}>本地 Web 服务未运行</Title><Paragraph type="secondary">请用 <code>pnpm web</code> 启动构建后的应用。浏览器静态回退已移除，所有会话统一使用 SQLite 和同一条 Harness 流程。</Paragraph><Button type="primary" onClick={onRetry}>重试</Button></div>; }
function Welcome({ onExample }: { onExample: (value: string) => void }) { return <div className="welcome"><div className="welcome-mark">A</div><Title>今天想完成什么？</Title><Paragraph type="secondary">从一个目标开始，智能体、工具、审批和产出文件都会保留在同一会话中。</Paragraph><div className="example-grid">{["总结这个代码仓库并说明主要模块。", "审查当前改动并运行相关测试。", "根据项目知识库创建一份内容简报。"].map((text) => <button type="button" key={text} onClick={() => onExample(text)}>{text}</button>)}</div></div>; }
function RunDetails({ task, events, approvals }: { task?: ApiTask; events: ApiRunEvent[]; approvals: ApiApproval[] }) { return task ? <div className="detail-stack"><Detail label="状态" value={statusMeta[task.status]?.label ?? task.status} /><Detail label="运行时" value={task.runtime} /><Detail label="目标" value={task.targetId} /><Detail label="运行 ID" value={task.runId ?? "尚未启动"} mono /><Divider /><Detail label="事件数" value={String(events.length)} /><Detail label="待审批" value={String(approvals.length)} /></div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择会话" />; }
function ContextDetails({ task, agents, teams }: { task?: ApiTask; agents: ApiAgent[]; teams: ApiAgentTeam[] }) { if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上下文" />; const target = [...agents, ...teams].find((item) => item.id === task.targetId); return <div className="detail-stack"><Detail label="智能体预设" value={target?.name ?? task.targetId} /><Detail label="所有者" value={task.owner} /><Detail label="访问权限" value={task.priority === "high" ? "操作前询问" : "可写工作区"} /><Divider /><Text type="secondary">Harness 会解析所需能力，并在执行前按策略收紧权限。</Text></div>; }
function ArtifactList({ artifacts, onOpen }: { artifacts: ApiArtifact[]; onOpen: (artifact: ApiArtifact) => void }) { return artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpen(artifact)}><FileTextOutlined /><span><strong>{artifact.name}</strong><small>{artifact.summary}</small></span></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无产出文件" />; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-row"><Text type="secondary">{label}</Text><Text className={mono ? "mono" : ""}>{value}</Text></div>; }

function fulfilled<T, K extends keyof T>(result: PromiseSettledResult<T>, key: K): T[K] extends unknown[] ? T[K] : never { return (result.status === "fulfilled" ? result.value[key] : []) as T[K] extends unknown[] ? T[K] : never; }
function resolveTarget(id: string, agents: ApiAgent[], teams: ApiAgentTeam[]) { const agent = agents.find((item) => item.id === id); if (agent) return { type: "agent" as const, id: agent.id, runtime: agent.runtime }; const team = teams.find((item) => item.id === id); if (team) return { type: "agent_team" as const, id: team.id, runtime: "Workflow" }; return { type: "agent" as const, id: "local", runtime: "Codex" }; }
function targetOptions(agents: ApiAgent[], teams: ApiAgentTeam[]) { return [{ value: "local", label: "本地智能体" }, ...agents.map((item) => ({ value: item.id, label: item.name })), ...teams.map((item) => ({ value: item.id, label: item.name }))]; }
function conversationEvents(events: ApiRunEvent[]) { const finals = new Set(events.filter((event) => event.type === "assistant.message").map(eventMessageId).filter(Boolean)); const latest = new Map<string, ApiRunEvent>(); for (const event of events) if (event.type === "assistant.delta") latest.set(eventMessageId(event), event); return events.filter((event) => event.type !== "assistant.delta" || (!finals.has(eventMessageId(event)) && latest.get(eventMessageId(event)) === event)); }
function eventMessageId(event: ApiRunEvent) { const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}; return typeof payload.messageId === "string" ? payload.messageId : ""; }
function titleFromPrompt(prompt: string) { const line = prompt.split(/\r?\n/)[0].trim(); return line.length > 52 ? `${line.slice(0, 49)}…` : line; }
function humanEvent(type: string) { return ({ "task.created": "任务已创建", "run.created": "运行已创建", "run.started": "运行已开始", "run.completed": "运行已完成", "run.failed": "运行失败", "run.status_changed": "运行状态更新", "runtime.started": "运行时已启动", "runtime.unconfigured": "模型未配置", "model.started": "模型开始生成", "model.failed": "模型请求失败", "agent.started": "智能体已启动", "agent.completed": "智能体已完成", "artifact.created": "已生成文件", "user.message": "用户消息", "approval.requested": "已请求审批", "capability/started": "能力开始执行", "capability/completed": "能力执行完成", "capability/denied": "能力被拒绝", "cli.started": "命令行开始执行", "cli.completed": "命令行执行完成", "mcp.tool_call.completed": "MCP 工具调用完成" } as Record<string, string>)[type] ?? type.replace(/[._/]/g, " "); }
function shortTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function badgeStatus(status: string): "default" | "processing" | "success" | "error" | "warning" { if (status === "running") return "processing"; if (status === "done") return "success"; if (status === "failed") return "error"; if (status === "approval") return "warning"; return "default"; }
