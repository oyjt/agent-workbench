import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.AGENT_WORKBENCH_DATA_DIR ?? resolve(projectRoot, ".agent-workbench", "data");
const dbPath = resolve(dataDir, "workbench.sqlite");
const artifactRoot = resolve(projectRoot, ".agent-workbench", "artifacts");
const distDir = resolve(projectRoot, "dist");
const port = Number(process.env.AGENT_WORKBENCH_API_PORT ?? 8787);
const host = process.env.AGENT_WORKBENCH_API_HOST ?? "127.0.0.1";

mkdirSync(dataDir, { recursive: true });
mkdirSync(artifactRoot, { recursive: true });

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

  CREATE TABLE IF NOT EXISTS artifact_versions (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    path TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_type TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS secrets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL,
    env_var TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_events_run_id_created_at ON events(run_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
  CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);
  CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_id ON artifact_versions(artifact_id, version);
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
const getArtifact = db.prepare("SELECT * FROM artifacts WHERE id = ?");
const updateArtifactPathStatement = db.prepare("UPDATE artifacts SET path = ?, updated_at = ? WHERE id = ?");
const insertArtifactVersion = db.prepare(`
  INSERT INTO artifact_versions (
    id, artifact_id, version, path, summary, content_type, bytes, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const listArtifactVersions = db.prepare("SELECT * FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC");
const getLatestArtifactVersion = db.prepare("SELECT * FROM artifact_versions WHERE artifact_id = ? ORDER BY version DESC LIMIT 1");
const countArtifactVersions = db.prepare("SELECT COUNT(*) AS count FROM artifact_versions WHERE artifact_id = ?");
const insertWorkflow = db.prepare(`
  INSERT INTO workflows (
    id, name, description, provider, concurrency, tags, steps, status, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const listWorkflows = db.prepare("SELECT * FROM workflows ORDER BY created_at DESC");
const getWorkflow = db.prepare("SELECT * FROM workflows WHERE id = ?");
const insertSecret = db.prepare(`
  INSERT INTO secrets (id, name, scope, env_var, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const listSecrets = db.prepare("SELECT * FROM secrets ORDER BY created_at DESC");
const deleteSecret = db.prepare("DELETE FROM secrets WHERE id = ?");

if (process.argv.includes("--init")) {
  console.log(JSON.stringify({ ok: true, dbPath, schema: ["tasks", "runs", "events", "agents", "knowledge_items", "connectors", "approvals", "agent_teams", "artifacts", "artifact_versions", "workflows", "secrets"] }, null, 2));
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
      const result = await checkConnector(connectorCheckMatch[1]);
      sendJson(response, 200, result);
      return;
    }

    const connectorInvokeMatch = url.pathname.match(/^\/api\/connectors\/([^/]+)\/invoke$/);
    if (request.method === "POST" && connectorInvokeMatch) {
      const body = await readJson(request);
      const result = await invokeConnector(connectorInvokeMatch[1], body);
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

    const artifactContentMatch = url.pathname.match(/^\/api\/artifacts\/([^/]+)\/content$/);
    if (request.method === "GET" && artifactContentMatch) {
      const result = readArtifactContent(artifactContentMatch[1]);
      sendJson(response, 200, result);
      return;
    }

    const artifactVersionsMatch = url.pathname.match(/^\/api\/artifacts\/([^/]+)\/versions$/);
    if (request.method === "GET" && artifactVersionsMatch) {
      sendJson(response, 200, { versions: listArtifactVersions.all(artifactVersionsMatch[1]).map(artifactVersionFromRow) });
      return;
    }

    if (request.method === "POST" && artifactVersionsMatch) {
      const body = await readJson(request);
      const version = createArtifactVersion(artifactVersionsMatch[1], body);
      sendJson(response, 201, { version });
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

    const workflowYamlMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/yaml$/);
    if (request.method === "GET" && workflowYamlMatch) {
      const workflow = ensureWorkflow(workflowYamlMatch[1]);
      sendText(response, 200, workflowToYaml(workflowFromRow(workflow)), "text/yaml; charset=utf-8");
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/workflows/import") {
      const body = await readTextOrJson(request);
      const yaml = typeof body === "string" ? body : requiredString(body.yaml, "yaml");
      const workflow = createWorkflow(parseWorkflowYaml(yaml));
      sendJson(response, 201, { workflow });
      return;
    }

    const workflowRunMatch = url.pathname.match(/^\/api\/workflows\/([^/]+)\/run$/);
    if (request.method === "POST" && workflowRunMatch) {
      const body = await readJson(request);
      const result = runWorkflow(workflowRunMatch[1], body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/secrets") {
      sendJson(response, 200, { secrets: listSecrets.all().map(secretFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/secrets") {
      const body = await readJson(request);
      const secret = createSecret(body);
      sendJson(response, 201, { secret });
      return;
    }

    const secretDeleteMatch = url.pathname.match(/^\/api\/secrets\/([^/]+)$/);
    if (request.method === "DELETE" && secretDeleteMatch) {
      deleteSecret.run(secretDeleteMatch[1]);
      sendJson(response, 200, { ok: true });
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

  const hasContent = typeof body.content === "string" && body.content.length > 0;
  if (hasContent && artifact.path.length === 0) {
    artifact.path = [".agent-workbench", "artifacts", safeFileName(artifact.taskId ?? "manual"), artifact.id, `001-${safeFileName(artifact.name)}`].join("/");
  }

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
  if (hasContent) {
    createArtifactVersion(artifact.id, {
      content: body.content,
      summary: artifact.summary,
      contentType: contentTypeForArtifact(artifact.kind),
    });
    const updated = getArtifact.get(artifact.id);
    return updated ? artifactFromRow(updated) : artifact;
  }
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

function ensureWorkflow(workflowId) {
  const workflow = getWorkflow.get(workflowId);
  if (!workflow) throw new Error("workflow_not_found");
  return workflow;
}

function createSecret(body) {
  const now = new Date().toISOString();
  const envVar = requiredString(body.envVar, "envVar");
  const secret = {
    id: createId("secret"),
    name: requiredString(body.name, "name"),
    scope: stringOr(body.scope, "workspace"),
    envVar,
    status: process.env[envVar] ? "available" : "missing",
    createdAt: now,
    updatedAt: now,
  };

  insertSecret.run(secret.id, secret.name, secret.scope, secret.envVar, secret.status, secret.createdAt, secret.updatedAt);
  return secret;
}

function createArtifactVersion(artifactId, body) {
  const artifact = getArtifact.get(artifactId);
  if (!artifact) throw new Error("artifact_not_found");

  const content = requiredString(body.content, "content");
  const version = Number(countArtifactVersions.get(artifactId)?.count ?? 0) + 1;
  const now = new Date().toISOString();
  const fileName = `${String(version).padStart(3, "0")}-${safeFileName(artifact.name)}`;
  const relPath = [".agent-workbench", "artifacts", safeFileName(artifact.task_id ?? "manual"), artifact.id, fileName].join("/");
  const absolutePath = resolve(projectRoot, relPath);
  const relativeToRoot = relative(projectRoot, absolutePath);
  if (relativeToRoot.startsWith("..")) throw new Error("invalid_artifact_path");

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");

  const row = {
    id: createId("artifact_version"),
    artifactId,
    version,
    path: relPath,
    summary: stringOr(body.summary, `version ${version}`),
    contentType: stringOr(body.contentType, "text/markdown"),
    bytes: Buffer.byteLength(content, "utf8"),
    createdAt: now,
  };

  insertArtifactVersion.run(row.id, row.artifactId, row.version, row.path, row.summary, row.contentType, row.bytes, row.createdAt);
  updateArtifactPathStatement.run(row.path, now, artifactId);
  return row;
}

function readArtifactContent(artifactId) {
  const artifact = getArtifact.get(artifactId);
  if (!artifact) throw new Error("artifact_not_found");

  const version = getLatestArtifactVersion.get(artifactId);
  const path = version?.path ?? artifact.path;
  const absolutePath = resolve(projectRoot, path);
  const relativeToRoot = relative(projectRoot, absolutePath);
  if (relativeToRoot.startsWith("..") || !existsSync(absolutePath)) {
    return { artifact: artifactFromRow(artifact), content: "", versions: listArtifactVersions.all(artifactId).map(artifactVersionFromRow) };
  }

  return {
    artifact: artifactFromRow(artifact),
    content: readFileSync(absolutePath, "utf8"),
    versions: listArtifactVersions.all(artifactId).map(artifactVersionFromRow),
  };
}

function runWorkflow(workflowId, body = {}) {
  const workflow = workflowFromRow(ensureWorkflow(workflowId));
  const fromStepId = typeof body.fromStepId === "string" && body.fromStepId.trim() ? body.fromStepId.trim() : null;
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  const selectedSteps = fromStepId ? affectedWorkflowSteps(workflow.steps, fromStepId) : workflow.steps;
  if (selectedSteps.length === 0) throw new Error("workflow_step_not_found");

  const taskResult = createTask({
    title: fromStepId ? `${workflow.name} · 从 ${fromStepId} 返工` : `${workflow.name} · DAG 执行`,
    prompt: feedback || workflow.description,
    targetType: "workflow",
    targetId: workflow.id,
    owner: "Workflow Engine",
    runtime: workflow.provider,
    priority: "normal",
    requiresApproval: false,
  });
  const { taskId, runId } = taskResult;
  updateTaskAndRunStatus(taskId, "running");
  appendEvent(runId, "workflow.started", {
    workflowId: workflow.id,
    name: workflow.name,
    concurrency: workflow.concurrency,
    fromStepId,
    feedback,
  });

  const levels = buildWorkflowExecutionLevels(selectedSteps);
  for (const [index, level] of levels.entries()) {
    appendEvent(runId, "workflow.layer.started", { layer: index + 1, steps: level.map((step) => step.id) });
    for (const step of level) {
      appendEvent(runId, "workflow.step.started", {
        stepId: step.id,
        role: step.role,
        task: step.task,
        dependsOn: step.dependsOn,
      });

      if (step.type === "approval" || step.type === "human_input") {
        const approval = createApproval({
          taskId,
          title: `Workflow step gate：${step.id}`,
          source: `${workflow.name} / ${step.role}`,
          risk: step.type === "approval" ? "medium" : "low",
          capabilities: ["workflow:continue", "artifact:write"],
          reason: step.task,
        });
        appendEvent(runId, "approval.requested", { approvalId: approval.id, stepId: step.id });
        continue;
      }

      appendEvent(runId, "message.delta", {
        role: "assistant",
        text: `${step.role} 完成 ${step.id}：${step.output ?? "step_output"}`,
      });
      appendEvent(runId, "workflow.step.completed", {
        stepId: step.id,
        output: step.output ?? `${step.id}_output`,
      });
    }
    appendEvent(runId, "workflow.layer.completed", { layer: index + 1 });
  }

  const content = renderWorkflowRunMarkdown(workflow, selectedSteps, { fromStepId, feedback, runId });
  const artifact = createArtifact({
    taskId,
    runId,
    name: `${workflow.name} · run-${new Date().toISOString().slice(0, 10)}.md`,
    kind: "markdown",
    summary: fromStepId ? `从 ${fromStepId} 开始的返工运行摘要。` : "DAG 工作流执行摘要。",
    source: "Workflow Engine",
    manifest: {
      workflowId: workflow.id,
      fromStepId,
      feedback,
      steps: selectedSteps.map((step) => step.id),
    },
    content,
  });
  appendEvent(runId, "artifact.created", { artifactId: artifact.id, title: artifact.name, path: artifact.path });
  updateTaskAndRunStatus(taskId, "done");

  return { ok: true, status: "done", task: taskResult.task, runId, artifact };
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
      content: [
        `# ${task.title} · Diff Summary`,
        "",
        "- Runtime: Codex",
        "- Scope: 代码变更计划、验证摘要和后续检查点",
        "- Status: simulated adapter output",
        "",
        "```diff",
        "+ 生成任务上下文",
        "+ 写入运行事件",
        "+ 登记 Artifact 版本",
        "```",
        "",
      ].join("\n"),
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
      name: `${task.title} · draft.md`,
      kind: "markdown",
      summary: "Runtime Adapter 生成的首版草稿。",
      source: task.runtime,
      path: `.agent-workbench/artifacts/${task.id}/draft.md`,
      manifest: { sourceTaskId: task.id, runtime: task.runtime },
      content: [
        `# ${task.title}`,
        "",
        task.prompt,
        "",
        "## 初版输出",
        "",
        "这是 Runtime Adapter 生成的首版草稿，用于验证 Artifact 文件写入、版本管理和资产库预览。",
        "",
      ].join("\n"),
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

async function checkConnector(connectorId) {
  const connector = ensureConnector(connectorId);

  if (connector.kind === "CLI") {
    const [command, ...args] = splitCommandLine(connector.command);
    const result = spawnSync(command, args, {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: 15000,
      shell: false,
    });
    const status = result.error || result.status !== 0 ? "待检查" : "CLI";
    updateConnectorStatusStatement.run(status, new Date().toISOString(), connector.id);
    return {
      ok: status === "CLI",
      status,
      result: {
        exitCode: result.status ?? 1,
        stdout: result.stdout?.slice(0, 2000) ?? "",
        stderr: result.stderr?.slice(0, 2000) ?? String(result.error?.message ?? ""),
      },
    };
  }

  if (/^https?:\/\//.test(connector.command)) {
    updateConnectorStatusStatement.run("在线", new Date().toISOString(), connector.id);
    return { ok: true, status: "在线", result: { transport: "http", message: "HTTP MCP endpoint registered" } };
  }

  try {
    const result = await callMcpStdio(connector.command, { mode: "tools/list", timeoutMs: 15000 });
    updateConnectorStatusStatement.run("在线", new Date().toISOString(), connector.id);
    return { ok: true, status: "在线", result };
  } catch (error) {
    updateConnectorStatusStatement.run("待检查", new Date().toISOString(), connector.id);
    return { ok: false, status: "待检查", error: error instanceof Error ? error.message : "mcp_check_failed" };
  }
}

async function invokeConnector(connectorId, body) {
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
    if (/^https?:\/\//.test(connector.command)) {
      if (run) appendEvent(run.id, "mcp.tool_call.completed", { connectorId, name: connector.name, transport: "http", simulated: true });
      return { ok: true, status: "completed", result: { message: "HTTP MCP endpoint registered; stdio call skipped" } };
    }

    const startedAt = new Date().toISOString();
    if (run) appendEvent(run.id, "mcp.tool_call.started", { connectorId, name: connector.name, startedAt });
    const result = await callMcpStdio(connector.command, {
      mode: body.toolName ? "tools/call" : "tools/list",
      toolName: typeof body.toolName === "string" ? body.toolName : undefined,
      toolArgs: body.toolArgs && typeof body.toolArgs === "object" ? body.toolArgs : {},
      timeoutMs: 30000,
    });
    if (run) appendEvent(run.id, "mcp.tool_call.completed", { connectorId, name: connector.name, result });
    return { ok: true, status: "completed", result };
  }

  const [command, ...args] = splitCommandLine(connector.command);
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

function artifactVersionFromRow(row) {
  return {
    id: row.id,
    artifactId: row.artifact_id,
    version: row.version,
    path: row.path,
    summary: row.summary,
    contentType: row.content_type,
    bytes: row.bytes,
    createdAt: row.created_at,
  };
}

function secretFromRow(row) {
  const status = process.env[row.env_var] ? "available" : "missing";
  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    envVar: row.env_var,
    status,
    valuePreview: status === "available" ? `${row.env_var}=***` : `${row.env_var}=<missing>`,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function workflowToYaml(workflow) {
  const lines = [
    `name: ${quoteYaml(workflow.name)}`,
    `description: ${quoteYaml(workflow.description)}`,
    `provider: ${quoteYaml(workflow.provider)}`,
    `concurrency: ${workflow.concurrency}`,
    "tags:",
    ...workflow.tags.map((tag) => `  - ${quoteYaml(tag)}`),
    "steps:",
  ];

  for (const step of workflow.steps) {
    lines.push(`  - id: ${quoteYaml(step.id)}`);
    lines.push(`    role: ${quoteYaml(step.role)}`);
    lines.push(`    task: ${quoteYaml(step.task)}`);
    if (step.output) lines.push(`    output: ${quoteYaml(step.output)}`);
    if (step.type) lines.push(`    type: ${quoteYaml(step.type)}`);
    lines.push("    dependsOn:");
    if (step.dependsOn.length === 0) {
      lines.push("      []");
    } else {
      for (const dep of step.dependsOn) lines.push(`      - ${quoteYaml(dep)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function parseWorkflowYaml(yaml) {
  const workflow = {
    name: "",
    description: "",
    provider: "codex-cli",
    concurrency: 1,
    tags: [],
    steps: [],
  };
  let mode = "";
  let currentStep = null;
  let dependsOn = false;

  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ")) {
      dependsOn = false;
      if (trimmed === "tags:") {
        mode = "tags";
        continue;
      }
      if (trimmed === "steps:") {
        mode = "steps";
        continue;
      }
      const [key, value] = splitYamlPair(trimmed);
      if (key === "name") workflow.name = unquoteYaml(value);
      if (key === "description") workflow.description = unquoteYaml(value);
      if (key === "provider") workflow.provider = unquoteYaml(value);
      if (key === "concurrency") workflow.concurrency = Number(value) || 1;
      continue;
    }

    if (mode === "tags" && trimmed.startsWith("- ")) {
      workflow.tags.push(unquoteYaml(trimmed.slice(2)));
      continue;
    }

    if (mode !== "steps") continue;
    if (trimmed.startsWith("- id:")) {
      currentStep = { id: unquoteYaml(trimmed.slice(5).trim()), role: "", task: "", dependsOn: [] };
      workflow.steps.push(currentStep);
      dependsOn = false;
      continue;
    }
    if (!currentStep) continue;
    if (trimmed === "dependsOn:") {
      dependsOn = true;
      currentStep.dependsOn = [];
      continue;
    }
    if (dependsOn && trimmed.startsWith("- ")) {
      currentStep.dependsOn.push(unquoteYaml(trimmed.slice(2)));
      continue;
    }
    if (dependsOn && trimmed === "[]") {
      currentStep.dependsOn = [];
      continue;
    }
    dependsOn = false;
    const [key, value] = splitYamlPair(trimmed);
    if (key === "role") currentStep.role = unquoteYaml(value);
    if (key === "task") currentStep.task = unquoteYaml(value);
    if (key === "output") currentStep.output = unquoteYaml(value);
    if (key === "type") currentStep.type = unquoteYaml(value);
  }

  return {
    name: workflow.name || "导入工作流",
    description: workflow.description,
    provider: workflow.provider,
    concurrency: workflow.concurrency,
    tags: workflow.tags,
    steps: workflow.steps.filter((step) => step.id && step.role && step.task),
  };
}

function affectedWorkflowSteps(steps, fromStepId) {
  const affected = new Set([fromStepId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) {
      if (!affected.has(step.id) && step.dependsOn.some((dep) => affected.has(dep))) {
        affected.add(step.id);
        changed = true;
      }
    }
  }
  return steps.filter((step) => affected.has(step.id)).map((step) => ({
    ...step,
    dependsOn: step.dependsOn.filter((dep) => affected.has(dep)),
  }));
}

function buildWorkflowExecutionLevels(steps) {
  const remaining = new Map(steps.map((step) => [step.id, step]));
  const completed = new Set();
  const levels = [];

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

function renderWorkflowRunMarkdown(workflow, steps, context) {
  return [
    `# ${workflow.name} 执行摘要`,
    "",
    `- Run: ${context.runId}`,
    `- Provider: ${workflow.provider}`,
    `- From step: ${context.fromStepId ?? "full"}`,
    `- Feedback: ${context.feedback || "none"}`,
    "",
    "## Steps",
    "",
    ...steps.map((step) => `- ${step.id}: ${step.role} -> ${step.output ?? "step_output"}`),
    "",
  ].join("\n");
}

async function callMcpStdio(commandLine, options) {
  const [command, ...args] = splitCommandLine(commandLine);
  if (!command) throw new Error("missing_mcp_command");

  return new Promise((resolveCall, rejectCall) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const pending = new Map();
    let stdoutBuffer = Buffer.alloc(0);
    let stderr = "";
    let nextId = 1;
    let settled = false;

    const timeout = setTimeout(() => {
      finish(new Error("mcp_timeout"));
    }, options.timeoutMs ?? 30000);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.kill();
      if (error) rejectCall(error);
      else resolveCall(value);
    }

    function request(method, params) {
      const id = nextId++;
      const payload = { jsonrpc: "2.0", id, method, params };
      child.stdin.write(encodeMcpFrame(payload));
      return new Promise((resolveRequest, rejectRequest) => pending.set(id, { resolveRequest, rejectRequest }));
    }

    child.stdout.on("data", (chunk) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
      const parsed = readMcpFrames(stdoutBuffer);
      stdoutBuffer = parsed.rest;
      for (const message of parsed.messages) {
        if (!message || typeof message.id === "undefined") continue;
        const waiter = pending.get(message.id);
        if (!waiter) continue;
        pending.delete(message.id);
        if (message.error) waiter.rejectRequest(new Error(message.error.message ?? "mcp_error"));
        else waiter.resolveRequest(message.result);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", finish);
    child.on("exit", (code) => {
      if (!settled && code !== 0) finish(new Error(stderr || `mcp_exited_${code}`));
    });

    void (async () => {
      await request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "agent-workbench", version: "0.1.0" },
      });
      child.stdin.write(encodeMcpFrame({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }));

      if (options.mode === "tools/call") {
        const result = await request("tools/call", { name: options.toolName, arguments: options.toolArgs ?? {} });
        finish(null, { mode: "tools/call", result });
        return;
      }

      const result = await request("tools/list", {});
      finish(null, { mode: "tools/list", result });
    })().catch((error) => finish(error));
  });
}

function encodeMcpFrame(payload) {
  const body = JSON.stringify(payload);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

function readMcpFrames(buffer) {
  const messages = [];
  let rest = buffer;

  while (rest.length > 0) {
    const text = rest.toString("utf8");
    const headerEnd = text.indexOf("\r\n\r\n");
    if (headerEnd >= 0) {
      const header = text.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) break;
      const length = Number(match[1]);
      const bodyStart = Buffer.byteLength(text.slice(0, headerEnd + 4), "utf8");
      if (rest.length < bodyStart + length) break;
      const body = rest.slice(bodyStart, bodyStart + length).toString("utf8");
      messages.push(JSON.parse(body));
      rest = rest.slice(bodyStart + length);
      continue;
    }

    const lineEnd = text.indexOf("\n");
    if (lineEnd < 0) break;
    const line = text.slice(0, lineEnd).trim();
    rest = rest.slice(Buffer.byteLength(text.slice(0, lineEnd + 1), "utf8"));
    if (line) messages.push(JSON.parse(line));
  }

  return { messages, rest };
}

function splitCommandLine(commandLine) {
  const result = [];
  let current = "";
  let quote = "";
  for (let index = 0; index < commandLine.length; index += 1) {
    const char = commandLine[index];
    if (quote) {
      if (char === quote) quote = "";
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        result.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) result.push(current);
  return result;
}

function splitYamlPair(line) {
  const separator = line.indexOf(":");
  if (separator === -1) return [line, ""];
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}

function quoteYaml(value) {
  return JSON.stringify(String(value ?? ""));
}

function unquoteYaml(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed.replace(/^["']|["']$/g, "");
  }
}

function safeFileName(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "artifact";
}

function contentTypeForArtifact(kind) {
  if (kind === "diff") return "text/x-diff";
  if (kind === "json") return "application/json";
  return "text/markdown";
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

function readTextOrJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        request.destroy(new Error("request_too_large"));
      }
    });
    request.on("end", () => {
      const type = request.headers["content-type"] ?? "";
      if (String(type).includes("application/json")) {
        try {
          resolveBody(body.length > 0 ? JSON.parse(body) : {});
        } catch {
          rejectBody(new Error("invalid_json"));
        }
        return;
      }
      resolveBody(body);
    });
    request.on("error", rejectBody);
  });
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

function sendText(response, status, body, contentType) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": contentType,
  });
  response.end(body);
}

function sendEmpty(response, status) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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
