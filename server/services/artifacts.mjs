import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

export function createArtifactService({ projectRoot, statements, mappers, createId, requiredString, stringOr }) {
  const { insertArtifact, getArtifact, insertArtifactVersion, countArtifactVersions, updateArtifactPathStatement, getLatestArtifactVersion, listArtifactVersions } = statements;
  const { artifactFromRow, artifactVersionFromRow } = mappers;

  function createVersion(artifactId, body) {
    const artifact = getArtifact.get(artifactId);
    if (!artifact) throw new Error("artifact_not_found");
    const content = requiredString(body.content, "content");
    const version = Number(countArtifactVersions.get(artifactId)?.count ?? 0) + 1;
    const now = new Date().toISOString();
    const path = [".agent-workbench", "artifacts", safeName(artifact.task_id ?? "manual"), artifact.id, `${String(version).padStart(3, "0")}-${safeName(artifact.name)}`].join("/");
    const absolutePath = safeAbsolutePath(projectRoot, path);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
    const row = { id: createId("artifact_version"), artifactId, version, path, summary: stringOr(body.summary, `version ${version}`), contentType: stringOr(body.contentType, "text/markdown"), bytes: Buffer.byteLength(content, "utf8"), createdAt: now };
    insertArtifactVersion.run(row.id, row.artifactId, row.version, row.path, row.summary, row.contentType, row.bytes, row.createdAt);
    updateArtifactPathStatement.run(row.path, now, artifactId);
    return row;
  }

  return {
    create(body) {
      const now = new Date().toISOString();
      const artifact = { id: createId("artifact"), taskId: typeof body.taskId === "string" ? body.taskId : null, runId: typeof body.runId === "string" ? body.runId : null, name: requiredString(body.name, "name"), kind: stringOr(body.kind, "markdown"), summary: stringOr(body.summary, ""), source: stringOr(body.source, "manual"), path: stringOr(body.path, ""), manifest: body.manifest && typeof body.manifest === "object" ? body.manifest : {}, createdAt: now, updatedAt: now };
      const hasContent = typeof body.content === "string" && body.content.length > 0;
      if (hasContent && !artifact.path) artifact.path = [".agent-workbench", "artifacts", safeName(artifact.taskId ?? "manual"), artifact.id, `001-${safeName(artifact.name)}`].join("/");
      insertArtifact.run(artifact.id, artifact.taskId, artifact.runId, artifact.name, artifact.kind, artifact.summary, artifact.source, artifact.path, JSON.stringify(artifact.manifest), artifact.createdAt, artifact.updatedAt);
      if (!hasContent) return artifact;
      createVersion(artifact.id, { content: body.content, summary: artifact.summary, contentType: contentType(artifact.kind) });
      const updated = getArtifact.get(artifact.id);
      return updated ? artifactFromRow(updated) : artifact;
    },
    createVersion,
    readContent(artifactId) {
      const artifact = getArtifact.get(artifactId);
      if (!artifact) throw new Error("artifact_not_found");
      const version = getLatestArtifactVersion.get(artifactId);
      const path = version?.path ?? artifact.path;
      let content = "";
      try {
        const absolutePath = safeAbsolutePath(projectRoot, path);
        if (existsSync(absolutePath)) content = readFileSync(absolutePath, "utf8");
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "invalid_artifact_path") throw error;
      }
      return { artifact: artifactFromRow(artifact), content, versions: listArtifactVersions.all(artifactId).map(artifactVersionFromRow) };
    },
  };
}

function safeAbsolutePath(root, path) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (rel.startsWith("..") || rel.startsWith("/")) throw new Error("invalid_artifact_path");
  return absolute;
}
function safeName(value) { return String(value).trim().replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "artifact"; }
function contentType(kind) { if (kind === "diff") return "text/x-diff"; if (kind === "json") return "application/json"; return "text/markdown"; }

