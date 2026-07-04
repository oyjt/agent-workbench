import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.AGENT_WORKBENCH_DATA_DIR ?? resolve(projectRoot, ".agent-workbench", "data");
const dbPath = resolve(dataDir, "workbench.sqlite");
const distDir = resolve(projectRoot, "dist");
const port = Number(process.env.AGENT_WORKBENCH_API_PORT ?? 8787);
const host = process.env.AGENT_WORKBENCH_API_HOST ?? "127.0.0.1";

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath, { timeout: 5000 });
const sseClients = new Map();

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    prompt TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    owner TEXT NOT NULL,
    runtime TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    requires_approval INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
  ) STRICT;

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    runtime TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    skill_ids TEXT NOT NULL,
    knowledge_scope TEXT NOT NULL,
    permission_profile TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL,
    visibility TEXT NOT NULL,
    status TEXT NOT NULL,
    source_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    command TEXT NOT NULL,
    risk TEXT NOT NULL,
    binding TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    risk TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS agent_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    workflow TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS agent_team_members (
    team_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,
    member_order INTEGER NOT NULL,
    PRIMARY KEY (team_id, agent_id, role)
  ) STRICT;

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    run_id TEXT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    summary TEXT NOT NULL,
    source TEXT NOT NULL,
    path TEXT NOT NULL,
    manifest TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    provider TEXT NOT NULL,
    concurrency INTEGER NOT NULL,
    tags TEXT NOT NULL,
    steps TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_events_run_id_created_at ON events(run_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
  CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);
`);

const insertTask = db.prepare(`
  INSERT INTO tasks (
    id, title, prompt, target_type, target_id, owner, runtime, status, priority,
    requires_approval, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertRun = db.prepare(`
  INSERT INTO runs (id, task_id, status, started_at, completed_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertEvent = db.prepare(`
  INSERT INTO events (id, run_id, type, payload, created_at)
  VALUES (?, ?, ?, ?, ?)
`);
const listTasks = db.prepare(`
  SELECT
    tasks.*,
    runs.id AS run_id
  FROM tasks
  LEFT JOIN runs ON runs.task_id = tasks.id
  ORDER BY tasks.created_at DESC
`);
const listEvents = db.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY created_at ASC");
const getRun = db.prepare("SELECT * FROM runs WHERE id = ?");
const getTask = db.prepare("SELECT * FROM tasks WHERE id = ?");
const getLatestRunByTask = db.prepare("SELECT * FROM runs WHERE task_id = ? ORDER BY created_at DESC LIMIT 1");
const getPendingApprovalByTask = db.prepare("SELECT * FROM approvals WHERE task_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1");
const updateTaskStatusStatement = db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?");
const updateRunStatusStatement = db.prepare("UPDATE runs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?");
const insertAgent = db.prepare(`
  INSERT INTO agents (
    id, name, description, runtime, model, system_prompt, skill_ids, knowledge_scope,
    permission_profile, status, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listAgents = db.prepare("SELECT * FROM agents ORDER BY created_at DESC");
const updateAgentStatusStatement = db.prepare("UPDATE agents SET status = ?, updated_at = ? WHERE id = ?");
const insertKnowledgeItem = db.prepare(`
  INSERT INTO knowledge_items (
    id, title, type, content, tags, visibility, status, source_url, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listKnowledgeItems = db.prepare("SELECT * FROM knowledge_items ORDER BY created_at DESC");
const insertConnector = db.prepare(`
  INSERT INTO connectors (
    id, kind, name, description, command, risk, binding, status, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listConnectors = db.prepare("SELECT * FROM connectors ORDER BY created_at DESC");
const updateConnectorStatusStatement = db.prepare("UPDATE connectors SET status = ?, updated_at = ? WHERE id = ?");
const getConnector = db.prepare("SELECT * FROM connectors WHERE id = ?");
const getTeam = db.prepare("SELECT * FROM agent_teams WHERE id = ?");
const insertApproval = db.prepare(`
  INSERT INTO approvals (
    id, task_id, title, source, risk, capabilities, status, reason, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listApprovals = db.prepare("SELECT * FROM approvals ORDER BY created_at DESC");
const listApprovalsByStatus = db.prepare("SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC");
const getApproval = db.prepare("SELECT * FROM approvals WHERE id = ?");
const updateApprovalStatusStatement = db.prepare("UPDATE approvals SET status = ?, updated_at = ? WHERE id = ?");
const insertTeam = db.prepare(`
  INSERT INTO agent_teams (id, name, workflow, description, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertTeamMember = db.prepare(`
  INSERT INTO agent_team_members (team_id, agent_id, role, member_order)
  VALUES (?, ?, ?, ?)
`);
const listTeams = db.prepare("SELECT * FROM agent_teams ORDER BY created_at DESC");
const listTeamMembers = db.prepare("SELECT * FROM agent_team_members WHERE team_id = ? ORDER BY member_order ASC");
const insertArtifact = db.prepare(`
  INSERT INTO artifacts (
    id, task_id, run_id, name, kind, summary, source, path, manifest, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listArtifacts = db.prepare("SELECT * FROM artifacts ORDER BY created_at DESC");
const insertWorkflow = db.prepare(`
  INSERT INTO workflows (
    id, name, description, provider, concurrency, tags, steps, status, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listWorkflows = db.prepare("SELECT * FROM workflows ORDER BY created_at DESC");

if (process.argv.includes("--init")) {
  console.log(JSON.stringify({ ok: true, dbPath, schema: ["tasks", "runs", "events", "agents", "knowledge_items", "connectors", "approvals", "agent_teams", "artifacts", "workflows"] }, null, 2));
  db.close();
  process.exit(0);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${host}:${port}`}`);

    if (request.method === "OPTIONS") {
      sendEmpty(response, 204);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, dbPath, service: "agent-workbench-api" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/tasks") {
      sendJson(response, 200, { tasks: listTasks.all().map(taskFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/tasks") {
      const body = await readJson(request);
      const result = createTask(body);
      sendJson(response, 201, result);
      return;
    }

    const taskStatusMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/status$/);
    if (request.method === "POST" && taskStatusMatch) {
      const body = await readJson(request);
      updateTaskAndRunStatus(taskStatusMatch[1], requiredString(body.status, "status"));
      sendJson(response, 200, { ok: true });
      return;
    }

    const taskStartMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/start$/);
    if (request.method === "POST" && taskStartMatch) {
      const result = startTask(taskStartMatch[1]);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/agents") {
      sendJson(response, 200, { agents: listAgents.all().map(agentFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/agents") {
      const body = await readJson(request);
      const agent = createAgent(body);
      sendJson(response, 201, { agent });
      return;
    }

    const agentStatusMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/status$/);
    if (request.method === "POST" && agentStatusMatch) {
      const body = await readJson(request);
      updateAgentStatusStatement.run(requiredString(body.status, "status"), new Date().toISOString(), agentStatusMatch[1]);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/knowledge-items") {
      sendJson(response, 200, { knowledgeItems: listKnowledgeItems.all().map(knowledgeFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/knowledge-items") {
      const body = await readJson(request);
      const knowledgeItem = createKnowledgeItem(body);
      sendJson(response, 201, { knowledgeItem });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/connectors") {
      sendJson(response, 200, { connectors: listConnectors.all().map(connectorFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/connectors") {
      const body = await readJson(request);
      const connector = createConnector(body);
      sendJson(response, 201, { connector });
      return;
    }

    const connectorCheckMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)\/check$/);
    if (request.method === "POST" && connectorCheckMatch) {
      const connector = ensureConnector(connectorCheckMatch[1]);
      const status = connector.kind === "CLI" ? "CLI" : "在线";
      updateConnectorStatusStatement.run(status, new Date().toISOString(), connector.id);
      sendJson(response, 200, { ok: true, status });
      return;
    }

    const connectorInvokeMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)\/invoke$/);
    if (request.method === "POST" && connectorInvokeMatch) {
      const body = await readJson(request);
      const result = invokeConnector(connectorInvokeMatch[1], body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/approvals") {
      const status = url.searchParams.get("status");
      const rows = status ? listApprovalsByStatus.all(status) : listApprovals.all();
      sendJson(response, 200, { approvals: rows.map(approvalFromRow) });
      return;
    }

    const approvalRespondMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/respond$/);
    if (request.method === "POST" && approvalRespondMatch) {
      const body = await readJson(request);
      const result = respondApproval(approvalRespondMatch[1], requiredString(body.decision, "decision"));
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/agent-teams") {
      sendJson(response, 200, { teams: listTeams.all().map(teamFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/agent-teams") {
      const body = await readJson(request);
      const team = createAgentTeam(body);
      sendJson(response, 201, { team });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/artifacts") {
      sendJson(response, 200, { artifacts: listArtifacts.all().map(artifactFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/artifacts") {
      const body = await readJson(request);
      const artifact = createArtifact(body);
      sendJson(response, 201, { artifact });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/workflows") {
      sendJson(response, 200, { workflows: listWorkflows.all().map(workflowFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/workflows") {
      const body = await readJson(request);
      const workflow = createWorkflow(body);
      sendJson(response, 201, { workflow });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/skills/scan") {
      sendJson(response, 200, { skills: scanSkills() });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/plugins/scan") {
      sendJson(response, 200, { plugins: scanWorkflowPlugins() });
      return;
    }

    const eventJsonMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events\.json$/);
    if (request.method === "GET" && eventJsonMatch) {
      const runId = eventJsonMatch[1];
      ensureRun(runId);
      sendJson(response, 200, { events: listEvents.all(runId).map(eventFromRow) });
      return;
    }

    const createEventMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (request.method === "POST" && createEventMatch) {
      const runId = createEventMatch[1];
      ensureRun(runId);
      const body = await readJson(request);
      const event = appendEvent(runId, body.type ?? "message", body.payload ?? {});
      sendJson(response, 201, { event });
      return;
    }

    if (request.method === "GET" && createEventMatch) {
      const runId = createEventMatch[1];
      ensureRun(runId);
      sendSse(request, response, runId);
      return;
    }

    if ((request.method === "GET" || request.method === "HEAD") && serveStatic(request, response, url.pathname)) {
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Agent Workbench API listening on http://${host}:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function createTask(body) {
  if (!body || typeof body !== "object") {
    throw new Error("invalid_json_body");
  }

  const title = requiredString(body.title, "title");
  const prompt = requiredString(body.prompt, "prompt");
  const targetType = requiredString(body.targetType, "targetType");
  const targetId = requiredString(body.targetId, "targetId");
  const owner = stringOr(body.owner, "内容团队");
  const runtime = stringOr(body.runtime, "BrowserOps");
  const priority = stringOr(body.priority, "normal");
  const requiresApproval = body.requiresApproval ? 1 : 0;
  const status = requiresApproval ? "approval" : "queued";
  const now = new Date().toISOString();
  const taskId = createId("task");
  const runId = createId("run");

  insertTask.run(
    taskId,
    title,
    prompt,
    targetType,
    targetId,
    owner,
    runtime,
    status,
    priority,
    requiresApproval,
    now,
    now,
  );
  insertRun.run(runId, taskId, status, status === "queued" ? now : null, null, now, now);
  const events = [
    appendEvent(runId, "task.created", { taskId, title, targetType, targetId }),
    appendEvent(runId, "run.created", { runId, status }),
  ];
  let approval = null;

  if (requiresApproval) {
    approval = createApproval({
      taskId,
      title: "任务启动 capability gate",
      source: `${targetId} / ${targetType}`,
      risk: priority === "high" ? "high" : "medium",
      capabilities: Array.isArray(body.capabilities) ? body.capabilities : ["network:read", "files:write"],
      reason: "任务创建时要求启动前审批。",
    });
    events.push(appendEvent(runId, "approval.requested", { approvalId: approval.id, risk: approval.risk }));
  }

  return {
    taskId,
    runId,
    status,
    approval,
    task: {
      id: taskId,
      runId,
      title,
      prompt,
      targetType,
      targetId,
      owner,
      runtime,
      status,
      priority,
      requiresApproval: Boolean(requiresApproval),
      createdAt: now,
      updatedAt: now,
    },
    events,
  };
}

function createAgent(body) {
  const now = new Date().toISOString();
  const agent = {
    id: createId("agent"),
    name: requiredString(body.name, "name"),
    description: requiredString(body.description, "description"),
    runtime: stringOr(body.runtime, "Codex"),
    model: stringOr(body.model, "gpt-5.4"),
    systemPrompt: stringOr(body.systemPrompt, ""),
    skillIds: Array.isArray(body.skillIds) ? body.skillIds : [],
    knowledgeScope: stringOr(body.knowledgeScope, "项目知识库"),
    permissionProfile: stringOr(body.permissionProfile, "collaborative"),
    status: stringOr(body.status, "启用"),
    createdAt: now,
    updatedAt: now,
  };

  insertAgent.run(
    agent.id,
    agent.name,
    agent.description,
    agent.runtime,
    agent.model,
    agent.systemPrompt,
    JSON.stringify(agent.skillIds),
    agent.knowledgeScope,
    agent.permissionProfile,
    agent.status,
    agent.createdAt,
    agent.updatedAt,
  );
  return agent;
}

function createKnowledgeItem(body) {
  const now = new Date().toISOString();
  const knowledgeItem = {
    id: createId("knowledge"),
    title: requiredString(body.title, "title"),
    type: stringOr(body.type, "SOP"),
    content: requiredString(body.content, "content"),
    tags: Array.isArray(body.tags) ? body.tags : [],
    visibility: stringOr(body.visibility, "project"),
    status: stringOr(body.status, "草稿"),
    sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
    createdAt: now,
    updatedAt: now,
  };

  insertKnowledgeItem.run(
    knowledgeItem.id,
    knowledgeItem.title,
    knowledgeItem.type,
    knowledgeItem.content,
    JSON.stringify(knowledgeItem.tags),
    knowledgeItem.visibility,
    knowledgeItem.status,
    knowledgeItem.sourceUrl,
    knowledgeItem.createdAt,
    knowledgeItem.updatedAt,
  );
  return knowledgeItem;
}

function createConnector(body) {
  const now = new Date().toISOString();
  const kind = requiredString(body.kind, "kind");
  const connector = {
    id: createId(kind.toLowerCase()),
    kind,
    name: requiredString(body.name, "name"),
    description: requiredString(body.description, "description"),
    command: requiredString(body.command, "command"),
    risk: stringOr(body.risk, "medium"),
    binding: stringOr(body.binding, "未绑定"),
    status: stringOr(body.status, "待检查"),
    createdAt: now,
    updatedAt: now,
  };

  insertConnector.run(
    connector.id,
    connector.kind,
    connector.name,
    connector.description,
    connector.command,
    connector.risk,
    connector.binding,
    connector.status,
    connector.createdAt,
    connector.updatedAt,
  );
  return connector;
}

function createApproval(body) {
  const now = new Date().toISOString();
  const approval = {
    id: createId("approval"),
    taskId: requiredString(body.taskId, "taskId"),
    title: requiredString(body.title, "title"),
    source: requiredString(body.source, "source"),
    risk: stringOr(body.risk, "medium"),
    capabilities: Array.isArray(body.capabilities) ? body.capabilities : [],
    status: "pending",
    reason: requiredString(body.reason, "reason"),
    createdAt: now,
    updatedAt: now,
  };

  insertApproval.run(
    approval.id,
    approval.taskId,
    approval.title,
    approval.source,
    approval.risk,
    JSON.stringify(approval.capabilities),
    approval.status,
    approval.reason,
    approval.createdAt,
    approval.updatedAt,
  );
  return approval;
}

function respondApproval(approvalId, decision) {
  const approval = getApproval.get(approvalId);
  if (!approval) throw new Error("approval_not_found");

  const status = decision === "allow_once" || decision === "allow_session" || decision === "allowed" ? "allowed" : "denied";
  const taskStatus = status === "allowed" ? "running" : "paused";
  const now = new Date().toISOString();
  updateApprovalStatusStatement.run(status, now, approvalId);
  updateTaskAndRunStatus(approval.task_id, taskStatus);
  return { ok: true, status, taskStatus };
}

function createAgentTeam(body) {
  const now = new Date().toISOString();
  const team = {
    id: createId("team"),
    name: requiredString(body.name, "name"),
    workflow: stringOr(body.workflow, "lead_sequential"),
    description: stringOr(body.description, ""),
    status: stringOr(body.status, "启用"),
    members: Array.isArray(body.members) ? body.members : [],
    createdAt: now,
    updatedAt: now,
  };

  insertTeam.run(team.id, team.name, team.workflow, team.description, team.status, team.createdAt, team.updatedAt);
  team.members.forEach((member, index) => {
    insertTeamMember.run(
      team.id,
      requiredString(member.agentId, "agentId"),
      stringOr(member.role, `step_${index + 1}`),
      Number.isFinite(member.order) ? member.order : index,
    );
  });
  return team;
}

function createArtifact(body) {
  const now = new Date().toISOString();
  const artifact = {
    id: createId("artifact"),
    taskId: typeof body.taskId === "string" ? body.taskId : null,
    runId: typeof body.runId === "string" ? body.runId : null,
    name: requiredString(body.name, "name"),
    kind: stringOr(body.kind, "markdown"),
    summary: stringOr(body.summary, ""),
    source: stringOr(body.source, "manual"),
    path: stringOr(body.path, ""),
    manifest: body.manifest && typeof body.manifest === "object" ? body.manifest : {},
    createdAt: now,
    updatedAt: now,
  };

  insertArtifact.run(
    artifact.id,
    artifact.taskId,
    artifact.runId,
    artifact.name,
    artifact.kind,
    artifact.summary,
    artifact.source,
    artifact.path,
    JSON.stringify(artifact.manifest),
    artifact.createdAt,
    artifact.updatedAt,
  );
  return artifact;
}

function createWorkflow(body) {
  const now = new Date().toISOString();
  const workflow = {
    id: createId("workflow"),
    name: requiredString(body.name, "name"),
    description: stringOr(body.description, ""),
    provider: stringOr(body.provider, "codex-cli"),
    concurrency: Number.isFinite(body.concurrency) ? body.concurrency : 1,
    tags: Array.isArray(body.tags) ? body.tags : [],
    steps: Array.isArray(body.steps) ? body.steps : [],
    status: stringOr(body.status, "draft"),
    createdAt: now,
    updatedAt: now,
  };

  insertWorkflow.run(
    workflow.id,
    workflow.name,
    workflow.description,
    workflow.provider,
    workflow.concurrency,
    JSON.stringify(workflow.tags),
    JSON.stringify(workflow.steps),
    workflow.status,
    workflow.createdAt,
    workflow.updatedAt,
  );
  return workflow;
}

function updateTaskAndRunStatus(taskId, status) {
  const now = new Date().toISOString();
  updateTaskStatusStatement.run(status, now, taskId);
  const run = getLatestRunByTask.get(taskId);
  if (run) {
    updateRunStatusStatement.run(status, now, ["done", "failed", "cancelled"].includes(status) ? now : null, run.id);
    appendEvent(run.id, "run.status_changed", { status });
  }
}

function startTask(taskId) {
  const task = getTask.get(taskId);
  if (!task) throw new Error("task_not_found");

  const run = getLatestRunByTask.get(taskId);
  if (!run) throw new Error("run_not_found");

  const pendingApproval = getPendingApprovalByTask.get(taskId);
  if (pendingApproval) {
    appendEvent(run.id, "approval.waiting", {
      approvalId: pendingApproval.id,
      reason: pendingApproval.reason,
    });
    return { ok: true, status: "approval", runId: run.id, waitingApprovalId: pendingApproval.id };
  }

  updateTaskAndRunStatus(taskId, "running");
  appendEvent(run.id, "runtime.started", {
    adapter: adapterForTask(task),
    targetType: task.target_type,
    targetId: task.target_id,
  });

  if (task.target_type === "agent_team") {
    runAgentTeam(run.id, task.target_id);
  } else {
    appendEvent(run.id, "agent.started", { agentId: task.target_id, runtime: task.runtime });
    appendEvent(run.id, "message.delta", { role: "assistant", text: `${task.runtime} 正在执行：${task.title}` });
    appendEvent(run.id, "agent.completed", { agentId: task.target_id });
  }

  if (task.runtime === "Codex" || task.target_id.includes("coding")) {
    const artifact = createArtifact({
      taskId: task.id,
      runId: run.id,
      name: `${task.title} · diff.md`,
      kind: "diff",
      summary: "Codex Adapter 生成的代码变更计划和验证摘要。",
      source: "Codex",
      path: `.agent-workbench/artifacts/${task.id}/diff.md`,
      manifest: { sourceTaskId: task.id, runtime: task.runtime },
    });
    appendEvent(run.id, "adapter.codex.diff", {
      artifactId: artifact.id,
      file: "src/App.tsx",
      summary: artifact.summary,
    });
  } else {
    const artifact = createArtifact({
      taskId: task.id,
      runId: run.id,
      type: "markdown",
      name: `${task.title} · draft.md`,
      kind: "markdown",
      summary: "Runtime Adapter 生成的首版草稿。",
      source: task.runtime,
      path: `.agent-workbench/artifacts/${task.id}/draft.md`,
      manifest: { sourceTaskId: task.id, runtime: task.runtime },
    });
    appendEvent(run.id, "artifact.created", {
      artifactId: artifact.id,
      type: artifact.kind,
      title: artifact.name,
      manifest: artifact.manifest,
    });
  }

  updateTaskAndRunStatus(taskId, "done");
  return { ok: true, status: "done", runId: run.id };
}

function runAgentTeam(runId, teamId) {
  const team = getTeam.get(teamId);
  const members = team ? listTeamMembers.all(teamId) : [];

  if (members.length === 0) {
    appendEvent(runId, "team.started", { teamId, mode: "fallback_sequential" });
    appendEvent(runId, "agent.started", { role: "planner", agentId: "default_planner" });
    appendEvent(runId, "agent.completed", { role: "planner", agentId: "default_planner" });
    appendEvent(runId, "team.completed", { teamId });
    return;
  }

  appendEvent(runId, "team.started", { teamId, workflow: team.workflow });
  for (const member of members) {
    appendEvent(runId, "agent.started", { agentId: member.agent_id, role: member.role, order: member.member_order });
    appendEvent(runId, "message.delta", { role: "assistant", text: `${member.role} 已完成阶段 ${member.member_order + 1}` });
    appendEvent(runId, "agent.completed", { agentId: member.agent_id, role: member.role });
  }
  appendEvent(runId, "team.completed", { teamId });
}

function invokeConnector(connectorId, body) {
  const connector = ensureConnector(connectorId);
  const taskId = typeof body.taskId === "string" ? body.taskId : "manual";
  const run = taskId === "manual" ? null : getLatestRunByTask.get(taskId);

  if (connector.risk !== "low") {
    const approval = createApproval({
      taskId,
      title: `${connector.kind} 调用审批：${connector.name}`,
      source: `${connector.kind} Connector`,
      risk: connector.risk,
      capabilities: connector.kind === "CLI" ? ["cli:run"] : ["mcp:call"],
      reason: `${connector.name} 风险等级为 ${connector.risk}，执行前需要人工审批。`,
    });
    if (run) appendEvent(run.id, "approval.requested", { approvalId: approval.id, connectorId });
    return { ok: true, status: "approval_required", approval };
  }

  if (connector.kind !== "CLI") {
    if (run) appendEvent(run.id, "mcp.tool_call.completed", { connectorId, name: connector.name });
    return { ok: true, status: "completed", result: { message: "MCP health-call simulated" } };
  }

  const [command, ...args] = connector.command.split(" ").filter(Boolean);
  const startedAt = new Date().toISOString();
  if (run) appendEvent(run.id, "cli.started", { connectorId, command: connector.command, startedAt });
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 120000,
    shell: false,
  });
  const payload = {
    connectorId,
    command: connector.command,
    exitCode: result.status ?? 1,
    stdout: result.stdout?.slice(0, 4000) ?? "",
    stderr: result.stderr?.slice(0, 4000) ?? "",
  };
  if (run) appendEvent(run.id, "cli.completed", payload);
  return { ok: result.status === 0, status: "completed", result: payload };
}

function adapterForTask(task) {
  if (task.runtime === "Codex") return "codex-cli";
  if (task.runtime === "OpenCode") return "opencode";
  if (task.runtime === "BrowserOps") return "generic-browser-worker";
  return "local-runtime";
}

function appendEvent(runId, type, payload) {
  const event = {
    id: createId("evt"),
    runId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  insertEvent.run(event.id, runId, event.type, JSON.stringify(event.payload), event.createdAt);
  broadcastEvent(event);
  return event;
}

function sendSse(request, response, runId) {
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
  });

  for (const event of listEvents.all(runId).map(eventFromRow)) {
    writeSseEvent(response, "runtime", event);
  }

  const clients = sseClients.get(runId) ?? new Set();
  clients.add(response);
  sseClients.set(runId, clients);

  const interval = setInterval(() => {
    writeSseEvent(response, "ping", { runId, at: new Date().toISOString() });
  }, 15000);

  request.on("close", () => {
    clearInterval(interval);
    clients.delete(response);
    if (clients.size === 0) {
      sseClients.delete(runId);
    }
  });
}

function broadcastEvent(event) {
  const clients = sseClients.get(event.runId);
  if (!clients) return;

  for (const client of clients) {
    writeSseEvent(client, "runtime", event);
  }
}

function writeSseEvent(response, eventName, data) {
  response.write(`event: ${eventName}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function ensureRun(runId) {
  const run = getRun.get(runId);
  if (!run) {
    throw new Error("run_not_found");
  }
  return run;
}

function taskFromRow(row) {
  return {
    id: row.id,
    runId: row.run_id,
    title: row.title,
    prompt: row.prompt,
    targetType: row.target_type,
    targetId: row.target_id,
    owner: row.owner,
    runtime: row.runtime,
    status: row.status,
    priority: row.priority,
    requiresApproval: Boolean(row.requires_approval),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function agentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    runtime: row.runtime,
    model: row.model,
    systemPrompt: row.system_prompt,
    skillIds: JSON.parse(row.skill_ids),
    knowledgeScope: row.knowledge_scope,
    permissionProfile: row.permission_profile,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function knowledgeFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    content: row.content,
    tags: JSON.parse(row.tags),
    visibility: row.visibility,
    status: row.status,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function connectorFromRow(row) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    command: row.command,
    risk: row.risk,
    binding: row.binding,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approvalFromRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    source: row.source,
    risk: row.risk,
    capabilities: JSON.parse(row.capabilities),
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function teamFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    workflow: row.workflow,
    description: row.description,
    status: row.status,
    members: listTeamMembers.all(row.id).map((member) => ({
      agentId: member.agent_id,
      role: member.role,
      order: member.member_order,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function artifactFromRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    runId: row.run_id,
    name: row.name,
    kind: row.kind,
    summary: row.summary,
    source: row.source,
    path: row.path,
    manifest: JSON.parse(row.manifest),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function workflowFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider,
    concurrency: row.concurrency,
    tags: JSON.parse(row.tags),
    steps: JSON.parse(row.steps),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function ensureConnector(connectorId) {
  const connector = getConnector.get(connectorId);
  if (!connector) throw new Error("connector_not_found");
  return connector;
}

function scanSkills() {
  const skillsDir = resolve(projectRoot, "skills");
  if (!existsSync(skillsDir)) return [];

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillDir = join(skillsDir, entry.name);
      const skillPath = join(skillDir, "SKILL.md");
      if (!existsSync(skillPath)) return null;
      const content = readFileSync(skillPath, "utf8");
      const meta = parseFrontMatter(content);
      return {
        id: entry.name,
        name: meta.name ?? entry.name,
        description: meta.description ?? "",
        path: skillPath,
        permissions: splitList(meta.permissions),
        risk: meta.risk ?? "low",
      };
    })
    .filter(Boolean);
}

function scanWorkflowPlugins() {
  const pluginsDir = resolve(projectRoot, "plugins");
  if (!existsSync(pluginsDir)) return [];

  return readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const pluginDir = join(pluginsDir, entry.name);
      const skillPath = join(pluginDir, "SKILL.md");
      const manifestPath = join(pluginDir, "plugin.json");
      if (!existsSync(skillPath) || !existsSync(manifestPath)) return null;
      const skillContent = readFileSync(skillPath, "utf8");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const meta = parseFrontMatter(skillContent);
      return {
        id: manifest.id ?? entry.name,
        name: manifest.name ?? meta.name ?? entry.name,
        description: manifest.description ?? meta.description ?? "",
        version: manifest.version ?? "0.1.0",
        path: pluginDir,
        skills: manifest.skills ?? [],
        mcpTools: manifest.mcpTools ?? [],
        cliCommands: manifest.cliCommands ?? [],
        knowledgeScopes: manifest.knowledgeScopes ?? [],
        capabilities: manifest.capabilities ?? [],
        pipeline: manifest.pipeline ?? [],
        manifest,
      };
    })
    .filter(Boolean);
}

function parseFrontMatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const raw = content.slice(3, end).trim();
  const meta = {};
  for (const line of raw.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  }
  return meta;
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function eventFromRow(row) {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    payload: JSON.parse(row.payload),
    createdAt: row.created_at,
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`missing_${name}`);
  }
  return value.trim();
}

function stringOr(value, fallback) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readJson(request) {
  return new Promise((resolveJson, rejectJson) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy(new Error("request_too_large"));
      }
    });
    request.on("end", () => {
      try {
        resolveJson(body.length > 0 ? JSON.parse(body) : {});
      } catch {
        rejectJson(new Error("invalid_json"));
      }
    });
    request.on("error", rejectJson);
  });
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function sendEmpty(response, status) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
  });
  response.end();
}

function serveStatic(request, response, pathname) {
  if (!existsSync(distDir) || pathname.startsWith("/api/")) return false;

  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = resolve(distDir, requestedPath);
  const relativePath = relative(distDir, filePath);
  if (relativePath.startsWith("..") || relativePath.startsWith("/") || relativePath === "") {
    return false;
  }

  try {
    if (statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }
  } catch {
    filePath = join(distDir, "index.html");
  }

  if (!existsSync(filePath)) return false;

  const body = readFileSync(filePath);
  response.writeHead(200, {
    "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": contentTypeFor(filePath),
  });
  if (request.method === "HEAD") {
    response.end();
    return true;
  }
  response.end(body);
  return true;
}

function contentTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
