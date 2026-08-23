export function createRowMappers(listTeamMembers) {
  return {
    taskFromRow: (row) => ({ id: row.id, runId: row.run_id, title: row.title, prompt: row.prompt, targetType: row.target_type, targetId: row.target_id, owner: row.owner, runtime: row.runtime, status: row.status, priority: row.priority, requiresApproval: Boolean(row.requires_approval), createdAt: row.created_at, updatedAt: row.updated_at }),
    agentFromRow: (row) => ({ id: row.id, name: row.name, description: row.description, runtime: row.runtime, model: row.model, systemPrompt: row.system_prompt, skillIds: JSON.parse(row.skill_ids), knowledgeScope: row.knowledge_scope, permissionProfile: row.permission_profile, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }),
    knowledgeFromRow: (row) => ({ id: row.id, title: row.title, type: row.type, content: row.content, tags: JSON.parse(row.tags), visibility: row.visibility, status: row.status, sourceUrl: row.source_url, createdAt: row.created_at, updatedAt: row.updated_at }),
    connectorFromRow: (row) => ({ id: row.id, kind: row.kind, name: row.name, description: row.description, command: row.command, risk: row.risk, binding: row.binding, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }),
    approvalFromRow: (row) => ({ id: row.id, taskId: row.task_id, title: row.title, source: row.source, risk: row.risk, capabilities: JSON.parse(row.capabilities), status: row.status, reason: row.reason, createdAt: row.created_at, updatedAt: row.updated_at }),
    teamFromRow: (row) => ({ id: row.id, name: row.name, workflow: row.workflow, description: row.description, status: row.status, members: listTeamMembers.all(row.id).map((member) => ({ agentId: member.agent_id, role: member.role, order: member.member_order })), createdAt: row.created_at, updatedAt: row.updated_at }),
    artifactFromRow: (row) => ({ id: row.id, taskId: row.task_id, runId: row.run_id, name: row.name, kind: row.kind, summary: row.summary, source: row.source, path: row.path, manifest: JSON.parse(row.manifest), createdAt: row.created_at, updatedAt: row.updated_at }),
    workflowFromRow: (row) => ({ id: row.id, name: row.name, description: row.description, provider: row.provider, concurrency: row.concurrency, tags: JSON.parse(row.tags), steps: JSON.parse(row.steps), status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }),
    artifactVersionFromRow: (row) => ({ id: row.id, artifactId: row.artifact_id, version: row.version, path: row.path, summary: row.summary, contentType: row.content_type, bytes: row.bytes, createdAt: row.created_at }),
    secretFromRow: (row) => {
      const status = process.env[row.env_var] ? "available" : "missing";
      return { id: row.id, name: row.name, scope: row.scope, envVar: row.env_var, status, valuePreview: status === "available" ? `${row.env_var}=***` : `${row.env_var}=<missing>`, createdAt: row.created_at, updatedAt: row.updated_at };
    },
    eventFromRow: (row) => ({ id: row.id, runId: row.run_id, type: row.type, payload: JSON.parse(row.payload), createdAt: row.created_at }),
  };
}

