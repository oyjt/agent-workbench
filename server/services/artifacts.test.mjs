import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createArtifactService } from "./artifacts.mjs";

test("artifact versions stay inside the workspace and persist metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "agent-workbench-artifact-"));
  const inserts = [];
  const service = createArtifactService({
    projectRoot: root,
    statements: {
      insertArtifact: { run() {} },
      getArtifact: { get: () => ({ id: "artifact_1", task_id: "task_1", name: "draft.md", path: "" }) },
      insertArtifactVersion: { run: (...args) => inserts.push(args) },
      countArtifactVersions: { get: () => ({ count: 0 }) },
      updateArtifactPathStatement: { run() {} },
      getLatestArtifactVersion: { get() {} },
      listArtifactVersions: { all: () => [] },
    },
    mappers: { artifactFromRow: (row) => row, artifactVersionFromRow: (row) => row },
    createId: () => "version_1",
    requiredString: (value) => value,
    stringOr: (value, fallback) => value || fallback,
  });
  try {
    const version = service.createVersion("artifact_1", { content: "hello" });
    assert.equal(version.version, 1);
    assert.equal(existsSync(join(root, version.path)), true);
    assert.equal(inserts.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

