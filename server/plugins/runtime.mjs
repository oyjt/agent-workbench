const runtimeAdapters = [
  { id: "codex-cli", runtimes: ["Codex"], kind: "coding", capabilities: ["events", "artifacts", "diff"] },
  { id: "opencode", runtimes: ["OpenCode"], kind: "coding", capabilities: ["events", "artifacts"] },
  { id: "generic-browser-worker", runtimes: ["BrowserOps"], kind: "browser", capabilities: ["events", "artifacts", "network"] },
  { id: "local-runtime", runtimes: ["Local", "Workflow"], kind: "custom", capabilities: ["events", "artifacts"] },
];

export function resolveRuntimeAdapter(runtime) {
  return runtimeAdapters.find((adapter) => adapter.runtimes.includes(runtime)) ?? runtimeAdapters.at(-1);
}

export const runtimePlugin = {
  id: "workbench.runtime",
  setup(context) {
    context.addDisposable(context.capabilities.register({
      id: "runtime:resolve",
      title: "解析 Runtime Adapter",
      risk: "low",
      execute: async ({ runtime }) => resolveRuntimeAdapter(runtime),
    }));
    context.addDisposable(context.capabilities.register({
      id: "runtime:list",
      title: "列出 Runtime Adapters",
      risk: "low",
      execute: async () => runtimeAdapters,
    }));
  },
};
