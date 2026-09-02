export const ENTITY_KINDS = Object.freeze([
  "organization",
  "domainEnvironment",
  "organizationIdentityRoot",
  "agentIdentity",
  "keyRecord",
  "rootMandate",
  "delegationReceipt",
  "actionRequestReceipt",
  "gatewayDecisionReceipt",
  "executionReceipt",
  "runSeal",
  "verificationReport",
]);

export function createProofRootState(overrides = {}) {
  return {
    schemaVersion: "proofroot.state.v1",
    organization: null,
    domainEnvironment: null,
    organizationIdentityRoot: null,
    agentIdentities: [],
    keyRecords: [],
    runs: [],
    evidence: {
      rootMandates: [],
      delegationReceipts: [],
      actionRequestReceipts: [],
      gatewayDecisionReceipts: [],
      executionReceipts: [],
      runSeals: [],
    },
    verificationReports: [],
    ...overrides,
  };
}

export function assertProofRootState(state) {
  if (!state || state.schemaVersion !== "proofroot.state.v1") {
    throw new Error("Unsupported ProofRoot state schema.");
  }

  const arrays = ["agentIdentities", "keyRecords", "runs", "verificationReports"];
  for (const field of arrays) {
    if (!Array.isArray(state[field])) throw new Error(`State field '${field}' must be an array.`);
  }

  const evidenceArrays = [
    "rootMandates",
    "delegationReceipts",
    "actionRequestReceipts",
    "gatewayDecisionReceipts",
    "executionReceipts",
    "runSeals",
  ];
  for (const field of evidenceArrays) {
    if (!Array.isArray(state.evidence?.[field])) {
      throw new Error(`Evidence field '${field}' must be an array.`);
    }
  }

  return true;
}
