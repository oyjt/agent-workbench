import type { CapabilityDefinition, CapabilityRisk } from "./types";

export type CapabilityDecision = "allow" | "ask" | "deny";

export type CapabilityPolicy = {
  decide(capability: CapabilityDefinition): CapabilityDecision;
};

export function createRiskPolicy(options?: {
  low?: CapabilityDecision;
  medium?: CapabilityDecision;
  high?: CapabilityDecision;
}): CapabilityPolicy {
  const decisions: Record<CapabilityRisk, CapabilityDecision> = {
    low: options?.low ?? "allow",
    medium: options?.medium ?? "ask",
    high: options?.high ?? "ask",
  };

  return {
    decide(capability) {
      return decisions[capability.risk];
    },
  };
}
