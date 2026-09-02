import test from "node:test";
import assert from "node:assert/strict";

import { generateSigningIdentity } from "../src/crypto/keys.mjs";
import { redactedDigest, createActionRequestReceipt, createDelegationReceipt, createRootMandate } from "../src/evidence/receipts.mjs";
import { executeDeterministicRefund } from "../src/integrations/refund-simulator.mjs";
import { evaluateProtectedAction, GATEWAY_REASON_CODES, ReplayStore } from "../src/gateway/proof-gateway.mjs";

const T = "2026-09-02T21:00:00.000Z";
const NOW = "2026-09-02T21:10:00.000Z";
const EXP = "2026-09-02T22:00:00.000Z";

function identity(ownerId) {
  const generated = generateSigningIdentity({ ownerId, keyId: `key_${ownerId}`, validFrom: T, validUntil: EXP });
  return {
    publicRecord: generated.publicRecord,
    signer: { signerId: ownerId, keyId: generated.publicRecord.keyId, privateKey: generated.privateKey },
  };
}

function chain({ amountCents = 8500, finalLimitCents = 10000, expiresAt = EXP } = {}) {
  const org = identity("org_acme_support");
  const triage = identity("agent_triage");
  const billing = identity("agent_billing");
  const refund = identity("agent_refund");
  const gateway = identity("gateway_proof");
  const runId = "run_case_194";
  const toolRequest = { caseId: "194", amountCents, currency: "USD" };

  const root = createRootMandate({
    receiptId: "root-1", runId, createdAt: T, nonce: "nonce-root",
    principalId: "principal-demo", firstAgentId: triage.publicRecord.ownerId,
    task: "Resolve support case #194", constraints: {
      maxRefundCents: 10000,
      permittedActions: ["billing.inspect", "refund.create"],
    }, validUntil: EXP, signer: org.signer,
  });
  const first = createDelegationReceipt({
    receiptId: "delegation-1", runId, createdAt: T, nonce: "nonce-d1",
    fromAgentId: triage.publicRecord.ownerId, toAgentId: billing.publicRecord.ownerId,
    parentDigest: root.contentDigest, purpose: "Inspect duplicate charge",
    permittedActions: ["billing.inspect", "refund.create"], constraints: { maxRefundCents: 10000 },
    expiresAt, signer: triage.signer,
  });
  const second = createDelegationReceipt({
    receiptId: "delegation-2", runId, createdAt: T, nonce: "nonce-d2",
    fromAgentId: billing.publicRecord.ownerId, toAgentId: refund.publicRecord.ownerId,
    parentDigest: first.contentDigest, purpose: "Request bounded refund",
    permittedActions: ["refund.create"], constraints: { maxRefundCents: finalLimitCents },
    expiresAt, signer: billing.signer,
  });
  const request = createActionRequestReceipt({
    receiptId: "request-1", runId, createdAt: T, nonce: "nonce-request",
    agentId: refund.publicRecord.ownerId, delegationDigest: second.contentDigest,
    tool: "refund-simulator", action: "refund.create",
    parametersEvidence: redactedDigest(toolRequest), expectedEffect: "Refund confirmed duplicate charge",
    signer: refund.signer,
  });
  const publicKeys = [org, triage, billing, refund, gateway].map((entry) => entry.publicRecord);
  return { org, triage, billing, refund, gateway, root, first, second, request, toolRequest, publicKeys };
}

function deterministicIds() {
  let n = 0;
  return () => String(++n).padStart(2, "0");
}

async function runGateway(c, overrides = {}) {
  return evaluateProtectedAction({
    rootMandate: c.root,
    delegations: [c.first, c.second],
    actionRequest: c.request,
    publicKeys: c.publicKeys,
    gatewaySigner: c.gateway.signer,
    toolRequest: c.toolRequest,
    protectedTool: (request) => executeDeterministicRefund(request),
    replayStore: new ReplayStore(),
    now: NOW,
    idFactory: deterministicIds(),
    ...overrides,
  });
}

test("valid $85 request under a $100 delegation reaches the protected tool and confirms execution", async () => {
  const c = chain();
  const result = await runGateway(c);
  assert.equal(result.decisionReceipt.claims.decision, "allowed");
  assert.equal(result.outcome, "confirmed");
  assert.equal(result.toolResult.transactionId, "sim-refund-194-usd-8500");
  assert.equal(result.executionReceipt.claims.effectStatus, "confirmed");
  assert.equal(result.executionReceipt.claims.transactionId, "sim-refund-194-usd-8500");
});

test("$850 request is blocked before the protected tool is called", async () => {
  const c = chain({ amountCents: 85000 });
  let toolCalls = 0;
  const result = await runGateway(c, { protectedTool: () => { toolCalls += 1; throw new Error("must not execute"); } });
  assert.equal(result.outcome, "blocked");
  assert.equal(toolCalls, 0);
  assert.equal(result.executionReceipt, null);
  assert.ok(result.reasonCodes.includes(GATEWAY_REASON_CODES.DELEGATED_LIMIT_EXCEEDED));
});

test("tampered action request signature is denied before execution", async () => {
  const c = chain();
  const tampered = structuredClone(c.request);
  tampered.claims.expectedEffect = "tampered";
  let toolCalls = 0;
  const result = await runGateway(c, {
    actionRequest: tampered,
    protectedTool: () => { toolCalls += 1; return {}; },
  });
  assert.equal(result.outcome, "denied");
  assert.equal(toolCalls, 0);
  assert.ok(result.reasonCodes.includes(GATEWAY_REASON_CODES.REQUEST_SIGNATURE_INVALID));
});

test("expired delegation is denied", async () => {
  const c = chain({ expiresAt: "2026-09-02T21:05:00.000Z" });
  const result = await runGateway(c);
  assert.equal(result.outcome, "denied");
  assert.ok(result.reasonCodes.includes(GATEWAY_REASON_CODES.DELEGATION_EXPIRED));
  assert.equal(result.executionReceipt, null);
});

test("child delegation cannot broaden the parent's refund limit", async () => {
  const c = chain({ finalLimitCents: 20000 });
  const result = await runGateway(c);
  assert.equal(result.outcome, "blocked");
  assert.ok(result.reasonCodes.includes(GATEWAY_REASON_CODES.AUTHORITY_EXPANSION));
  assert.equal(result.executionReceipt, null);
});

test("request replay is denied after the first authenticated evaluation", async () => {
  const c = chain();
  const replayStore = new ReplayStore();
  const first = await runGateway(c, { replayStore });
  const second = await runGateway(c, { replayStore });
  assert.equal(first.outcome, "confirmed");
  assert.equal(second.outcome, "denied");
  assert.ok(second.reasonCodes.includes(GATEWAY_REASON_CODES.REPLAY_DETECTED));
  assert.equal(second.executionReceipt, null);
});

test("tool failure produces signed failed execution evidence after an allowed decision", async () => {
  const c = chain();
  const result = await runGateway(c, { protectedTool: async () => { throw new Error("provider timeout"); } });
  assert.equal(result.decisionReceipt.claims.decision, "allowed");
  assert.equal(result.outcome, "failed");
  assert.equal(result.executionReceipt.claims.effectStatus, "failed");
  assert.equal(result.executionReceipt.claims.transactionId, null);
  assert.deepEqual(result.reasonCodes, [GATEWAY_REASON_CODES.PROTECTED_TOOL_FAILED]);
});

test("actual tool parameters must match the signed request evidence", async () => {
  const c = chain();
  const result = await runGateway(c, {
    toolRequest: { ...c.toolRequest, amountCents: 9900 },
  });
  assert.equal(result.outcome, "denied");
  assert.ok(result.reasonCodes.includes(GATEWAY_REASON_CODES.PARAMETERS_EVIDENCE_MISMATCH));
  assert.equal(result.executionReceipt, null);
});
