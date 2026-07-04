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
import { useMemo, useState } from "react";

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

type PageKey =
  | "overview"
  | "agents"
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

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [page, setPage] = useState<PageKey>("overview");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task>(initialTasks[0]);
  const [agents, setAgents] = useState<AgentRecord[]>(initialAgents);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>(initialKnowledgeItems);
  const [connectors, setConnectors] = useState<ConnectorRecord[]>(initialConnectors);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>(initialApprovals);
  const [taskFilter, setTaskFilter] = useState<string>("全部");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false);
  const [knowledgeDrawerOpen, setKnowledgeDrawerOpen] = useState(false);
  const [connectorDrawer, setConnectorDrawer] = useState<{ open: boolean; kind: ConnectorKind }>({
    open: false,
    kind: "MCP",
  });

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
    { key: "plugins", icon: <BranchesOutlined />, label: "插件" },
    { key: "knowledge", icon: <DatabaseOutlined />, label: "知识库" },
    { key: "connectors", icon: <CloudServerOutlined />, label: "连接器" },
    { key: "creative", icon: <BgColorsOutlined />, label: "Creative Studio" },
    { key: "workflows", icon: <PlayCircleOutlined />, label: "工作流" },
    { key: "assets", icon: <FileTextOutlined />, label: "资产" },
    { key: "settings", icon: <SettingOutlined />, label: "设置" },
  ];

  function createTask(values: TaskFormValues) {
    const agent = agents.find((item) => item.key === values.targetId);
    const target = values.targetType === "plugin" ? values.targetId : agent?.name ?? "自媒体内容团队";
    const runtime = values.targetType === "plugin" ? "BrowserOps" : agent?.runtime ?? "BrowserOps";
    const newTask: Task = {
      key: `task_${Date.now()}`,
      title: values.title,
      description: values.prompt,
      owner: values.targetType === "agent" ? target : "内容团队",
      runtime,
      status: values.requiresApproval ? "approval" : "queued",
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

    messageApi.success("任务草稿已创建，并加入工作台队列");
  }

  function createAgent(values: AgentFormValues) {
    const agent: AgentRecord = {
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

    setAgents((current) => [agent, ...current]);
    setAgentDrawerOpen(false);
    setPage("agents");
    messageApi.success("Agent 已创建，可继续绑定 MCP / CLI 能力");
  }

  function createKnowledgeItem(values: KnowledgeFormValues) {
    const item: KnowledgeItem = {
      key: `knowledge_${Date.now()}`,
      title: values.title,
      type: values.type,
      meta: `${values.visibility === "team" ? "团队" : "项目"} · 草稿 · 引用 0 次`,
      status: "草稿",
      tags: values.tags,
      visibility: values.visibility,
    };

    setKnowledgeItems((current) => [item, ...current]);
    setKnowledgeDrawerOpen(false);
    setPage("knowledge");
    messageApi.success("知识条目已保存为草稿，审核后可进入 Agent 检索范围");
  }

  function createConnector(kind: ConnectorKind, values: ConnectorFormValues) {
    const connector: ConnectorRecord = {
      key: `${kind.toLowerCase()}_${Date.now()}`,
      kind,
      name: values.name,
      description: kind === "MCP" ? `${values.command} · 待自检` : `${values.command} · command template`,
      status: "待检查",
      risk: values.risk,
      binding: values.binding,
    };

    setConnectors((current) => [connector, ...current]);
    setConnectorDrawer({ open: false, kind });
    setPage("connectors");
    messageApi.success(`${kind} 连接器已注册，下一步可运行健康检查`);
  }

  function updateTaskStatus(taskKey: string, status: TaskStatus) {
    setTasks((current) =>
      current.map((task) => (task.key === taskKey ? { ...task, status, updatedAt: nowLabel() } : task)),
    );
    setSelectedTask((current) => (current.key === taskKey ? { ...current, status, updatedAt: nowLabel() } : current));
    messageApi.info(`任务状态已更新为：${taskStatusMeta[status].label}`);
  }

  function respondApproval(approvalKey: string, decision: ApprovalRecord["status"]) {
    const approval = approvals.find((item) => item.key === approvalKey);
    setApprovals((current) => current.map((item) => (item.key === approvalKey ? { ...item, status: decision } : item)));

    if (approval?.taskKey && decision === "allowed") {
      updateTaskStatus(approval.taskKey, "running");
    }

    if (decision === "denied" && approval?.taskKey) {
      updateTaskStatus(approval.taskKey, "paused");
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
          onCancel={() => setTaskModalOpen(false)}
          onCreate={createTask}
        />
        <AgentDrawer
          open={agentDrawerOpen}
          onClose={() => setAgentDrawerOpen(false)}
          onCreate={createAgent}
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
                <TaskRunPanel task={selectedTask} />
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
        return <AgentsPage agents={agents} onCreate={() => setAgentDrawerOpen(true)} />;
      case "plugins":
        return <PluginsPage onStart={() => setPluginOpen(true)} />;
      case "knowledge":
        return <KnowledgePage knowledgeItems={knowledgeItems} onCreate={() => setKnowledgeDrawerOpen(true)} />;
      case "connectors":
        return (
          <ConnectorsPage
            connectors={connectors}
            onCreateMcp={() => setConnectorDrawer({ open: true, kind: "MCP" })}
            onCreateCli={() => setConnectorDrawer({ open: true, kind: "CLI" })}
          />
        );
      case "creative":
        return <CreativePage />;
      case "workflows":
        return <WorkflowsPage />;
      case "assets":
        return <AssetsPage />;
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

function TaskActionBar({ task, onStatusChange }: { task: Task; onStatusChange: (taskKey: string, status: TaskStatus) => void }) {
  const canPause = task.status === "running" || task.status === "queued";
  const canResume = task.status === "paused" || task.status === "approval";
  const canRetry = task.status === "failed" || task.status === "cancelled";

  return (
    <Flex wrap gap={8} className="task-actions">
      <Button disabled={!canPause} onClick={() => onStatusChange(task.key, "paused")}>暂停</Button>
      <Button disabled={!canResume} onClick={() => onStatusChange(task.key, "running")}>继续</Button>
      <Button disabled={!canRetry} onClick={() => onStatusChange(task.key, "queued")}>重试</Button>
      <Button danger disabled={task.status === "done" || task.status === "cancelled"} onClick={() => onStatusChange(task.key, "cancelled")}>停止</Button>
    </Flex>
  );
}

function TaskRunPanel({ task }: { task: Task }) {
  const items = [
    {
      color: "blue",
      content: `run.created · ${task.title}`,
    },
    {
      color: task.status === "failed" ? "red" : "green",
      content: `context.bound · ${task.owner} / ${task.runtime}`,
    },
    {
      color: task.status === "approval" ? "gold" : "blue",
      content: task.status === "approval" ? "approval.requested · 等待能力授权" : "tool_call.completed · 知识与连接器上下文已准备",
    },
    {
      color: task.status === "done" ? "green" : "gray",
      content: task.status === "done" ? "artifact.created · 产物已写入 Studio" : "artifact.pending · 等待运行输出",
    },
  ];

  return (
    <Card title="运行事件" extra={<Tag>{task.runtime}</Tag>}>
      <Timeline items={items} />
    </Card>
  );
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

function AgentsPage({ agents, onCreate }: { agents: AgentRecord[]; onCreate: () => void }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card title="Agent 列表" extra={<Button type="primary" onClick={onCreate}>创建 Agent</Button>}>
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
        <Card title="团队编排">
          <Steps
            size="small"
            current={3}
            items={[
              { title: "选题" },
              { title: "写作" },
              { title: "设计" },
              { title: "审核" },
              { title: "发布包" },
            ]}
          />
          <Form layout="vertical" className="top-gap">
            <Form.Item label="审核员系统提示词">
              <Input.TextArea
                rows={6}
                value="检查事实、平台格式、敏感风险、品牌语气和发布完整性。涉及真实账号写入或提交时必须请求人工审批。"
                readOnly
              />
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}

function PluginsPage({ onStart }: { onStart: () => void }) {
  const plugins = [
    ["自媒体周更", "热榜采集、正文生成、封面 brief、审核、发布包", "内置", "success"],
    ["代码需求实现", "需求澄清、代码修改、测试、diff 审批、变更摘要", "P0", "processing"],
    ["产品上线宣传包", "Landing page、PPT、社媒图、短视频脚本和导出包", "需授权", "warning"],
  ];
  return (
    <Card title="Workflow Plugins" extra={<Button type="primary">安装插件</Button>}>
      <Row gutter={[16, 16]}>
        {plugins.map(([name, desc, label, color]) => (
          <Col xs={24} lg={8} key={name}>
            <Card
              className="plugin-card"
              title={name}
              extra={<Tag color={color}>{label}</Tag>}
              actions={[<Button key="start" type={name === "自媒体周更" ? "primary" : "default"} onClick={onStart}>启动</Button>]}
            >
              <Paragraph>{desc}</Paragraph>
              <Space wrap>
                <Tag>Discovery</Tag>
                <Tag>Generate</Tag>
                <Tag>Critique</Tag>
                <Tag>Handoff</Tag>
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
}: {
  connectors: ConnectorRecord[];
  onCreateMcp: () => void;
  onCreateCli: () => void;
}) {
  return (
    <Space orientation="vertical" size={16} className="full-width">
      <Card title="MCP 与 CLI 连接器" extra={<Space><Button onClick={onCreateCli}>注册 CLI</Button><Button type="primary" onClick={onCreateMcp}>添加 MCP</Button></Space>}>
        <Row gutter={[16, 16]}>
          {connectors.map((connector) => (
            <Col xs={24} md={12} xl={6} key={connector.key}>
              <Card title={connector.name} extra={<Tag color={connector.kind === "MCP" ? "blue" : "purple"}>{connector.kind}</Tag>}>
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

function WorkflowsPage() {
  return (
    <Card title="工作流模板" extra={<Button type="primary">新建流程</Button>}>
      <Row gutter={[16, 16]}>
        {["自媒体周更", "编码需求实现", "运营日报"].map((name, index) => (
          <Col xs={24} md={8} key={name}>
            <Card title={name}>
              <Text type="secondary">{index === 0 ? "Discovery → Generate → Critique → Handoff" : index === 1 ? "Plan → Patch → Test → Review" : "Schedule → Fetch → Summarize → Sync"}</Text>
              <Progress percent={[88, 62, 74][index]} className="top-gap" />
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );
}

function AssetsPage() {
  return (
    <Card title="资产库" extra={<Button>批量导出</Button>}>
      <Table
        rowKey="file"
        pagination={false}
        columns={[
          { title: "文件", dataIndex: "file" },
          { title: "类型", dataIndex: "type", render: (value) => <Tag color="blue">{value}</Tag> },
          { title: "来源", dataIndex: "source" },
          { title: "更新时间", dataIndex: "updatedAt" },
        ]}
        dataSource={[
          { file: "AI Agent 工作流正文.md", type: "MD", source: "文案 Agent", updatedAt: "2 分钟前" },
          { file: "公众号封面 16-9.png", type: "PNG", source: "设计 Agent", updatedAt: "8 分钟前" },
          { file: "发布包.zip", type: "ZIP", source: "发布 Agent", updatedAt: "23 分钟前" },
          { file: "capability-gate.diff", type: "DIFF", source: "Codex", updatedAt: "1 小时前" },
        ]}
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
  onRespond: (approvalKey: string, decision: ApprovalRecord["status"]) => void;
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
                <Button onClick={() => onRespond(approval.key, "denied")}>拒绝</Button>
                <Button>编辑参数</Button>
                <Button type="primary" onClick={() => onRespond(approval.key, "allowed")}>允许本次</Button>
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
  onCancel,
  onCreate,
}: {
  open: boolean;
  agents: AgentRecord[];
  onCancel: () => void;
  onCreate: (values: TaskFormValues) => void;
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
          targetId: "team_content_ops",
          priority: "normal",
          requiresApproval: true,
        }}
        onValuesChange={(changed) => {
          if (changed.targetType) {
            const nextTarget = changed.targetType === "agent" ? agents[0]?.key : changed.targetType === "plugin" ? "自媒体周更插件" : "team_content_ops";
            form.setFieldValue("targetId", nextTarget);
          }
        }}
        onFinish={(values) => {
          onCreate(values);
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
  onCreate: (values: AgentFormValues) => void;
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
          onCreate(values);
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

function KnowledgeDrawer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: KnowledgeFormValues) => void;
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
          onCreate(values);
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
  onCreate: (kind: ConnectorKind, values: ConnectorFormValues) => void;
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
          onCreate(kind, values);
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
