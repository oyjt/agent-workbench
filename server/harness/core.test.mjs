import test from "node:test";
import assert from "node:assert/strict";
import { AgentHarness, CapabilityRegistry } from "./core.mjs";
import { CapabilityApprovalRequired, createRiskPolicy, executeCapability } from "./policy.mjs";

test("capability registration is reversible", () => {
  const registry = new CapabilityRegistry();
  const dispose = registry.register({ id: "demo", risk: "low", execute: async () => "ok" });
  assert.equal(registry.get("demo")?.id, "demo");
  dispose();
  assert.equal(registry.get("demo"), undefined);
});

test("plugin removal disposes registered capabilities", async () => {
  const harness = new AgentHarness();
  await harness.use({
    id: "demo-plugin",
    setup(ctx) {
      ctx.addDisposable(ctx.capabilities.register({ id: "demo", risk: "low", execute: async () => "ok" }));
    },
  });
  assert.equal(harness.capabilities.get("demo")?.id, "demo");
  harness.remove("demo-plugin");
  assert.equal(harness.capabilities.get("demo"), undefined);
});

test("risk policy asks before medium risk execution", async () => {
  const registry = new CapabilityRegistry();
  registry.register({ id: "publish", risk: "medium", execute: async () => "published" });
  let requested = false;
  const result = await executeCapability({
    registry,
    policy: createRiskPolicy(),
    capabilityId: "publish",
    input: {},
    context: { emit() {} },
    requestApproval: async () => {
      requested = true;
      return true;
    },
  });
  assert.equal(requested, true);
  assert.equal(result, "published");
});

test("pending approval pauses capability before provider execution", async () => {
  const registry = new CapabilityRegistry();
  let executed = false;
  registry.register({ id: "publish", risk: "high", execute: async () => { executed = true; } });
  await assert.rejects(
    executeCapability({
      registry,
      policy: createRiskPolicy(),
      capabilityId: "publish",
      input: {},
      context: { emit() {} },
      requestApproval: async () => ({ pending: true, approval: { id: "approval_1" } }),
    }),
    (error) => error instanceof CapabilityApprovalRequired && error.approval.id === "approval_1",
  );
  assert.equal(executed, false);
});

test("an approved execution resumes through policy without asking twice", async () => {
  const harness = new AgentHarness();
  let calls = 0;
  harness.capabilities.register({ id: "cli:publish", risk: "high", execute: async () => ++calls });
  const result = await executeCapability({
    registry: harness.capabilities,
    policy: createRiskPolicy(),
    capabilityId: "cli:publish",
    input: {},
    context: { approvalGranted: true },
  });
  assert.equal(result, 1);
  assert.equal(calls, 1);
});
