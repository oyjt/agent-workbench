import type { ApiAgent, ApiAgentTeam, ApiApproval, ApiArtifact, ApiArtifactVersion, ApiConnector, ApiKnowledgeItem, ApiSecret, ApiTask, ApiWorkflow } from "../api";
import type { AgentRecord, AgentTeamRecord, ApprovalRecord, ArtifactRecord, ArtifactVersionRecord, ConnectorRecord, KnowledgeItem, SecretRecord, Task, TaskStatus, WorkflowPlan } from "../domain/workbench";

export function taskFromApi(task: ApiTask): Task {
  return { key: task.id, runId: task.runId, title: task.title, description: task.prompt, owner: task.owner, runtime: task.runtime, status: normalizeTaskStatus(task.status), target: task.targetId, updatedAt: formatTime(task.updatedAt) };
}
export function agentFromApi(agent: ApiAgent): AgentRecord {
  return { key: agent.id, name: agent.name, description: agent.description, runtime: agent.runtime, model: agent.model, capability: `${agent.skillIds.length} Skills`, knowledgeScope: agent.knowledgeScope, permissionProfile: agent.permissionProfile, status: normalizeAgentStatus(agent.status) };
}
export function teamFromApi(team: ApiAgentTeam): AgentTeamRecord {
  return { key: team.id, name: team.name, workflow: team.workflow, description: team.description, status: normalizeAgentStatus(team.status), members: team.members };
}
export function knowledgeFromApi(item: ApiKnowledgeItem): KnowledgeItem {
  return { key: item.id, title: item.title, type: normalizeKnowledgeType(item.type), meta: `${item.visibility === "team" ? "团队" : "项目"} · ${formatTime(item.updatedAt)} · 引用 0 次`, status: normalizeKnowledgeStatus(item.status), tags: item.tags, visibility: item.visibility === "team" ? "team" : "project" };
}
export function connectorFromApi(connector: ApiConnector): ConnectorRecord {
  return { key: connector.id, kind: connector.kind, name: connector.name, description: connector.description, status: normalizeConnectorStatus(connector.status), risk: connector.risk, binding: connector.binding };
}
export function approvalFromApi(approval: ApiApproval): ApprovalRecord {
  return { key: approval.id, taskKey: approval.taskId, title: approval.title, source: approval.source, risk: approval.risk, capabilities: approval.capabilities, status: approval.status, reason: approval.reason };
}
export function artifactFromApi(artifact: ApiArtifact): ArtifactRecord {
  return { key: artifact.id, file: artifact.name, type: artifact.kind.toUpperCase(), source: artifact.source, summary: artifact.summary, path: artifact.path, updatedAt: formatTime(artifact.updatedAt), manifest: artifact.manifest };
}
export function artifactVersionFromApi(version: ApiArtifactVersion): ArtifactVersionRecord {
  return { key: version.id, version: version.version, path: version.path, summary: version.summary, bytes: version.bytes, createdAt: formatTime(version.createdAt) };
}
export function workflowFromApi(workflow: ApiWorkflow): WorkflowPlan {
  return { key: workflow.id, name: workflow.name, description: workflow.description, provider: workflow.provider, concurrency: workflow.concurrency, tags: workflow.tags, steps: workflow.steps };
}
export function secretFromApi(secret: ApiSecret): SecretRecord {
  return { key: secret.id, name: secret.name, scope: secret.scope, envVar: secret.envVar, status: secret.status, valuePreview: secret.valuePreview };
}

export function normalizeTaskStatus(status: string): TaskStatus {
  const allowed: TaskStatus[] = ["queued", "approval", "running", "paused", "done", "failed", "cancelled"];
  return allowed.includes(status as TaskStatus) ? status as TaskStatus : "queued";
}
function normalizeAgentStatus(status: string): AgentRecord["status"] { return status === "运行中" || status === "禁用" ? status : "启用"; }
function normalizeKnowledgeType(type: string): KnowledgeItem["type"] { const allowed: KnowledgeItem["type"][] = ["SOP", "品牌", "平台规则", "决策", "代码文档"]; return allowed.includes(type as KnowledgeItem["type"]) ? type as KnowledgeItem["type"] : "SOP"; }
function normalizeKnowledgeStatus(status: string): KnowledgeItem["status"] { const allowed: KnowledgeItem["status"][] = ["已审核", "契约", "将过期", "草稿"]; return allowed.includes(status as KnowledgeItem["status"]) ? status as KnowledgeItem["status"] : "草稿"; }
export function normalizeConnectorStatus(status: string): ConnectorRecord["status"] { const allowed: ConnectorRecord["status"][] = ["在线", "CLI", "待检查", "禁用"]; return allowed.includes(status as ConnectorRecord["status"]) ? status as ConnectorRecord["status"] : "待检查"; }
function formatTime(value: string) { return Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleTimeString(); }
