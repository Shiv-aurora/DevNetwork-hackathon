import { createDeterministicModelClient } from "../agents/model-runtime.mjs";
import { runGoldenWorkflow, WORKFLOW_SCENARIOS } from "../agents/golden-workflow.mjs";
import { RECEIPT_TYPES } from "../evidence/receipts.mjs";
import { verifyEvidenceBundle } from "../verifier/verify-bundle.mjs";

export async function runAuthorityViolationAttack({
  modelClient = createDeterministicModelClient(),
  identityResolver,
  idFactory,
} = {}) {
  let protectedToolCalls = 0;
  const workflow = await runGoldenWorkflow({
    scenario: WORKFLOW_SCENARIOS.AUTHORITY_ATTACK,
    modelClient,
    idFactory,
    protectedTool: async () => {
      protectedToolCalls += 1;
      throw new Error("Authority-violation attack must never reach the protected tool.");
    },
  });
  const verification = await verifyEvidenceBundle(workflow.evidenceBundle, { identityResolver });

  return Object.freeze({
    version: "proofroot.attack.v1",
    attack: "authority-violation",
    title: "$850 request under a signed $100 cap",
    expected: "BLOCKED BEFORE EXECUTION",
    result: workflow.gateway.outcome,
    protectedToolCalls,
    transactionCreated: false,
    decisionReceipt: workflow.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.GATEWAY_DECISION),
    executionReceipt: workflow.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.EXECUTION) ?? null,
    reasonCodes: workflow.gateway.reasonCodes,
    workflow,
    verification,
  });
}

export async function runEvidenceTamperAttack({
  modelClient = createDeterministicModelClient(),
  identityResolver,
  idFactory,
} = {}) {
  const workflow = await runGoldenWorkflow({
    scenario: WORKFLOW_SCENARIOS.VALID,
    modelClient,
    idFactory,
  });
  const tamperedBundle = structuredClone(workflow.evidenceBundle);
  const request = tamperedBundle.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ACTION_REQUEST);
  if (!request) throw new Error("Golden bundle does not contain an Action Request Receipt.");

  const originalAmountCents = request.claims.parametersEvidence.display.amountCents;
  request.claims.parametersEvidence.display.amountCents = 85000;
  const verification = await verifyEvidenceBundle(tamperedBundle, { identityResolver });

  return Object.freeze({
    version: "proofroot.attack.v1",
    attack: "evidence-tampering",
    title: "Stored successful receipt changed from $85 to $850",
    expected: "VERIFICATION FAILED",
    result: verification.overallStatus,
    originalAmountCents,
    tamperedAmountCents: 85000,
    alteredReceiptId: request.receiptId,
    firstFailure: verification.firstFailure,
    affectedReceiptIds: verification.affectedReceiptIds,
    tamperedBundle,
    verification,
  });
}
