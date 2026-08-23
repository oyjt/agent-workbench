import type { WorkflowPlan, WorkflowStepRecord } from "../../domain/workbench";

export function serializeWorkflowYaml(plan: WorkflowPlan) {
  const lines = [`name: ${JSON.stringify(plan.name)}`, `description: ${JSON.stringify(plan.description)}`, `provider: ${JSON.stringify(plan.provider)}`, `concurrency: ${plan.concurrency}`, "tags:", ...plan.tags.map((tag) => `  - ${JSON.stringify(tag)}`), "steps:"];
  for (const step of plan.steps) {
    lines.push(`  - id: ${JSON.stringify(step.id)}`, `    role: ${JSON.stringify(step.role)}`, `    task: ${JSON.stringify(step.task)}`);
    if (step.output) lines.push(`    output: ${JSON.stringify(step.output)}`);
    if (step.type) lines.push(`    type: ${JSON.stringify(step.type)}`);
    lines.push("    depends_on:");
    if (step.dependsOn.length === 0) lines.push("      []");
    else step.dependsOn.forEach((dependency) => lines.push(`      - ${JSON.stringify(dependency)}`));
  }
  return `${lines.join("\n")}\n`;
}

export function parseWorkflowYaml(yaml: string): WorkflowPlan {
  const plan: WorkflowPlan = { key: browserId(), name: "导入工作流", description: "", provider: "codex-cli", concurrency: 1, tags: [], steps: [] };
  let mode = "";
  let currentStep: WorkflowStepRecord | null = null;
  let readingDependencies = false;
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (!line.startsWith(" ")) {
      readingDependencies = false;
      if (trimmed === "tags:" || trimmed === "steps:") { mode = trimmed.slice(0, -1); continue; }
      const [key, value] = splitPair(trimmed);
      if (key === "name") plan.name = unquote(value);
      if (key === "description") plan.description = unquote(value);
      if (key === "provider") plan.provider = unquote(value);
      if (key === "concurrency") plan.concurrency = Number(value) || 1;
      continue;
    }
    if (mode === "tags" && trimmed.startsWith("- ")) { plan.tags.push(unquote(trimmed.slice(2))); continue; }
    if (mode !== "steps") continue;
    if (trimmed.startsWith("- id:")) {
      currentStep = { id: unquote(trimmed.slice(5).trim()), role: "", task: "", dependsOn: [] };
      plan.steps.push(currentStep);
      readingDependencies = false;
      continue;
    }
    if (!currentStep) continue;
    if (trimmed === "dependsOn:" || trimmed === "depends_on:") { readingDependencies = true; currentStep.dependsOn = []; continue; }
    if (readingDependencies && trimmed.startsWith("- ")) { currentStep.dependsOn.push(unquote(trimmed.slice(2))); continue; }
    if (readingDependencies && trimmed === "[]") { currentStep.dependsOn = []; continue; }
    readingDependencies = false;
    const [key, value] = splitPair(trimmed);
    if (key === "role") currentStep.role = unquote(value);
    if (key === "task") currentStep.task = unquote(value);
    if (key === "output") currentStep.output = unquote(value);
    if (key === "type") currentStep.type = unquote(value) as WorkflowStepRecord["type"];
  }
  plan.steps = plan.steps.filter((step) => step.id && step.role && step.task);
  if (plan.steps.length === 0) throw new Error("empty_workflow");
  return plan;
}

export function buildWorkflowLevels(steps: WorkflowStepRecord[]) {
  const remaining = new Map(steps.map((step) => [step.id, step]));
  const completed = new Set<string>();
  const levels: WorkflowStepRecord[][] = [];
  while (remaining.size > 0) {
    const level = [...remaining.values()].filter((step) => step.dependsOn.every((dependency) => completed.has(dependency)));
    if (level.length === 0) { levels.push([...remaining.values()]); break; }
    levels.push(level);
    for (const step of level) { completed.add(step.id); remaining.delete(step.id); }
  }
  return levels;
}

export function affectedWorkflowSteps(steps: WorkflowStepRecord[], fromStepId: string) {
  const affected = new Set([fromStepId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const step of steps) {
      if (!affected.has(step.id) && step.dependsOn.some((dependency) => affected.has(dependency))) { affected.add(step.id); changed = true; }
    }
  }
  return steps.filter((step) => affected.has(step.id)).map((step) => ({ ...step, dependsOn: step.dependsOn.filter((dependency) => affected.has(dependency)) }));
}

function browserId() { return `workflow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
function splitPair(line: string) { const separator = line.indexOf(":"); return separator === -1 ? [line, ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]; }
function unquote(value: string) { const trimmed = value.trim(); try { return JSON.parse(trimmed) as string; } catch { return trimmed.replace(/^["']|["']$/g, ""); } }

