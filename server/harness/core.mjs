export class CapabilityRegistry {
  #definitions = new Map();

  register(definition) {
    if (!definition?.id || typeof definition.execute !== "function") {
      throw new TypeError("Invalid capability definition");
    }
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

  get(id) {
    return this.#definitions.get(id);
  }

  list() {
    return [...this.#definitions.values()];
  }
}

export class HarnessEventBus {
  #listeners = new Map();

  emit(type, payload) {
    for (const listener of this.#listeners.get(type) ?? []) listener(payload);
  }

  on(type, listener) {
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
  capabilities = new CapabilityRegistry();
  events = new HarnessEventBus();
  #plugins = new Map();

  async use(plugin) {
    if (!plugin?.id || typeof plugin.setup !== "function") {
      throw new TypeError("Invalid harness plugin");
    }
    if (this.#plugins.has(plugin.id)) {
      throw new Error(`Plugin already mounted: ${plugin.id}`);
    }

    const disposers = [];
    const context = {
      capabilities: this.capabilities,
      events: this.events,
      addDisposable(disposer) {
        disposers.push(disposer);
        return disposer;
      },
    };

    const teardown = await plugin.setup(context);
    if (typeof teardown === "function") disposers.push(teardown);
    this.#plugins.set(plugin.id, disposers);
    return () => this.remove(plugin.id);
  }

  remove(pluginId) {
    const disposers = this.#plugins.get(pluginId);
    if (!disposers) return false;
    for (const dispose of disposers.reverse()) dispose();
    this.#plugins.delete(pluginId);
    return true;
  }

  dispose() {
    for (const pluginId of [...this.#plugins.keys()].reverse()) this.remove(pluginId);
  }
}
