import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8"));
const releaseDir = resolve(projectRoot, ".agent-workbench", "release");
const archiveName = `${pkg.name}-${pkg.version}.tgz`;
const archivePath = resolve(releaseDir, archiveName);
const includePaths = [
  "dist",
  "server",
  "package.json",
  "pnpm-lock.yaml",
  "README.md",
  "docs",
  "skills",
  "plugins",
].filter((item) => existsSync(resolve(projectRoot, item)));

if (!existsSync(resolve(projectRoot, "dist", "index.html"))) {
  console.error("dist/index.html not found. Run pnpm build first.");
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const result = spawnSync("tar", ["-czf", archivePath, ...includePaths], {
  cwd: projectRoot,
  encoding: "utf8",
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

console.log(JSON.stringify({ ok: true, archivePath, files: includePaths }, null, 2));
