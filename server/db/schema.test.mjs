import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { initializeDatabase, schemaTables } from "./schema.mjs";

test("database initializer creates the declared schema", () => {
  const directory = mkdtempSync(join(tmpdir(), "agent-workbench-schema-"));
  const database = new DatabaseSync(join(directory, "test.sqlite"));
  try {
    initializeDatabase(database);
    const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const names = new Set(rows.map((row) => row.name));
    for (const table of schemaTables) assert.equal(names.has(table), true, `missing table ${table}`);
    const agentColumns = database.prepare("PRAGMA table_info(agents)").all().map((row) => row.name);
    assert.equal(agentColumns.includes("model_provider_id"), true);
    const now = new Date().toISOString();
    database.prepare("INSERT INTO model_providers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("provider_1", "Local", "http://127.0.0.1:11434/v1", "none", "local-model", 1, 1, now, now);
    database.prepare("INSERT INTO agents VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run("agent_1", "Agent", "Test", "Codex", "provider_1", "local-model", "", "[]", "project", "collaborative", "enabled", now, now);
    assert.throws(() => database.prepare("INSERT INTO model_providers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run("provider_2", "Other", "https://api.example.com/v1", "bearer", "other-model", 1, 1, now, now));
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("database initializer rejects the legacy agent schema with reset guidance", () => {
  const database = new DatabaseSync(":memory:");
  try {
    database.exec("CREATE TABLE agents (id TEXT PRIMARY KEY, model TEXT NOT NULL) STRICT");
    assert.throws(() => initializeDatabase(database), /pnpm db:reset/);
  } finally {
    database.close();
  }
});
