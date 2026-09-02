export const ACTION_STATUS = Object.freeze({
  REQUESTED: "requested",
  ALLOWED: "allowed",
  BLOCKED: "blocked",
  DISPATCHED: "dispatched",
  CONFIRMED: "confirmed",
  FAILED: "failed",
  UNVERIFIABLE: "unverifiable",
});

export const DOMAIN_STATUS = Object.freeze({
  REQUESTED: "requested",
  PROVISIONED: "provisioned",
  ACTIVE: "active",
  RETIRED: "retired",
  FAILED: "failed",
  UNVERIFIABLE: "unverifiable",
});

export const AGENT_STATUS = Object.freeze({
  REQUESTED: "requested",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  RETIRED: "retired",
});

export const RUN_STATUS = Object.freeze({
  REQUESTED: "requested",
  RUNNING: "running",
  CONFIRMED: "confirmed",
  BLOCKED: "blocked",
  FAILED: "failed",
  UNVERIFIABLE: "unverifiable",
});

export const RECEIPT_STATUS = Object.freeze({
  REQUESTED: "requested",
  SIGNED: "signed",
  VERIFIED: "verified",
  INVALID: "invalid",
  UNVERIFIABLE: "unverifiable",
});

export const STATUS_MEANING = Object.freeze({
  requested: "Intent exists; no authorization or tool effect is implied.",
  allowed: "The gateway policy allowed the request; execution is not yet implied.",
  blocked: "The gateway rejected the request before protected-tool execution.",
  dispatched: "The gateway sent the request to the protected tool; confirmation is not implied.",
  confirmed: "The protected tool returned a confirmation observed by the gateway.",
  failed: "The attempted stage failed and no stronger outcome should be inferred.",
  unverifiable: "ProofRoot does not currently have sufficient evidence to verify the claim.",
});
