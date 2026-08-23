export const capabilityDecision = Object.freeze({
  ALLOW: "allow",
  ASK: "ask",
  DENY: "deny",
});

export function createRiskPolicy(options = {}) {
  const decisions = {
    low: options.low ?? capabilityDecision.ALLOW,
    medium: options.medium ?? capabilityDecision.ASK,
    high: options.high ?? capabilityDecision.ASK,
  };

  return {
    decide(capability) {
      return decisions[capability.risk ?? "medium"] ?? capabilityDecision.ASK;
    },
  };
}

export async function executeCapability({ registry, policy, capabilityId, input, context, requestApproval }) {
  const capability = registry.get(capabilityId);
  if (!capability) throw new Error(`Unknown capability: ${capabilityId}`);

  const decision = policy.decide(capability);
  context?.emit?.("capability/requested", { capabilityId, decision });

  if (decision === capabilityDecision.DENY) {
    context?.emit?.("capability/denied", { capabilityId });
    throw new Error(`Capability denied: ${capabilityId}`);
  }

  if (decision === capabilityDecision.ASK) {
    if (typeof requestApproval !== "function") {
      throw new Error(`Capability requires approval: ${capabilityId}`);
    }
    context?.emit?.("capability/approval-required", { capabilityId });
    const approved = await requestApproval(capability, input);
    if (!approved) {
      context?.emit?.("capability/denied", { capabilityId, reason: "approval-denied" });
      throw new Error(`Capability approval denied: ${capabilityId}`);
    }
  }

  context?.emit?.("capability/started", { capabilityId });
  try {
    const result = await capability.execute(input, context);
    context?.emit?.("capability/completed", { capabilityId });
    return result;
  } catch (error) {
    context?.emit?.("capability/failed", {
      capabilityId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
