import {
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Divider,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  appendRunEvent,
  createApiTask,
  deleteApiTask,
  getApiArtifactContent,
  listApiAgents,
  listApiAgentTeams,
  listApiApprovals,
  listApiArtifacts,
  listApiConnectors,
  listApiKnowledgeItems,
  listApiRunEvents,
  listApiSecrets,
  listApiTasks,
  listApiWorkflows,
  respondApiApproval,
  scanApiPlugins,
  scanApiSkills,
  startApiTask,
} from "../api";
import type { ApiAgent, ApiAgentTeam, ApiApproval, ApiArtifact, ApiRunEvent, ApiTask } from "../api";
import type { SettingsCatalog } from "./settings-drawer";

const { Text, Title, Paragraph } = Typography;
const SettingsDrawer = lazy(() => import("./settings-drawer"));
type DetailTab = "activity" | "files" | "context";

const statusMeta: Record<string, { label: string }> = {
  queued: { label: "排队中" }, approval: { label: "等待确认" }, running: { label: "生成中" }, paused: { label: "已暂停" },
  done: { label: "已完成" }, failed: { label: "失败" }, cancelled: { label: "已取消" },
};

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
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 760);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("activity");
  const [artifactPreview, setArtifactPreview] = useState<{ artifact: ApiArtifact; content: string }>();
  const conversationRef = useRef<HTMLElement>(null);
  const shouldFollowConversationRef = useRef(true);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const filteredTasks = useMemo(() => { const value = query.trim().toLowerCase(); return value ? tasks.filter((task) => `${task.title} ${task.prompt}`.toLowerCase().includes(value)) : tasks; }, [query, tasks]);
  const selectedApprovals = approvals.filter((item) => item.taskId === selectedTaskId && item.status === "pending");
  const selectedArtifacts = artifacts.filter((item) => item.taskId === selectedTaskId || item.runId === selectedTask?.runId);
  const messages = conversationEvents(events);
  const activityEvents = events.filter((event) => !isConversationEvent(event));

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
    const syncViewport = () => { const phone = window.innerWidth <= 760; setIsPhone(phone); if (phone) setSidebarOpen(false); };
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
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
  useEffect(() => {
    shouldFollowConversationRef.current = true;
    requestAnimationFrame(() => conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight }));
  }, [selectedTaskId]);
  useEffect(() => {
    if (shouldFollowConversationRef.current) conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" });
  }, [events, selectedApprovals.length]);
  useEffect(() => {
    if (!detailsOpen && !(isPhone && sidebarOpen)) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailsOpen) closeDetails(); else closeSidebar();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detailsOpen, isPhone, sidebarOpen]);

  async function createSession() {
    const prompt = composer.trim(); if (!prompt || submitting) return;
    setSubmitting(true);
    try {
      const target = resolveTarget(targetId, agents, teams);
      const result = await createApiTask({ title: titleFromPrompt(prompt), prompt, targetType: target.type, targetId: target.id, owner: "Local workspace", runtime: target.runtime, priority: accessMode === "strict" ? "high" : "normal", requiresApproval: false });
      setTasks((current) => [result.task, ...current]); setSelectedTaskId(result.task.id); setEvents(result.events); setComposer("");
      await startApiTask(result.task.id); await loadWorkspace();
    } catch { messageApi.error("无法开始新对话，请确认本地服务正在运行。"); setConnected(false); } finally { setSubmitting(false); }
  }

  async function sendFollowUp() {
    const text = composer.trim(); if (!selectedTask?.runId || !text || submitting) return;
    setComposer(""); setSubmitting(true);
    try { const { event } = await appendRunEvent(selectedTask.runId, "user.message", { text }); setEvents((current) => current.some((item) => item.id === event.id) ? current : [...current, event]); }
    catch { setComposer((current) => current || text); messageApi.error("消息发送失败，请检查本地服务后重试。"); } finally { setSubmitting(false); }
  }

  function confirmDeleteSession(task: ApiTask) {
    Modal.confirm({
      title: "删除对话？", content: `“${task.title}”的消息、运行记录和关联产物将被永久删除。`, okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
      async onOk() {
        try {
          await deleteApiTask(task.id);
          setTasks((current) => current.filter((item) => item.id !== task.id));
          setApprovals((current) => current.filter((item) => item.taskId !== task.id));
          setArtifacts((current) => current.filter((item) => item.taskId !== task.id && item.runId !== task.runId));
          setSelectedTaskId((current) => current === task.id ? undefined : current);
          messageApi.success("对话已删除");
        } catch { messageApi.error("对话删除失败，请检查本地服务后重试。"); }
      },
    });
  }

  async function respond(approval: ApiApproval, decision: "allow_once" | "deny") {
    try { await respondApiApproval(approval.id, decision); setApprovals((await listApiApprovals()).approvals); await loadWorkspace(); }
    catch { messageApi.error("无法提交确认，请稍后重试。"); }
  }
  async function openSettings() { if (isPhone) setSidebarOpen(false); setSettingsOpen(true); await loadSettings(); }
  function closeSettings() { setSettingsOpen(false); if (isPhone) requestAnimationFrame(() => document.getElementById("open-sidebar")?.focus()); }
  async function loadSettings() {
    setSettingsLoading(true); setSettingsError(undefined);
    const results = await Promise.allSettled([listApiConnectors(), listApiKnowledgeItems(), scanApiSkills(), scanApiPlugins(), listApiWorkflows(), listApiSecrets()]);
    setCatalog({ connectors: fulfilled(results[0], "connectors"), knowledge: fulfilled(results[1], "knowledgeItems"), skills: fulfilled(results[2], "skills"), plugins: fulfilled(results[3], "plugins"), workflows: fulfilled(results[4], "workflows"), secrets: fulfilled(results[5], "secrets") });
    if (results.some((result) => result.status === "rejected")) setSettingsError("部分本地数据没有响应。已保留成功加载的内容，你可以重试。");
    setSettingsLoading(false);
  }

  function openSidebar() { setSidebarOpen(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(".session-sidebar")?.focus()); }
  function closeSidebar() { setSidebarOpen(false); requestAnimationFrame(() => document.getElementById("open-sidebar")?.focus()); }
  function openDetails(tab: DetailTab = "activity") { setDetailTab(tab); setDetailsOpen(true); requestAnimationFrame(() => document.querySelector<HTMLElement>(".details-panel")?.focus()); }
  function closeDetails() { setDetailsOpen(false); requestAnimationFrame(() => document.getElementById("open-details")?.focus()); }
  async function previewArtifact(artifact: ApiArtifact) { try { const result = await getApiArtifactContent(artifact.id); setArtifactPreview({ artifact, content: result.content }); } catch { messageApi.error("无法读取产物内容。"); } }

  const pendingCount = approvals.filter((item) => item.status === "pending").length;
  const sidebarModal = isPhone && sidebarOpen;
  const connectionLabel = connected === null ? "正在连接" : connected === false ? "本地服务不可用" : selectedTask?.runId && streamConnected === false ? "正在重新连接" : submitting || selectedTask?.status === "running" ? "正在生成" : "已连接";
  const visibleTaskStatus = submitting ? "running" : selectedTask?.status;

  return (
    <div className={`workbench-shell ${sidebarOpen ? "" : "sidebar-collapsed"} ${detailsOpen ? "details-open" : ""}`}>
      {contextHolder}<a className="skip-link" href="#session-main">跳到当前对话</a>
      {sidebarModal && <button className="panel-backdrop sidebar-backdrop" type="button" aria-label="关闭对话列表" onClick={closeSidebar} />}
      {detailsOpen && <button className="panel-backdrop details-backdrop" type="button" aria-label="关闭活动面板" onClick={closeDetails} />}
      <aside className="session-sidebar" aria-label="对话导航" aria-hidden={!sidebarOpen} aria-modal={sidebarModal || undefined} role={sidebarModal ? "dialog" : undefined} inert={!sidebarOpen || detailsOpen ? true : undefined} tabIndex={-1}>
        <div className="sidebar-brand"><span className="brand-glyph" aria-hidden="true">A</span><div><Text strong>Agent Workbench</Text><Text type="secondary">写作工作区</Text></div><Tooltip title="收起侧栏"><Button type="text" icon={<MenuFoldOutlined />} aria-label="收起侧栏" onClick={closeSidebar} /></Tooltip></div>
        <Button className="new-session-button" icon={<PlusOutlined />} onClick={() => { setSelectedTaskId(undefined); setComposer(""); if (isPhone) setSidebarOpen(false); }}>新对话</Button>
        <Input className="session-search" prefix={<SearchOutlined aria-hidden="true" />} value={query} onChange={(event) => setQuery(event.target.value)} allowClear placeholder="搜索对话" aria-label="搜索对话" />
        <div className="session-list-heading"><Text type="secondary">最近</Text></div>
        <div className="session-list" role="list" aria-label="对话列表">
          {loading ? <Skeleton active paragraph={{ rows: 6 }} title={false} /> : filteredTasks.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? "没有匹配的对话" : "还没有对话"} /> : filteredTasks.map((task) => (
            <div key={task.id} role="listitem" className={`session-row ${task.id === selectedTaskId ? "selected" : ""}`}>
              <button className="session-row-select" type="button" aria-current={task.id === selectedTaskId ? "page" : undefined} onClick={() => { setSelectedTaskId(task.id); if (isPhone) setSidebarOpen(false); }}>
                <span className="session-row-title">{task.title}</span>
                <span className="session-row-meta"><span className={`session-status-dot status-${task.status}`} aria-hidden="true" />{statusMeta[task.status]?.label ?? task.status}<time>{shortTime(task.updatedAt)}</time></span>
              </button>
              <Tooltip title="删除对话"><Button className="session-delete" type="text" danger icon={<DeleteOutlined />} aria-label={`删除对话：${task.title}`} onClick={() => confirmDeleteSession(task)} /></Tooltip>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <button type="button" className="workspace-row" onClick={() => void openSettings()}><FolderOpenOutlined aria-hidden="true" /><span>agent-workbench</span><Badge status={connected === null ? "processing" : connected ? "success" : "error"} /></button>
          <button type="button" className="settings-row" onClick={() => void openSettings()}><SettingOutlined aria-hidden="true" /><span>设置</span>{pendingCount > 0 && <Badge count={pendingCount} />}</button>
        </div>
      </aside>

      <main className="session-main" id="session-main" inert={sidebarModal || detailsOpen ? true : undefined}>
        <header className="session-header">
          <div className="header-leading">{!sidebarOpen && <Button id="open-sidebar" type="text" icon={<MenuUnfoldOutlined />} aria-label="打开对话列表" onClick={openSidebar} />}<div className="session-title-block"><Title level={4}>{selectedTask?.title ?? "新对话"}</Title><span className="connection-label" role="status"><span className={`connection-dot ${connected === null ? "connecting" : connected ? "online" : "offline"}`} aria-hidden="true" />{connectionLabel}</span></div></div>
          <Space size={8}>{selectedTask && visibleTaskStatus && <Tag className={`task-status task-status-${visibleTaskStatus}`}>{statusMeta[visibleTaskStatus]?.label ?? visibleTaskStatus}</Tag>}<Button id="open-details" type="text" icon={<HistoryOutlined />} aria-label="打开活动面板" aria-expanded={detailsOpen} onClick={() => openDetails("activity")}>活动</Button></Space>
        </header>
        {connected === null ? <ConversationLoading /> : connected === false ? <ConnectionState onRetry={() => void loadWorkspace()} /> : selectedTask ? (
          <section ref={conversationRef} className="conversation" aria-label="对话内容" onScroll={(event) => { const element = event.currentTarget; shouldFollowConversationRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120; }}><div className="conversation-inner"><UserMessage text={selectedTask.prompt} />{messages.map((event) => <ConversationMessage key={event.id} event={event} />)}{selectedApprovals.map((approval) => <ApprovalMessage key={approval.id} approval={approval} onRespond={respond} />)}{selectedTask.status === "running" && !messages.some((event) => event.type === "assistant.delta") && <ThinkingMessage />}</div></section>
        ) : <Welcome onExample={setComposer} />}
        <Composer selectedTask={selectedTask} connected={Boolean(connected)} composer={composer} setComposer={setComposer} targetId={targetId} setTargetId={setTargetId} accessMode={accessMode} setAccessMode={setAccessMode} agents={agents} teams={teams} submitting={submitting} onSend={() => void (selectedTask ? sendFollowUp() : createSession())} />
      </main>

      <aside className="details-panel" aria-label="活动与产物" aria-hidden={!detailsOpen} aria-modal="true" role="dialog" inert={!detailsOpen ? true : undefined} tabIndex={-1}>
        <div className="details-header"><div><Text strong>对话活动</Text><Text type="secondary">运行信息不会混入正文</Text></div><Button type="text" icon={<CloseOutlined />} aria-label="关闭活动面板" onClick={closeDetails} /></div>
        <Tabs activeKey={detailTab} onChange={(key) => setDetailTab(key as DetailTab)} items={[{ key: "activity", label: `活动 ${activityEvents.length || ""}`, children: <ActivityList task={selectedTask} events={activityEvents} /> }, { key: "files", label: `产物 ${selectedArtifacts.length || ""}`, children: <ArtifactList artifacts={selectedArtifacts} onOpen={previewArtifact} /> }, { key: "context", label: "上下文", children: <ContextDetails task={selectedTask} agents={agents} teams={teams} /> }]} />
      </aside>

      {settingsOpen && <Suspense fallback={null}><SettingsDrawer open loading={settingsLoading} error={settingsError} onClose={closeSettings} onRetry={() => void loadSettings()} onChanged={loadSettings} agents={agents} teams={teams} catalog={catalog} /></Suspense>}
      <Modal title={artifactPreview?.artifact.name} open={Boolean(artifactPreview)} onCancel={() => setArtifactPreview(undefined)} footer={null} width={760}><pre className="artifact-content">{artifactPreview?.content || "暂无可预览内容。"}</pre></Modal>
    </div>
  );
}

function Composer({ selectedTask, connected, composer, setComposer, targetId, setTargetId, accessMode, setAccessMode, agents, teams, submitting, onSend }: { selectedTask?: ApiTask; connected: boolean; composer: string; setComposer: (value: string) => void; targetId: string; setTargetId: (value: string) => void; accessMode: "collaborative" | "strict"; setAccessMode: (value: "collaborative" | "strict") => void; agents: ApiAgent[]; teams: ApiAgentTeam[]; submitting: boolean; onSend: () => void }) {
  return <div className="composer-wrap"><div className="composer"><Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={composer} onChange={(event) => setComposer(event.target.value)} placeholder={selectedTask ? "继续写作或提出修改要求" : "描述你想一起完成的内容"} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); onSend(); } }} aria-label="对话消息" /><div className="composer-controls"><Space size={4} wrap><Select variant="borderless" value={targetId} onChange={setTargetId} options={targetOptions(agents, teams)} aria-label="选择智能体" /><Segmented size="small" value={accessMode} onChange={(value) => setAccessMode(value as typeof accessMode)} options={[{ label: "可写工作区", value: "collaborative" }, { label: "操作前询问", value: "strict" }]} /></Space><Button className="send-button" type="primary" shape="circle" icon={<SendOutlined />} loading={submitting} disabled={!composer.trim() || !connected} aria-label={selectedTask ? "发送消息" : "开始对话"} onClick={onSend} /></div></div><Text type="secondary" className="composer-hint">Enter 发送 · Shift + Enter 换行</Text></div>;
}

function UserMessage({ text, time }: { text: string; time?: string }) { return <article className="chat-message user-message"><div className="chat-bubble"><Paragraph>{text}</Paragraph>{time && <time>{time}</time>}</div></article>; }
function ConversationMessage({ event }: { event: ApiRunEvent }) { const payload = eventPayload(event); const text = String(payload.text ?? payload.message ?? ""); if (event.type === "user.message") return <UserMessage text={text} time={shortTime(event.createdAt)} />; const streaming = event.type === "assistant.delta"; return <article className={`chat-message assistant-message ${streaming ? "is-streaming" : ""}`} aria-live={streaming ? "polite" : undefined}><span className="assistant-avatar" aria-hidden="true">A</span><div className="assistant-content"><div className="message-heading"><Text strong>Agent Workbench</Text><time>{shortTime(event.createdAt)}</time></div><Paragraph>{text || humanEvent(event.type)}</Paragraph></div></article>; }
function ThinkingMessage() { return <article className="chat-message assistant-message thinking-message" aria-live="polite"><span className="assistant-avatar" aria-hidden="true">A</span><div className="thinking-dots" aria-label="智能体正在生成"><span /><span /><span /></div></article>; }
function ApprovalMessage({ approval, onRespond }: { approval: ApiApproval; onRespond: (approval: ApiApproval, decision: "allow_once" | "deny") => void }) { const risk = { low: "低风险", medium: "中风险", high: "高风险" }[approval.risk]; return <article className="approval-message"><div className="approval-heading"><Text strong>需要你的确认</Text><Tag className={`risk-tag risk-${approval.risk}`}>{risk}</Tag></div><Paragraph>{approval.reason}</Paragraph><Space><Button onClick={() => onRespond(approval, "deny")}>拒绝</Button><Button type="primary" onClick={() => onRespond(approval, "allow_once")}>允许一次</Button></Space></article>; }

function ActivityList({ task, events }: { task?: ApiTask; events: ApiRunEvent[] }) {
  if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择对话后查看活动" />;
  return events.length ? <div className="activity-list">{events.map((event) => { const payload = eventPayload(event); const tool = /cli|mcp|capability|tool|adapter/.test(event.type); const summary = activitySummary(event); return <article className="activity-item" key={event.id}><span className={`activity-node ${tool ? "tool" : ""}`} aria-hidden="true">{tool ? <CodeOutlined /> : null}</span><div><div className="activity-heading"><Text strong>{humanEvent(event.type)}</Text><time>{shortTime(event.createdAt)}</time></div>{summary && <Paragraph>{summary}</Paragraph>}{Object.keys(payload).length > 0 && tool && <details><summary>查看详情</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>}</div></article>; })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行活动" />;
}
function ConversationLoading() { return <div className="conversation-loading" aria-label="正在加载对话"><Skeleton active avatar paragraph={{ rows: 4 }} /></div>; }
function ConnectionState({ onRetry }: { onRetry: () => void }) { return <div className="center-state"><div className="state-mark"><CloseOutlined /></div><Title level={3}>本地服务未运行</Title><Paragraph type="secondary">运行 <code>pnpm web</code> 后重试。对话、设置和产物都由本地服务读取。</Paragraph><Button type="primary" onClick={onRetry}>重新连接</Button></div>; }
function Welcome({ onExample }: { onExample: (value: string) => void }) { const examples = [["起草", "帮我起草一篇关于本地 AI 工作流的产品文章。"], ["改写", "把这段内容改得更清晰、自然，并保留原意。"], ["续写", "根据现有结构继续完成下一节，并保持语气一致。"]]; return <div className="welcome"><div className="welcome-mark">A</div><Title>今天想写什么？</Title><Paragraph type="secondary">从想法、草稿或修改要求开始，我们在同一段对话里完成它。</Paragraph><div className="example-grid">{examples.map(([label, text]) => <button type="button" key={label} onClick={() => onExample(text)}><strong>{label}</strong><span>{text}</span></button>)}</div></div>; }
function ContextDetails({ task, agents, teams }: { task?: ApiTask; agents: ApiAgent[]; teams: ApiAgentTeam[] }) { if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上下文" />; const target = [...agents, ...teams].find((item) => item.id === task.targetId); return <div className="detail-stack"><Detail label="智能体" value={target?.name ?? task.targetId} /><Detail label="运行时" value={task.runtime} /><Detail label="访问权限" value={task.priority === "high" ? "操作前询问" : "可写工作区"} /><Divider /><Detail label="运行 ID" value={task.runId ?? "尚未启动"} mono /><Text type="secondary">能力调用会按策略检查，高风险操作会回到对话中请求确认。</Text></div>; }
function ArtifactList({ artifacts, onOpen }: { artifacts: ApiArtifact[]; onOpen: (artifact: ApiArtifact) => void }) { return artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <button key={artifact.id} type="button" onClick={() => onOpen(artifact)}><FileTextOutlined aria-hidden="true" /><span><strong>{artifact.name}</strong><small>{artifact.summary}</small></span></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这段对话还没有产物" />; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-row"><Text type="secondary">{label}</Text><Text className={mono ? "mono" : ""}>{value}</Text></div>; }

function fulfilled<T, K extends keyof T>(result: PromiseSettledResult<T>, key: K): T[K] extends unknown[] ? T[K] : never { return (result.status === "fulfilled" ? result.value[key] : []) as T[K] extends unknown[] ? T[K] : never; }
function resolveTarget(id: string, agents: ApiAgent[], teams: ApiAgentTeam[]) { const agent = agents.find((item) => item.id === id); if (agent) return { type: "agent" as const, id: agent.id, runtime: agent.runtime }; const team = teams.find((item) => item.id === id); if (team) return { type: "agent_team" as const, id: team.id, runtime: "Workflow" }; return { type: "agent" as const, id: "local", runtime: "Codex" }; }
function targetOptions(agents: ApiAgent[], teams: ApiAgentTeam[]) { return [{ value: "local", label: "本地智能体" }, ...agents.map((item) => ({ value: item.id, label: item.name })), ...teams.map((item) => ({ value: item.id, label: item.name }))]; }
function isConversationEvent(event: ApiRunEvent) { return event.type === "user.message" || /assistant\.(delta|message|error)|runtime\.unconfigured/.test(event.type); }
function conversationEvents(events: ApiRunEvent[]) { const finals = new Set(events.filter((event) => event.type === "assistant.message").map(eventMessageId).filter(Boolean)); const latest = new Map<string, ApiRunEvent>(); for (const event of events) if (event.type === "assistant.delta") latest.set(eventMessageId(event), event); return events.filter((event) => isConversationEvent(event) && (event.type !== "assistant.delta" || (!finals.has(eventMessageId(event)) && latest.get(eventMessageId(event)) === event))); }
function eventPayload(event: ApiRunEvent) { return event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}; }
function eventMessageId(event: ApiRunEvent) { const payload = eventPayload(event); return typeof payload.messageId === "string" ? payload.messageId : ""; }
function activitySummary(event: ApiRunEvent) { const payload = eventPayload(event); if (typeof payload.text === "string") return payload.text; if (typeof payload.status === "string") return statusMeta[payload.status]?.label ?? payload.status; if (typeof payload.message === "string") return payload.message; return ""; }
function titleFromPrompt(prompt: string) { const line = prompt.split(/\r?\n/)[0].trim(); return line.length > 52 ? `${line.slice(0, 49)}…` : line; }
function humanEvent(type: string) { return ({ "task.created": "对话已创建", "run.created": "运行已创建", "run.started": "运行已开始", "run.completed": "运行已完成", "run.failed": "运行失败", "run.status_changed": "运行状态更新", "runtime.started": "运行时已启动", "runtime.unconfigured": "模型未配置", "model.started": "模型开始生成", "model.failed": "模型请求失败", "agent.started": "智能体已启动", "agent.completed": "智能体已完成", "artifact.created": "已生成产物", "approval.requested": "已请求确认", "capability/started": "能力开始执行", "capability/completed": "能力执行完成", "capability/denied": "能力被拒绝", "cli.started": "命令开始执行", "cli.completed": "命令执行完成", "mcp.tool_call.completed": "工具调用完成" } as Record<string, string>)[type] ?? type.replace(/[._/]/g, " "); }
function shortTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
