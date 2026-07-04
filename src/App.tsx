import {
  AppstoreOutlined,
  AuditOutlined,
  BgColorsOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  SafetyOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Progress,
  Radio,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Steps,
  Switch,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import {
  appendRunEvent,
  checkApiConnector,
  createApiAgent,
  createApiAgentTeam,
  createApiArtifact,
  createApiConnector,
  createApiKnowledgeItem,
  createApiTask,
  createApiWorkflow,
  invokeApiConnector,
  listApiAgents,
  listApiAgentTeams,
  listApiApprovals,
  listApiArtifacts,
  listApiConnectors,
  listApiKnowledgeItems,
  listApiTasks,
  listApiWorkflows,
  respondApiApproval,
  scanApiPlugins,
  scanApiSkills,
  startApiTask,
  updateApiTaskStatus,
} from "./api";
import type { ApiAgent, ApiAgentTeam, ApiApproval, ApiArtifact, ApiConnector, ApiKnowledgeItem, ApiRunEvent, ApiSkill, ApiTask, ApiWorkflow, ApiWorkflowPlugin } from "./api";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

type PageKey =
  | "overview"
  | "agents"
  | "skills"
  | "plugins"
  | "knowledge"
  | "connectors"
  | "creative"
  | "workflows"
  | "assets"
  | "settings";

type TaskStatus = "queued" | "approval" | "running" | "paused" | "done" | "failed" | "cancelled";
type RiskLevel = "low" | "medium" | "high";
type ConnectorKind = "MCP" | "CLI";

type Task = {
  key: string;
  runId?: string;
  title: string;
  description: string;
  owner: string;
  runtime: string;
  status: TaskStatus;
  target: string;
  updatedAt: string;
};

type AgentRecord = {
  key: string;
  name: string;
  description: string;
  runtime: string;
  model: string;
  capability: string;
  knowledgeScope: string;
  permissionProfile: string;
  status: "启用" | "运行中" | "禁用";
};

type AgentTeamRecord = {
  key: string;
  name: string;
  workflow: string;
  description: string;
  status: "启用" | "运行中" | "禁用";
  members: Array<{
    agentId: string;
    role: string;
    order: number;
  }>;
};

type KnowledgeItem = {
  key: string;
  title: string;
  type: "SOP" | "品牌" | "平台规则" | "决策" | "代码文档";
  meta: string;
  status: "已审核" | "契约" | "将过期" | "草稿";
  tags: string[];
  visibility: "team" | "project";
};

type ConnectorRecord = {
  key: string;
  kind: ConnectorKind;
  name: string;
  description: string;
  status: "在线" | "CLI" | "待检查" | "禁用";
  risk: RiskLevel;
  binding: string;
};

type ApprovalRecord = {
  key: string;
  taskKey: string;
  title: string;
  source: string;
  risk: RiskLevel;
  capabilities: string[];
  status: "pending" | "allowed" | "denied";
  reason: string;
};

type WorkflowStepRecord = {
  id: string;
  role: string;
  task: string;
  output?: string;
  dependsOn: string[];
  type?: "normal" | "approval" | "human_input";
};

type WorkflowPlan = {
  key: string;
  name: string;
  description: string;
  provider: string;
  concurrency: number;
  tags: string[];
  steps: WorkflowStepRecord[];
};

type ArtifactRecord = {
  key: string;
  file: string;
  type: string;
  source: string;
  summary: string;
  path: string;
  updatedAt: string;
};

type TaskFormValues = {
  title: string;
  prompt: string;
  targetType: "agent" | "agent_team" | "plugin";
  targetId: string;
  priority: "normal" | "high";
  requiresApproval: boolean;
};

type AgentFormValues = {
  name: string;
  description: string;
  runtime: string;
  model: string;
  permissionProfile: string;
  systemPrompt: string;
  skillIds: string[];
  knowledgeScope: string;
};

type AgentTeamFormValues = {
  name: string;
  workflow: string;
  description: string;
  agentIds: string[];
};

type KnowledgeFormValues = {
  title: string;
  type: KnowledgeItem["type"];
  content: string;
  tags: string[];
  visibility: KnowledgeItem["visibility"];
};

type ConnectorFormValues = {
  name: string;
  description: string;
  command: string;
  risk: RiskLevel;
  binding: string;
};

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

const riskMeta: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "低风险", color: "success" },
  medium: { label: "中风险", color: "warning" },
  high: { label: "高风险", color: "error" },
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

function statusTag(status: TaskStatus) {
  const meta = taskStatusMeta[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function riskTag(risk: RiskLevel, key?: string) {
  const meta = riskMeta[risk];
  return <Tag key={key} color={meta.color}>{meta.label}</Tag>;
}

function nowLabel() {
  return "刚刚";
}

function normalizeTaskStatus(status: string): TaskStatus {
  const allowed: TaskStatus[] = ["queued", "approval", "running", "paused", "done", "failed", "cancelled"];
  return allowed.includes(status as TaskStatus) ? (status as TaskStatus) : "queued";
}

function taskFromApi(task: ApiTask): Task {
  return {
    key: task.id,
    runId: task.runId,
    title: task.title,
    description: task.prompt,
    owner: task.owner,
    runtime: task.runtime,
    status: normalizeTaskStatus(task.status),
    target: task.targetId,
    updatedAt: formatTime(task.updatedAt),
  };
}

function agentFromApi(agent: ApiAgent): AgentRecord {
  return {
    key: agent.id,
    name: agent.name,
    description: agent.description,
    runtime: agent.runtime,
    model: agent.model,
    capability: `${agent.skillIds.length} Skills`,
    knowledgeScope: agent.knowledgeScope,
    permissionProfile: agent.permissionProfile,
    status: normalizeAgentStatus(agent.status),
  };
}

function teamFromApi(team: ApiAgentTeam): AgentTeamRecord {
  return {
    key: team.id,
    name: team.name,
    workflow: team.workflow,
    description: team.description,
    status: normalizeAgentStatus(team.status),
    members: team.members,
  };
}

function knowledgeFromApi(item: ApiKnowledgeItem): KnowledgeItem {
  return {
    key: item.id,
    title: item.title,
    type: normalizeKnowledgeType(item.type),
    meta: `${item.visibility === "team" ? "团队" : "项目"} · ${formatTime(item.updatedAt)} · 引用 0 次`,
    status: normalizeKnowledgeStatus(item.status),
    tags: item.tags,
    visibility: item.visibility === "team" ? "team" : "project",
  };
}

function connectorFromApi(connector: ApiConnector): ConnectorRecord {
  return {
    key: connector.id,
    kind: connector.kind,
    name: connector.name,
    description: connector.description,
    status: normalizeConnectorStatus(connector.status),
    risk: connector.risk,
    binding: connector.binding,
  };
}

function approvalFromApi(approval: ApiApproval): ApprovalRecord {
  return {
    key: approval.id,
    taskKey: approval.taskId,
    title: approval.title,
    source: approval.source,
    risk: approval.risk,
    capabilities: approval.capabilities,
    status: approval.status,
    reason: approval.reason,
  };
}

function artifactFromApi(artifact: ApiArtifact): ArtifactRecord {
  return {
    key: artifact.id,
    file: artifact.name,
    type: artifact.kind.toUpperCase(),
    source: artifact.source,
    summary: artifact.summary,
    path: artifact.path,
    updatedAt: formatTime(artifact.updatedAt),
  };
}

function workflowFromApi(workflow: ApiWorkflow): WorkflowPlan {
  return {
    key: workflow.id,
    name: workflow.name,
    description: workflow.description,
    provider: workflow.provider,
    concurrency: workflow.concurrency,
    tags: workflow.tags,
    steps: workflow.steps,
  };
}

function normalizeAgentStatus(status: string): AgentRecord["status"] {
  if (status === "运行中" || status === "禁用") return status;
  return "启用";
}

function normalizeKnowledgeType(type: string): KnowledgeItem["type"] {
  const allowed: KnowledgeItem["type"][] = ["SOP", "品牌", "平台规则", "决策", "代码文档"];
  return allowed.includes(type as KnowledgeItem["type"]) ? (type as KnowledgeItem["type"]) : "SOP";
}

function normalizeKnowledgeStatus(status: string): KnowledgeItem["status"] {
  const allowed: KnowledgeItem["status"][] = ["已审核", "契约", "将过期", "草稿"];
  return allowed.includes(status as KnowledgeItem["status"]) ? (status as KnowledgeItem["status"]) : "草稿";
}

function normalizeConnectorStatus(status: string): ConnectorRecord["status"] {
  const allowed: ConnectorRecord["status"][] = ["在线", "CLI", "待检查", "禁用"];
  return allowed.includes(status as ConnectorRecord["status"]) ? (status as ConnectorRecord["status"]) : "待检查";
}

function formatTime(value: string) {
  return Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleTimeString();
}

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
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
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [workflowPlugins, setWorkflowPlugins] = useState<ApiWorkflowPlugin[]>([]);
  const [runEvents, setRunEvents] = useState<Record<string, ApiRunEvent[]>>({});
  const [taskFilter, setTaskFilter] = useState<string>("全部");
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

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceData() {
      try {
        const [taskResult, agentResult, teamResult, knowledgeResult, connectorResult, approvalResult, artifactResult, workflowResult] = await Promise.all([
          listApiTasks(),
          listApiAgents(),
          listApiAgentTeams(),
          listApiKnowledgeItems(),
          listApiConnectors(),
          listApiApprovals(),
          listApiArtifacts(),
          listApiWorkflows(),
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
        setApprovals(apiApprovals);
        setSkills(skillResult.skills);
        setWorkflowPlugins(pluginResult.plugins);
      } catch {
        if (!cancelled) {
          messageApi.warning("API 未启动，当前使用前端演示数据");
        }
      }
    }

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  useEffect(() => {
    if (!selectedTask.runId) return;

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
  }, [selectedTask.runId]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "全部") return tasks;
    if (taskFilter === "审批") return tasks.filter((task) => task.status === "approval");
    if (taskFilter === "运行") return tasks.filter((task) => ["queued", "running", "paused"].includes(task.status));
    return tasks.filter((task) => task.status === "failed");
  }, [taskFilter, tasks]);

  const runtimePool = useMemo(
    () =>
      ["Codex", "OpenCode", "BrowserOps", "Creative"].map((runtime) => ({
        runtime,
        count: tasks.filter((task) => task.runtime === runtime && ["queued", "approval", "running"].includes(task.status)).length,
      })),
    [tasks],
  );

  const taskColumns: ColumnsType<Task> = [
    {
      title: "任务",
      dataIndex: "title",
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text type="secondary">{record.description}</Text>
        </Space>
      ),
    },
    { title: "Owner", dataIndex: "owner", width: 120 },
    { title: "Runtime", dataIndex: "runtime", width: 120 },
    { title: "状态", dataIndex: "status", width: 96, render: statusTag },
  ];

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
      messageApi.warning("API 未启动，已创建前端临时任务");
    }
  }

  async function createAgent(values: AgentFormValues) {
    let agent: AgentRecord;

    try {
      const result = await createApiAgent(values);
      agent = agentFromApi(result.agent);
      messageApi.success("Agent 已写入 SQLite");
    } catch {
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
      messageApi.warning("API 未启动，已创建前端临时 Agent");
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
      team = {
        key: `team_${Date.now()}`,
        name: values.name,
        workflow: values.workflow,
        description: values.description,
        status: "启用",
        members,
      };
      messageApi.warning("API 未启动，已创建前端临时 Agent Team");
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
      item = {
        key: `knowledge_${Date.now()}`,
        title: values.title,
        type: values.type,
        meta: `${values.visibility === "team" ? "团队" : "项目"} · 草稿 · 引用 0 次`,
        status: "草稿",
        tags: values.tags,
        visibility: values.visibility,
      };
      messageApi.warning("API 未启动，已创建前端临时知识条目");
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
      connector = {
        key: `${kind.toLowerCase()}_${Date.now()}`,
        kind,
        name: values.name,
        description: kind === "MCP" ? `${values.command} · 待自检` : `${values.command} · command template`,
        status: "待检查",
        risk: values.risk,
        binding: values.binding,
      };
      messageApi.warning("API 未启动，已创建前端临时连接器");
    }

    setConnectors((current) => [connector, ...current]);
    setConnectorDrawer({ open: false, kind });
    setPage("connectors");
  }

  async function checkConnector(connectorKey: string) {
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
    try {
      const result = await listApiArtifacts();
      const apiArtifacts = result.artifacts.map(artifactFromApi);
      if (apiArtifacts.length > 0) setArtifacts(apiArtifacts);
    } catch {
      messageApi.warning("API 未启动，无法刷新 Artifact 列表");
    }
  }

  async function createManualArtifact() {
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
      });
      setArtifacts((current) => [artifactFromApi(result.artifact), ...current]);
      messageApi.success("Artifact 已写入 SQLite");
    } catch {
      messageApi.error("Artifact 登记失败，请确认 API server 正在运行");
    }
  }

  async function saveWorkflow(plan: WorkflowPlan) {
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

  async function updateTaskStatus(taskKey: string, status: TaskStatus) {
    let nextStatus = status;
    const task = tasks.find((item) => item.key === taskKey);

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
      messageApi.warning("API 未启动，任务状态仅在前端更新");
    }

    setTasks((current) =>
      current.map((task) => (task.key === taskKey ? { ...task, status: nextStatus, updatedAt: nowLabel() } : task)),
    );
    setSelectedTask((current) => (current.key === taskKey ? { ...current, status: nextStatus, updatedAt: nowLabel() } : current));
    messageApi.info(`任务状态已更新为：${taskStatusMeta[nextStatus].label}`);
  }

  async function appendDiagnosticEvent(task: Task) {
    if (!task.runId) {
      messageApi.warning("这个任务还没有持久化 run，无法追加真实事件");
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

    if (approval?.key) {
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

  return (
    <>
      {contextHolder}
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
            <div>
              <Title level={3}>{pageMeta[page].title}</Title>
              <Text type="secondary">{pageMeta[page].subtitle}</Text>
            </div>
            <Space wrap>
              <Input.Search placeholder="搜索任务、Agent、插件、知识" className="global-search" />
              <Button onClick={() => setApprovalOpen(true)}>审批队列</Button>
              <Button type="primary" onClick={() => setTaskModalOpen(true)}>新建任务</Button>
            </Space>
          </Header>
          <Content className="app-content">{renderPage()}</Content>
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
      </Layout>
    </>
  );

  function renderPage() {
    switch (page) {
      case "overview":
        return (
          <Space orientation="vertical" size={16} className="full-width">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={5}>
                <Card><Statistic title="运行中任务" value={tasks.filter((task) => ["queued", "approval", "running"].includes(task.status)).length} suffix="个" /></Card>
              </Col>
              <Col xs={24} sm={12} lg={5}>
                <Card><Statistic title="今日产物" value={24} suffix="个" /></Card>
              </Col>
              <Col xs={24} sm={12} lg={5}>
                <Card><Statistic title="知识条目" value={knowledgeItems.length} suffix="条" /></Card>
              </Col>
              <Col xs={24} sm={12} lg={5}>
                <Card><Statistic title="连接器" value={connectors.length} suffix="个" /></Card>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Card><Statistic title="待审批" value={approvals.filter((item) => item.status === "pending").length} styles={{ content: { color: "#faad14" } }} /></Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={15}>
                <Card
                  title="任务队列"
                  extra={<Segmented options={["全部", "运行", "审批", "异常"]} value={taskFilter} onChange={(value) => setTaskFilter(String(value))} />}
                >
                  <Table
                    rowKey="key"
                    columns={taskColumns}
                    dataSource={filteredTasks}
                    pagination={false}
                    rowClassName={(record) => (record.key === selectedTask.key ? "selected-row" : "")}
                    onRow={(record) => ({ onClick: () => setSelectedTask(record) })}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={9}>
                <Card title={selectedTask.title} extra={statusTag(selectedTask.status)}>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="目标">{selectedTask.target}</Descriptions.Item>
                    <Descriptions.Item label="Runtime">{selectedTask.runtime}</Descriptions.Item>
                    <Descriptions.Item label="最近更新">{selectedTask.updatedAt}</Descriptions.Item>
                  </Descriptions>
                  <Progress percent={taskStatusMeta[selectedTask.status].progress} className="top-gap" />
                  <Steps
                    orientation="vertical"
                    current={stepIndexForTask(selectedTask.status)}
                    items={[
                      { title: "Create", content: "任务创建并写入 run draft" },
                      { title: "Context", content: "注入 Agent、知识范围和连接器权限" },
                      { title: "Approval", content: "高风险能力进入审批队列" },
                      { title: "Artifact", content: "产物写入 manifest 并进入 Studio" },
                    ]}
                  />
                  <TaskActionBar task={selectedTask} onStatusChange={updateTaskStatus} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={15}>
                <TaskRunPanel
                  task={selectedTask}
                  events={selectedTask.runId ? runEvents[selectedTask.runId] ?? [] : []}
                  onAppendEvent={appendDiagnosticEvent}
                />
              </Col>
              <Col xs={24} xl={9}>
                <Card title="审批概览" extra={<Button onClick={() => setApprovalOpen(true)}>处理</Button>}>
                  {approvals.length === 0 ? (
                    <Empty description="暂无审批" />
                  ) : (
                    <div className="list-panel">
                      {approvals.slice(0, 3).map((item) => (
                        <div className="list-row" key={item.key}>
                          <div>
                            <Text strong>{item.title}</Text>
                            <Text type="secondary" className="row-meta">{item.reason}</Text>
                          </div>
                          <Space wrap>
                            {riskTag(item.risk)}
                            <Tag>{item.status}</Tag>
                          </Space>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            <ArtifactSnapshot onOpenStudio={() => setPage("creative")} />
          </Space>
        );
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
        return <WorkflowsPage savedWorkflows={savedWorkflows} onSave={saveWorkflow} />;
      case "assets":
        return <AssetsPage artifacts={artifacts} onCreate={createManualArtifact} />;
      case "settings":
        return <SettingsPage />;
    }
  }
}

function stepIndexForTask(status: TaskStatus) {
  if (status === "queued") return 0;
  if (status === "running" || status === "paused") return 1;
  if (status === "approval" || status === "failed") return 2;
  return 3;
}

function TaskActionBar({ task, onStatusChange }: { task: Task; onStatusChange: (taskKey: string, status: TaskStatus) => void | Promise<void> }) {
  const canPause = task.status === "running" || task.status === "queued";
  const canResume = task.status === "paused" || task.status === "approval";
  const canRetry = task.status === "failed" || task.status === "cancelled";

  return (
    <Flex wrap gap={8} className="task-actions">
      <Button disabled={!canPause} onClick={() => void onStatusChange(task.key, "paused")}>暂停</Button>
      <Button disabled={!canResume} onClick={() => void onStatusChange(task.key, "running")}>继续</Button>
      <Button disabled={!canRetry} onClick={() => void onStatusChange(task.key, "queued")}>重试</Button>
      <Button danger disabled={task.status === "done" || task.status === "cancelled"} onClick={() => void onStatusChange(task.key, "cancelled")}>停止</Button>
    </Flex>
  );
}

function TaskRunPanel({
  task,
  events,
  onAppendEvent,
}: {
  task: Task;
  events: ApiRunEvent[];
  onAppendEvent: (task: Task) => void;
}) {
  const items =
    events.length > 0
      ? events.map((event) => ({
          color: event.type.includes("error") ? "red" : event.type.includes("approval") ? "gold" : "blue",
          content: (
            <Space orientation="vertical" size={0}>
              <Text strong>{event.type}</Text>
              <Text type="secondary">{formatEventPayload(event.payload)}</Text>
              <Text type="secondary">{new Date(event.createdAt).toLocaleTimeString()}</Text>
            </Space>
          ),
        }))
      : [
          {
            color: "gray",
            content: task.runId ? "正在等待 SSE 事件..." : "本地临时任务尚未创建持久化 run",
          },
        ];

  return (
    <Card
      title="运行事件"
      extra={
        <Space>
          {task.runId ? <Tag color="processing">SSE</Tag> : <Tag>Local</Tag>}
          <Button size="small" disabled={!task.runId} onClick={() => onAppendEvent(task)}>追加测试事件</Button>
        </Space>
      }
    >
      <Timeline items={items} />
    </Card>
  );
}

function formatEventPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return String(payload ?? "");
  if ("text" in payload && typeof payload.text === "string") return payload.text;
  return JSON.stringify(payload);
}

function ArtifactSnapshot({ onOpenStudio }: { onOpenStudio: () => void }) {
  const items = [
    ["MD", "draft.md", "正文草稿 · 2 引用", "blue"],
    ["PNG", "cover.png", "封面图 · BRAND.md", "purple"],
    ["HTML", "landing.html", "预览可用", "cyan"],
    ["ZIP", "publish.zip", "发布包", "gold"],
  ];
  return (
    <Card title="Artifact Studio 快照" extra={<Button onClick={onOpenStudio}>打开 Studio</Button>}>
      <Row gutter={[12, 12]}>
        {items.map(([type, name, desc, color]) => (
          <Col xs={24} sm={12} lg={6} key={name}>
            <Card size="small">
              <Tag color={color}>{type}</Tag>
              <Title level={5}>{name}</Title>
              <Text type="secondary">{desc}</Text>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function AgentsPage({
  agents,
  teams,
  onCreateAgent,
  onCreateTeam,
}: {
  agents: AgentRecord[];
  teams: AgentTeamRecord[];
  onCreateAgent: () => void;
  onCreateTeam: () => void;
}) {
  const agentNameById = new Map(agents.map((agent) => [agent.key, agent.name]));

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card title="Agent 列表" extra={<Button type="primary" onClick={onCreateAgent}>创建 Agent</Button>}>
          <Table
            rowKey="key"
            pagination={false}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "Runtime", dataIndex: "runtime" },
              { title: "模型", dataIndex: "model" },
              { title: "能力", dataIndex: "capability" },
              {
                title: "状态",
                dataIndex: "status",
                render: (value) => <Tag color={value === "运行中" ? "processing" : value === "禁用" ? "default" : "success"}>{value}</Tag>,
              },
            ]}
            dataSource={agents}
            expandable={{
              expandedRowRender: (record) => (
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="说明">{record.description}</Descriptions.Item>
                  <Descriptions.Item label="知识范围">{record.knowledgeScope}</Descriptions.Item>
                  <Descriptions.Item label="权限策略">{record.permissionProfile}</Descriptions.Item>
                </Descriptions>
              ),
            }}
          />
        </Card>
      </Col>
      <Col xs={24} xl={9}>
        <Card title="Agent Team" extra={<Button onClick={onCreateTeam}>创建 Team</Button>}>
          {teams.length === 0 ? (
            <Empty description="暂无 Agent Team" />
          ) : (
            <div className="list-panel">
              {teams.map((team) => (
                <div className="list-row" key={team.key}>
                  <div>
                    <Text strong>{team.name}</Text>
                    <Text type="secondary" className="row-meta">{team.description || team.workflow}</Text>
                    <Space wrap className="row-meta">
                      <Tag>{team.workflow}</Tag>
                      {team.members.map((member) => (
                        <Tag key={`${team.key}_${member.agentId}_${member.role}`}>
                          {member.role}: {agentNameById.get(member.agentId) ?? member.agentId}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                  <Tag color={team.status === "运行中" ? "processing" : "success"}>{team.status}</Tag>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
}

function SkillsPage({ skills }: { skills: ApiSkill[] }) {
  const skillColumns: ColumnsType<ApiSkill> = [
    {
      title: "Skill",
      dataIndex: "name",
      render: (_, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">{record.description || "未填写描述"}</Text>
        </Space>
      ),
    },
    {
      title: "权限",
      dataIndex: "permissions",
      render: (permissions: string[]) => (
        <Space wrap>{permissions.length > 0 ? permissions.map((item) => <Tag key={item}>{item}</Tag>) : <Tag>none</Tag>}</Space>
      ),
    },
    { title: "风险", dataIndex: "risk", width: 112, render: (risk: RiskLevel) => riskTag(risk) },
    { title: "路径", dataIndex: "path", ellipsis: true },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card title="本地 Skills" extra={<Tag color="processing">scan /skills</Tag>}>
          {skills.length === 0 ? (
            <Empty description="暂无扫描到的本地 Skill" />
          ) : (
            <Table<ApiSkill>
              rowKey="id"
              pagination={false}
              columns={skillColumns}
              dataSource={skills}
            />
          )}
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="接入规则">
          <Steps
            direction="vertical"
            size="small"
            current={2}
            items={[
              { title: "读取 SKILL.md" },
              { title: "解析权限与风险" },
              { title: "绑定 Agent / Plugin" },
              { title: "进入审批与审计" },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

function PluginsPage({ plugins, onStart }: { plugins: ApiWorkflowPlugin[]; onStart: () => void }) {
  const fallbackPlugins: ApiWorkflowPlugin[] = [
    {
      id: "weekly-media-post",
      name: "自媒体周更",
      description: "热榜采集、正文生成、封面 brief、审核、发布包",
      version: "demo",
      path: "plugins/weekly-media-post",
      skills: ["content-planner", "web-access"],
      mcpTools: ["browser.search", "filesystem.read"],
      cliCommands: [],
      knowledgeScopes: ["BRAND.md", "CONTENT.md"],
      capabilities: ["network:read", "knowledge:read", "files:write", "browser:input"],
      pipeline: ["discovery", "plan", "generate", "critique", "handoff"],
    },
    {
      id: "coding-task",
      name: "代码需求实现",
      description: "需求澄清、代码修改、测试、diff 审批、变更摘要",
      version: "demo",
      path: "plugins/coding-task",
      skills: ["code-implementer"],
      mcpTools: ["filesystem.read", "github.pull_request"],
      cliCommands: ["pnpm build"],
      knowledgeScopes: ["架构决策", "代码文档"],
      capabilities: ["files:write", "cli:run", "mcp:read"],
      pipeline: ["plan", "patch", "test", "review", "handoff"],
    },
    {
      id: "launch-kit",
      name: "产品上线宣传包",
      description: "Landing page、PPT、社媒图、短视频脚本和导出包",
      version: "demo",
      path: "plugins/launch-kit",
      skills: ["content-planner"],
      mcpTools: [],
      cliCommands: [],
      knowledgeScopes: ["BRAND.md"],
      capabilities: ["knowledge:read", "files:write"],
      pipeline: ["brief", "copy", "visual", "export"],
    },
  ];
  const rows = plugins.length > 0 ? plugins : fallbackPlugins;

  return (
    <Card title="Workflow Plugins" extra={<Button type="primary">安装插件</Button>}>
      <Row gutter={[16, 16]}>
        {rows.map((plugin) => (
          <Col xs={24} lg={8} key={plugin.id}>
            <Card
              className="plugin-card"
              title={plugin.name}
              extra={<Tag color={plugin.version === "demo" ? "default" : "success"}>{plugin.version}</Tag>}
              actions={[<Button key="start" type={plugin.id === "weekly-media-post" ? "primary" : "default"} onClick={onStart}>启动</Button>]}
            >
              <Paragraph>{plugin.description}</Paragraph>
              <Space wrap>
                {plugin.pipeline.map((step) => <Tag key={step}>{step}</Tag>)}
              </Space>
              <Descriptions column={1} size="small" className="top-gap">
                <Descriptions.Item label="Skills">{plugin.skills.join(", ") || "none"}</Descriptions.Item>
                <Descriptions.Item label="MCP">{plugin.mcpTools.join(", ") || "none"}</Descriptions.Item>
                <Descriptions.Item label="CLI">{plugin.cliCommands.join(", ") || "none"}</Descriptions.Item>
              </Descriptions>
              <Space wrap className="row-meta">
                {plugin.capabilities.map((item) => <Tag key={item}>{item}</Tag>)}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function KnowledgePage({ knowledgeItems, onCreate }: { knowledgeItems: KnowledgeItem[]; onCreate: () => void }) {
  const tabLabels = ["全部", "SOP", "品牌", "平台规则", "决策"];
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card title="团队知识库" extra={<Button type="primary" onClick={onCreate}>新增知识</Button>}>
          <Tabs
            items={tabLabels.map((label) => {
              const data = label === "全部" ? knowledgeItems : knowledgeItems.filter((item) => item.type === label);
              return {
                key: label,
                label,
                children: data.length === 0 ? (
                    <Empty description="暂无知识条目" />
                  ) : (
                    <div className="list-panel">
                      {data.map((item) => (
                        <div className="list-row" key={item.key}>
                          <div>
                            <Text strong>{item.title}</Text>
                            <Space wrap className="row-meta">
                              <Text type="secondary">{item.meta}</Text>
                              {item.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                            </Space>
                          </div>
                          <Tag color={item.status === "将过期" ? "warning" : item.status === "草稿" ? "default" : "success"}>{item.status}</Tag>
                        </div>
                      ))}
                    </div>
                  ),
              };
            })}
          />
        </Card>
      </Col>
      <Col xs={24} xl={9}>
        <Card title="Agent 知识范围">
          <Paragraph>自媒体内容团队可读取内容 SOP、品牌契约、平台规则、竞品资料；可建议更新，不可直接写入。</Paragraph>
          <Space wrap>
            <Tag>BRAND.md</Tag>
            <Tag>CONTENT.md</Tag>
            <Tag>平台规则</Tag>
            <Tag>竞品资料</Tag>
          </Space>
        </Card>
        <Card title="检索策略" className="top-gap">
          <Steps
            size="small"
            current={2}
            items={[
              { title: "范围过滤" },
              { title: "状态过滤" },
              { title: "FTS 召回" },
              { title: "引用返回" },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

function ConnectorsPage({
  connectors,
  onCreateMcp,
  onCreateCli,
  onCheck,
  onInvoke,
}: {
  connectors: ConnectorRecord[];
  onCreateMcp: () => void;
  onCreateCli: () => void;
  onCheck: (connectorKey: string) => void | Promise<void>;
  onInvoke: (connectorKey: string) => void | Promise<void>;
}) {
  return (
    <Space orientation="vertical" size={16} className="full-width">
      <Card title="MCP 与 CLI 连接器" extra={<Space><Button onClick={onCreateCli}>注册 CLI</Button><Button type="primary" onClick={onCreateMcp}>添加 MCP</Button></Space>}>
        <Row gutter={[16, 16]}>
          {connectors.map((connector) => (
            <Col xs={24} md={12} xl={6} key={connector.key}>
              <Card
                title={connector.name}
                extra={<Tag color={connector.kind === "MCP" ? "blue" : "purple"}>{connector.kind}</Tag>}
                actions={[
                  <Button key="check" type="text" onClick={() => void onCheck(connector.key)}>自检</Button>,
                  <Button key="invoke" type="text" onClick={() => void onInvoke(connector.key)}>试运行</Button>,
                ]}
              >
                <Paragraph>{connector.description}</Paragraph>
                <Space wrap>
                  <Tag>{connector.status}</Tag>
                  {riskTag(connector.risk)}
                  <Tag>{connector.binding}</Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
      <Card title="调用策略">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <PolicyItem icon={<SafetyOutlined />} title="Allowlist" text="Agent 只能调用绑定范围内的 MCP tools 和 CLI commands。" />
          </Col>
          <Col xs={24} md={8}>
            <PolicyItem icon={<AuditOutlined />} title="Approval" text="中高风险命令进入统一审批队列，记录参数与来源。" />
          </Col>
          <Col xs={24} md={8}>
            <PolicyItem icon={<CodeOutlined />} title="Audit" text="执行结果写入运行事件，支持任务回放和失败诊断。" />
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

function PolicyItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Flex gap={12} align="flex-start">
      <div className="policy-icon">{icon}</div>
      <div>
        <Text strong>{title}</Text>
        <Paragraph type="secondary" className="compact-copy">{text}</Paragraph>
      </div>
    </Flex>
  );
}

function CreativePage() {
  const [artifact, setArtifact] = useState("正文");
  const preview = {
    正文: <ArticlePreview />,
    Landing: <LandingPreview />,
    PPT: <DeckPreview />,
    封面: <CoverPreview />,
    Diff: <DiffPreview />,
  }[artifact];
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card title="Creative Studio" extra={<Button type="primary">导出发布包</Button>}>
          <Tabs
            activeKey={artifact}
            onChange={setArtifact}
            items={["正文", "Landing", "PPT", "封面", "Diff"].map((key) => ({ key, label: key }))}
          />
          <div className="artifact-preview">{preview}</div>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="Artifact Manifest">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="来源 Agent">文案 Agent</Descriptions.Item>
            <Descriptions.Item label="来源 Plugin">自媒体周更</Descriptions.Item>
            <Descriptions.Item label="知识引用">2 条</Descriptions.Item>
            <Descriptions.Item label="契约版本">BRAND.md / CONTENT.md</Descriptions.Item>
            <Descriptions.Item label="导出格式">MD / PDF / ZIP</Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );
}

function ArticlePreview() {
  return (
    <article className="doc-preview">
      <Tag color="processing">Markdown</Tag>
      <Title>AI Agent 工作流：从工具到团队协作</Title>
      <Paragraph>本文从自媒体、编码、运营三个场景切入，解释为什么通用 Agent 产品不应重写单体 Agent，而应成为任务、工具、知识和产物的工作台。</Paragraph>
      <ul>
        <li>引用：公众号发布前审核 SOP</li>
        <li>契约：CONTENT.md v2026-07-04</li>
      </ul>
    </article>
  );
}

function LandingPreview() {
  return (
    <div className="landing-preview">
      <Tag color="processing">HTML</Tag>
      <Title>Agent Workbench Launch Kit</Title>
      <Paragraph>本地优先的多 Agent 控制台，把任务、工具、知识和产物放进一个可审批工作流。</Paragraph>
    </div>
  );
}

function DeckPreview() {
  return (
    <div className="deck-preview">
      <Tag color="success">PPT</Tag>
      <Title>从 Agent 到 Agent Team</Title>
      <Paragraph>10 页产品说明 · 4 个图表 · 2 条决策记录引用</Paragraph>
    </div>
  );
}

function CoverPreview() {
  return <div className="cover-preview">Agent Workbench</div>;
}

function DiffPreview() {
  return (
    <pre className="diff-preview">{`+ plugin_grants 表记录授权来源
+ task_status 支持 queued / paused / cancelled
+ connectors 统一 MCP 与 CLI 注册表
- 旧资产仅记录本地路径`}</pre>
  );
}

function WorkflowsPage({
  savedWorkflows,
  onSave,
}: {
  savedWorkflows: WorkflowPlan[];
  onSave: (plan: WorkflowPlan) => void | Promise<void>;
}) {
  const templates = useMemo<WorkflowPlan[]>(
    () => [
      {
        key: "product-review",
        name: "产品需求评审",
        description: "产品经理分析后，并行交给架构师、UX 研究员和安全工程师评审，最后汇总结论。",
        provider: "codex-cli",
        concurrency: 3,
        tags: ["DAG", "并行评审", "人工结论"],
        steps: [
          { id: "analyze", role: "product/product-manager", task: "分析 PRD，提取目标、用户、约束和验收标准。", output: "requirements", dependsOn: [] },
          { id: "tech_review", role: "engineering/software-architect", task: "评估技术可行性、模块边界和风险。", output: "tech_report", dependsOn: ["analyze"] },
          { id: "design_review", role: "design/ux-researcher", task: "评估用户体验、信息架构和操作成本。", output: "design_report", dependsOn: ["analyze"] },
          { id: "security_review", role: "security/security-engineer", task: "检查权限、数据、命令执行和外部账号风险。", output: "security_report", dependsOn: ["analyze"] },
          { id: "summary", role: "product/product-manager", task: "综合评审结论，输出 Go / No-Go 与下一步任务。", output: "decision", dependsOn: ["tech_review", "design_review", "security_review"] },
        ],
      },
      {
        key: "content-publish",
        name: "自媒体发布闭环",
        description: "选题、正文、封面、品牌审核、发布包生成，浏览器写入前插入审批节点。",
        provider: "deepseek",
        concurrency: 2,
        tags: ["内容", "审批", "Artifact"],
        steps: [
          { id: "research", role: "marketing/trend-researcher", task: "收集热榜、竞品和历史素材。", output: "research_pack", dependsOn: [] },
          { id: "outline", role: "content/content-strategist", task: "生成大纲、角度和标题候选。", output: "outline", dependsOn: ["research"] },
          { id: "draft", role: "content/writer", task: "撰写正文并标注知识引用。", output: "draft", dependsOn: ["outline"] },
          { id: "cover", role: "design/visual-storyteller", task: "生成封面 brief 与配图建议。", output: "cover_brief", dependsOn: ["outline"] },
          { id: "approval", role: "human", task: "确认浏览器写入草稿箱的能力授权。", dependsOn: ["draft", "cover"], type: "approval" },
          { id: "handoff", role: "ops/publisher", task: "生成发布包和复盘清单。", output: "publish_pack", dependsOn: ["approval"] },
        ],
      },
      {
        key: "dev-pr-review",
        name: "代码变更评审",
        description: "代码审查、安全检查、性能检查三路并行，再由工程负责人汇总。",
        provider: "codex-cli",
        concurrency: 3,
        tags: ["Coding", "PR", "安全"],
        steps: [
          { id: "scan", role: "engineering/code-reviewer", task: "读取 diff，识别行为变化和测试缺口。", output: "code_findings", dependsOn: [] },
          { id: "security", role: "security/application-security", task: "并行检查鉴权、输入校验和 secret 风险。", output: "security_findings", dependsOn: ["scan"] },
          { id: "performance", role: "engineering/performance-engineer", task: "并行检查性能、包体积和渲染成本。", output: "perf_findings", dependsOn: ["scan"] },
          { id: "final", role: "engineering/tech-lead", task: "汇总阻塞项、建议和可合并条件。", output: "review_summary", dependsOn: ["security", "performance"] },
        ],
      },
    ],
    [],
  );
  const [prompt, setPrompt] = useState("把一个自媒体选题做成可发布的公众号文章，并生成封面 brief 和发布包");
  const [provider, setProvider] = useState("codex-cli");
  const [concurrency, setConcurrency] = useState(2);
  const [activePlan, setActivePlan] = useState<WorkflowPlan>(templates[1]);

  function composeFromPrompt() {
    setActivePlan({
      key: `compose_${Date.now()}`,
      name: "AI 自动组队方案",
      description: prompt,
      provider,
      concurrency,
      tags: ["一句话编排", "自动组队", "待保存"],
      steps: [
        { id: "intent", role: "product/task-planner", task: "澄清目标、输出物和验收标准。", output: "task_brief", dependsOn: [] },
        { id: "research", role: "research/domain-analyst", task: "收集任务相关背景、案例和约束。", output: "research", dependsOn: ["intent"] },
        { id: "plan", role: "product/workflow-designer", task: "拆解阶段、选择 Agent Team 和所需连接器。", output: "workflow_plan", dependsOn: ["intent"] },
        { id: "risk_gate", role: "security/capability-auditor", task: "识别高风险能力并生成 capability gate。", output: "risk_gate", dependsOn: ["plan"] },
        { id: "draft", role: "content-or-code/executor", task: "根据计划生成首版产物或代码变更。", output: "artifact_draft", dependsOn: ["research", "risk_gate"] },
        { id: "review", role: "quality/reviewer", task: "审核事实、质量、引用和发布风险。", output: "review_report", dependsOn: ["draft"] },
      ],
    });
  }

  return (
    <Space orientation="vertical" size={16} className="full-width">
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title="一句话自动编排" extra={<Tag color="processing">AO-inspired</Tag>}>
            <Form layout="vertical">
              <Form.Item label="任务目标">
                <Input.TextArea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Provider">
                    <Select
                      value={provider}
                      onChange={setProvider}
                      options={[
                        { value: "codex-cli", label: "Codex CLI" },
                        { value: "claude-code", label: "Claude Code" },
                        { value: "deepseek", label: "DeepSeek API" },
                        { value: "ollama", label: "Ollama Local" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="并发度">
                    <Segmented
                      block
                      options={[1, 2, 3, 4]}
                      value={concurrency}
                      onChange={(value) => setConcurrency(Number(value))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" block onClick={composeFromPrompt}>生成工作流计划</Button>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <WorkflowDagPreview plan={activePlan} onSave={onSave} />
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card title="内置工作流模板">
            <div className="list-panel">
              {templates.map((template) => (
                <div className="list-row" key={template.key}>
                  <div>
                    <Text strong>{template.name}</Text>
                    <Text type="secondary" className="row-meta">{template.description}</Text>
                    <Space wrap className="row-meta">
                      {template.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </Space>
                  </div>
                  <Button onClick={() => setActivePlan(template)}>套用</Button>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="团队 Loadout">
            <div className="list-panel">
              {[
                ["内容增长小队", "趋势研究员 / 内容策略师 / 品牌守护者 / 发布运营"],
                ["研发评审小队", "架构师 / 安全工程师 / 性能工程师 / 测试分析师"],
                ["产品上线小队", "产品经理 / UX 研究员 / 文案 / 视觉叙事师"],
              ].map(([name, roles]) => (
                <div className="list-row" key={name}>
                  <div>
                    <Text strong>{name}</Text>
                    <Text type="secondary" className="row-meta">{roles}</Text>
                  </div>
                  <Tag color="blue">可复用</Tag>
                </div>
              ))}
            </div>
          </Card>
          <Card title="已保存工作流" className="top-gap">
            {savedWorkflows.length === 0 ? (
              <Empty description="暂无保存的工作流" />
            ) : (
              <div className="list-panel">
                {savedWorkflows.slice(0, 4).map((workflow) => (
                  <div className="list-row" key={workflow.key}>
                    <div>
                      <Text strong>{workflow.name}</Text>
                      <Text type="secondary" className="row-meta">{workflow.description}</Text>
                    </div>
                    <Button onClick={() => setActivePlan(workflow)}>打开</Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>
      <Card title="Resume / Feedback 返工入口">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Text strong>恢复运行</Text>
            <Paragraph type="secondary" className="compact-copy">从上次输出目录恢复已完成步骤，未变步骤跳过。</Paragraph>
          </Col>
          <Col xs={24} md={8}>
            <Text strong>从指定步骤重跑</Text>
            <Paragraph type="secondary" className="compact-copy">选择某个 step，把后续依赖重新排队。</Paragraph>
          </Col>
          <Col xs={24} md={8}>
            <Text strong>带反馈返工</Text>
            <Paragraph type="secondary" className="compact-copy">把上一版产物和修改意见注入目标 Agent，减少从零重写。</Paragraph>
          </Col>
        </Row>
      </Card>
    </Space>
  );
}

function WorkflowDagPreview({
  plan,
  onSave,
}: {
  plan: WorkflowPlan;
  onSave?: (plan: WorkflowPlan) => void | Promise<void>;
}) {
  const levels = buildWorkflowLevels(plan.steps);
  return (
    <Card
      title={plan.name}
      extra={
        <Space wrap>
          <Tag>{plan.provider}</Tag>
          <Tag>并发 {plan.concurrency}</Tag>
          {onSave ? <Button size="small" onClick={() => void onSave(plan)}>保存</Button> : null}
        </Space>
      }
    >
      <Paragraph type="secondary">{plan.description}</Paragraph>
      <Space wrap>
        {plan.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
      </Space>
      <div className="dag-board">
        {levels.map((level, index) => (
          <div className="dag-level" key={`level_${index}`}>
            <Text type="secondary">Layer {index + 1}</Text>
            {level.map((step) => (
              <div className="dag-step" key={step.id}>
                <Flex justify="space-between" align="center">
                  <Text strong>{step.id}</Text>
                  {step.type ? <Tag color={step.type === "approval" ? "warning" : "purple"}>{step.type}</Tag> : <Tag color="success">normal</Tag>}
                </Flex>
                <Text type="secondary" className="row-meta">{step.role}</Text>
                <Paragraph className="compact-copy">{step.task}</Paragraph>
                {step.dependsOn.length > 0 ? <Text type="secondary">depends_on: {step.dependsOn.join(", ")}</Text> : <Text type="secondary">root step</Text>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function buildWorkflowLevels(steps: WorkflowStepRecord[]) {
  const remaining = new Map(steps.map((step) => [step.id, step]));
  const completed = new Set<string>();
  const levels: WorkflowStepRecord[][] = [];

  while (remaining.size > 0) {
    const level = Array.from(remaining.values()).filter((step) => step.dependsOn.every((dep) => completed.has(dep)));
    if (level.length === 0) {
      levels.push(Array.from(remaining.values()));
      break;
    }

    levels.push(level);
    for (const step of level) {
      completed.add(step.id);
      remaining.delete(step.id);
    }
  }

  return levels;
}

function AssetsPage({
  artifacts,
  onCreate,
}: {
  artifacts: ArtifactRecord[];
  onCreate: () => void | Promise<void>;
}) {
  return (
    <Card title="资产库" extra={<Space><Button onClick={() => void onCreate()}>登记产物</Button><Button>批量导出</Button></Space>}>
      <Table
        rowKey="key"
        pagination={false}
        columns={[
          { title: "文件", dataIndex: "file" },
          { title: "类型", dataIndex: "type", render: (value) => <Tag color="blue">{value}</Tag> },
          { title: "来源", dataIndex: "source" },
          { title: "摘要", dataIndex: "summary" },
          { title: "更新时间", dataIndex: "updatedAt" },
        ]}
        dataSource={artifacts}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions column={1} size="small">
              <Descriptions.Item label="路径">{record.path}</Descriptions.Item>
            </Descriptions>
          ),
        }}
      />
    </Card>
  );
}

function SettingsPage() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={12}>
        <Card title="模型与 Runtime">
          <div className="list-panel">
            {["Codex CLI", "OpenCode", "GenericAgent Worker"].map((item, index) => (
              <div className="list-row" key={item}>
                <div>
                  <Text strong>{item}</Text>
                  <Text type="secondary" className="row-meta">{index === 2 ? "127.0.0.1:3917" : "已连接"}</Text>
                </div>
                <Switch defaultChecked={index < 2} />
              </div>
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={24} xl={12}>
        <Card title="安全策略">
          <Radio.Group defaultValue="collab" optionType="button" buttonStyle="solid">
            <Radio value="auto">自动化</Radio>
            <Radio value="collab">协作</Radio>
            <Radio value="strict">保守</Radio>
          </Radio.Group>
          <div className="list-panel top-gap">
            {["插件安装：需要确认", "真实账号发布：禁止自动提交", "Secret 注入：仅运行时"].map((item) => (
              <div className="list-row" key={item}>
                <Text>{item}</Text>
                <CheckCircleOutlined className="success-icon" />
              </div>
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  );
}

function ApprovalDrawer({
  open,
  approvals,
  onClose,
  onRespond,
}: {
  open: boolean;
  approvals: ApprovalRecord[];
  onClose: () => void;
  onRespond: (approvalKey: string, decision: ApprovalRecord["status"]) => void | Promise<void>;
}) {
  const pendingApprovals = approvals.filter((item) => item.status === "pending");

  return (
    <Drawer title="审批请求" open={open} onClose={onClose} size={520}>
      {pendingApprovals.length === 0 ? (
        <Empty description="暂无待审批动作" />
      ) : (
        <Space orientation="vertical" size={16} className="full-width">
          {pendingApprovals.map((approval) => (
            <Card key={approval.key} className="approval-card">
              <Space wrap>
                {riskTag(approval.risk)}
                <Tag>{approval.source}</Tag>
              </Space>
              <Title level={4}>{approval.title}</Title>
              <Paragraph>{approval.reason}</Paragraph>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="能力">
                  <Space wrap>{approval.capabilities.map((capability) => <Tag key={capability}>{capability}</Tag>)}</Space>
                </Descriptions.Item>
                <Descriptions.Item label="审计">将记录来源、参数、审批人和执行结果</Descriptions.Item>
              </Descriptions>
              <Flex justify="end" gap={8} className="drawer-actions">
                <Button onClick={() => void onRespond(approval.key, "denied")}>拒绝</Button>
                <Button>编辑参数</Button>
                <Button type="primary" onClick={() => void onRespond(approval.key, "allowed")}>允许本次</Button>
              </Flex>
            </Card>
          ))}
        </Space>
      )}
    </Drawer>
  );
}

function PluginModal({ open, onCancel, onOk }: { open: boolean; onCancel: () => void; onOk: () => void }) {
  return (
    <Modal title="启动插件：自媒体周更" open={open} onCancel={onCancel} onOk={onOk} okText="授权并启动" cancelText="取消">
      <Paragraph type="secondary">确认本次运行将使用的能力。</Paragraph>
      <Space orientation="vertical" className="full-width">
        <CapabilityRow capability="network:read" text="读取热榜与竞品页面" enabled />
        <CapabilityRow capability="knowledge:read" text="检索 BRAND.md / CONTENT.md / SOP" enabled />
        <CapabilityRow capability="files:write" text="写入 artifact project" enabled />
        <CapabilityRow capability="browser:input" text="写入公众号草稿箱" />
      </Space>
    </Modal>
  );
}

function CapabilityRow({ capability, text, enabled = false }: { capability: string; text: string; enabled?: boolean }) {
  return (
    <Flex align="center" gap={12} className="capability-row">
      <Switch defaultChecked={enabled} />
      <Text><Text code>{capability}</Text> {text}</Text>
    </Flex>
  );
}

function TaskModal({
  open,
  agents,
  teams,
  onCancel,
  onCreate,
}: {
  open: boolean;
  agents: AgentRecord[];
  teams: AgentTeamRecord[];
  onCancel: () => void;
  onCreate: (values: TaskFormValues) => void | Promise<void>;
}) {
  const [form] = Form.useForm<TaskFormValues>();
  const targetType = Form.useWatch("targetType", form) ?? "agent_team";
  const targetOptions =
    targetType === "agent"
      ? agents.map((agent) => ({ value: agent.key, label: agent.name }))
      : targetType === "plugin"
        ? [
            { value: "自媒体周更插件", label: "自媒体周更插件" },
            { value: "代码需求实现插件", label: "代码需求实现插件" },
            { value: "产品上线宣传包", label: "产品上线宣传包" },
          ]
        : teams.length > 0
          ? teams.map((team) => ({ value: team.key, label: team.name }))
          : [{ value: "team_content_ops", label: "自媒体内容团队" }];

  return (
    <Modal
      title="新建任务"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="创建任务"
      cancelText="取消"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          title: "公众号周更：AI Agent 工作流",
          targetType: "agent_team",
          targetId: teams[0]?.key ?? "team_content_ops",
          priority: "normal",
          requiresApproval: true,
        }}
        onValuesChange={(changed) => {
          if (changed.targetType) {
            const nextTarget = changed.targetType === "agent" ? agents[0]?.key : changed.targetType === "plugin" ? "自媒体周更插件" : teams[0]?.key ?? "team_content_ops";
            form.setFieldValue("targetId", nextTarget);
          }
        }}
        onFinish={(values) => {
          void onCreate(values);
          form.resetFields();
        }}
      >
        <Form.Item label="任务标题" name="title" rules={[{ required: true, message: "请输入任务标题" }]}>
          <Input />
        </Form.Item>
        <Form.Item label="任务说明" name="prompt" rules={[{ required: true, message: "请输入任务说明" }]}>
          <Input.TextArea rows={4} placeholder="描述目标、输入、验收标准和需要生成的产物" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="目标类型" name="targetType">
              <Select
                options={[
                  { value: "agent_team", label: "Agent Team" },
                  { value: "agent", label: "单 Agent" },
                  { value: "plugin", label: "Workflow Plugin" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="运行目标" name="targetId" rules={[{ required: true, message: "请选择运行目标" }]}>
              <Select options={targetOptions} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="优先级" name="priority">
              <Radio.Group optionType="button" buttonStyle="solid">
                <Radio value="normal">普通</Radio>
                <Radio value="high">高</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="启动前审批" name="requiresApproval" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

function AgentDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: AgentFormValues) => void | Promise<void>;
}) {
  const [form] = Form.useForm<AgentFormValues>();
  return (
    <Drawer
      title="创建 Agent"
      open={open}
      onClose={onClose}
      size={520}
      extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          runtime: "Codex",
          model: "gpt-5.4",
          permissionProfile: "collaborative",
          skillIds: ["web-access"],
          knowledgeScope: "项目知识库 / BRAND.md / CONTENT.md",
        }}
        onFinish={(values) => {
          void onCreate(values);
          form.resetFields();
        }}
      >
        <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入 Agent 名称" }]}>
          <Input placeholder="例如：内容审核 Agent" />
        </Form.Item>
        <Form.Item label="说明" name="description" rules={[{ required: true, message: "请输入 Agent 说明" }]}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Runtime" name="runtime">
              <Select options={["Codex", "OpenCode", "BrowserOps", "GenericAgent"].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="模型" name="model">
              <Select options={["gpt-5.5", "gpt-5.4", "gpt-5.4-mini"].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="系统提示词" name="systemPrompt">
          <Input.TextArea rows={5} placeholder="描述角色、边界、输出格式和审批策略" />
        </Form.Item>
        <Form.Item label="绑定 Skills" name="skillIds">
          <Select
            mode="multiple"
            options={["web-access", "content-planner", "code-review", "artifact-export"].map((value) => ({ value, label: value }))}
          />
        </Form.Item>
        <Form.Item label="知识范围" name="knowledgeScope">
          <Input />
        </Form.Item>
        <Form.Item label="权限策略" name="permissionProfile">
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio value="strict">保守</Radio>
            <Radio value="collaborative">协作</Radio>
            <Radio value="auto">自动化</Radio>
          </Radio.Group>
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function AgentTeamDrawer({
  open,
  agents,
  onClose,
  onCreate,
}: {
  open: boolean;
  agents: AgentRecord[];
  onClose: () => void;
  onCreate: (values: AgentTeamFormValues) => void | Promise<void>;
}) {
  const [form] = Form.useForm<AgentTeamFormValues>();
  return (
    <Drawer
      title="创建 Agent Team"
      open={open}
      onClose={onClose}
      size={520}
      extra={<Button type="primary" onClick={() => form.submit()}>保存 Team</Button>}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          workflow: "lead_sequential",
          agentIds: agents.slice(0, 2).map((agent) => agent.key),
        }}
        onFinish={(values) => {
          void onCreate(values);
          form.resetFields();
        }}
      >
        <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入 Team 名称" }]}>
          <Input placeholder="例如：自媒体内容团队" />
        </Form.Item>
        <Form.Item label="说明" name="description">
          <Input.TextArea rows={3} placeholder="说明协作目标、输入输出和审批边界" />
        </Form.Item>
        <Form.Item label="工作流" name="workflow">
          <Select
            options={[
              { value: "lead_sequential", label: "Lead Sequential" },
              { value: "review_chain", label: "Review Chain" },
              { value: "publish_handoff", label: "Publish Handoff" },
            ]}
          />
        </Form.Item>
        <Form.Item label="成员顺序" name="agentIds" rules={[{ required: true, message: "请选择至少一个 Agent" }]}>
          <Select
            mode="multiple"
            options={agents.map((agent) => ({ value: agent.key, label: agent.name }))}
            placeholder="按选择顺序串行执行"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function KnowledgeDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: KnowledgeFormValues) => void | Promise<void>;
}) {
  const [form] = Form.useForm<KnowledgeFormValues>();
  return (
    <Drawer
      title="新增知识条目"
      open={open}
      onClose={onClose}
      size={520}
      extra={<Button type="primary" onClick={() => form.submit()}>保存草稿</Button>}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: "SOP", visibility: "project", tags: ["审核"] }}
        onFinish={(values) => {
          void onCreate(values);
          form.resetFields();
        }}
      >
        <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入知识标题" }]}>
          <Input placeholder="例如：公众号发布前审核 SOP" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="类型" name="type">
              <Select options={["SOP", "品牌", "平台规则", "决策", "代码文档"].map((value) => ({ value, label: value }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="可见范围" name="visibility">
              <Select
                options={[
                  { value: "project", label: "项目" },
                  { value: "team", label: "团队" },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="标签" name="tags">
          <Select mode="tags" placeholder="输入后回车" />
        </Form.Item>
        <Form.Item label="正文" name="content" rules={[{ required: true, message: "请输入知识正文" }]}>
          <Input.TextArea rows={8} placeholder="支持粘贴 Markdown、会议纪要、规则摘要或代码文档片段" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function ConnectorDrawer({
  open,
  kind,
  agents,
  onClose,
  onCreate,
}: {
  open: boolean;
  kind: ConnectorKind;
  agents: AgentRecord[];
  onClose: () => void;
  onCreate: (kind: ConnectorKind, values: ConnectorFormValues) => void | Promise<void>;
}) {
  const [form] = Form.useForm<ConnectorFormValues>();
  return (
    <Drawer
      title={kind === "MCP" ? "添加 MCP Server" : "注册 CLI Command"}
      open={open}
      onClose={onClose}
      size={520}
      extra={<Button type="primary" onClick={() => form.submit()}>注册</Button>}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          risk: kind === "MCP" ? "medium" : "low",
          binding: agents[0]?.name,
          command: kind === "MCP" ? "github-mcp-server stdio" : "pnpm build",
        }}
        onFinish={(values) => {
          void onCreate(kind, values);
          form.resetFields();
        }}
      >
        <Form.Item label="名称" name="name" rules={[{ required: true, message: "请输入连接器名称" }]}>
          <Input placeholder={kind === "MCP" ? "例如：GitHub MCP" : "例如：pnpm build"} />
        </Form.Item>
        <Form.Item label={kind === "MCP" ? "命令 / URL" : "命令模板"} name="command" rules={[{ required: true, message: "请输入命令或 URL" }]}>
          <Input />
        </Form.Item>
        <Form.Item label="说明" name="description" rules={[{ required: true, message: "请输入说明" }]}>
          <Input.TextArea rows={3} placeholder="说明用途、参数、输出格式和失败诊断方式" />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="风险等级" name="risk">
              <Select
                options={[
                  { value: "low", label: "低风险" },
                  { value: "medium", label: "中风险" },
                  { value: "high", label: "高风险" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="默认绑定" name="binding">
              <Select options={agents.map((agent) => ({ value: agent.name, label: agent.name }))} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Drawer>
  );
}
