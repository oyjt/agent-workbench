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
  Flex,
  Form,
  Input,
  Layout,
  List,
  Menu,
  Modal,
  Progress,
  Radio,
  Row,
  Segmented,
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

type TaskStatus = "approval" | "running" | "done" | "failed";

type Task = {
  key: string;
  title: string;
  description: string;
  owner: string;
  runtime: string;
  status: TaskStatus;
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

const tasks: Task[] = [
  {
    key: "media",
    title: "公众号周更：AI Agent 工作流",
    description: "选题、正文、封面、发布包",
    owner: "内容团队",
    runtime: "BrowserOps",
    status: "approval",
  },
  {
    key: "coding",
    title: "实现 Plugin Capability Gate",
    description: "权限弹窗与审计记录",
    owner: "开发工程师",
    runtime: "Codex",
    status: "running",
  },
  {
    key: "creative",
    title: "产品上线宣传包",
    description: "Landing page、PPT、海报",
    owner: "Creative Studio",
    runtime: "OpenCode",
    status: "done",
  },
  {
    key: "ops",
    title: "竞品账号内容趋势复盘",
    description: "热榜、评论、互动指标",
    owner: "运营 Agent",
    runtime: "BrowserOps",
    status: "failed",
  },
];

function statusTag(status: TaskStatus) {
  const map = {
    approval: <Tag color="warning">待审批</Tag>,
    running: <Tag color="processing">运行中</Tag>,
    done: <Tag color="success">已完成</Tag>,
    failed: <Tag color="error">需处理</Tag>,
  };
  return map[status];
}

export default function App() {
  const [page, setPage] = useState<PageKey>("overview");
  const [selectedTask, setSelectedTask] = useState<Task>(tasks[0]);
  const [taskFilter, setTaskFilter] = useState<string>("全部");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);

  const filteredTasks = useMemo(() => {
    if (taskFilter === "全部") return tasks;
    if (taskFilter === "审批") return tasks.filter((task) => task.status === "approval");
    return tasks.filter((task) => task.status === "failed");
  }, [taskFilter]);

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

  return (
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
            <Flex justify="space-between"><span>Codex</span><Badge status="success" text="2" /></Flex>
            <Flex justify="space-between"><span>OpenCode</span><Badge status="success" text="1" /></Flex>
            <Flex justify="space-between"><span>BrowserOps</span><Badge status="warning" text="1" /></Flex>
            <Flex justify="space-between"><span>Creative</span><Badge status="default" text="0" /></Flex>
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
            <Button type="primary">新建任务</Button>
          </Space>
        </Header>
        <Content className="app-content">{renderPage()}</Content>
      </Layout>

      <ApprovalDrawer open={approvalOpen} onClose={() => setApprovalOpen(false)} />
      <PluginModal
        open={pluginOpen}
        onCancel={() => setPluginOpen(false)}
        onOk={() => {
          setPluginOpen(false);
          message.success("已记录本次授权，插件运行已加入任务队列");
        }}
      />
    </Layout>
  );

  function renderPage() {
    switch (page) {
      case "overview":
        return (
          <Space orientation="vertical" size={16} className="full-width">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={5}><Card><Statistic title="运行中任务" value={6} suffix="个" /></Card></Col>
              <Col xs={24} sm={12} lg={5}><Card><Statistic title="今日产物" value={24} suffix="个" /></Card></Col>
              <Col xs={24} sm={12} lg={5}><Card><Statistic title="知识引用" value={38} suffix="次" /></Card></Col>
              <Col xs={24} sm={12} lg={5}><Card><Statistic title="插件运行" value={9} suffix="次" /></Card></Col>
              <Col xs={24} sm={12} lg={4}><Card><Statistic title="风险动作" value={4} styles={{ content: { color: "#faad14" } }} /></Card></Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={15}>
                <Card
                  title="任务队列"
                  extra={<Segmented options={["全部", "审批", "异常"]} value={taskFilter} onChange={(value) => setTaskFilter(String(value))} />}
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
                  <Steps
                    orientation="vertical"
                    current={2}
                    items={[
                      { title: "Discovery", content: "热榜、竞品和历史素材已整理" },
                      { title: "Generate", content: "正文草稿、标题和封面 brief 已生成" },
                      { title: "Approval", content: "准备写入公众号草稿箱" },
                      { title: "Handoff", content: "导出发布包和复盘卡片" },
                    ]}
                  />
                  <Card size="small" className="approval-card">
                    <Flex justify="space-between" align="center" gap={12}>
                      <div>
                        <Tag color="warning">中风险</Tag>
                        <Paragraph className="approval-copy">浏览器写入草稿箱，不提交发布。</Paragraph>
                      </div>
                      <Button type="primary" onClick={() => setApprovalOpen(true)}>处理审批</Button>
                    </Flex>
                  </Card>
                </Card>
              </Col>
            </Row>

            <ArtifactSnapshot onOpenStudio={() => setPage("creative")} />
          </Space>
        );
      case "agents":
        return <AgentsPage />;
      case "plugins":
        return <PluginsPage onStart={() => setPluginOpen(true)} />;
      case "knowledge":
        return <KnowledgePage />;
      case "connectors":
        return <ConnectorsPage />;
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

function AgentsPage() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card title="Agent 列表" extra={<Button type="primary">创建 Agent</Button>}>
          <Table
            rowKey="name"
            pagination={false}
            columns={[
              { title: "名称", dataIndex: "name" },
              { title: "Runtime", dataIndex: "runtime" },
              { title: "能力", dataIndex: "capability" },
              { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "运行中" ? "processing" : "success"}>{value}</Tag> },
            ]}
            dataSource={[
              { name: "内容选题 Agent", runtime: "BrowserOps", capability: "4 Skills · 2 MCP", status: "启用" },
              { name: "开发工程师", runtime: "Codex", capability: "3 Skills · 3 CLI", status: "运行中" },
              { name: "设计素材 Agent", runtime: "OpenCode", capability: "2 Plugins", status: "启用" },
            ]}
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
              actions={[<Button type={name === "自媒体周更" ? "primary" : "default"} onClick={onStart}>启动</Button>]}
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

function KnowledgePage() {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Card title="团队知识库" extra={<Button type="primary">新增知识</Button>}>
          <Tabs
            items={["全部", "SOP", "品牌", "平台规则", "决策"].map((label) => ({
              key: label,
              label,
              children: (
                <List
                  dataSource={[
                    ["公众号发布前审核 SOP", "SOP · 今天 09:42 · 引用 12 次", "已审核"],
                    ["BRAND.md：品牌语气与视觉规范", "契约 · 全团队 · 当前版本", "契约"],
                    ["小红书标签与标题规则", "平台规则 · 下周复核", "将过期"],
                  ]}
                  renderItem={(item) => (
                    <List.Item actions={[<Tag color={item[2] === "将过期" ? "warning" : "success"}>{item[2]}</Tag>]}>
                      <List.Item.Meta title={item[0]} description={item[1]} />
                    </List.Item>
                  )}
                />
              ),
            }))}
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
      </Col>
    </Row>
  );
}

function ConnectorsPage() {
  const connectors = [
    ["GitHub MCP", "stdio · 12 tools · 绑定开发工程师", "在线", "success"],
    ["Filesystem MCP", "工作区只读默认 · 写入需审批", "在线", "success"],
    ["pnpm build", "command template · timeout 120s", "CLI", "processing"],
    ["ffmpeg render", "视频 worker 渲染和转码", "待检查", "warning"],
  ];
  return (
    <Card title="MCP 与 CLI 连接器" extra={<Space><Button>注册 CLI</Button><Button type="primary">添加 MCP</Button></Space>}>
      <Row gutter={[16, 16]}>
        {connectors.map(([name, desc, status, color]) => (
          <Col xs={24} md={12} xl={6} key={name}>
            <Card title={name} extra={<Tag color={color}>{status}</Tag>}>
              <Paragraph>{desc}</Paragraph>
              <Space wrap><Tag>allowlist</Tag><Tag>audit</Tag></Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
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
+ artifact manifest 增加 contractVersions
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
          <List
            dataSource={["Codex CLI", "OpenCode", "GenericAgent Worker"]}
            renderItem={(item, index) => (
              <List.Item actions={[<Switch defaultChecked={index < 2} />]}>
                <List.Item.Meta title={item} description={index === 2 ? "127.0.0.1:3917" : "已连接"} />
              </List.Item>
            )}
          />
        </Card>
      </Col>
      <Col xs={24} xl={12}>
        <Card title="安全策略">
          <Radio.Group defaultValue="collab" optionType="button" buttonStyle="solid">
            <Radio value="auto">自动化</Radio>
            <Radio value="collab">协作</Radio>
            <Radio value="strict">保守</Radio>
          </Radio.Group>
          <List
            className="top-gap"
            dataSource={["插件安装：需要确认", "真实账号发布：禁止自动提交", "Secret 注入：仅运行时"]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
        </Card>
      </Col>
    </Row>
  );
}

function ApprovalDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer title="审批请求" open={open} onClose={onClose} size={480}>
      <Card className="approval-card">
        <Tag color="warning">中风险</Tag>
        <Title level={4}>发布 Agent 请求浏览器输入</Title>
        <Paragraph>目标：微信公众平台草稿箱。动作：填入标题、正文和封面，不提交发布。</Paragraph>
      </Card>
      <Descriptions column={1} bordered size="small" className="top-gap">
        <Descriptions.Item label="来源 Agent">发布 Agent</Descriptions.Item>
        <Descriptions.Item label="来源 Plugin">自媒体周更</Descriptions.Item>
        <Descriptions.Item label="权限">browser:input · files:read</Descriptions.Item>
        <Descriptions.Item label="审计">将记录截图、DOM 摘要和输入参数</Descriptions.Item>
      </Descriptions>
      <Flex justify="end" gap={8} className="drawer-actions">
        <Button onClick={onClose}>拒绝</Button>
        <Button>编辑参数</Button>
        <Button type="primary" onClick={onClose}>允许本次</Button>
      </Flex>
    </Drawer>
  );
}

function PluginModal({ open, onCancel, onOk }: { open: boolean; onCancel: () => void; onOk: () => void }) {
  return (
    <Modal title="启动插件：自媒体周更" open={open} onCancel={onCancel} onOk={onOk} okText="授权并启动" cancelText="取消">
      <Paragraph type="secondary">确认本次运行将使用的能力。</Paragraph>
      <Space orientation="vertical">
        <Switch defaultChecked /> <Text>`network:read` 读取热榜与竞品页面</Text>
        <Switch defaultChecked /> <Text>`knowledge:read` 检索 BRAND.md / CONTENT.md / SOP</Text>
        <Switch defaultChecked /> <Text>`files:write` 写入 artifact project</Text>
        <Switch /> <Text>`browser:input` 写入公众号草稿箱</Text>
      </Space>
    </Modal>
  );
}
