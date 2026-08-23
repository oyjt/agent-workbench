export type CreateTaskPayload = {
  title: string;
  prompt: string;
  targetType: "agent" | "agent_team" | "plugin";
  targetId: string;
  owner: string;
  runtime: string;
  priority: "normal" | "high";
  requiresApproval: boolean;
};

export type ApiTask = {
  id: string;
  runId?: string;
  title: string;
  prompt: string;
  targetType: string;
  targetId: string;
  owner: string;
  runtime: string;
  status: string;
  priority: string;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiAgent = {
  id: string;
  name: string;
  description: string;
  runtime: string;
  model: string;
  systemPrompt: string;
  skillIds: string[];
  knowledgeScope: string;
  permissionProfile: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiKnowledgeItem = {
  id: string;
  title: string;
  type: string;
  content: string;
  tags: string[];
  visibility: string;
  status: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiConnector = {
  id: string;
  kind: "MCP" | "CLI";
  name: string;
  description: string;
  command: string;
  risk: "low" | "medium" | "high";
  binding: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiAgentTeam = {
  id: string;
  name: string;
  workflow: string;
  description: string;
  status: string;
  members: Array<{
    agentId: string;
    role: string;
    order: number;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type ApiApproval = {
  id: string;
  taskId: string;
  title: string;
  source: string;
  risk: "low" | "medium" | "high";
  capabilities: string[];
  status: "pending" | "allowed" | "denied";
  reason: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiSkill = {
  id: string;
  name: string;
  description: string;
  path: string;
  permissions: string[];
  risk: "low" | "medium" | "high";
};

export type ApiWorkflowPlugin = {
  id: string;
  name: string;
  description: string;
  version: string;
  path: string;
  skills: string[];
  mcpTools: string[];
  cliCommands: string[];
  knowledgeScopes: string[];
  capabilities: string[];
  pipeline: string[];
};

export type ApiArtifact = {
  id: string;
  taskId: string | null;
  runId: string | null;
  name: string;
  kind: string;
  summary: string;
  source: string;
  path: string;
  manifest: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ApiArtifactVersion = {
  id: string;
  artifactId: string;
  version: number;
  path: string;
  summary: string;
  contentType: string;
  bytes: number;
  createdAt: string;
};

export type ApiWorkflowStep = {
  id: string;
  role: string;
  task: string;
  output?: string;
  dependsOn: string[];
  type?: "normal" | "approval" | "human_input";
};

export type ApiWorkflow = {
  id: string;
  name: string;
  description: string;
  provider: string;
  concurrency: number;
  tags: string[];
  steps: ApiWorkflowStep[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiSecret = {
  id: string;
  name: string;
  scope: string;
  envVar: string;
  status: "available" | "missing";
  valuePreview: string;
  createdAt: string;
  updatedAt: string;
};

export type ApiRunEvent = {
  id: string;
  runId: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type CreateTaskResponse = {
  taskId: string;
  runId: string;
  status: string;
  task: ApiTask;
  events: ApiRunEvent[];
};

export async function createApiTask(payload: CreateTaskPayload) {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`create_task_failed_${response.status}`);
  }

  return response.json() as Promise<CreateTaskResponse>;
}

export async function startApiTask(taskId: string) {
  return requestJson<{ ok: boolean; status: string; runId: string; waitingApprovalId?: string }>(`/api/tasks/${taskId}/start`, {
    method: "POST",
  });
}

export async function listApiTasks() {
  return requestJson<{ tasks: ApiTask[] }>("/api/tasks");
}

export async function listApiAgents() {
  return requestJson<{ agents: ApiAgent[] }>("/api/agents");
}

export function createApiAgent(payload: Pick<ApiAgent, "name" | "description" | "runtime" | "model" | "systemPrompt" | "skillIds" | "knowledgeScope" | "permissionProfile">) {
  return postJson<{ agent: ApiAgent }>("/api/agents", payload);
}

export async function listApiKnowledgeItems() {
  return requestJson<{ knowledgeItems: ApiKnowledgeItem[] }>("/api/knowledge-items");
}

export function createApiKnowledgeItem(payload: Pick<ApiKnowledgeItem, "title" | "type" | "content" | "tags" | "visibility">) {
  return postJson<{ knowledgeItem: ApiKnowledgeItem }>("/api/knowledge-items", payload);
}

export async function listApiConnectors() {
  return requestJson<{ connectors: ApiConnector[] }>("/api/connectors");
}

export function createApiConnector(payload: Pick<ApiConnector, "kind" | "name" | "description" | "command" | "risk" | "binding">) {
  return postJson<{ connector: ApiConnector }>("/api/connectors", payload);
}

export function checkApiConnector(connectorId: string) {
  return requestJson<{ ok: boolean; status: string }>(`/api/connectors/${connectorId}/check`, { method: "POST" });
}

export async function listApiApprovals(status?: "pending" | "allowed" | "denied") {
  const query = status ? `?status=${status}` : "";
  return requestJson<{ approvals: ApiApproval[] }>(`/api/approvals${query}`);
}

export async function listApiAgentTeams() {
  return requestJson<{ teams: ApiAgentTeam[] }>("/api/agent-teams");
}

export function createApiAgentTeam(payload: Pick<ApiAgentTeam, "name" | "workflow" | "description" | "members">) {
  return postJson<{ team: ApiAgentTeam }>("/api/agent-teams", payload);
}

export async function listApiArtifacts() {
  return requestJson<{ artifacts: ApiArtifact[] }>("/api/artifacts");
}

export async function getApiArtifactContent(artifactId: string) {
  return requestJson<{ artifact: ApiArtifact; content: string; versions: ApiArtifactVersion[] }>(`/api/artifacts/${artifactId}/content`);
}

export async function listApiWorkflows() {
  return requestJson<{ workflows: ApiWorkflow[] }>("/api/workflows");
}

export function createApiWorkflow(payload: Pick<ApiWorkflow, "name" | "description" | "provider" | "concurrency" | "tags" | "steps">) {
  return postJson<{ workflow: ApiWorkflow }>("/api/workflows", payload);
}

export async function listApiSecrets() {
  return requestJson<{ secrets: ApiSecret[] }>("/api/secrets");
}

export function createApiSecret(payload: { name: string; scope: string; envVar: string }) {
  return postJson<{ secret: ApiSecret }>("/api/secrets", payload);
}

export async function scanApiSkills() {
  return requestJson<{ skills: ApiSkill[] }>("/api/skills/scan");
}

export async function scanApiPlugins() {
  return requestJson<{ plugins: ApiWorkflowPlugin[] }>("/api/plugins/scan");
}

export async function respondApiApproval(approvalId: string, decision: "allow_once" | "allow_session" | "deny") {
  return requestJson<{ ok: boolean; status: string; taskStatus: string }>(`/api/approvals/${approvalId}/respond`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
}

export async function appendRunEvent(runId: string, type: string, payload: unknown) {
  const response = await fetch(`/api/runs/${runId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });

  if (!response.ok) {
    throw new Error(`append_event_failed_${response.status}`);
  }

  return response.json() as Promise<{ event: ApiRunEvent }>;
}

export async function listApiRunEvents(runId: string) {
  return requestJson<{ events: ApiRunEvent[] }>(`/api/runs/${runId}/events.json`);
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`request_failed_${response.status}`);
  }
  return response.json() as Promise<T>;
}

function postJson<T>(path: string, body: unknown) {
  return requestJson<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
