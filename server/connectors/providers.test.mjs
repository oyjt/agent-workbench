import assert from "node:assert/strict";
import test from "node:test";
import { ConnectorProviderRegistry } from "./providers.mjs";

test("connector providers are selected by registration instead of a central switch", async () => {
  const registry = new ConnectorProviderRegistry();
  const dispose = registry.register({ id: "custom", matches: (connector) => connector.kind === "CUSTOM", invoke: async () => "ok" });
  assert.equal(await registry.invoke({ kind: "CUSTOM" }, {}), "ok");
  dispose();
  assert.throws(() => registry.resolve({ kind: "CUSTOM" }), /provider_not_found/);
});
