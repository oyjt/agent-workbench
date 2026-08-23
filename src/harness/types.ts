export type HarnessEventMap = Record<string, unknown>;

export type HarnessEvent<K extends string = string, P = unknown> = {
  id: string;
  type: K;
  payload: P;
  createdAt: string;
};

export type CapabilityRisk = "low" | "medium" | "high";

export type CapabilityDescriptor = {
  id: string;
  title: string;
  description?: string;
  risk: CapabilityRisk;
};

export type CapabilityExecutionContext = {
  runId: string;
  signal: AbortSignal;
  emit: (type: string, payload: unknown) => void;
};

export type CapabilityDefinition<TInput = unknown, TOutput = unknown> = CapabilityDescriptor & {
  execute(input: TInput, context: CapabilityExecutionContext): Promise<TOutput>;
};

export type HarnessPluginContext = {
  capabilities: CapabilityRegistry;
  events: HarnessEventBus;
  disposables: DisposableStack;
};

export type HarnessPlugin = {
  id: string;
  setup(context: HarnessPluginContext): void | (() => void) | Promise<void | (() => void)>;
};

export interface CapabilityRegistry {
  register(definition: CapabilityDefinition): () => void;
  get(id: string): CapabilityDefinition | undefined;
  list(): readonly CapabilityDefinition[];
}

export interface HarnessEventBus {
  emit(type: string, payload: unknown): void;
  on(type: string, listener: (payload: unknown) => void): () => void;
}

export class DisposableStack {
  #disposers: Array<() => void> = [];

  add(disposer: () => void) {
    this.#disposers.push(disposer);
    return disposer;
  }

  dispose() {
    for (const disposer of this.#disposers.splice(0).reverse()) disposer();
  }
}
