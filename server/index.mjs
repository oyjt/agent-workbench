import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.AGENT_WORKBENCH_DATA_DIR ?? resolve(projectRoot, ".agent-workbench", "data");
const dbPath = resolve(dataDir, "workbench.sqlite");
const port = Number(process.env.AGENT_WORKBENCH_API_PORT ?? 8787);
const host = process.env.AGENT_WORKBENCH_API_HOST ?? "127.0.0.1";

mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(dbPath, { timeout: 5000 });

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

  CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_events_run_id_created_at ON events(run_id, created_at);
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
const listTasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC");
const listEvents = db.prepare("SELECT * FROM events WHERE run_id = ? ORDER BY created_at ASC");
const getRun = db.prepare("SELECT * FROM runs WHERE id = ?");

if (process.argv.includes("--init")) {
  console.log(JSON.stringify({ ok: true, dbPath, schema: ["tasks", "runs", "events"] }, null, 2));
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

  return {
    taskId,
    runId,
    status,
    task: {
      id: taskId,
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

function appendEvent(runId, type, payload) {
  const event = {
    id: createId("evt"),
    runId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  insertEvent.run(event.id, runId, event.type, JSON.stringify(event.payload), event.createdAt);
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
    response.write(`event: runtime\n`);
    response.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const interval = setInterval(() => {
    response.write(`event: ping\n`);
    response.write(`data: ${JSON.stringify({ runId, at: new Date().toISOString() })}\n\n`);
  }, 15000);

  request.on("close", () => clearInterval(interval));
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

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
