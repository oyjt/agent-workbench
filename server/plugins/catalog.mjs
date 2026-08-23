import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function createCatalogPlugin(projectRoot) {
  return {
    id: "workbench.catalog",
    setup(context) {
      context.addDisposable(context.capabilities.register({
        id: "catalog:skills.scan",
        title: "扫描本地 Skills",
        risk: "low",
        execute: async () => scanSkills(projectRoot),
      }));
      context.addDisposable(context.capabilities.register({
        id: "catalog:plugins.scan",
        title: "扫描 Workflow Plugins",
        risk: "low",
        execute: async () => scanWorkflowPlugins(projectRoot),
      }));
    },
  };
}

function scanSkills(projectRoot) {
  const skillsDir = resolve(projectRoot, "skills");
  if (!existsSync(skillsDir)) return [];
  return directories(skillsDir).map((id) => {
    const path = join(skillsDir, id, "SKILL.md");
    if (!existsSync(path)) return null;
    const meta = parseFrontMatter(readFileSync(path, "utf8"));
    return { id, name: meta.name ?? id, description: meta.description ?? "", path, permissions: splitList(meta.permissions), risk: meta.risk ?? "low" };
  }).filter(Boolean);
}

function scanWorkflowPlugins(projectRoot) {
  const pluginsDir = resolve(projectRoot, "plugins");
  if (!existsSync(pluginsDir)) return [];
  return directories(pluginsDir).map((id) => {
    const pluginDir = join(pluginsDir, id);
    const skillPath = join(pluginDir, "SKILL.md");
    const manifestPath = join(pluginDir, "plugin.json");
    if (!existsSync(skillPath) || !existsSync(manifestPath)) return null;
    const meta = parseFrontMatter(readFileSync(skillPath, "utf8"));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      id: manifest.id ?? id,
      name: manifest.name ?? meta.name ?? id,
      description: manifest.description ?? meta.description ?? "",
      version: manifest.version ?? "0.1.0",
      path: pluginDir,
      skills: manifest.skills ?? [],
      mcpTools: manifest.mcpTools ?? [],
      cliCommands: manifest.cliCommands ?? [],
      knowledgeScopes: manifest.knowledgeScopes ?? [],
      capabilities: manifest.capabilities ?? [],
      pipeline: manifest.pipeline ?? [],
      manifest,
    };
  }).filter(Boolean);
}

function directories(path) {
  return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function parseFrontMatter(content) {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  return Object.fromEntries(content.slice(3, end).trim().split("\n").flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return [];
    return [[line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^["']|["']$/g, "")]];
  }));
}

function splitList(value) {
  if (!value) return [];
  return value.replace(/^\[|\]$/g, "").split(",").map((item) => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

