import { createServer } from "node:http";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createStatements } from "./db/statements.mjs";
import { initializeDatabase, schemaTables } from "./db/schema.mjs";
import { createRowMappers } from "./repositories/row-mappers.mjs";
import { createRunEventService } from "./services/run-events.mjs";
import { createApprovalService } from "./services/approvals.mjs";
import { createArtifactService } from "./services/artifacts.mjs";
import { chatCompletionsUrl, createChatCompletion, ModelRequestError } from "./services/openai-compatible.mjs";
import { AgentHarness } from "./harness/core.mjs";
import { CapabilityApprovalRequired, createRiskPolicy, executeCapability } from "./harness/policy.mjs";
import { createCatalogPlugin } from "./plugins/catalog.mjs";
import { createDefaultConnectorProviders } from "./connectors/providers.mjs";
import { resolveRuntimeAdapter, runtimePlugin } from "./plugins/runtime.mjs";
import { createStaticHandler, readJson, readTextOrJson, sendEmpty, sendJson, sendText } from "./transport/http.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.AGENT_WORKBENCH_DATA_DIR ?? resolve(projectRoot, ".agent-workbench", "data");
const dbPath = resolve(dataDir, "workbench.sqlite");
const credentialDir = resolve(dataDir, "credentials");
const artifactRoot = resolve(projectRoot, ".agent-workbench", "artifacts");
const distDir = resolve(projectRoot, "dist");
const port = Number(process.env.AGENT_WORKBENCH_API_PORT ?? 8787);
const host = process.env.AGENT_WORKBENCH_API_HOST ?? "127.0.0.1";
const harness = new AgentHarness();
const harnessPolicy = createRiskPolicy();
const serveStatic = createStaticHandler(distDir);
const connectorProviders = createDefaultConnectorProviders({ projectRoot, spawnSync, callMcpStdio });
const activeGenerations = new Map();

await harness.use(runtimePlugin);
await harness.use(createCatalogPlugin(projectRoot));

mkdirSync(dataDir, { recursive: true });
mkdirSync(artifactRoot, { recursive: true });

if (process.argv.includes("--reset")) {
  for (const suffix of ["", "-shm", "-wal"]) rmSync(`${dbPath}${suffix}`, { force: true });
  rmSync(credentialDir, { recursive: true, force: true });
}

mkdirSync(credentialDir, { recursive: true, mode: 0o700 });
chmodSync(credentialDir, 0o700);

const db = new DatabaseSync(dbPath, { timeout: 5000 });
initializeDatabase(db);

const {
  insertTask, insertRun, insertEvent, listTasks, deleteTask, deleteApprovalsByTask, deleteArtifactsByTask, listEvents, getRun, getTask, getLatestRunByTask,
  getPendingApprovalByTask, updateTaskStatusStatement, updateRunStatusStatement, insertAgent, listAgents, getAgent,
  updateAgentStatusStatement, insertKnowledgeItem, listKnowledgeItems, insertConnector, listConnectors,
  updateConnectorStatusStatement, getConnector, getTeam, insertApproval, listApprovals, listApprovalsByStatus,
  getApproval, updateApprovalStatusStatement, insertTeam, insertTeamMember, listTeams, listTeamMembers,
  insertPendingCapabilityExecution, getPendingCapabilityExecution, completePendingCapabilityExecution,
  insertArtifact, listArtifacts, getArtifact, updateArtifactPathStatement, insertArtifactVersion,
  listArtifactVersions, getLatestArtifactVersion, countArtifactVersions, insertWorkflow, listWorkflows,
  getWorkflow, insertModelProvider, listModelProviders, getModelProvider, getDefaultModelProvider,
  clearDefaultModelProviders, deleteModelProvider,
} = createStatements(db);
const { taskFromRow, agentFromRow, knowledgeFromRow, connectorFromRow, approvalFromRow, teamFromRow, artifactFromRow, workflowFromRow, artifactVersionFromRow, modelProviderFromRow, eventFromRow } = createRowMappers(listTeamMembers, hasModelCredential);
const artifactService = createArtifactService({
  projectRoot,
  statements: { insertArtifact, getArtifact, insertArtifactVersion, countArtifactVersions, updateArtifactPathStatement, getLatestArtifactVersion, listArtifactVersions },
  mappers: { artifactFromRow, artifactVersionFromRow },
  createId,
  requiredString,
  stringOr,
});
const createArtifact = (body) => artifactService.create(body);
const createArtifactVersion = (artifactId, body) => artifactService.createVersion(artifactId, body);
const readArtifactContent = (artifactId) => artifactService.readContent(artifactId);
const runEventService = createRunEventService({ listEvents, mapEvent: eventFromRow });
const approvalService = createApprovalService({
  insertApproval,
  getApproval,
  updateApprovalStatus: updateApprovalStatusStatement,
  updateTaskAndRunStatus,
  createId,
  requiredString,
  stringOr,
});
const createApproval = (body) => approvalService.create(body);
const respondApproval = async (approvalId, decision) => {
  const response = approvalService.respond(approvalId, decision);
  if (response.status !== "allowed") return response;
  const pending = getPendingCapabilityExecution.get(approvalId);
  if (!pending) return response;
  const context = JSON.parse(pending.context);
  try {
    const result = await invokeApprovedConnector(pending.capability_id, JSON.parse(pending.input), context);
    completePendingCapabilityExecution.run("completed", JSON.stringify(result), null, new Date().toISOString(), approvalId);
    return { ...response, execution: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "capability_resume_failed";
    completePendingCapabilityExecution.run("failed", null, message, new Date().toISOString(), approvalId);
    throw error;
  }
};

if (process.argv.includes("--init")) {
  console.log(JSON.stringify({ ok: true, dbPath, schema: schemaTables }, null, 2));
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
      sendJson(response, 200, { ok: true, dbPath, service: "agent-workbench-api", architecture: "harness-v1" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/extensions") {
      const runtimes = await runCapability("runtime:list", {});
      sendJson(response, 200, {
        capabilities: harness.capabilities.list().map(({ execute, ...definition }) => definition),
        runtimes,
      });
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

    const taskDeleteMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (request.method === "DELETE" && taskDeleteMatch) {
      const taskId = taskDeleteMatch[1];
      if (!getTask.get(taskId)) {
        sendJson(response, 404, { error: "task_not_found" });
        return;
      }
      db.exec("BEGIN");
      try {
        deleteApprovalsByTask.run(taskId);
        deleteArtifactsByTask.run(taskId);
        deleteTask.run(taskId);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      sendJson(response, 200, { ok: true });
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
      const result = await startTask(taskStartMatch[1]);
      sendJson(response, 200, result);
      return;
    }

    const runStopMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/stop$/);
    if (request.method === "POST" && runStopMatch) {
      const result = stopGeneration(runStopMatch[1]);
      sendJson(response, result.stopped ? 200 : 409, result);
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
      const result = await respondApproval(approvalRespondMatch[1], requiredString(body.decision, "decision"));
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

    if (request.method === "GET" && url.pathname === "/api/model-providers") {
      sendJson(response, 200, { providers: listModelProviders.all().map(modelProviderFromRow) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/model-providers") {
      const body = await readJson(request);
      const provider = createModelProvider(body);
      sendJson(response, 201, { provider });
      return;
    }

    const providerCheckMatch = url.pathname.match(/^\/api\/model-providers\/([^/]+)\/check$/);
    if (request.method === "POST" && providerCheckMatch) {
      sendJson(response, 200, await checkModelProvider(providerCheckMatch[1]));
      return;
    }

    const providerDeleteMatch = url.pathname.match(/^\/api\/model-providers\/([^/]+)$/);
    if (request.method === "DELETE" && providerDeleteMatch) {
      deleteModelProvider.run(providerDeleteMatch[1]);
      rmSync(modelCredentialPath(providerDeleteMatch[1]), { force: true });
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/skills/scan") {
      sendJson(response, 200, { skills: await runCapability("catalog:skills.scan", {}) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/plugins/scan") {
      sendJson(response, 200, { plugins: await runCapability("catalog:plugins.scan", {}) });
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
      const reply = body.type === "user.message" ? await continueConversation(runId) : null;
      sendJson(response, 201, { event, reply });
      return;
    }

    if (request.method === "GET" && createEventMatch) {
      const runId = createEventMatch[1];
      ensureRun(runId);
      runEventService.openStream(request, response, runId);
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
  const modelProviderId = requiredString(body.modelProviderId, "modelProviderId");
  const provider = getModelProvider.get(modelProviderId);
  if (!provider) throw new Error("model_provider_not_found");
  const agent = {
    id: createId("agent"),
    name: requiredString(body.name, "name"),
    description: requiredString(body.description, "description"),
    runtime: stringOr(body.runtime, "Codex"),
    modelProviderId,
    model: stringOr(body.model, provider.default_model),
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
    agent.modelProviderId,
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

function createModelProvider(body) {
  const now = new Date().toISOString();
  const baseUrl = requiredString(body.baseUrl, "baseUrl").replace(/\/$/, "");
  chatCompletionsUrl(baseUrl);
  const authType = body.noAuth ? "none" : "bearer";
  const apiKey = authType === "bearer" ? requiredString(body.apiKey, "apiKey") : null;
  const provider = {
    id: createId("provider"),
    name: requiredString(body.name, "name"),
    baseUrl,
    authType,
    defaultModel: requiredString(body.defaultModel, "defaultModel"),
    isDefault: Boolean(body.isDefault) || !getDefaultModelProvider.get(),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  db.exec("BEGIN");
  try {
    if (provider.isDefault) clearDefaultModelProviders.run(now);
    insertModelProvider.run(provider.id, provider.name, provider.baseUrl, provider.authType, provider.defaultModel, provider.isDefault ? 1 : 0, 1, provider.createdAt, provider.updatedAt);
    if (apiKey) writeModelCredential(provider.id, apiKey);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    rmSync(modelCredentialPath(provider.id), { force: true });
    throw error;
  }
  return modelProviderFromRow(getModelProvider.get(provider.id));
}

async function checkModelProvider(providerId) {
  const provider = getModelProvider.get(providerId);
  if (!provider) throw new Error("model_provider_not_found");
  const apiKey = provider.auth_type === "bearer" ? readModelCredential(provider.id) : undefined;
  if (provider.auth_type === "bearer" && !apiKey) throw new Error("model_api_key_missing");
  const result = await createChatCompletion({
    baseUrl: provider.base_url,
    authType: provider.auth_type,
    apiKey,
    model: provider.default_model,
    messages: [{ role: "user", content: "请只回复：连接成功" }],
    stream: false,
    signal: AbortSignal.timeout(30_000),
  });
  return { ok: true, status: "available", requestId: result.requestId };
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

async function startTask(taskId) {
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
    try {
      const reply = await appendAssistantReply(task, run.id);
      if (reply.type === "runtime.unconfigured") {
        appendEvent(run.id, "agent.completed", { agentId: task.target_id });
        updateTaskAndRunStatus(taskId, "failed");
        return { ok: false, status: "failed", runId: run.id };
      }
      if (reply.payload?.stopped) {
        appendEvent(run.id, "agent.completed", { agentId: task.target_id, stopped: true });
        return { ok: true, status: "paused", runId: run.id };
      }
    } catch (error) {
      appendAssistantError(run.id, error);
      appendEvent(run.id, "agent.completed", { agentId: task.target_id });
      updateTaskAndRunStatus(taskId, "failed");
      return { ok: false, status: "failed", runId: run.id };
    }
    appendEvent(run.id, "agent.completed", { agentId: task.target_id });
  }

  updateTaskAndRunStatus(taskId, "done");
  return { ok: true, status: "done", runId: run.id };
}

async function continueConversation(runId) {
  const run = ensureRun(runId);
  const task = getTask.get(run.task_id);
  if (!task) throw new Error("task_not_found");
  updateTaskAndRunStatus(task.id, "running");
  try {
    const reply = await appendAssistantReply(task, runId);
    if (!reply.payload?.stopped) updateTaskAndRunStatus(task.id, reply.type === "runtime.unconfigured" ? "failed" : "done");
    return reply;
  } catch (error) {
    const event = appendAssistantError(runId, error);
    updateTaskAndRunStatus(task.id, "failed");
    return event;
  }
}

function appendAssistantError(runId, error) {
  const detail = error instanceof Error ? error.message : "unknown_error";
  return appendEvent(runId, "assistant.error", { role: "assistant", text: `模型请求失败：${detail}。请检查密钥、网络和模型配置后重试。` });
}

async function appendAssistantReply(task, runId) {
  const config = resolveTaskModel(task);
  if (!config) return appendEvent(runId, "runtime.unconfigured", { role: "assistant", text: "尚未配置默认模型连接。请先在设置中添加一个 OpenAI 兼容连接。" });
  const { agent, provider } = config;
  const apiKey = provider.auth_type === "bearer" ? readModelCredential(provider.id) : undefined;
  if (provider.auth_type === "bearer" && !apiKey) return appendEvent(runId, "runtime.unconfigured", { role: "assistant", text: `模型连接“${provider.name}”缺少 API Key。请重新添加连接。` });

  const history = listEvents.all(runId).map(eventFromRow).flatMap((event) => {
    const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
    if (event.type === "user.message" && typeof payload.text === "string") return [{ role: "user", content: payload.text }];
    if (event.type === "assistant.message" && typeof payload.text === "string") return [{ role: "assistant", content: payload.text }];
    return [];
  });
  const model = agent?.model || provider.default_model;
  const systemPrompt = agent?.system_prompt || "你是 Agent Workbench 中的助理。请使用简体中文，直接、清晰地帮助用户完成任务。";
  const messages = [{ role: "system", content: systemPrompt }, { role: "user", content: task.prompt }, ...history];
  const messageId = createId("message");
  const controller = new AbortController();
  let streamedText = "";
  activeGenerations.set(runId, { controller, taskId: task.id });
  appendEvent(runId, "model.started", { providerId: provider.id, provider: provider.name, model, messageId });
  try {
    const result = await createChatCompletion({
      baseUrl: provider.base_url,
      authType: provider.auth_type,
      apiKey,
      model,
      messages,
      onDelta: (text) => { streamedText = text; appendEvent(runId, "assistant.delta", { role: "assistant", messageId, text }); },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(120_000)]),
    });
    return appendEvent(runId, "assistant.message", { role: "assistant", messageId, text: result.text, model, providerId: provider.id, requestId: result.requestId });
  } catch (error) {
    if (controller.signal.aborted) {
      appendEvent(runId, "model.stopped", { providerId: provider.id, provider: provider.name, model, messageId });
      return appendEvent(runId, "assistant.message", { role: "assistant", messageId, text: streamedText || "已停止生成。", model, providerId: provider.id, stopped: true });
    }
    const failure = error instanceof ModelRequestError ? error : new ModelRequestError("model_request_failed");
    appendEvent(runId, "model.failed", { providerId: provider.id, provider: provider.name, model, status: failure.status, detail: failure.detail, requestId: failure.requestId });
    throw failure;
  } finally {
    if (activeGenerations.get(runId)?.controller === controller) activeGenerations.delete(runId);
  }
}

function stopGeneration(runId) {
  const active = activeGenerations.get(runId);
  if (!active) return { ok: false, stopped: false, error: "generation_not_running" };
  active.controller.abort();
  updateTaskAndRunStatus(active.taskId, "paused");
  return { ok: true, stopped: true, runId };
}

function resolveTaskModel(task) {
  const agent = task.target_type === "agent" && task.target_id !== "local" ? getAgent.get(task.target_id) : null;
  if (task.target_type === "agent" && task.target_id !== "local" && !agent) throw new Error("agent_not_found");
  const provider = agent ? getModelProvider.get(agent.model_provider_id) : getDefaultModelProvider.get();
  if (!provider || !provider.enabled) return null;
  return { agent, provider };
}

function modelCredentialPath(providerId) { return resolve(credentialDir, `${providerId}.key`); }
function hasModelCredential(providerId) { return existsSync(modelCredentialPath(providerId)); }
function readModelCredential(providerId) { return hasModelCredential(providerId) ? readFileSync(modelCredentialPath(providerId), "utf8").trim() : undefined; }
function writeModelCredential(providerId, apiKey) {
  const path = modelCredentialPath(providerId);
  writeFileSync(path, apiKey, { encoding: "utf8", mode: 0o600 });
  chmodSync(path, 0o600);
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
  const result = await connectorProviders.check(connector);
  updateConnectorStatusStatement.run(result.status, new Date().toISOString(), connector.id);
  return result;
}

async function invokeConnector(connectorId, body) {
  const connector = ensureConnector(connectorId);
  const taskId = typeof body.taskId === "string" ? body.taskId : "manual";
  const run = taskId === "manual" ? null : getLatestRunByTask.get(taskId);
  const capabilityId = `connector:${connector.id}:invoke`;
  const dispose = harness.capabilities.register({
    id: capabilityId,
    title: `${connector.kind} Connector：${connector.name}`,
    risk: connector.risk,
    execute: () => invokeConnectorProvider(connector, body, run),
  });
  try {
    return await runCapability(capabilityId, body, {}, async () => {
      const approval = createApproval({
        taskId,
        title: `${connector.kind} 调用审批：${connector.name}`,
        source: `${connector.kind} Connector`,
        risk: connector.risk,
        capabilities: [capabilityId],
        reason: `${connector.name} 风险等级为 ${connector.risk}，执行前需要人工审批。`,
      });
      const now = new Date().toISOString();
      insertPendingCapabilityExecution.run(
        approval.id,
        capabilityId,
        JSON.stringify(body),
        JSON.stringify({ connectorId, runId: run?.id ?? null }),
        now,
        now,
      );
      if (run) appendEvent(run.id, "approval.requested", { approvalId: approval.id, connectorId, capabilityId });
      return { pending: true, approval };
    });
  } catch (error) {
    if (error instanceof CapabilityApprovalRequired) return { ok: true, status: "approval_required", approval: error.approval };
    throw error;
  } finally {
    dispose();
  }
}

async function invokeApprovedConnector(capabilityId, body, context) {
  const connector = ensureConnector(context.connectorId);
  const run = context.runId ? ensureRun(context.runId) : null;
  const dispose = harness.capabilities.register({
    id: capabilityId,
    title: `${connector.kind} Connector：${connector.name}`,
    risk: connector.risk,
    execute: () => invokeConnectorProvider(connector, body, run),
  });
  try {
    if (run) appendEvent(run.id, "capability/approval-resumed", { capabilityId });
    return await runCapability(capabilityId, body, { approvalGranted: true });
  } finally {
    dispose();
  }
}

async function invokeConnectorProvider(connector, body, run) {
  return connectorProviders.invoke(connector, body, {
    emit: (type, payload) => { if (run) appendEvent(run.id, type, payload); },
  });
}

function adapterForTask(task) {
  return resolveRuntimeAdapter(task.runtime).id;
}

function runCapability(capabilityId, input, context = {}, requestApproval) {
  return executeCapability({
    registry: harness.capabilities,
    policy: harnessPolicy,
    capabilityId,
    input,
    context: { emit: (type, payload) => harness.events.emit(type, payload), ...context },
    requestApproval,
  });
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
  runEventService.publish(event);
  return event;
}

function ensureRun(runId) {
  const run = getRun.get(runId);
  if (!run) {
    throw new Error("run_not_found");
  }
  return run;
}

function ensureConnector(connectorId) {
  const connector = getConnector.get(connectorId);
  if (!connector) throw new Error("connector_not_found");
  return connector;
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
    lines.push("    depends_on:");
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
    if (trimmed === "dependsOn:" || trimmed === "depends_on:") {
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

function shutdown() {
  harness.dispose();
  runEventService.dispose();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
