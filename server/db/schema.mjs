export const schemaTables = ["tasks", "runs", "events", "model_providers", "agents", "knowledge_items", "connectors", "approvals", "pending_capability_executions", "agent_teams", "artifacts", "artifact_versions", "workflows"];

export function initializeDatabase(db) {
  const agentColumns = db.prepare("PRAGMA table_info(agents)").all().map((row) => row.name);
  if (agentColumns.length && !agentColumns.includes("model_provider_id")) {
    throw new Error("database_schema_incompatible: agents.model_provider_id is missing; back up local data and run pnpm db:reset");
  }

  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, prompt TEXT NOT NULL, target_type TEXT NOT NULL,
      target_id TEXT NOT NULL, owner TEXT NOT NULL, runtime TEXT NOT NULL, status TEXT NOT NULL,
      priority TEXT NOT NULL, requires_approval INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, status TEXT NOT NULL, started_at TEXT, completed_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS model_providers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL,
      auth_type TEXT NOT NULL CHECK (auth_type IN ('bearer', 'none')),
      default_model TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, runtime TEXT NOT NULL,
      model_provider_id TEXT NOT NULL, model TEXT NOT NULL,
      system_prompt TEXT NOT NULL, skill_ids TEXT NOT NULL, knowledge_scope TEXT NOT NULL, permission_profile TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (model_provider_id) REFERENCES model_providers(id) ON DELETE RESTRICT
    ) STRICT;
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, tags TEXT NOT NULL,
      visibility TEXT NOT NULL, status TEXT NOT NULL, source_url TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS connectors (
      id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, command TEXT NOT NULL,
      risk TEXT NOT NULL, binding TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, title TEXT NOT NULL, source TEXT NOT NULL, risk TEXT NOT NULL,
      capabilities TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS pending_capability_executions (
      approval_id TEXT PRIMARY KEY, capability_id TEXT NOT NULL, input TEXT NOT NULL, context TEXT NOT NULL,
      status TEXT NOT NULL, result TEXT, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      FOREIGN KEY (approval_id) REFERENCES approvals(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS agent_teams (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, workflow TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS agent_team_members (
      team_id TEXT NOT NULL, agent_id TEXT NOT NULL, role TEXT NOT NULL, member_order INTEGER NOT NULL,
      PRIMARY KEY (team_id, agent_id, role)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY, task_id TEXT, run_id TEXT, name TEXT NOT NULL, kind TEXT NOT NULL, summary TEXT NOT NULL,
      source TEXT NOT NULL, path TEXT NOT NULL, manifest TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS artifact_versions (
      id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL, version INTEGER NOT NULL, path TEXT NOT NULL, summary TEXT NOT NULL,
      content_type TEXT NOT NULL, bytes INTEGER NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY (artifact_id) REFERENCES artifacts(id) ON DELETE CASCADE
    ) STRICT;
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, provider TEXT NOT NULL, concurrency INTEGER NOT NULL,
      tags TEXT NOT NULL, steps TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
    CREATE INDEX IF NOT EXISTS idx_events_run_id_created_at ON events(run_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_artifacts_task_id ON artifacts(task_id);
    CREATE INDEX IF NOT EXISTS idx_artifact_versions_artifact_id ON artifact_versions(artifact_id, version);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_model_providers_default ON model_providers(is_default) WHERE is_default = 1;
  `);
}
