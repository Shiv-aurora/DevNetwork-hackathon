import test from "node:test";
import assert from "node:assert/strict";

import { canonicalize, canonicalDigest } from "../src/crypto/canonical-json.mjs";
import { generateSigningIdentity } from "../src/crypto/keys.mjs";
import {
  createActionRequestReceipt,
  createDelegationReceipt,
  createExecutionReceipt,
  createGatewayDecisionReceipt,
  createRootMandate,
  createRunSeal,
  createSignedReceipt,
  redactedDigest,
  RECEIPT_TYPES,
  verifySignedReceipt,
} from "../src/evidence/receipts.mjs";
import { createEvidenceBundle, exportEvidenceBundle } from "../src/evidence/bundle.mjs";

const T = "2026-09-02T21:00:00.000Z";
const EXP = "2026-09-02T22:00:00.000Z";

function identity(ownerId) {
  const generated = generateSigningIdentity({ ownerId, keyId: `key_${ownerId}`, validFrom: T, validUntil: EXP });
  return {
    publicRecord: generated.publicRecord,
    signer: { signerId: ownerId, keyId: generated.publicRecord.keyId, privateKey: generated.privateKey },
  };
}

function signedDemoChain({ amountCents = 8500, decision = "allowed" } = {}) {
  const org = identity("org_acme_support");
  const triage = identity("agent_triage");
  const billing = identity("agent_billing");
  const refund = identity("agent_refund");
  const gateway = identity("gateway_proof");
  const runId = "run_case_194";

  const root = createRootMandate({
    receiptId: "receipt_root_1", runId, createdAt: T, nonce: "nonce-root-1",
    principalId: "principal_demo", firstAgentId: "agent_triage",
    task: "Resolve support case #194.", constraints: { maxRefundCents: 10000 }, validUntil: EXP, signer: org.signer,
  });
  const triageDelegation = createDelegationReceipt({
    receiptId: "receipt_delegation_1", runId, createdAt: T, nonce: "nonce-del-1",
    fromAgentId: "agent_triage", toAgentId: "agent_billing", parentDigest: root.contentDigest,
    purpose: "Investigate duplicate charge", permittedActions: ["billing.inspect"], constraints: { maxRefundCents: 10000 }, expiresAt: EXP, signer: triage.signer,
  });
  const billingDelegation = createDelegationReceipt({
    receiptId: "receipt_delegation_2", runId, createdAt: T, nonce: "nonce-del-2",
    fromAgentId: "agent_billing", toAgentId: "agent_refund", parentDigest: triageDelegation.contentDigest,
    purpose: "Request bounded refund", permittedActions: ["refund.request"], constraints: { maxRefundCents: 10000 }, expiresAt: EXP, signer: billing.signer,
  });
  const request = createActionRequestReceipt({
    receiptId: "receipt_request_1", runId, createdAt: T, nonce: "nonce-request-1",
    agentId: "agent_refund", delegationDigest: billingDelegation.contentDigest, tool: "refund-simulator", action: "refund.create",
    parametersEvidence: { amountCents, currency: "USD", customer: redactedDigest({ customerId: "cust-private-194" }) },
    expectedEffect: "Refund duplicate charge", signer: refund.signer,
  });
  const gatewayDecision = createGatewayDecisionReceipt({
    receiptId: "receipt_decision_1", runId, createdAt: T, nonce: "nonce-decision-1",
    requestDigest: request.contentDigest, decision,
    checks: { identity: true, signature: true, delegation: true, amountWithinLimit: amountCents <= 10000 },
    reasonCodes: decision === "allowed" ? ["ALL_CHECKS_PASSED"] : ["DELEGATED_LIMIT_EXCEEDED"], signer: gateway.signer,
  });
  const execution = decision === "allowed" ? createExecutionReceipt({
    receiptId: "receipt_execution_1", runId, createdAt: T, nonce: "nonce-exec-1",
    decisionDigest: gatewayDecision.contentDigest, tool: "refund-simulator",
    toolRequestEvidence: redactedDigest({ caseId: "194", amountCents }),
    toolResponseEvidence: redactedDigest({ status: "confirmed", transactionId: "sim-refund-194-usd-8500" }),
    effectStatus: "confirmed", transactionId: "sim-refund-194-usd-8500", signer: gateway.signer,
  }) : null;

  const receipts = [root, triageDelegation, billingDelegation, request, gatewayDecision, ...(execution ? [execution] : [])];
  const seal = createRunSeal({
    receiptId: "receipt_seal_1", runId, createdAt: T, nonce: "nonce-seal-1",
    receiptDigests: receipts.map((receipt) => receipt.contentDigest), signer: gateway.signer,
  });

  return { identities: { org, triage, billing, refund, gateway }, receipts, root, triageDelegation, billingDelegation, request, gatewayDecision, execution, seal };
}

test("canonical JSON and digests are stable across object key order", () => {
  assert.equal(canonicalize({ b: 2, a: { z: 3, y: 1 } }), canonicalize({ a: { y: 1, z: 3 }, b: 2 }));
  assert.equal(canonicalDigest({ b: 2, a: 1 }), canonicalDigest({ a: 1, b: 2 }));
});

test("each signed receipt verifies only with its published signer key", () => {
  const chain = signedDemoChain();
  const keyByOwner = new Map(Object.values(chain.identities).map(({ publicRecord }) => [publicRecord.ownerId, publicRecord]));
  for (const receipt of [...chain.receipts, chain.seal]) {
    const result = verifySignedReceipt(receipt, keyByOwner.get(receipt.signerId));
    assert.equal(result.valid, true, `${receipt.type} should verify`);
  }
  assert.equal(verifySignedReceipt(chain.request, chain.identities.billing.publicRecord).valid, false);
});

test("material receipt tampering invalidates both digest and signature", () => {
  const chain = signedDemoChain();
  const tampered = structuredClone(chain.request);
  tampered.claims.parametersEvidence.amountCents = 85000;
  const result = verifySignedReceipt(tampered, chain.identities.refund.publicRecord);
  assert.equal(result.valid, false);
  assert.equal(result.digestValid, false);
  assert.equal(result.signatureValid, false);
  assert.ok(result.reasons.includes("content-digest-mismatch"));
  assert.ok(result.reasons.includes("signature-invalid"));
});

test("non-root receipts bind directly to causal parent digests", () => {
  const chain = signedDemoChain();
  assert.deepEqual(chain.root.parentDigests, []);
  assert.deepEqual(chain.triageDelegation.parentDigests, [chain.root.contentDigest]);
  assert.deepEqual(chain.billingDelegation.parentDigests, [chain.triageDelegation.contentDigest]);
  assert.deepEqual(chain.request.parentDigests, [chain.billingDelegation.contentDigest]);
  assert.deepEqual(chain.gatewayDecision.parentDigests, [chain.request.contentDigest]);
  assert.deepEqual(chain.execution.parentDigests, [chain.gatewayDecision.contentDigest]);
});

test("blocked gateway outcomes remain signed first-class evidence without an execution receipt", () => {
  const chain = signedDemoChain({ amountCents: 85000, decision: "blocked" });
  assert.equal(chain.gatewayDecision.claims.decision, "blocked");
  assert.equal(chain.gatewayDecision.claims.checks.amountWithinLimit, false);
  assert.equal(chain.execution, null);
  assert.equal(verifySignedReceipt(chain.gatewayDecision, chain.identities.gateway.publicRecord).valid, true);
});

test("redacted evidence preserves a digest without leaking raw sensitive content", () => {
  const evidence = redactedDigest({ customerId: "customer-secret", email: "private@example.com" });
  assert.equal(evidence.redacted, true);
  assert.match(evidence.digest, /^sha256:/);
  assert.equal(JSON.stringify(evidence).includes("customer-secret"), false);
  assert.equal(JSON.stringify(evidence).includes("private@example.com"), false);
});

test("private model chain-of-thought fields are rejected from evidence", () => {
  const signer = identity("agent_refund").signer;
  assert.throws(() => createSignedReceipt({
    type: RECEIPT_TYPES.ACTION_REQUEST,
    receiptId: "receipt_bad", runId: "run_bad", createdAt: T, nonce: "nonce-bad",
    signerId: signer.signerId, keyId: signer.keyId, privateKey: signer.privateKey,
    claims: { action: "refund.create", chainOfThought: "private reasoning must never be stored" },
  }), /forbidden/i);
});

test("evidence bundle is canonical, exportable, and commits to the signed run seal", () => {
  const chain = signedDemoChain();
  const bundle = createEvidenceBundle({
    organization: { id: "org_acme_support" },
    domainEnvironment: { provider: "name.com", environment: "sandbox", publicDnsAvailable: false },
    publicKeys: Object.values(chain.identities).map(({ publicRecord }) => publicRecord),
    receipts: chain.receipts,
    runSeal: chain.seal,
  });
  assert.match(bundle.bundleDigest, /^sha256:/);
  const exported = exportEvidenceBundle(bundle);
  assert.equal(JSON.parse(exported).runSeal.contentDigest, chain.seal.contentDigest);
  assert.equal(exported.includes("PRIVATE KEY"), false);
});
