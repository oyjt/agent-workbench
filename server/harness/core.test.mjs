import test from "node:test";
import assert from "node:assert/strict";
import { AgentHarness, CapabilityRegistry } from "./core.mjs";
import { createRiskPolicy, executeCapability } from "./policy.mjs";

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
