export class ConnectorProviderRegistry {
  #providers = [];

  register(provider) {
    if (!provider?.id || typeof provider.matches !== "function" || typeof provider.invoke !== "function") {
      throw new Error("invalid_connector_provider");
    }
    if (this.#providers.some((candidate) => candidate.id === provider.id)) throw new Error(`duplicate_connector_provider:${provider.id}`);
    this.#providers.unshift(provider);
    return () => { this.#providers = this.#providers.filter((candidate) => candidate !== provider); };
  }

  resolve(connector) {
    const provider = this.#providers.find((candidate) => candidate.matches(connector));
    if (!provider) throw new Error(`connector_provider_not_found:${connector.kind}`);
    return provider;
  }

  check(connector) {
    const provider = this.resolve(connector);
    return typeof provider.check === "function" ? provider.check(connector) : { ok: true, status: "在线", result: { provider: provider.id } };
  }

  invoke(connector, input, context = {}) {
    return this.resolve(connector).invoke(connector, input, context);
  }
}

export function createDefaultConnectorProviders({ projectRoot, spawnSync, callMcpStdio }) {
  const registry = new ConnectorProviderRegistry();
  registry.register({
    id: "mcp-stdio",
    matches: (connector) => connector.kind !== "CLI" && !/^https?:\/\//.test(connector.command),
    async check(connector) {
      try { return { ok: true, status: "在线", result: await callMcpStdio(connector.command, { mode: "tools/list", timeoutMs: 15000 }) }; }
      catch (error) { return { ok: false, status: "待检查", error: error instanceof Error ? error.message : "mcp_check_failed" }; }
    },
    async invoke(connector, input, { emit = () => {} } = {}) {
      emit("mcp.tool_call.started", { connectorId: connector.id, name: connector.name, startedAt: new Date().toISOString() });
      const result = await callMcpStdio(connector.command, {
        mode: input.toolName ? "tools/call" : "tools/list",
        toolName: typeof input.toolName === "string" ? input.toolName : undefined,
        toolArgs: input.toolArgs && typeof input.toolArgs === "object" ? input.toolArgs : {},
        timeoutMs: 30000,
      });
      emit("mcp.tool_call.completed", { connectorId: connector.id, name: connector.name, result });
      return { ok: true, status: "completed", result };
    },
  });
  registry.register({
    id: "mcp-http",
    matches: (connector) => connector.kind !== "CLI" && /^https?:\/\//.test(connector.command),
    check: () => ({ ok: true, status: "在线", result: { transport: "http", message: "HTTP MCP endpoint registered" } }),
    async invoke(connector, _input, { emit = () => {} } = {}) {
      emit("mcp.tool_call.completed", { connectorId: connector.id, name: connector.name, transport: "http", simulated: true });
      return { ok: true, status: "completed", result: { message: "HTTP MCP endpoint registered; stdio call skipped" } };
    },
  });
  registry.register({
    id: "cli",
    matches: (connector) => connector.kind === "CLI",
    check(connector) {
      const [command, ...args] = splitCommandLine(connector.command);
      const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8", timeout: 15000, shell: false });
      const ok = !result.error && result.status === 0;
      return { ok, status: ok ? "CLI" : "待检查", result: commandResult(result, 2000) };
    },
    async invoke(connector, _input, { emit = () => {} } = {}) {
      const [command, ...args] = splitCommandLine(connector.command);
      emit("cli.started", { connectorId: connector.id, command: connector.command, startedAt: new Date().toISOString() });
      const result = spawnSync(command, args, { cwd: projectRoot, encoding: "utf8", timeout: 120000, shell: false });
      const payload = { connectorId: connector.id, command: connector.command, ...commandResult(result, 4000) };
      emit("cli.completed", payload);
      return { ok: result.status === 0, status: "completed", result: payload };
    },
  });
  return registry;
}

function commandResult(result, limit) {
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout?.slice(0, limit) ?? "",
    stderr: result.stderr?.slice(0, limit) ?? String(result.error?.message ?? ""),
  };
}

function splitCommandLine(commandLine) {
  const parts = String(commandLine).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts.map((part) => part.replace(/^("|')|("|')$/g, ""));
}
