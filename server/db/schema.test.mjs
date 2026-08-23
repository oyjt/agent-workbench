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
  } finally {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

