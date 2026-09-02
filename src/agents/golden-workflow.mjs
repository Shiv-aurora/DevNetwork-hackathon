import { randomUUID } from "node:crypto";

import { DEMO_CONTRACT } from "../core/demo-contract.mjs";
import { canonicalDigest } from "../crypto/canonical-json.mjs";
import { generateSigningIdentity } from "../crypto/keys.mjs";
import {
  createActionRequestReceipt,
  createDelegationReceipt,
  createRootMandate,
  createRunSeal,
  redactedDigest,
} from "../evidence/receipts.mjs";
import { createEvidenceBundle } from "../evidence/bundle.mjs";
import { evaluateProtectedAction, ReplayStore } from "../gateway/proof-gateway.mjs";
import { executeDeterministicRefund } from "../integrations/refund-simulator.mjs";
import { createConfiguredModelClient } from "./model-runtime.mjs";

export const WORKFLOW_SCENARIOS = Object.freeze({
  VALID: "valid",
  AUTHORITY_ATTACK: "authority-attack",
});

function signerIdentity(ownerId, keyId, validFrom, validUntil) {
  const generated = generateSigningIdentity({ ownerId, keyId, validFrom, validUntil });
  return Object.freeze({
    publicRecord: generated.publicRecord,
    signer: Object.freeze({
      signerId: ownerId,
      keyId: generated.publicRecord.keyId,
      privateKey: generated.privateKey,
    }),
  });
}

function createEphemeralIdentities({ now, validUntil, idFactory }) {
  return Object.freeze({
    organization: signerIdentity("org_acme_support", `key_org_${idFactory()}`, now, validUntil),
    triage: signerIdentity("agent_triage", `key_triage_${idFactory()}`, now, validUntil),
    billing: signerIdentity("agent_billing", `key_billing_${idFactory()}`, now, validUntil),
    refund: signerIdentity("agent_refund", `key_refund_${idFactory()}`, now, validUntil),
    gateway: signerIdentity("gateway_proof", `key_gateway_${idFactory()}`, now, validUntil),
  });
}

function assertSigningIdentities(identities) {
  for (const role of ["organization", "triage", "billing", "refund", "gateway"]) {
    const identity = identities?.[role];
    if (!identity?.publicRecord?.ownerId || !identity?.signer?.privateKey) {
      throw new Error(`Signing identity '${role}' is missing or incomplete.`);
    }
  }
}

function createIds(idFactory) {
  return Object.freeze({
    receipt: (label) => `receipt_${label}_${idFactory()}`,
    nonce: (label) => `nonce_${label}_${idFactory()}`,
  });
}

function routingDecisionValid(value) {
  return value
    && value.route === "billing"
    && value.category === "duplicate-charge"
    && value.shouldInvestigate === true
    && typeof value.summary === "string"
    && value.summary.length > 0;
}

function timelineEvent({ id, actor, label, status, evidenceDigest = null, receiptId = null, detail = null }) {
  return Object.freeze({ id, actor, label, status, evidenceDigest, receiptId, detail });
}

export async function runGoldenWorkflow({
  scenario = WORKFLOW_SCENARIOS.VALID,
  modelClient = createConfiguredModelClient(),
  signingIdentities = null,
  now = new Date().toISOString(),
  validUntil = null,
  idFactory = randomUUID,
  replayStore = new ReplayStore(),
  protectedTool = executeDeterministicRefund,
  domainName = process.env.PROOFROOT_DOMAIN ?? null,
  namecomEnvironment = process.env.NAMECOM_ENV ?? "sandbox",
} = {}) {
  if (!Object.values(WORKFLOW_SCENARIOS).includes(scenario)) {
    throw new Error(`Unsupported workflow scenario '${scenario}'.`);
  }
  if (!modelClient || typeof modelClient.decideJson !== "function") {
    throw new Error("modelClient with decideJson() is required.");
  }

  const resolvedValidUntil = validUntil ?? new Date(Date.parse(now) + 60 * 60 * 1000).toISOString();
  const ids = createIds(idFactory);
  const runId = `run_case_${DEMO_CONTRACT.supportCaseId}_${idFactory()}`;
  const requestedAmountCents = scenario === WORKFLOW_SCENARIOS.AUTHORITY_ATTACK
    ? DEMO_CONTRACT.authorityAttackAmountCents
    : DEMO_CONTRACT.validRefundAmountCents;
  const toolRequest = Object.freeze({
    caseId: DEMO_CONTRACT.supportCaseId,
    amountCents: requestedAmountCents,
    currency: DEMO_CONTRACT.currency,
  });

  const identities = signingIdentities ?? createEphemeralIdentities({
    now,
    validUntil: resolvedValidUntil,
    idFactory,
  });
  assertSigningIdentities(identities);
  const persistentIdentity = Boolean(signingIdentities);

  const rootMandate = createRootMandate({
    receiptId: ids.receipt("root"),
    runId,
    createdAt: now,
    nonce: ids.nonce("root"),
    principalId: "principal_demo_operator",
    firstAgentId: identities.triage.publicRecord.ownerId,
    task: `Resolve support case #${DEMO_CONTRACT.supportCaseId}. Refund a confirmed duplicate charge only if the amount is no more than $100.`,
    constraints: {
      maxRefundCents: DEMO_CONTRACT.delegatedRefundLimitCents,
      permittedActions: ["billing.inspect", "refund.create"],
    },
    validUntil: resolvedValidUntil,
    signer: identities.organization.signer,
  });

  const routingDecision = await modelClient.decideJson({
    system: "You are ProofRoot's Triage Agent. Classify the support case and select the next specialist. Return only the requested structured decision, never hidden reasoning.",
    user: `Support case #${DEMO_CONTRACT.supportCaseId}: customer reports a duplicate charge. The policy allows a confirmed duplicate refund only up to $100.`,
    fallbackValue: {
      route: "billing",
      category: "duplicate-charge",
      shouldInvestigate: true,
      summary: "Duplicate-charge claim requires Billing Agent verification before any refund request.",
    },
    validate: routingDecisionValid,
  });

  const triageDelegation = createDelegationReceipt({
    receiptId: ids.receipt("triage_billing"),
    runId,
    createdAt: now,
    nonce: ids.nonce("triage_billing"),
    fromAgentId: identities.triage.publicRecord.ownerId,
    toAgentId: identities.billing.publicRecord.ownerId,
    parentDigest: rootMandate.contentDigest,
    purpose: routingDecision.value.summary,
    permittedActions: ["billing.inspect", "refund.create"],
    constraints: { maxRefundCents: DEMO_CONTRACT.delegatedRefundLimitCents },
    expiresAt: resolvedValidUntil,
    signer: identities.triage.signer,
  });

  const billingFinding = Object.freeze({
    duplicateConfirmed: true,
    source: "golden-demo-fixture",
    chargeAmountCents: DEMO_CONTRACT.validRefundAmountCents,
    currency: DEMO_CONTRACT.currency,
    note: "Controlled fixture confirms one duplicate $85 charge for case #194.",
  });

  const billingDelegation = createDelegationReceipt({
    receiptId: ids.receipt("billing_refund"),
    runId,
    createdAt: now,
    nonce: ids.nonce("billing_refund"),
    fromAgentId: identities.billing.publicRecord.ownerId,
    toAgentId: identities.refund.publicRecord.ownerId,
    parentDigest: triageDelegation.contentDigest,
    purpose: billingFinding.duplicateConfirmed
      ? "Request refund for the confirmed duplicate charge within the signed $100 cap."
      : "No refund authority delegated because no duplicate was confirmed.",
    permittedActions: ["refund.create"],
    constraints: { maxRefundCents: DEMO_CONTRACT.delegatedRefundLimitCents },
    expiresAt: resolvedValidUntil,
    signer: identities.billing.signer,
  });

  const requestDigest = canonicalDigest(toolRequest);
  const actionRequest = createActionRequestReceipt({
    receiptId: ids.receipt("refund_request"),
    runId,
    createdAt: now,
    nonce: ids.nonce("refund_request"),
    agentId: identities.refund.publicRecord.ownerId,
    delegationDigest: billingDelegation.contentDigest,
    tool: "refund-simulator",
    action: "refund.create",
    parametersEvidence: {
      redacted: true,
      digest: requestDigest,
      display: {
        caseId: DEMO_CONTRACT.supportCaseId,
        amountCents: requestedAmountCents,
        currency: DEMO_CONTRACT.currency,
      },
      customer: redactedDigest({ customerId: "customer_case_194" }),
    },
    expectedEffect: `Refund ${requestedAmountCents / 100} ${DEMO_CONTRACT.currency} for confirmed duplicate charge.`,
    signer: identities.refund.signer,
  });

  const publicKeys = Object.values(identities).map((identity) => identity.publicRecord);
  const gatewayResult = await evaluateProtectedAction({
    rootMandate,
    delegations: [triageDelegation, billingDelegation],
    actionRequest,
    publicKeys,
    gatewaySigner: identities.gateway.signer,
    toolRequest,
    protectedTool,
    protectedToolName: "refund-simulator",
    protectedAction: "refund.create",
    replayStore,
    now,
    idFactory,
  });

  const receiptsBeforeSeal = [
    rootMandate,
    triageDelegation,
    billingDelegation,
    actionRequest,
    gatewayResult.decisionReceipt,
    ...(gatewayResult.executionReceipt ? [gatewayResult.executionReceipt] : []),
  ];
  const runSeal = createRunSeal({
    receiptId: ids.receipt("run_seal"),
    runId,
    createdAt: now,
    nonce: ids.nonce("run_seal"),
    receiptDigests: receiptsBeforeSeal.map((receipt) => receipt.contentDigest),
    signer: identities.gateway.signer,
  });

  const evidenceBundle = createEvidenceBundle({
    organization: {
      id: identities.organization.publicRecord.ownerId,
      name: "Acme Support",
    },
    domainEnvironment: {
      provider: "name.com",
      environment: namecomEnvironment,
      domainName,
      identityMode: persistentIdentity
        ? (namecomEnvironment === "sandbox" ? "Name.com Sandbox / Provider-Backed Verification" : "Production Public DNS")
        : "Ephemeral development identity; domain publication not claimed",
      publicDnsAvailable: namecomEnvironment === "sandbox" ? false : "requires-independent-resolution-check",
      persistentIdentity,
    },
    publicKeys,
    receipts: receiptsBeforeSeal,
    runSeal,
  });

  const timeline = Object.freeze([
    timelineEvent({ id: "root", actor: "Organization", label: "Signed root mandate", status: "requested", receiptId: rootMandate.receiptId, evidenceDigest: rootMandate.contentDigest }),
    timelineEvent({ id: "triage", actor: "Triage Agent", label: `Routed case to Billing Agent (${routingDecision.provider})`, status: "allowed", receiptId: triageDelegation.receiptId, evidenceDigest: triageDelegation.contentDigest, detail: routingDecision.value.summary }),
    timelineEvent({ id: "billing", actor: "Billing Agent", label: "Confirmed controlled-fixture duplicate charge and delegated bounded refund", status: "allowed", receiptId: billingDelegation.receiptId, evidenceDigest: billingDelegation.contentDigest }),
    timelineEvent({ id: "refund", actor: "Refund Agent", label: `Signed refund request for $${(requestedAmountCents / 100).toFixed(2)}`, status: "requested", receiptId: actionRequest.receiptId, evidenceDigest: actionRequest.contentDigest }),
    timelineEvent({ id: "gateway", actor: "Proof Gateway", label: gatewayResult.decisionReceipt.claims.decision === "allowed" ? "Validated delegation and allowed protected action" : "Blocked protected action before execution", status: gatewayResult.decisionReceipt.claims.decision, receiptId: gatewayResult.decisionReceipt.receiptId, evidenceDigest: gatewayResult.decisionReceipt.contentDigest, detail: gatewayResult.reasonCodes.join(", ") }),
    ...(gatewayResult.executionReceipt ? [timelineEvent({ id: "tool", actor: "Refund Tool", label: gatewayResult.outcome === "confirmed" ? `Confirmed transaction ${gatewayResult.toolResult?.transactionId}` : "Protected tool failed", status: gatewayResult.outcome, receiptId: gatewayResult.executionReceipt.receiptId, evidenceDigest: gatewayResult.executionReceipt.contentDigest })] : []),
  ]);

  return Object.freeze({
    version: "proofroot.workflow.v1",
    scenario,
    runId,
    requestedAmountCents,
    delegatedLimitCents: DEMO_CONTRACT.delegatedRefundLimitCents,
    identity: Object.freeze({ persistent: persistentIdentity, domainName, environment: namecomEnvironment }),
    routingDecision: Object.freeze({
      ...routingDecision.value,
      provider: routingDecision.provider,
      model: routingDecision.model,
      requestId: routingDecision.requestId,
      modelDriven: routingDecision.modelDriven,
    }),
    billingFinding,
    gateway: Object.freeze({
      outcome: gatewayResult.outcome,
      reasonCodes: gatewayResult.reasonCodes,
      checks: gatewayResult.checks,
      transactionId: gatewayResult.toolResult?.transactionId ?? null,
    }),
    publicKeys: Object.freeze(publicKeys),
    receipts: Object.freeze(receiptsBeforeSeal),
    runSeal,
    evidenceBundle,
    timeline,
  });
}
