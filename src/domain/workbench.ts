import type { ApiRunEvent } from "../api";

export type PageKey = "overview" | "agents" | "skills" | "plugins" | "knowledge" | "connectors" | "creative" | "workflows" | "assets" | "settings";
export type TaskStatus = "queued" | "approval" | "running" | "paused" | "done" | "failed" | "cancelled";
export type RiskLevel = "low" | "medium" | "high";
export type ConnectorKind = "MCP" | "CLI";

export type Task = { key: string; runId?: string; title: string; description: string; owner: string; runtime: string; status: TaskStatus; target: string; updatedAt: string };
export type AgentRecord = { key: string; name: string; description: string; runtime: string; model: string; capability: string; knowledgeScope: string; permissionProfile: string; status: "启用" | "运行中" | "禁用" };
export type AgentTeamRecord = { key: string; name: string; workflow: string; description: string; status: "启用" | "运行中" | "禁用"; members: Array<{ agentId: string; role: string; order: number }> };
export type KnowledgeItem = { key: string; title: string; type: "SOP" | "品牌" | "平台规则" | "决策" | "代码文档"; meta: string; status: "已审核" | "契约" | "将过期" | "草稿"; tags: string[]; visibility: "team" | "project" };
export type ConnectorRecord = { key: string; kind: ConnectorKind; name: string; description: string; status: "在线" | "CLI" | "待检查" | "禁用"; risk: RiskLevel; binding: string };
export type ApprovalRecord = { key: string; taskKey: string; title: string; source: string; risk: RiskLevel; capabilities: string[]; status: "pending" | "allowed" | "denied"; reason: string };
export type WorkflowStepRecord = { id: string; role: string; task: string; output?: string; dependsOn: string[]; type?: "normal" | "approval" | "human_input" };
export type WorkflowPlan = { key: string; name: string; description: string; provider: string; concurrency: number; tags: string[]; steps: WorkflowStepRecord[] };
export type ArtifactVersionRecord = { key: string; version: number; path: string; summary: string; bytes: number; createdAt: string };
export type ArtifactRecord = { key: string; file: string; type: string; source: string; summary: string; path: string; updatedAt: string; content?: string; versions?: ArtifactVersionRecord[]; manifest?: Record<string, unknown> };
export type SecretRecord = { key: string; name: string; scope: string; envVar: string; status: "available" | "missing"; valuePreview: string };
export type ArtifactPreviewState = { open: boolean; artifact?: ArtifactRecord; content: string };
export type TaskFormValues = { title: string; prompt: string; targetType: "agent" | "agent_team" | "plugin"; targetId: string; priority: "normal" | "high"; requiresApproval: boolean };
export type AgentFormValues = { name: string; description: string; runtime: string; model: string; permissionProfile: string; systemPrompt: string; skillIds: string[]; knowledgeScope: string };
export type AgentTeamFormValues = { name: string; workflow: string; description: string; agentIds: string[] };
export type KnowledgeFormValues = { title: string; type: KnowledgeItem["type"]; content: string; tags: string[]; visibility: KnowledgeItem["visibility"] };
export type ConnectorFormValues = { name: string; description: string; command: string; risk: RiskLevel; binding: string };
export type SecretFormValues = { name: string; scope: string; envVar: string };
export type WorkspaceMode = "api" | "static";
export type WorkbenchSnapshot = { version: 1; exportedAt: string; tasks: Task[]; selectedTaskKey?: string; agents: AgentRecord[]; agentTeams: AgentTeamRecord[]; knowledgeItems: KnowledgeItem[]; connectors: ConnectorRecord[]; approvals: ApprovalRecord[]; artifacts: ArtifactRecord[]; savedWorkflows: WorkflowPlan[]; runEvents: Record<string, ApiRunEvent[]>; secrets?: SecretRecord[] };

