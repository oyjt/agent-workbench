import type {
  CapabilityDefinition,
  CapabilityRegistry,
  HarnessEventBus,
  HarnessPlugin,
  HarnessPluginContext,
} from "./types";
import { DisposableStack } from "./types";

export class DefaultCapabilityRegistry implements CapabilityRegistry {
  #definitions = new Map<string, CapabilityDefinition>();

  register(definition: CapabilityDefinition) {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`Capability already registered: ${definition.id}`);
    }
    this.#definitions.set(definition.id, definition);
    return () => {
      if (this.#definitions.get(definition.id) === definition) {
        this.#definitions.delete(definition.id);
      }
    };
  }

  get(id: string) {
    return this.#definitions.get(id);
  }

  list() {
    return [...this.#definitions.values()];
  }
}

export class DefaultHarnessEventBus implements HarnessEventBus {
  #listeners = new Map<string, Set<(payload: unknown) => void>>();

  emit(type: string, payload: unknown) {
    for (const listener of this.#listeners.get(type) ?? []) listener(payload);
  }

  on(type: string, listener: (payload: unknown) => void) {
    const listeners = this.#listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.#listeners.set(type, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(type);
    };
  }
}

export class AgentHarness {
  readonly capabilities = new DefaultCapabilityRegistry();
  readonly events = new DefaultHarnessEventBus();
  #plugins = new Map<string, DisposableStack>();

  async use(plugin: HarnessPlugin) {
    if (this.#plugins.has(plugin.id)) throw new Error(`Plugin already mounted: ${plugin.id}`);

    const disposables = new DisposableStack();
    const context: HarnessPluginContext = {
      capabilities: this.capabilities,
      events: this.events,
      disposables,
    };

    const teardown = await plugin.setup(context);
    if (teardown) disposables.add(teardown);
    this.#plugins.set(plugin.id, disposables);

    return () => this.remove(plugin.id);
  }

  remove(pluginId: string) {
    const plugin = this.#plugins.get(pluginId);
    if (!plugin) return false;
    plugin.dispose();
    this.#plugins.delete(pluginId);
    return true;
  }

  dispose() {
    for (const pluginId of [...this.#plugins.keys()].reverse()) this.remove(pluginId);
  }
}
