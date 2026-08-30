import {
  ArrowDownOutlined,
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
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { Bubble, Conversations, Prompts, Sender, Welcome as XWelcome } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import {
  Badge,
  Button,
  Divider,
  Dropdown,
  Empty,
  Input,
  Modal,
  Result,
  Skeleton,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  listApiModelProviders,
  listApiTasks,
  listApiWorkflows,
  respondApiApproval,
  scanApiPlugins,
  scanApiSkills,
  startApiTask,
  stopApiRun,
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
  const [catalog, setCatalog] = useState<SettingsCatalog>({ connectors: [], knowledge: [], skills: [], plugins: [], workflows: [], modelProviders: [] });
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [targetId, setTargetId] = useState("local");
  const [accessMode, setAccessMode] = useState<"collaborative" | "strict">("collaborative");
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string>();
  const [isPhone, setIsPhone] = useState(() => window.innerWidth <= 760);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 760);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [followingConversation, setFollowingConversation] = useState(true);
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
  const generating = submitting || selectedTask?.status === "running";
  const followLatest = useCallback(() => { if (shouldFollowConversationRef.current) conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "auto" }); }, []);

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
    let frame = 0;
    let pendingEvents: ApiRunEvent[] = [];
    const receiveRuntimeEvent = (event: MessageEvent<string>) => { try { const next = JSON.parse(event.data) as ApiRunEvent; pendingEvents.push(next); if (next.type === "run.status_changed") { const status = eventPayload(next).status; if (typeof status === "string") setTasks((current) => current.map((task) => task.runId === next.runId ? { ...task, status } : task)); } if (!frame) frame = requestAnimationFrame(() => { const batch = pendingEvents; pendingEvents = []; frame = 0; setEvents((current) => { const ids = new Set(current.map((item) => item.id)); return [...current, ...batch.filter((item) => !ids.has(item.id))]; }); }); } catch { setStreamConnected(false); } };
    source.addEventListener("runtime", receiveRuntimeEvent);
    return () => { active = false; if (frame) cancelAnimationFrame(frame); source.removeEventListener("runtime", receiveRuntimeEvent); source.close(); };
  }, [connected, selectedTask?.runId]);
  useEffect(() => {
    shouldFollowConversationRef.current = true;
    setFollowingConversation(true);
    requestAnimationFrame(followLatest);
  }, [selectedTaskId]);
  useEffect(() => {
    followLatest();
  }, [events, selectedApprovals.length, followLatest]);
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

  async function stopGeneration() {
    if (!selectedTask?.runId || stopping) return;
    setStopping(true);
    try { await stopApiRun(selectedTask.runId); setSubmitting(false); await loadWorkspace(); }
    catch { messageApi.error("未能停止生成，请稍后重试。"); }
    finally { setStopping(false); }
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
    const results = await Promise.allSettled([listApiConnectors(), listApiKnowledgeItems(), scanApiSkills(), scanApiPlugins(), listApiWorkflows(), listApiModelProviders()]);
    setCatalog({ connectors: fulfilled(results[0], "connectors"), knowledge: fulfilled(results[1], "knowledgeItems"), skills: fulfilled(results[2], "skills"), plugins: fulfilled(results[3], "plugins"), workflows: fulfilled(results[4], "workflows"), modelProviders: fulfilled(results[5], "providers") });
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
        <Input className="session-search" prefix={<SearchOutlined aria-hidden="true" />} value={query} onChange={(event) => setQuery(event.target.value)} allowClear placeholder="搜索对话" aria-label="搜索对话" />
        <div className="session-list" role="list" aria-label="对话列表">
          {loading ? <Skeleton active paragraph={{ rows: 6 }} title={false} /> : <Conversations
            activeKey={selectedTaskId}
            creation={{ label: "新对话", icon: <PlusOutlined />, onClick: () => { setSelectedTaskId(undefined); setComposer(""); if (isPhone) setSidebarOpen(false); } }}
            items={filteredTasks.map((task) => ({ key: task.id, label: <span className="conversation-label"><span className="conversation-title">{task.title}</span><span className="conversation-meta"><span className={`session-status-dot status-${task.status}`} aria-hidden="true" />{statusMeta[task.status]?.label ?? task.status}<time>{shortTime(task.updatedAt)}</time></span></span> }))}
            menu={(conversation) => ({ items: [{ key: "delete", label: "删除对话", danger: true, icon: <DeleteOutlined /> }], onClick: ({ domEvent }) => { domEvent.stopPropagation(); const task = tasks.find((item) => item.id === conversation.key); if (task) confirmDeleteSession(task); } })}
            onActiveChange={(key) => { setSelectedTaskId(String(key)); if (isPhone) setSidebarOpen(false); }}
          />}
          {!loading && filteredTasks.length === 0 && query && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的对话" />}
        </div>
        <div className="sidebar-footer">
          <Button type="text" block className="workspace-row" icon={<FolderOpenOutlined aria-hidden="true" />} onClick={() => void openSettings()}><span>agent-workbench</span><Badge status={connected === null ? "processing" : connected ? "success" : "error"} /></Button>
          <Button type="text" block className="settings-row" icon={<SettingOutlined aria-hidden="true" />} onClick={() => void openSettings()}><span>设置</span>{pendingCount > 0 && <Badge count={pendingCount} />}</Button>
        </div>
      </aside>

      <main className="session-main" id="session-main" inert={sidebarModal || detailsOpen ? true : undefined}>
        <header className="session-header">
          <div className="header-leading">{!sidebarOpen && <Button id="open-sidebar" type="text" icon={<MenuUnfoldOutlined />} aria-label="打开对话列表" onClick={openSidebar} />}<div className="session-title-block"><Title level={4}>{selectedTask?.title ?? "新对话"}</Title><span className="connection-label" role="status"><span className={`connection-dot ${connected === null ? "connecting" : connected ? "online" : "offline"}`} aria-hidden="true" />{connectionLabel}</span></div></div>
          <Space size={8}>{selectedTask && visibleTaskStatus && <Tag className={`task-status task-status-${visibleTaskStatus}`}>{statusMeta[visibleTaskStatus]?.label ?? visibleTaskStatus}</Tag>}<Button id="open-details" type="text" icon={<HistoryOutlined />} aria-label="打开活动面板" aria-expanded={detailsOpen} onClick={() => openDetails("activity")}>活动</Button></Space>
        </header>
        {connected === null ? <ConversationLoading /> : connected === false ? <ConnectionState onRetry={() => void loadWorkspace()} /> : selectedTask ? (
          <div className="conversation-stage"><section ref={conversationRef} className="conversation" aria-label="对话内容" onScroll={(event) => { const element = event.currentTarget; const following = element.scrollHeight - element.scrollTop - element.clientHeight < 80; shouldFollowConversationRef.current = following; setFollowingConversation(following); }}><div className="conversation-inner"><ConversationBubbles task={selectedTask} events={messages} generating={generating} />{selectedApprovals.map((approval) => <ApprovalMessage key={approval.id} approval={approval} onRespond={respond} />)}</div></section>{!followingConversation && <Button className="scroll-to-latest" shape="round" icon={<ArrowDownOutlined />} onClick={() => { shouldFollowConversationRef.current = true; setFollowingConversation(true); conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: "smooth" }); }}>回到最新</Button>}</div>
        ) : <Welcome onExample={setComposer} />}
        <Composer selectedTask={selectedTask} connected={Boolean(connected)} composer={composer} setComposer={setComposer} targetId={targetId} setTargetId={setTargetId} accessMode={accessMode} setAccessMode={setAccessMode} agents={agents} teams={teams} generating={generating} stopping={stopping} onSend={() => void (selectedTask ? sendFollowUp() : createSession())} onStop={() => void stopGeneration()} />
      </main>

      <aside className="details-panel" aria-label="活动与产物" aria-hidden={!detailsOpen} aria-modal="true" role="dialog" inert={!detailsOpen ? true : undefined} tabIndex={-1}>
        <div className="details-header"><div><Text strong>对话活动</Text><Text type="secondary">运行信息不会混入正文</Text></div><Button type="text" icon={<CloseOutlined />} aria-label="关闭活动面板" onClick={closeDetails} /></div>
        <Tabs activeKey={detailTab} onChange={(key) => setDetailTab(key as DetailTab)} items={[{ key: "activity", label: `活动 ${activityEvents.length || ""}`, children: <ActivityList task={selectedTask} events={activityEvents} /> }, { key: "files", label: `产物 ${selectedArtifacts.length || ""}`, children: <ArtifactList artifacts={selectedArtifacts} onOpen={previewArtifact} /> }, { key: "context", label: "上下文", children: <ContextDetails task={selectedTask} agents={agents} teams={teams} /> }]} />
      </aside>

      {settingsOpen && <Suspense fallback={null}><SettingsDrawer open loading={settingsLoading} error={settingsError} onClose={closeSettings} onRetry={() => void loadSettings()} onChanged={async () => { await Promise.all([loadWorkspace(), loadSettings()]); }} agents={agents} teams={teams} catalog={catalog} /></Suspense>}
      <Modal title={artifactPreview?.artifact.name} open={Boolean(artifactPreview)} onCancel={() => setArtifactPreview(undefined)} footer={null} width={760}><pre className="artifact-content">{artifactPreview?.content || "暂无可预览内容。"}</pre></Modal>
    </div>
  );
}

function Composer({ selectedTask, connected, composer, setComposer, targetId, setTargetId, accessMode, setAccessMode, agents, teams, generating, stopping, onSend, onStop }: { selectedTask?: ApiTask; connected: boolean; composer: string; setComposer: (value: string) => void; targetId: string; setTargetId: (value: string) => void; accessMode: "collaborative" | "strict"; setAccessMode: (value: "collaborative" | "strict") => void; agents: ApiAgent[]; teams: ApiAgentTeam[]; generating: boolean; stopping: boolean; onSend: () => void; onStop: () => void }) {
  const targets = targetOptions(agents, teams);
  const targetLabel = targets.find((item) => item.value === targetId)?.label ?? "本地智能体";
  const permissionLabel = accessMode === "strict" ? "更改前询问" : "低风险自动执行";
  const targetMenu = <Dropdown trigger={["click"]} menu={{ selectedKeys: [targetId], items: targets.map((item) => ({ key: item.value, label: item.label })), onClick: ({ key }) => setTargetId(key) }}><Tooltip title={`选择智能体 · ${targetLabel}`}><Button className="composer-agent-button" type="text" icon={<PlusOutlined />} aria-label={`选择智能体，当前为${targetLabel}`} /></Tooltip></Dropdown>;
  const permissionMenu = <Dropdown classNames={{ root: "composer-permission-menu" }} trigger={["click"]} menu={{ selectedKeys: [accessMode], items: [{ key: "strict", label: "更改前询问" }, { key: "collaborative", label: "自动执行低风险操作" }], onClick: ({ key }) => setAccessMode(key as typeof accessMode) }}><Sender.Switch className="composer-switch" value={false} icon={<SafetyCertificateOutlined />} aria-label={`权限：${permissionLabel}`}>{permissionLabel}</Sender.Switch></Dropdown>;
  return <div className="composer-wrap"><Sender rootClassName="composer-sender" value={composer} onChange={setComposer} onSubmit={() => { if (!generating && composer.trim()) onSend(); }} onCancel={onStop} loading={generating} disabled={!connected || stopping} submitType="enter" autoSize={{ minRows: 1, maxRows: 8 }} placeholder={selectedTask ? "继续输入消息" : "向 Agent Workbench 发送消息"} suffix={false} footer={(actions) => <div className="composer-toolbar"><Space size={4}>{targetMenu}{permissionMenu}</Space>{actions}</div>} /><Text type="secondary" className="composer-hint" role="status" aria-live="polite">{generating ? "正在生成，你可以停止或继续编辑下一条消息" : "Enter 发送 · Shift + Enter 换行"}</Text></div>;
}

function ConversationBubbles({ task, events, generating }: { task: ApiTask; events: ApiRunEvent[]; generating: boolean }) {
  const hasStreamingMessage = events.some((event) => event.type === "assistant.delta");
  const items = [{ key: `prompt-${task.id}`, role: "user", content: task.prompt, status: "success" as const }, ...events.map((event) => { const payload = eventPayload(event); const user = event.type === "user.message"; const streaming = event.type === "assistant.delta"; return { key: conversationEventKey(event), role: user ? "user" : "ai", content: String(payload.text ?? payload.message ?? humanEvent(event.type)), status: (streaming ? "updating" : event.type === "assistant.error" ? "error" : payload.stopped === true ? "abort" : "success") as "updating" | "error" | "abort" | "success", streaming, header: user ? undefined : <span className="message-heading"><Text strong>Agent Workbench</Text><time>{shortTime(event.createdAt)}</time></span>, footer: payload.stopped === true ? <Text type="secondary" className="stopped-label">已停止生成</Text> : undefined }; }), ...(generating && !hasStreamingMessage ? [{ key: "thinking", role: "ai", content: "", status: "loading" as const, loading: true }] : [])];
  return <Bubble.List className="conversation-bubbles" autoScroll={false} items={items} role={{ user: { placement: "end", variant: "filled", shape: "corner" }, ai: { placement: "start", variant: "borderless", avatar: <span className="assistant-avatar" aria-hidden="true">A</span>, contentRender: (content, info) => <XMarkdown className="markdown-body x-markdown-light" content={String(content)} openLinksInNewTab escapeRawHtml streaming={{ hasNextChunk: info.status === "updating", enableAnimation: true, animationConfig: { fadeDuration: 120, easing: "ease-out" }, tail: false }} /> } }} />;
}
function ApprovalMessage({ approval, onRespond }: { approval: ApiApproval; onRespond: (approval: ApiApproval, decision: "allow_once" | "deny") => void }) { const risk = { low: "低风险", medium: "中风险", high: "高风险" }[approval.risk]; return <article className="approval-message"><div className="approval-heading"><Text strong>需要你的确认</Text><Tag className={`risk-tag risk-${approval.risk}`}>{risk}</Tag></div><Paragraph>{approval.reason}</Paragraph><Space><Button onClick={() => onRespond(approval, "deny")}>拒绝</Button><Button type="primary" onClick={() => onRespond(approval, "allow_once")}>允许一次</Button></Space></article>; }

function ActivityList({ task, events }: { task?: ApiTask; events: ApiRunEvent[] }) {
  if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择对话后查看活动" />;
  return events.length ? <div className="activity-list">{events.map((event) => { const payload = eventPayload(event); const tool = /cli|mcp|capability|tool|adapter/.test(event.type); const summary = activitySummary(event); return <article className="activity-item" key={event.id}><span className={`activity-node ${tool ? "tool" : ""}`} aria-hidden="true">{tool ? <CodeOutlined /> : null}</span><div><div className="activity-heading"><Text strong>{humanEvent(event.type)}</Text><time>{shortTime(event.createdAt)}</time></div>{summary && <Paragraph>{summary}</Paragraph>}{Object.keys(payload).length > 0 && tool && <details><summary>查看详情</summary><pre>{JSON.stringify(payload, null, 2)}</pre></details>}</div></article>; })}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无运行活动" />;
}
function ConversationLoading() { return <div className="conversation-loading" aria-label="正在加载对话"><Skeleton active avatar paragraph={{ rows: 4 }} /></div>; }
function ConnectionState({ onRetry }: { onRetry: () => void }) { return <Result className="center-state" status="error" title="本地服务未运行" subTitle={<>运行 <code>pnpm web</code> 后重试。对话、设置和产物都由本地服务读取。</>} extra={<Button type="primary" onClick={onRetry}>重新连接</Button>} />; }
function Welcome({ onExample }: { onExample: (value: string) => void }) { const examples = [{ key: "起草", label: "起草", description: "帮我起草一篇关于本地 AI 工作流的产品文章。" }, { key: "改写", label: "改写", description: "把这段内容改得更清晰、自然，并保留原意。" }, { key: "续写", label: "续写", description: "根据现有结构继续完成下一节，并保持语气一致。" }]; return <div className="welcome"><XWelcome variant="borderless" title="今天想写什么？" description="从想法、草稿或修改要求开始，我们在同一段对话里完成它。" /><Prompts className="example-grid" items={examples} onItemClick={({ data }) => onExample(String(data.description ?? ""))} /></div>; }
function ContextDetails({ task, agents, teams }: { task?: ApiTask; agents: ApiAgent[]; teams: ApiAgentTeam[] }) { if (!task) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上下文" />; const target = [...agents, ...teams].find((item) => item.id === task.targetId); return <div className="detail-stack"><Detail label="智能体" value={target?.name ?? task.targetId} /><Detail label="运行时" value={task.runtime} /><Detail label="访问权限" value={task.priority === "high" ? "操作前询问" : "可写工作区"} /><Divider /><Detail label="运行 ID" value={task.runId ?? "尚未启动"} mono /><Text type="secondary">能力调用会按策略检查，高风险操作会回到对话中请求确认。</Text></div>; }
function ArtifactList({ artifacts, onOpen }: { artifacts: ApiArtifact[]; onOpen: (artifact: ApiArtifact) => void }) { return artifacts.length ? <div className="artifact-list">{artifacts.map((artifact) => <Button key={artifact.id} type="text" block className="artifact-entry" icon={<FileTextOutlined aria-hidden="true" />} onClick={() => onOpen(artifact)}><span><strong>{artifact.name}</strong><small>{artifact.summary}</small></span></Button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这段对话还没有产物" />; }
function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="detail-row"><Text type="secondary">{label}</Text><Text className={mono ? "mono" : ""}>{value}</Text></div>; }

function fulfilled<T, K extends keyof T>(result: PromiseSettledResult<T>, key: K): T[K] extends unknown[] ? T[K] : never { return (result.status === "fulfilled" ? result.value[key] : []) as T[K] extends unknown[] ? T[K] : never; }
function resolveTarget(id: string, agents: ApiAgent[], teams: ApiAgentTeam[]) { const agent = agents.find((item) => item.id === id); if (agent) return { type: "agent" as const, id: agent.id, runtime: agent.runtime }; const team = teams.find((item) => item.id === id); if (team) return { type: "agent_team" as const, id: team.id, runtime: "Workflow" }; return { type: "agent" as const, id: "local", runtime: "Codex" }; }
function targetOptions(agents: ApiAgent[], teams: ApiAgentTeam[]) { return [{ value: "local", label: "本地智能体" }, ...agents.map((item) => ({ value: item.id, label: item.name })), ...teams.map((item) => ({ value: item.id, label: item.name }))]; }
function isConversationEvent(event: ApiRunEvent) { return event.type === "user.message" || /assistant\.(delta|message|error)|runtime\.unconfigured/.test(event.type); }
function conversationEvents(events: ApiRunEvent[]) { const finals = new Set(events.filter((event) => event.type === "assistant.message").map(eventMessageId).filter(Boolean)); const latest = new Map<string, ApiRunEvent>(); for (const event of events) if (event.type === "assistant.delta") latest.set(eventMessageId(event), event); return events.filter((event) => isConversationEvent(event) && (event.type !== "assistant.delta" || (!finals.has(eventMessageId(event)) && latest.get(eventMessageId(event)) === event))); }
function eventPayload(event: ApiRunEvent) { return event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : {}; }
function eventMessageId(event: ApiRunEvent) { const payload = eventPayload(event); return typeof payload.messageId === "string" ? payload.messageId : ""; }
function conversationEventKey(event: ApiRunEvent) { return eventMessageId(event) || event.id; }
function activitySummary(event: ApiRunEvent) { const payload = eventPayload(event); if (typeof payload.text === "string") return payload.text; if (typeof payload.status === "string") return statusMeta[payload.status]?.label ?? payload.status; if (typeof payload.message === "string") return payload.message; return ""; }
function titleFromPrompt(prompt: string) { const line = prompt.split(/\r?\n/)[0].trim(); return line.length > 52 ? `${line.slice(0, 49)}…` : line; }
function humanEvent(type: string) { return ({ "task.created": "对话已创建", "run.created": "运行已创建", "run.started": "运行已开始", "run.completed": "运行已完成", "run.failed": "运行失败", "run.status_changed": "运行状态更新", "runtime.started": "运行时已启动", "runtime.unconfigured": "模型未配置", "model.started": "模型开始生成", "model.failed": "模型请求失败", "agent.started": "智能体已启动", "agent.completed": "智能体已完成", "artifact.created": "已生成产物", "approval.requested": "已请求确认", "capability/started": "能力开始执行", "capability/completed": "能力执行完成", "capability/denied": "能力被拒绝", "cli.started": "命令开始执行", "cli.completed": "命令执行完成", "mcp.tool_call.completed": "工具调用完成" } as Record<string, string>)[type] ?? type.replace(/[._/]/g, " "); }
function shortTime(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
