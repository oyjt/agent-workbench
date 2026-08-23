import {
  AppstoreOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Input,
  Layout,
  Menu,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  appendRunEvent,
  checkApiConnector,
  createApiAgent,
  createApiAgentTeam,
  createApiArtifact,
  createApiArtifactVersion,
  createApiConnector,
  createApiKnowledgeItem,
  createApiSecret,
  createApiTask,
  createApiWorkflow,
  exportApiWorkflowYaml,
  getApiArtifactContent,
  importApiWorkflowYaml,
  invokeApiConnector,
  invokeApiMcpTool,
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
  runApiWorkflow,
  scanApiPlugins,
  scanApiSkills,
  startApiTask,
  updateApiTaskStatus,
} from "./api";
import type { ApiRunEvent, ApiSkill, ApiWorkflowPlugin } from "./api";
import type { AgentFormValues, AgentRecord, AgentTeamFormValues, AgentTeamRecord, ApprovalRecord, ArtifactPreviewState, ArtifactRecord, ArtifactVersionRecord, ConnectorFormValues, ConnectorKind, ConnectorRecord, KnowledgeFormValues, KnowledgeItem, PageKey, SecretFormValues, SecretRecord, Task, TaskFormValues, TaskStatus, WorkbenchSnapshot, WorkflowPlan, WorkflowStepRecord, WorkspaceMode } from "./domain/workbench";
import { agentFromApi, approvalFromApi, artifactFromApi, artifactVersionFromApi, connectorFromApi, knowledgeFromApi, normalizeConnectorStatus, normalizeTaskStatus, secretFromApi, taskFromApi, teamFromApi, workflowFromApi } from "./infrastructure/api-mappers";
import { createArtifactRecord, createBrowserEvent, createBrowserId, createStaticRunEvents, loadStaticSnapshot, nowLabel, saveStaticSnapshot } from "./infrastructure/static-workspace";
import { affectedWorkflowSteps, parseWorkflowYaml, serializeWorkflowYaml } from "./features/workflows/model";
import { AgentDrawer, AgentTeamDrawer, ApprovalDrawer, ConnectorDrawer, KnowledgeDrawer, PluginModal, TaskModal } from "./features/shell/overlays";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const AgentsPage = lazy(() => import("./features/agents/page").then((module) => ({ default: module.AgentsPage })));
const ConnectorsPage = lazy(() => import("./features/connectors/page").then((module) => ({ default: module.ConnectorsPage })));
const CreativePage = lazy(() => import("./features/artifacts/creative-page").then((module) => ({ default: module.CreativePage })));
const SkillsPage = lazy(() => import("./features/catalog/pages").then((module) => ({ default: module.SkillsPage })));
const PluginsPage = lazy(() => import("./features/catalog/pages").then((module) => ({ default: module.PluginsPage })));
const KnowledgePage = lazy(() => import("./features/catalog/pages").then((module) => ({ default: module.KnowledgePage })));
const AssetsPage = lazy(() => import("./features/artifacts/assets-page").then((module) => ({ default: module.AssetsPage })));
const SettingsPage = lazy(() => import("./features/settings/page").then((module) => ({ default: module.SettingsPage })));
const WorkflowsPage = lazy(() => import("./features/workflows/page").then((module) => ({ default: module.WorkflowsPage })));
const OverviewPage = lazy(() => import("./features/tasks/overview-page").then((module) => ({ default: module.OverviewPage })));

const pageMeta: Record<PageKey, { title: string; subtitle: string }> = {
  overview: { title: "工作台", subtitle: "任务、审批、产物和运行状态集中管理" },
  agents: { title: "Agents", subtitle: "管理 Agent、Team、Runtime 与能力范围" },
  skills: { title: "Skills", subtitle: "扫描本地 skill 元数据、权限声明和风险等级" },
  plugins: { title: "插件", subtitle: "Workflow Plugin、输入 Schema、Pipeline 与授权" },
  knowledge: { title: "知识库", subtitle: "团队知识、品牌契约、内容契约和引用治理" },
  connectors: { title: "连接器", subtitle: "MCP servers 与受控 CLI commands" },
  creative: { title: "Creative Studio", subtitle: "产物预览、来源、引用、版本和导出" },
  workflows: { title: "工作流", subtitle: "从模板升级为可复用 plugin pipeline" },
  assets: { title: "资产", subtitle: "按项目、平台、版本和来源归档产物" },
  settings: { title: "设置", subtitle: "Runtime、Provider、Secret 和安全策略" },
};

const taskStatusMeta: Record<TaskStatus, { label: string; color: string; progress: number }> = {
  queued: { label: "排队中", color: "default", progress: 12 },
  approval: { label: "待审批", color: "warning", progress: 62 },
  running: { label: "运行中", color: "processing", progress: 48 },
  paused: { label: "已暂停", color: "default", progress: 42 },
  done: { label: "已完成", color: "success", progress: 100 },
  failed: { label: "需处理", color: "error", progress: 34 },
  cancelled: { label: "已取消", color: "default", progress: 0 },
};


const initialTasks: Task[] = [
  {
    key: "media",
    title: "公众号周更：AI Agent 工作流",
    description: "选题、正文、封面、发布包",
    owner: "内容团队",
    runtime: "BrowserOps",
    status: "approval",
    target: "自媒体周更插件",
    updatedAt: "刚刚",
  },
  {
    key: "coding",
    title: "实现 Plugin Capability Gate",
    description: "权限弹窗与审计记录",
    owner: "开发工程师",
    runtime: "Codex",
    status: "running",
    target: "代码需求实现插件",
    updatedAt: "8 分钟前",
  },
  {
    key: "creative",
    title: "产品上线宣传包",
    description: "Landing page、PPT、海报",
    owner: "Creative Studio",
    runtime: "OpenCode",
    status: "done",
    target: "产品上线宣传包",
    updatedAt: "24 分钟前",
  },
  {
    key: "ops",
    title: "竞品账号内容趋势复盘",
    description: "热榜、评论、互动指标",
    owner: "运营 Agent",
    runtime: "BrowserOps",
    status: "failed",
    target: "运营日报流程",
    updatedAt: "1 小时前",
  },
];

const initialAgents: AgentRecord[] = [
  {
    key: "agent_topic",
    name: "内容选题 Agent",
    description: "负责热榜、竞品、资料收集和选题评分",
    runtime: "BrowserOps",
    model: "gpt-5.5",
    capability: "4 Skills · 2 MCP",
    knowledgeScope: "内容 SOP / 平台规则 / 竞品资料",
    permissionProfile: "collaborative",
    status: "启用",
  },
  {
    key: "agent_coder",
    name: "开发工程师",
    description: "负责需求实现、测试、diff 汇总和变更说明",
    runtime: "Codex",
    model: "gpt-5.4",
    capability: "3 Skills · 3 CLI",
    knowledgeScope: "代码文档 / 架构决策",
    permissionProfile: "collaborative",
    status: "运行中",
  },
  {
    key: "agent_creative",
    name: "设计素材 Agent",
    description: "生成封面 brief、素材清单和品牌一致性检查",
    runtime: "OpenCode",
    model: "gpt-5.4",
    capability: "2 Plugins",
    knowledgeScope: "BRAND.md / CONTENT.md",
    permissionProfile: "strict",
    status: "启用",
  },
];

const initialAgentTeams: AgentTeamRecord[] = [
  {
    key: "team_content_ops",
    name: "自媒体内容团队",
    workflow: "lead_sequential",
    description: "选题、写作、设计审核、发布运营串行协作。",
    status: "启用",
    members: [
      { agentId: "agent_topic", role: "planner", order: 0 },
      { agentId: "agent_creative", role: "designer", order: 1 },
    ],
  },
];

const initialKnowledgeItems: KnowledgeItem[] = [
  {
    key: "kb_sop",
    title: "公众号发布前审核 SOP",
    type: "SOP",
    meta: "今天 09:42 · 引用 12 次",
    status: "已审核",
    tags: ["公众号", "审核", "发布"],
    visibility: "team",
  },
  {
    key: "kb_brand",
    title: "BRAND.md：品牌语气与视觉规范",
    type: "品牌",
    meta: "全团队 · 当前版本",
    status: "契约",
    tags: ["品牌", "语气", "视觉"],
    visibility: "team",
  },
  {
    key: "kb_xhs",
    title: "小红书标签与标题规则",
    type: "平台规则",
    meta: "下周复核 · 引用 6 次",
    status: "将过期",
    tags: ["小红书", "标题", "标签"],
    visibility: "project",
  },
];

const initialConnectors: ConnectorRecord[] = [
  {
    key: "mcp_github",
    kind: "MCP",
    name: "GitHub MCP",
    description: "stdio · 12 tools · 绑定开发工程师",
    status: "在线",
    risk: "medium",
    binding: "开发工程师",
  },
  {
    key: "mcp_filesystem",
    kind: "MCP",
    name: "Filesystem MCP",
    description: "工作区只读默认 · 写入需审批",
    status: "在线",
    risk: "medium",
    binding: "内容团队",
  },
  {
    key: "cli_build",
    kind: "CLI",
    name: "pnpm build",
    description: "command template · timeout 120s",
    status: "CLI",
    risk: "low",
    binding: "开发工程师",
  },
  {
    key: "cli_ffmpeg",
    kind: "CLI",
    name: "ffmpeg render",
    description: "视频 worker 渲染和转码",
    status: "待检查",
    risk: "high",
    binding: "Creative Studio",
  },
];

const initialApprovals: ApprovalRecord[] = [
  {
    key: "approval_browser_input",
    taskKey: "media",
    title: "发布 Agent 请求浏览器输入",
    source: "发布 Agent / 自媒体周更",
    risk: "medium",
    capabilities: ["browser:input", "files:read"],
    status: "pending",
    reason: "目标：微信公众平台草稿箱。动作：填入标题、正文和封面，不提交发布。",
  },
];

const initialArtifacts: ArtifactRecord[] = [
  { key: "asset_md", file: "AI Agent 工作流正文.md", type: "MD", source: "文案 Agent", summary: "正文草稿", path: "artifact://demo/article.md", updatedAt: "2 分钟前" },
  { key: "asset_cover", file: "公众号封面 16-9.png", type: "PNG", source: "设计 Agent", summary: "封面 brief", path: "artifact://demo/cover.png", updatedAt: "8 分钟前" },
  { key: "asset_zip", file: "发布包.zip", type: "ZIP", source: "发布 Agent", summary: "发布包", path: "artifact://demo/publish.zip", updatedAt: "23 分钟前" },
  { key: "asset_diff", file: "capability-gate.diff", type: "DIFF", source: "Codex", summary: "能力闸口变更摘要", path: "artifact://demo/capability-gate.diff", updatedAt: "1 小时前" },
];

const initialSecrets: SecretRecord[] = [
  {
    key: "secret_openai",
    name: "OpenAI API Key",
    scope: "runtime",
    envVar: "OPENAI_API_KEY",
    status: "missing",
    valuePreview: "OPENAI_API_KEY=<missing>",
  },
];

const staticSkills: ApiSkill[] = [
  {
    id: "content-planner",
    name: "content-planner",
    description: "Plan self-media topics, outlines, references, and publishing packages.",
    path: "skills/content-planner/SKILL.md",
    permissions: ["network:read", "knowledge:read", "files:write"],
    risk: "medium",
  },
  {
    id: "code-implementer",
    name: "code-implementer",
    description: "Implement scoped code changes, run checks, and summarize diffs.",
    path: "skills/code-implementer/SKILL.md",
    permissions: ["files:write", "cli:run"],
    risk: "high",
  },
];

const staticWorkflowPlugins: ApiWorkflowPlugin[] = [
  {
    id: "weekly-media-post",
    name: "自媒体周更",
    description: "热榜采集、正文生成、封面 brief、审核和发布包。",
    version: "static",
    path: "plugins/weekly-media-post",
    skills: ["content-planner", "web-access"],
    mcpTools: ["browser.search", "filesystem.read"],
    cliCommands: [],
    knowledgeScopes: ["BRAND.md", "CONTENT.md", "发布 SOP"],
    capabilities: ["network:read", "knowledge:read", "files:write", "browser:input"],
    pipeline: ["discovery", "plan", "generate", "critique", "handoff"],
  },
  {
    id: "coding-task",
    name: "代码需求实现",
    description: "需求澄清、代码修改、测试、diff 审批和变更摘要。",
    version: "static",
    path: "plugins/coding-task",
    skills: ["code-implementer"],
    mcpTools: ["filesystem.read", "github.pull_request"],
    cliCommands: ["pnpm build"],
    knowledgeScopes: ["架构决策", "代码文档"],
    capabilities: ["files:write", "cli:run", "mcp:read"],
    pipeline: ["plan", "patch", "test", "review", "handoff"],
  },
];

function downloadTextFile(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("api");
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [page, setPage] = useState<PageKey>("overview");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task>(initialTasks[0]);
  const [agents, setAgents] = useState<AgentRecord[]>(initialAgents);
  const [agentTeams, setAgentTeams] = useState<AgentTeamRecord[]>(initialAgentTeams);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(initialKnowledgeItems);
  const [connectors, setConnectors] = useState<ConnectorRecord[]>(initialConnectors);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(initialApprovals);
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>(initialArtifacts);
  const [savedWorkflows, setSavedWorkflows] = useState<WorkflowPlan[]>([]);
  const [secrets, setSecrets] = useState<SecretRecord[]>(initialSecrets);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [workflowPlugins, setWorkflowPlugins] = useState<ApiWorkflowPlugin[]>([]);
  const [runEvents, setRunEvents] = useState<Record<string, ApiRunEvent[]>>({});
  const [artifactPreview, setArtifactPreview] = useState<ArtifactPreviewState>({ open: false, content: "" });
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [knowledgeDrawerOpen, setKnowledgeDrawerOpen] = useState(false);
  const [connectorDrawer, setConnectorDrawer] = useState<{ open: boolean; kind: ConnectorKind }>({
    open: false,
    kind: "MCP",
  });

  function currentSnapshot(): WorkbenchSnapshot {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks,
      selectedTaskKey: selectedTask.key,
      agents,
      agentTeams,
      knowledgeItems,
      connectors,
      approvals,
      artifacts,
      savedWorkflows,
      runEvents,
      secrets,
    };
  }

  function applySnapshot(snapshot: WorkbenchSnapshot) {
    setTasks(snapshot.tasks.length > 0 ? snapshot.tasks : initialTasks);
    setSelectedTask(snapshot.tasks.find((task) => task.key === snapshot.selectedTaskKey) ?? snapshot.tasks[0] ?? initialTasks[0]);
    setAgents(snapshot.agents.length > 0 ? snapshot.agents : initialAgents);
    setAgentTeams(snapshot.agentTeams.length > 0 ? snapshot.agentTeams : initialAgentTeams);
    setKnowledgeItems(snapshot.knowledgeItems.length > 0 ? snapshot.knowledgeItems : initialKnowledgeItems);
    setConnectors(snapshot.connectors.length > 0 ? snapshot.connectors : initialConnectors);
    setApprovals(snapshot.approvals);
    setArtifacts(snapshot.artifacts.length > 0 ? snapshot.artifacts : initialArtifacts);
    setSavedWorkflows(snapshot.savedWorkflows);
    setRunEvents(snapshot.runEvents);
    setSecrets(snapshot.secrets && snapshot.secrets.length > 0 ? snapshot.secrets : initialSecrets);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceData() {
      try {
        const [taskResult, agentResult, teamResult, knowledgeResult, connectorResult, approvalResult, artifactResult, workflowResult, secretResult] = await Promise.all([
          listApiTasks(),
          listApiAgents(),
          listApiAgentTeams(),
          listApiKnowledgeItems(),
          listApiConnectors(),
          listApiApprovals(),
          listApiArtifacts(),
          listApiWorkflows(),
          listApiSecrets(),
        ]);
        const [skillResult, pluginResult] = await Promise.all([scanApiSkills(), scanApiPlugins()]);

        if (cancelled) return;

        const apiTasks = taskResult.tasks.map(taskFromApi);
        const apiAgents = agentResult.agents.map(agentFromApi);
        const apiTeams = teamResult.teams.map(teamFromApi);
        const apiKnowledgeItems = knowledgeResult.knowledgeItems.map(knowledgeFromApi);
        const apiConnectors = connectorResult.connectors.map(connectorFromApi);
        const apiApprovals = approvalResult.approvals.map(approvalFromApi);
        const apiArtifacts = artifactResult.artifacts.map(artifactFromApi);
        const apiWorkflows = workflowResult.workflows.map(workflowFromApi);
        const apiSecrets = secretResult.secrets.map(secretFromApi);

        if (apiTasks.length > 0) {
          setTasks(apiTasks);
          setSelectedTask(apiTasks[0]);
        }
        if (apiAgents.length > 0) setAgents(apiAgents);
        if (apiTeams.length > 0) setAgentTeams(apiTeams);
        if (apiKnowledgeItems.length > 0) setKnowledgeItems(apiKnowledgeItems);
        if (apiConnectors.length > 0) setConnectors(apiConnectors);
        if (apiArtifacts.length > 0) setArtifacts(apiArtifacts);
        setSavedWorkflows(apiWorkflows);
        setSecrets(apiSecrets.length > 0 ? apiSecrets : initialSecrets);
        setApprovals(apiApprovals);
        setSkills(skillResult.skills);
        setWorkflowPlugins(pluginResult.plugins);
        setWorkspaceMode("api");
        setWorkspaceLoaded(true);
      } catch {
        if (!cancelled) {
          const snapshot = await loadStaticSnapshot();
          if (snapshot) applySnapshot(snapshot);
          setSkills(staticSkills);
          setWorkflowPlugins(staticWorkflowPlugins);
          setWorkspaceMode("static");
          setWorkspaceLoaded(true);
          messageApi.warning(snapshot ? "API 未启动，已恢复浏览器本地工作区" : "API 未启动，当前使用浏览器本地模式");
        }
      }
    }

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  useEffect(() => {
    if (!workspaceLoaded || workspaceMode !== "static") return;
    void saveStaticSnapshot(currentSnapshot());
  }, [workspaceLoaded, workspaceMode, tasks, selectedTask, agents, agentTeams, knowledgeItems, connectors, approvals, artifacts, savedWorkflows, runEvents, secrets]);

  useEffect(() => {
    if (!selectedTask.runId || workspaceMode === "static") return;

    const eventSource = new EventSource(`/api/runs/${selectedTask.runId}/events`);

    eventSource.addEventListener("runtime", (event) => {
      const parsed = JSON.parse(event.data) as ApiRunEvent;
      setRunEvents((current) => {
        const existing = current[parsed.runId] ?? [];
        if (existing.some((item) => item.id === parsed.id)) return current;
        return { ...current, [parsed.runId]: [...existing, parsed] };
      });
    });

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [selectedTask.runId, workspaceMode]);

  const runtimePool = useMemo(
    () =>
      ["Codex", "OpenCode", "BrowserOps", "Creative"].map((runtime) => ({
        runtime,
        count: tasks.filter((task) => task.runtime === runtime && ["queued", "approval", "running"].includes(task.status)).length,
      })),
    [tasks],
  );

  const menuItems = [
    { key: "overview", icon: <AppstoreOutlined />, label: "工作台" },
    { key: "agents", icon: <TeamOutlined />, label: "Agents" },
    { key: "skills", icon: <CodeOutlined />, label: "Skills" },
    { key: "plugins", icon: <BranchesOutlined />, label: "插件" },
    { key: "knowledge", icon: <DatabaseOutlined />, label: "知识库" },
    { key: "connectors", icon: <CloudServerOutlined />, label: "连接器" },
    { key: "creative", icon: <BgColorsOutlined />, label: "Creative Studio" },
    { key: "workflows", icon: <PlayCircleOutlined />, label: "工作流" },
    { key: "assets", icon: <FileTextOutlined />, label: "资产" },
    { key: "settings", icon: <SettingOutlined />, label: "设置" },
  ];

  async function createTask(values: TaskFormValues) {
    const agent = agents.find((item) => item.key === values.targetId);
    const team = agentTeams.find((item) => item.key === values.targetId);
    const target = values.targetType === "plugin" ? values.targetId : agent?.name ?? team?.name ?? "自媒体内容团队";
    const runtime = values.targetType === "plugin" ? "BrowserOps" : agent?.runtime ?? "BrowserOps";
    const owner = values.targetType === "agent" ? target : "内容团队";
    let taskKey = `task_${Date.now()}`;
    let runId: string | undefined;
    let status: TaskStatus = values.requiresApproval ? "approval" : "queued";
    let persisted = false;

    try {
      const result = await createApiTask({
        title: values.title,
        prompt: values.prompt,
        targetType: values.targetType,
        targetId: values.targetId,
        owner,
        runtime,
        priority: values.priority,
        requiresApproval: values.requiresApproval,
      });
      taskKey = result.task.id;
      runId = result.runId;
      status = normalizeTaskStatus(result.task.status);
      setRunEvents((current) => ({ ...current, [result.runId]: result.events }));
      persisted = true;
    } catch {
      setWorkspaceMode("static");
      runId = createBrowserId("run");
      setRunEvents((current) => ({
        ...current,
        [runId!]: [
          createBrowserEvent(runId!, "task.created", { taskId: taskKey, title: values.title, targetType: values.targetType, targetId: values.targetId }),
          createBrowserEvent(runId!, "run.created", { runId, status }),
        ],
      }));
      persisted = false;
    }

    const newTask: Task = {
      key: taskKey,
      runId,
      title: values.title,
      description: values.prompt,
      owner,
      runtime,
      status,
      target,
      updatedAt: nowLabel(),
    };

    setTasks((current) => [newTask, ...current]);
    setSelectedTask(newTask);
    setTaskModalOpen(false);
    setPage("overview");

    if (values.requiresApproval) {
      setApprovals((current) => [
        {
          key: `approval_${Date.now()}`,
          taskKey: newTask.key,
          title: "新任务请求高风险能力确认",
          source: `${target} / ${values.targetType}`,
          risk: values.priority === "high" ? "high" : "medium",
          capabilities: ["network:read", "files:write"],
          status: "pending",
          reason: "任务创建时选择了审批模式，启动前需要确认能力授权。",
        },
        ...current,
      ]);
    }

    if (persisted) {
      messageApi.success("任务已写入 SQLite，并创建 task / run / event");
    } else {
      messageApi.warning("API 未启动，任务已保存到浏览器本地");
    }
  }

  async function createAgent(values: AgentFormValues) {
    let agent: AgentRecord;

    try {
      const result = await createApiAgent(values);
      agent = agentFromApi(result.agent);
      messageApi.success("Agent 已写入 SQLite");
    } catch {
      setWorkspaceMode("static");
      agent = {
        key: `agent_${Date.now()}`,
        name: values.name,
        description: values.description,
        runtime: values.runtime,
        model: values.model,
        capability: `${values.skillIds.length} Skills · 0 MCP`,
        knowledgeScope: values.knowledgeScope,
        permissionProfile: values.permissionProfile,
        status: "启用",
      };
      messageApi.warning("API 未启动，Agent 已保存到浏览器本地");
    }

    setAgents((current) => [agent, ...current]);
    setAgentDrawerOpen(false);
    setPage("agents");
  }

  async function createAgentTeam(values: AgentTeamFormValues) {
    let team: AgentTeamRecord;
    const members = values.agentIds.map((agentId, index) => ({
      agentId,
      role: `step_${index + 1}`,
      order: index,
    }));

    try {
      const result = await createApiAgentTeam({
        name: values.name,
        workflow: values.workflow,
        description: values.description,
        members,
      });
      team = teamFromApi(result.team);
      messageApi.success("Agent Team 已写入 SQLite");
    } catch {
      setWorkspaceMode("static");
      team = {
        key: `team_${Date.now()}`,
        name: values.name,
        workflow: values.workflow,
        description: values.description,
        status: "启用",
        members,
      };
      messageApi.warning("API 未启动，Agent Team 已保存到浏览器本地");
    }

    setAgentTeams((current) => [team, ...current]);
    setTeamDrawerOpen(false);
    setPage("agents");
  }

  async function createKnowledgeItem(values: KnowledgeFormValues) {
    let item: KnowledgeItem;

    try {
      const result = await createApiKnowledgeItem(values);
      item = knowledgeFromApi(result.knowledgeItem);
      messageApi.success("知识条目已写入 SQLite");
    } catch {
      setWorkspaceMode("static");
      item = {
        key: `knowledge_${Date.now()}`,
        title: values.title,
        type: values.type,
        meta: `${values.visibility === "team" ? "团队" : "项目"} · 草稿 · 引用 0 次`,
        status: "草稿",
        tags: values.tags,
        visibility: values.visibility,
      };
      messageApi.warning("API 未启动，知识条目已保存到浏览器本地");
    }

    setKnowledgeItems((current) => [item, ...current]);
    setKnowledgeDrawerOpen(false);
    setPage("knowledge");
  }

  async function createConnector(kind: ConnectorKind, values: ConnectorFormValues) {
    let connector: ConnectorRecord;

    try {
      const result = await createApiConnector({ ...values, kind });
      connector = connectorFromApi(result.connector);
      messageApi.success(`${kind} 连接器已写入 SQLite`);
    } catch {
      setWorkspaceMode("static");
      connector = {
        key: `${kind.toLowerCase()}_${Date.now()}`,
        kind,
        name: values.name,
        description: kind === "MCP" ? `${values.command} · 待自检` : `${values.command} · command template`,
        status: "待检查",
        risk: values.risk,
        binding: values.binding,
      };
      messageApi.warning("API 未启动，连接器已保存到浏览器本地");
    }

    setConnectors((current) => [connector, ...current]);
    setConnectorDrawer({ open: false, kind });
    setPage("connectors");
  }

  async function checkConnector(connectorKey: string) {
    if (workspaceMode === "static") {
      setConnectors((current) =>
        current.map((connector) =>
          connector.key === connectorKey
            ? { ...connector, status: connector.kind === "CLI" ? "CLI" : "在线" }
            : connector,
        ),
      );
      messageApi.success("静态模式已模拟连接器自检");
      return;
    }

    try {
      const result = await checkApiConnector(connectorKey);
      setConnectors((current) =>
        current.map((connector) =>
          connector.key === connectorKey
            ? { ...connector, status: normalizeConnectorStatus(result.status) }
            : connector,
        ),
      );
      messageApi.success(`连接器状态：${result.status}`);
    } catch {
      messageApi.error("连接器自检失败，请确认 API server 正在运行");
    }
  }

  async function invokeConnector(connectorKey: string) {
    if (workspaceMode === "static") {
      const connector = connectors.find((item) => item.key === connectorKey);
      if (!connector) return;
      if (connector.risk !== "low") {
        setApprovals((current) => [
          {
            key: createBrowserId("approval"),
            taskKey: selectedTask.key,
            title: `${connector.kind} 调用审批：${connector.name}`,
            source: `${connector.kind} Connector`,
            risk: connector.risk,
            capabilities: connector.kind === "CLI" ? ["cli:run"] : ["mcp:call"],
            status: "pending",
            reason: `${connector.name} 风险等级为 ${connector.risk}，静态模式下仍要求人工确认。`,
          },
          ...current,
        ]);
        setApprovalOpen(true);
        messageApi.warning("连接器调用需要审批，已加入浏览器本地队列");
        return;
      }
      if (selectedTask.runId) {
        setRunEvents((current) => ({
          ...current,
          [selectedTask.runId!]: [
            ...(current[selectedTask.runId!] ?? []),
            createBrowserEvent(selectedTask.runId!, connector.kind === "CLI" ? "cli.completed" : "mcp.tool_call.completed", {
              connectorId: connector.key,
              name: connector.name,
              mode: "static",
            }),
          ],
        }));
      }
      messageApi.success("静态模式已模拟连接器调用");
      return;
    }

    try {
      const result = await invokeApiConnector(connectorKey, selectedTask.key);
      if (result.approval) {
        setApprovals((current) => [approvalFromApi(result.approval!), ...current]);
        setApprovalOpen(true);
        messageApi.warning("连接器调用需要审批，已加入队列");
        return;
      }
      messageApi.success(result.ok ? "连接器调用完成" : "连接器调用结束，请查看运行事件");
    } catch {
      messageApi.error("连接器调用失败，请确认 API server 正在运行");
    }
  }

  async function refreshArtifacts() {
    if (workspaceMode === "static") return;

    try {
      const result = await listApiArtifacts();
      const apiArtifacts = result.artifacts.map(artifactFromApi);
      if (apiArtifacts.length > 0) setArtifacts(apiArtifacts);
    } catch {
      messageApi.warning("API 未启动，无法刷新 Artifact 列表");
    }
  }

  async function createManualArtifact() {
    if (workspaceMode === "static") {
      const content = [`# ${selectedTask.title} · Handoff`, "", "浏览器本地登记的交付摘要。", ""].join("\n");
      setArtifacts((current) => [
        {
          key: createBrowserId("artifact"),
          file: `${selectedTask.title} · handoff.md`,
          type: "MARKDOWN",
          source: selectedTask.runtime,
          summary: "浏览器本地登记的交付摘要。",
          path: `browser://artifacts/${selectedTask.key}/handoff.md`,
          updatedAt: nowLabel(),
          content,
          versions: [
            {
              key: createBrowserId("artifact_version"),
              version: 1,
              path: `browser://artifacts/${selectedTask.key}/handoff.md`,
              summary: "手动登记首版。",
              bytes: new Blob([content]).size,
              createdAt: nowLabel(),
            },
          ],
          manifest: { taskKey: selectedTask.key, mode: "static" },
        },
        ...current,
      ]);
      messageApi.success("Artifact 已保存到浏览器本地");
      return;
    }

    try {
      const result = await createApiArtifact({
        taskId: selectedTask.key,
        runId: selectedTask.runId,
        name: `${selectedTask.title} · handoff.md`,
        kind: "markdown",
        summary: "人工登记的交付摘要，用于验证 Artifact 持久化。",
        source: selectedTask.runtime,
        path: `.agent-workbench/artifacts/${selectedTask.key}/handoff.md`,
        manifest: { sourceTaskId: selectedTask.key, runtime: selectedTask.runtime },
        content: [`# ${selectedTask.title} · Handoff`, "", "人工登记的交付摘要，用于验证 Artifact 文件写入和版本持久化。", ""].join("\n"),
      });
      setArtifacts((current) => [artifactFromApi(result.artifact), ...current]);
      messageApi.success("Artifact 已写入 SQLite");
    } catch {
      messageApi.error("Artifact 登记失败，请确认 API server 正在运行");
    }
  }

  async function openArtifact(artifact: ArtifactRecord) {
    if (workspaceMode === "static" || artifact.path.startsWith("browser://") || artifact.path.startsWith("artifact://")) {
      setArtifactPreview({
        open: true,
        artifact,
        content: artifact.content ?? `# ${artifact.file}\n\n${artifact.summary}\n\n路径：${artifact.path}\n`,
      });
      return;
    }

    try {
      const result = await getApiArtifactContent(artifact.key);
      const nextArtifact = {
        ...artifactFromApi(result.artifact),
        content: result.content,
        versions: result.versions.map(artifactVersionFromApi),
      };
      setArtifacts((current) => current.map((item) => (item.key === artifact.key ? nextArtifact : item)));
      setArtifactPreview({ open: true, artifact: nextArtifact, content: result.content });
    } catch {
      messageApi.error("读取 Artifact 内容失败");
    }
  }

  async function createArtifactVersion(artifact: ArtifactRecord) {
    const baseContent = artifact.content ?? `# ${artifact.file}\n\n${artifact.summary}\n`;
    const nextContent = `${baseContent.trim()}\n\n## Revision ${new Date().toLocaleString()}\n\n记录一次人工返工或版本确认。\n`;

    if (workspaceMode === "static" || artifact.path.startsWith("browser://") || artifact.path.startsWith("artifact://")) {
      const version: ArtifactVersionRecord = {
        key: createBrowserId("artifact_version"),
        version: (artifact.versions?.length ?? 0) + 1,
        path: artifact.path,
        summary: "浏览器本地新增版本。",
        bytes: new Blob([nextContent]).size,
        createdAt: nowLabel(),
      };
      const nextArtifact = {
        ...artifact,
        content: nextContent,
        versions: [version, ...(artifact.versions ?? [])],
        updatedAt: nowLabel(),
      };
      setArtifacts((current) => current.map((item) => (item.key === artifact.key ? nextArtifact : item)));
      setArtifactPreview({ open: true, artifact: nextArtifact, content: nextContent });
      messageApi.success("Artifact 新版本已保存到浏览器本地");
      return;
    }

    try {
      const result = await createApiArtifactVersion(artifact.key, {
        content: nextContent,
        summary: "人工返工版本。",
        contentType: "text/markdown",
      });
      const version = artifactVersionFromApi(result.version);
      const nextArtifact = {
        ...artifact,
        content: nextContent,
        versions: [version, ...(artifact.versions ?? [])],
        path: version.path,
        updatedAt: nowLabel(),
      };
      setArtifacts((current) => current.map((item) => (item.key === artifact.key ? nextArtifact : item)));
      setArtifactPreview({ open: true, artifact: nextArtifact, content: nextContent });
      messageApi.success("Artifact 新版本已写入本地文件");
    } catch {
      messageApi.error("新增 Artifact 版本失败，请确认 API server 正在运行");
    }
  }

  function exportArtifacts() {
    const payload = {
      exportedAt: new Date().toISOString(),
      artifacts,
    };
    downloadTextFile(`agent-workbench-artifacts-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  async function createSecret(values: SecretFormValues) {
    if (workspaceMode === "static") {
      setSecrets((current) => [
        {
          key: createBrowserId("secret"),
          name: values.name,
          scope: values.scope,
          envVar: values.envVar,
          status: "missing",
          valuePreview: `${values.envVar}=<browser-local>`,
        },
        ...current,
      ]);
      messageApi.success("Secret 引用已保存到浏览器本地");
      return;
    }

    try {
      const result = await createApiSecret(values);
      setSecrets((current) => [secretFromApi(result.secret), ...current]);
      messageApi.success("Secret 引用已写入 SQLite");
    } catch {
      messageApi.error("Secret 注册失败，请确认 API server 正在运行");
    }
  }

  async function saveWorkflow(plan: WorkflowPlan) {
    if (workspaceMode === "static") {
      setSavedWorkflows((current) => [{ ...plan, key: createBrowserId("workflow") }, ...current]);
      messageApi.success("工作流已保存到浏览器本地");
      return;
    }

    try {
      const result = await createApiWorkflow({
        name: plan.name,
        description: plan.description,
        provider: plan.provider,
        concurrency: plan.concurrency,
        tags: plan.tags,
        steps: plan.steps,
      });
      setSavedWorkflows((current) => [workflowFromApi(result.workflow), ...current]);
      messageApi.success("工作流已写入 SQLite");
    } catch {
      messageApi.error("工作流保存失败，请确认 API server 正在运行");
    }
  }

  async function exportWorkflowYaml(plan: WorkflowPlan) {
    try {
      const yaml = workspaceMode === "api" && plan.key.startsWith("workflow_")
        ? await exportApiWorkflowYaml(plan.key)
        : serializeWorkflowYaml(plan);
      downloadTextFile(`${plan.name}.workflow.yml`, yaml, "text/yaml");
      messageApi.success("工作流 YAML 已导出");
    } catch {
      downloadTextFile(`${plan.name}.workflow.yml`, serializeWorkflowYaml(plan), "text/yaml");
      messageApi.warning("API 未返回 YAML，已导出前端版本");
    }
  }

  async function importWorkflowYaml(file?: File) {
    if (!file) return;
    try {
      const yaml = await file.text();
      if (workspaceMode === "static") {
        const plan = parseWorkflowYaml(yaml);
        setSavedWorkflows((current) => [plan, ...current]);
        messageApi.success("工作流 YAML 已导入浏览器本地");
        return;
      }

      const result = await importApiWorkflowYaml(yaml);
      setSavedWorkflows((current) => [workflowFromApi(result.workflow), ...current]);
      messageApi.success("工作流 YAML 已写入 SQLite");
    } catch {
      messageApi.error("导入失败，请确认 YAML 是 Agent Workbench 工作流格式");
    }
  }

  async function runWorkflowPlan(plan: WorkflowPlan, options?: { fromStepId?: string; feedback?: string }) {
    if (workspaceMode === "static") {
      const runId = createBrowserId("run");
      const selectedSteps = options?.fromStepId ? affectedWorkflowSteps(plan.steps, options.fromStepId) : plan.steps;
      const task: Task = {
        key: createBrowserId("task"),
        runId,
        title: options?.fromStepId ? `${plan.name} · 从 ${options.fromStepId} 返工` : `${plan.name} · DAG 执行`,
        description: options?.feedback || plan.description,
        owner: "Workflow Engine",
        runtime: plan.provider,
        status: "done",
        target: plan.name,
        updatedAt: nowLabel(),
      };
      const content = [
        `# ${task.title}`,
        "",
        `- Provider: ${plan.provider}`,
        `- From step: ${options?.fromStepId ?? "full"}`,
        `- Feedback: ${options?.feedback || "none"}`,
        "",
        "## Steps",
        "",
        ...selectedSteps.map((step) => `- ${step.id}: ${step.role} -> ${step.output ?? "step_output"}`),
        "",
      ].join("\n");
      const artifact: ArtifactRecord = {
        key: createBrowserId("artifact"),
        file: `${plan.name} · workflow-run.md`,
        type: "MARKDOWN",
        source: "Workflow Engine",
        summary: options?.fromStepId ? `从 ${options.fromStepId} 开始的返工摘要。` : "DAG 工作流执行摘要。",
        path: `browser://workflows/${plan.key}/${runId}.md`,
        updatedAt: nowLabel(),
        content,
        versions: [
          {
            key: createBrowserId("artifact_version"),
            version: 1,
            path: `browser://workflows/${plan.key}/${runId}.md`,
            summary: "静态工作流执行结果。",
            bytes: new Blob([content]).size,
            createdAt: nowLabel(),
          },
        ],
        manifest: { workflowKey: plan.key, fromStepId: options?.fromStepId, mode: "static" },
      };
      setTasks((current) => [task, ...current]);
      setSelectedTask(task);
      setArtifacts((current) => [artifact, ...current]);
      setRunEvents((current) => ({
        ...current,
        [runId]: [
          createBrowserEvent(runId, "workflow.started", { workflowKey: plan.key, name: plan.name, fromStepId: options?.fromStepId }),
          ...selectedSteps.flatMap((step) => [
            createBrowserEvent(runId, "workflow.step.started", { stepId: step.id, role: step.role }),
            createBrowserEvent(runId, "workflow.step.completed", { stepId: step.id, output: step.output ?? `${step.id}_output` }),
          ]),
          createBrowserEvent(runId, "artifact.created", { artifactId: artifact.key, title: artifact.file }),
          createBrowserEvent(runId, "run.status_changed", { status: "done" }),
        ],
      }));
      setPage("overview");
      messageApi.success("静态工作流已执行并生成 Artifact");
      return;
    }

    try {
      let workflowId = plan.key;
      if (!workflowId.startsWith("workflow_")) {
        const saved = await createApiWorkflow({
          name: plan.name,
          description: plan.description,
          provider: plan.provider,
          concurrency: plan.concurrency,
          tags: plan.tags,
          steps: plan.steps,
        });
        const savedPlan = workflowFromApi(saved.workflow);
        workflowId = savedPlan.key;
        setSavedWorkflows((current) => [savedPlan, ...current]);
      }
      const result = await runApiWorkflow(workflowId, options);
      const task = taskFromApi(result.task);
      setTasks((current) => [task, ...current]);
      setSelectedTask(task);
      if (result.artifact) setArtifacts((current) => [artifactFromApi(result.artifact!), ...current]);
      const events = await listApiRunEvents(result.runId);
      setRunEvents((current) => ({ ...current, [result.runId]: events.events }));
      setPage("overview");
      messageApi.success("工作流已通过本地 API 执行");
    } catch {
      messageApi.error("工作流执行失败，请确认 API server 正在运行");
    }
  }

  async function updateTaskStatus(taskKey: string, status: TaskStatus) {
    let nextStatus = status;
    const task = tasks.find((item) => item.key === taskKey);
    let nextRunId = task?.runId;

    if (workspaceMode === "static" && task) {
      if (status === "running") {
        nextRunId = task.runId ?? createBrowserId("run");
        const runnableTask = { ...task, runId: nextRunId };
        const artifact = createArtifactRecord(runnableTask, nextRunId);
        const events = createStaticRunEvents(runnableTask, nextRunId, artifact);
        setRunEvents((current) => ({ ...current, [nextRunId!]: [...(current[nextRunId!] ?? []), ...events] }));
        setArtifacts((current) => [artifact, ...current]);
        nextStatus = "done";
      }
    } else {
      try {
        if (status === "running") {
          const result = await startApiTask(taskKey);
          nextStatus = normalizeTaskStatus(result.status);
          if (nextStatus === "done") void refreshArtifacts();
          if (result.waitingApprovalId) {
            messageApi.warning("任务仍有待审批动作，已写入 approval.waiting 事件");
          }
        } else if (task?.runId) {
          await updateApiTaskStatus(taskKey, status);
        }
      } catch {
        setWorkspaceMode("static");
        messageApi.warning("API 未启动，任务状态已保存到浏览器本地");
      }
    }

    setTasks((current) =>
      current.map((task) => (task.key === taskKey ? { ...task, runId: nextRunId, status: nextStatus, updatedAt: nowLabel() } : task)),
    );
    setSelectedTask((current) => (current.key === taskKey ? { ...current, runId: nextRunId, status: nextStatus, updatedAt: nowLabel() } : current));
    messageApi.info(`任务状态已更新为：${taskStatusMeta[nextStatus].label}`);
  }

  async function appendDiagnosticEvent(task: Task) {
    if (!task.runId) {
      messageApi.warning("这个任务还没有持久化 run，无法追加真实事件");
      return;
    }

    if (workspaceMode === "static") {
      setRunEvents((current) => ({
        ...current,
        [task.runId!]: [
          ...(current[task.runId!] ?? []),
          createBrowserEvent(task.runId!, "message.delta", {
            role: "assistant",
            text: `静态模式事件验证：${new Date().toLocaleTimeString()}`,
          }),
        ],
      }));
      messageApi.success("事件已保存到浏览器本地");
      return;
    }

    try {
      const result = await appendRunEvent(task.runId, "message.delta", {
        role: "assistant",
        text: `实时事件验证：${new Date().toLocaleTimeString()}`,
      });
      setRunEvents((current) => {
        const existing = current[result.event.runId] ?? [];
        if (existing.some((item) => item.id === result.event.id)) return current;
        return { ...current, [result.event.runId]: [...existing, result.event] };
      });
      messageApi.success("事件已写入 SQLite，SSE 已广播");
    } catch {
      messageApi.error("追加事件失败，请确认 API server 正在运行");
    }
  }

  async function respondApproval(approvalKey: string, decision: ApprovalRecord["status"]) {
    const approval = approvals.find((item) => item.key === approvalKey);
    const apiDecision = decision === "allowed" ? "allow_once" : "deny";

    if (approval?.key && workspaceMode !== "static") {
      try {
        await respondApiApproval(approval.key, apiDecision);
      } catch {
        messageApi.warning("API 未启动，审批仅更新前端状态");
      }
    }

    setApprovals((current) => current.map((item) => (item.key === approvalKey ? { ...item, status: decision } : item)));

    if (approval?.taskKey && decision === "allowed") {
      await updateTaskStatus(approval.taskKey, "running");
    }

    if (decision === "denied" && approval?.taskKey) {
      await updateTaskStatus(approval.taskKey, "paused");
    }

    messageApi.success(decision === "allowed" ? "已允许本次能力调用" : "已拒绝本次能力调用");
  }

  function startPluginRun() {
    const task: Task = {
      key: `plugin_task_${Date.now()}`,
      title: "自媒体周更：AI Agent 工作流",
      description: "由 Workflow Plugin 生成：热榜采集、正文、封面 brief、发布包",
      owner: "内容团队",
      runtime: "BrowserOps",
      status: "approval",
      target: "自媒体周更插件",
      updatedAt: nowLabel(),
    };

    setTasks((current) => [task, ...current]);
    setApprovals((current) => [
      {
        key: `approval_plugin_${Date.now()}`,
        taskKey: task.key,
        title: "Plugin capability gate",
        source: "自媒体周更 / Workflow Plugin",
        risk: "medium",
        capabilities: ["network:read", "knowledge:read", "files:write", "browser:input"],
        status: "pending",
        reason: "插件启动前需要确认网络读取、知识检索、文件写入和浏览器输入权限。",
      },
      ...current,
    ]);
    setSelectedTask(task);
    setPluginOpen(false);
    setPage("overview");
    messageApi.success("插件运行草稿已创建，等待 capability gate 审批");
  }

  function exportWorkspace() {
    const snapshot = currentSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `agent-workbench-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(file?: File) {
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text()) as WorkbenchSnapshot;
      if (snapshot.version !== 1) throw new Error("unsupported_snapshot");
      applySnapshot(snapshot);
      setSkills(staticSkills);
      setWorkflowPlugins(staticWorkflowPlugins);
      setWorkspaceMode("static");
      setWorkspaceLoaded(true);
      messageApi.success("工作区已导入浏览器本地");
    } catch {
      messageApi.error("导入失败，请确认 JSON 来自 Agent Workbench");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  return (
    <>
      {contextHolder}
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => void importWorkspace(event.target.files?.[0])}
      />
      <Layout className="app-shell">
        <Sider width={256} breakpoint="lg" collapsedWidth={0} className="app-sider">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <Text strong className="brand-title">Agent Workbench</Text>
              <Text className="brand-subtitle">Local Agent Console</Text>
            </div>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[page]}
            items={menuItems}
            onClick={({ key }) => setPage(key as PageKey)}
          />
          <Card className="runtime-card" size="small">
            <Text type="secondary">Runtime Pool</Text>
            <Flex vertical gap={8} className="runtime-list">
              {runtimePool.map((runtime) => (
                <Flex justify="space-between" key={runtime.runtime}>
                  <span>{runtime.runtime}</span>
                  <Badge status={runtime.count > 0 ? "success" : "default"} text={runtime.count} />
                </Flex>
              ))}
            </Flex>
          </Card>
        </Sider>

        <Layout>
          <Header className="app-header">
            <div className="header-copy">
              <Title level={3}>{pageMeta[page].title}</Title>
              <Text type="secondary">{pageMeta[page].subtitle}</Text>
            </div>
            <div className="header-controls">
              <Select
                className="mobile-page-select"
                value={page}
                onChange={(value) => setPage(value as PageKey)}
                options={menuItems.map((item) => ({ value: item.key, label: item.label }))}
              />
              <Space wrap className="header-actions">
                <span className="workspace-mode-tag">
                  <Tag color={workspaceMode === "api" ? "success" : "warning"}>{workspaceMode === "api" ? "SQLite API" : "Static Local"}</Tag>
                </span>
                <span className="global-search-wrap">
                  <Input.Search placeholder="搜索任务、Agent、插件、知识…" className="global-search" />
                </span>
                <Button onClick={exportWorkspace}>导出</Button>
                <Button onClick={() => importInputRef.current?.click()}>导入</Button>
                <Button onClick={() => setApprovalOpen(true)}>审批队列</Button>
                <Button type="primary" onClick={() => setTaskModalOpen(true)}>新建任务</Button>
              </Space>
            </div>
          </Header>
          <Content className="app-content"><Suspense fallback={<Card loading />}>{renderPage()}</Suspense></Content>
        </Layout>

        <ApprovalDrawer
          open={approvalOpen}
          approvals={approvals}
          onClose={() => setApprovalOpen(false)}
          onRespond={respondApproval}
        />
        <PluginModal
          open={pluginOpen}
          onCancel={() => setPluginOpen(false)}
          onOk={startPluginRun}
        />
        <TaskModal
          open={taskModalOpen}
          agents={agents}
          teams={agentTeams}
          onCancel={() => setTaskModalOpen(false)}
          onCreate={createTask}
        />
        <AgentDrawer
          open={agentDrawerOpen}
          onClose={() => setAgentDrawerOpen(false)}
          onCreate={createAgent}
        />
        <AgentTeamDrawer
          open={teamDrawerOpen}
          agents={agents}
          onClose={() => setTeamDrawerOpen(false)}
          onCreate={createAgentTeam}
        />
        <KnowledgeDrawer
          open={knowledgeDrawerOpen}
          onClose={() => setKnowledgeDrawerOpen(false)}
          onCreate={createKnowledgeItem}
        />
        <ConnectorDrawer
          open={connectorDrawer.open}
          kind={connectorDrawer.kind}
          agents={agents}
          onClose={() => setConnectorDrawer((current) => ({ ...current, open: false }))}
          onCreate={createConnector}
        />
        <Modal
          title={artifactPreview.artifact?.file ?? "Artifact"}
          open={artifactPreview.open}
          onCancel={() => setArtifactPreview({ open: false, content: "" })}
          footer={artifactPreview.artifact ? [
            <Button key="download" onClick={() => downloadTextFile(artifactPreview.artifact!.file, artifactPreview.content, "text/markdown")}>下载</Button>,
            <Button key="version" type="primary" onClick={() => void createArtifactVersion(artifactPreview.artifact!)}>新增版本</Button>,
          ] : null}
          width={820}
        >
          <pre className="artifact-content-preview">{artifactPreview.content}</pre>
          {artifactPreview.artifact?.versions?.length ? (
            <Timeline
              className="top-gap"
              items={artifactPreview.artifact.versions.map((version) => ({
                children: `v${version.version} · ${version.summary} · ${version.bytes} bytes · ${version.createdAt}`,
              }))}
            />
          ) : null}
        </Modal>
      </Layout>
    </>
  );

  function renderPage() {
    switch (page) {
      case "overview":
        return <OverviewPage tasks={tasks} selectedTask={selectedTask} onSelectTask={setSelectedTask} knowledgeCount={knowledgeItems.length} connectorCount={connectors.length} approvals={approvals} events={selectedTask.runId ? runEvents[selectedTask.runId] ?? [] : []} onStatusChange={updateTaskStatus} onAppendEvent={appendDiagnosticEvent} onOpenApprovals={() => setApprovalOpen(true)} onOpenStudio={() => setPage("creative")} />;
      case "agents":
        return (
          <AgentsPage
            agents={agents}
            teams={agentTeams}
            onCreateAgent={() => setAgentDrawerOpen(true)}
            onCreateTeam={() => setTeamDrawerOpen(true)}
          />
        );
      case "skills":
        return <SkillsPage skills={skills} />;
      case "plugins":
        return <PluginsPage plugins={workflowPlugins} onStart={() => setPluginOpen(true)} />;
      case "knowledge":
        return <KnowledgePage knowledgeItems={knowledgeItems} onCreate={() => setKnowledgeDrawerOpen(true)} />;
      case "connectors":
        return (
          <ConnectorsPage
            connectors={connectors}
            onCreateMcp={() => setConnectorDrawer({ open: true, kind: "MCP" })}
            onCreateCli={() => setConnectorDrawer({ open: true, kind: "CLI" })}
            onCheck={checkConnector}
            onInvoke={invokeConnector}
          />
        );
      case "creative":
        return <CreativePage />;
      case "workflows":
        return (
          <WorkflowsPage
            savedWorkflows={savedWorkflows}
            onSave={saveWorkflow}
            onRun={runWorkflowPlan}
            onExportYaml={exportWorkflowYaml}
            onImportYaml={importWorkflowYaml}
          />
        );
      case "assets":
        return <AssetsPage artifacts={artifacts} onCreate={createManualArtifact} onOpen={openArtifact} onVersion={createArtifactVersion} onExport={exportArtifacts} />;
      case "settings":
        return <SettingsPage secrets={secrets} onCreateSecret={createSecret} />;
    }
  }
}
