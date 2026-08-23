import type { ApiRunEvent } from "../api";
import type { ArtifactRecord, Task, WorkbenchSnapshot } from "../domain/workbench";

const WORKSPACE_KEY = "agent-workbench-static-workspace-v1";
const WORKSPACE_DB = "agent-workbench-static-db";
const WORKSPACE_STORE = "snapshots";

function openWorkspaceDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(WORKSPACE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(WORKSPACE_STORE)) request.result.createObjectStore(WORKSPACE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb_open_failed"));
  });
}

export async function loadStaticSnapshot() {
  try {
    if (window.indexedDB) {
      const db = await openWorkspaceDb();
      const snapshot = await new Promise<WorkbenchSnapshot | null>((resolve, reject) => {
        const request = db.transaction(WORKSPACE_STORE, "readonly").objectStore(WORKSPACE_STORE).get(WORKSPACE_KEY);
        request.onsuccess = () => resolve((request.result as WorkbenchSnapshot | undefined) ?? null);
        request.onerror = () => reject(request.error ?? new Error("indexeddb_read_failed"));
      });
      db.close();
      if (snapshot?.version === 1) return snapshot;
    }
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as WorkbenchSnapshot;
    return snapshot.version === 1 ? snapshot : null;
  } catch {
    return null;
  }
}

export async function saveStaticSnapshot(snapshot: WorkbenchSnapshot) {
  try {
    if (window.indexedDB) {
      const db = await openWorkspaceDb();
      await new Promise<void>((resolve, reject) => {
        const request = db.transaction(WORKSPACE_STORE, "readwrite").objectStore(WORKSPACE_STORE).put(snapshot, WORKSPACE_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("indexeddb_write_failed"));
      });
      db.close();
    }
  } catch {
    // IndexedDB is optional; localStorage remains the compatibility store.
  } finally {
    window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot));
  }
}

export function createBrowserId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nowLabel() { return "刚刚"; }

export function createBrowserEvent(runId: string, type: string, payload: unknown): ApiRunEvent {
  return { id: createBrowserId("evt"), runId, type, payload, createdAt: new Date().toISOString() };
}

export function createArtifactRecord(task: Task, runId: string, kind: "markdown" | "diff" = task.runtime === "Codex" ? "diff" : "markdown"): ArtifactRecord {
  const extension = kind === "diff" ? "diff.md" : "draft.md";
  const content = kind === "diff"
    ? [`# ${task.title} · Diff Summary`, "", "```diff", "+ static workflow execution", "+ artifact version generated", "```", ""].join("\n")
    : [`# ${task.title}`, "", task.description, "", "静态模式生成的本地草稿，可导出或继续返工。", ""].join("\n");
  return {
    key: createBrowserId("artifact"), file: `${task.title} · ${extension}`, type: kind.toUpperCase(), source: task.runtime,
    summary: kind === "diff" ? "浏览器本地模拟的代码变更摘要。" : "浏览器本地模拟的内容草稿。",
    path: `browser://artifacts/${task.key}/${extension}`, updatedAt: "刚刚", content,
    versions: [{ key: createBrowserId("artifact_version"), version: 1, path: `browser://artifacts/${task.key}/${extension}`, summary: "浏览器本地首版产物。", bytes: new Blob([content]).size, createdAt: "刚刚" }],
    manifest: { taskKey: task.key, runId, mode: "static" },
  };
}

export function createStaticRunEvents(task: Task, runId: string, artifact: ArtifactRecord): ApiRunEvent[] {
  return [
    createBrowserEvent(runId, "runtime.started", { adapter: "browser-static", target: task.target }),
    createBrowserEvent(runId, "agent.started", { runtime: task.runtime, target: task.target }),
    createBrowserEvent(runId, "message.delta", { role: "assistant", text: `静态模式已模拟执行：${task.title}` }),
    createBrowserEvent(runId, "agent.completed", { target: task.target }),
    createBrowserEvent(runId, artifact.type === "DIFF" ? "adapter.codex.diff" : "artifact.created", { artifactId: artifact.key, title: artifact.file, summary: artifact.summary }),
    createBrowserEvent(runId, "run.status_changed", { status: "done" }),
  ];
}
