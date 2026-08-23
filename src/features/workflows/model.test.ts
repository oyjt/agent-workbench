import assert from "node:assert/strict";
import test from "node:test";
import { affectedWorkflowSteps, buildWorkflowLevels, parseWorkflowYaml, serializeWorkflowYaml } from "./model.ts";

const plan = {
  key: "workflow_test",
  name: "内容流水线",
  description: "验证序列化契约",
  provider: "codex-cli",
  concurrency: 2,
  tags: ["content", "review"],
  steps: [
    { id: "research", role: "研究员", task: "收集材料", dependsOn: [] },
    { id: "draft", role: "作者", task: "撰写初稿", output: "draft.md", dependsOn: ["research"] },
    { id: "review", role: "审校", task: "审校内容", dependsOn: ["draft"] },
  ],
};

test("workflow YAML serialization round-trips the domain contract", () => {
  const parsed = parseWorkflowYaml(serializeWorkflowYaml(plan));
  assert.deepEqual({ ...parsed, key: plan.key }, plan);
});

test("workflow graph groups executable steps by dependency level", () => {
  assert.deepEqual(buildWorkflowLevels(plan.steps).map((level) => level.map((step) => step.id)), [
    ["research"],
    ["draft"],
    ["review"],
  ]);
});

test("workflow rerun scope contains the selected step and its dependants", () => {
  assert.deepEqual(affectedWorkflowSteps(plan.steps, "draft").map((step) => step.id), ["draft", "review"]);
});
