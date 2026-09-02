import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicModelClient } from "../src/agents/model-runtime.mjs";
import { runGoldenWorkflow, WORKFLOW_SCENARIOS } from "../src/agents/golden-workflow.mjs";
import { RECEIPT_TYPES } from "../src/evidence/receipts.mjs";
import { verifyEvidenceBundle } from "../src/verifier/verify-bundle.mjs";

function ids() {
  let n = 0;
  return () => `verify${++n}`;
}

function sandboxResolver(publicKeys) {
  return async () => ({
    status: "verified",
    source: "name.com-sandbox-provider-backed-test-double",
    publicKeys,
    detail: "Provider-backed identity material matched the evidence bundle.",
    limitation: "Test resolver models name.com sandbox provider-backed lookup; it does not claim public DNS resolution.",
  });
}

test("valid bundle verifies end to end when identity material resolves independently", async () => {
  const workflow = await runGoldenWorkflow({ modelClient: createDeterministicModelClient(), idFactory: ids() });
  const report = await verifyEvidenceBundle(workflow.evidenceBundle, {
    identityResolver: sandboxResolver(workflow.publicKeys),
  });

  assert.equal(report.overallStatus, "verified");
  for (const check of Object.values(report.checks)) assert.equal(check.status, "valid");
  assert.equal(report.firstFailure, null);
  assert.equal(report.affectedReceiptIds.length, 0);
  assert.ok(report.provenClaims.includes("externally-resolved-identity-binding"));
});

test("same cryptographic bundle remains explicit about identity when no resolver is supplied", async () => {
  const workflow = await runGoldenWorkflow({ modelClient: createDeterministicModelClient(), idFactory: ids() });
  const report = await verifyEvidenceBundle(workflow.evidenceBundle);
  assert.equal(report.overallStatus, "evidence-valid-identity-unverifiable");
  assert.equal(report.checks.identityResolution.status, "unverifiable");
  assert.equal(report.checks.signatureValidity.status, "valid");
  assert.equal(report.checks.gatewayEvidence.status, "valid");
});

test("receipt amount tampering localizes the exact action request and marks downstream evidence affected", async () => {
  const workflow = await runGoldenWorkflow({ modelClient: createDeterministicModelClient(), idFactory: ids() });
  const tampered = structuredClone(workflow.evidenceBundle);
  const request = tampered.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ACTION_REQUEST);
  request.claims.parametersEvidence.display.amountCents = 85000;

  const report = await verifyEvidenceBundle(tampered, {
    identityResolver: sandboxResolver(workflow.publicKeys),
  });
  assert.equal(report.overallStatus, "failed");
  assert.equal(report.firstFailure.receiptId, request.receiptId);
  assert.equal(report.checks.signatureValidity.status, "invalid");
  assert.equal(report.checks.bundleIntegrity.status, "invalid");
  const decision = tampered.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.GATEWAY_DECISION);
  assert.ok(report.affectedReceiptIds.includes(request.receiptId));
  assert.ok(report.affectedReceiptIds.includes(decision.receiptId));
  assert.ok(report.affectedReceiptIds.includes(tampered.runSeal.receiptId));
});

test("missing parent evidence fails delegation and identifies dependent receipt", async () => {
  const workflow = await runGoldenWorkflow({ modelClient: createDeterministicModelClient(), idFactory: ids() });
  const altered = structuredClone(workflow.evidenceBundle);
  const firstDelegation = altered.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.DELEGATION);
  altered.receipts = altered.receipts.filter((receipt) => receipt.receiptId !== firstDelegation.receiptId);

  const report = await verifyEvidenceBundle(altered, {
    identityResolver: sandboxResolver(workflow.publicKeys),
  });
  assert.equal(report.overallStatus, "failed");
  assert.equal(report.checks.delegationValidity.status, "invalid");
  assert.equal(report.checks.bundleIntegrity.status, "invalid");
});

test("authority attack verifies cryptographic evidence while reporting the signed constraint violation", async () => {
  const workflow = await runGoldenWorkflow({
    scenario: WORKFLOW_SCENARIOS.AUTHORITY_ATTACK,
    modelClient: createDeterministicModelClient(),
    idFactory: ids(),
  });
  const report = await verifyEvidenceBundle(workflow.evidenceBundle, {
    identityResolver: sandboxResolver(workflow.publicKeys),
  });

  assert.equal(report.checks.signatureValidity.status, "valid");
  assert.equal(report.checks.gatewayEvidence.status, "valid");
  assert.equal(report.checks.constraintValidity.status, "invalid");
  assert.equal(workflow.gateway.outcome, "blocked");
  assert.equal(workflow.receipts.some((receipt) => receipt.type === RECEIPT_TYPES.EXECUTION), false);
});

test("identity resolver mismatch fails identity independently of otherwise valid signatures", async () => {
  const workflow = await runGoldenWorkflow({ modelClient: createDeterministicModelClient(), idFactory: ids() });
  const alteredKeys = structuredClone(workflow.publicKeys);
  alteredKeys[0].fingerprint = "sha256:not-the-bundle-key";
  const report = await verifyEvidenceBundle(workflow.evidenceBundle, {
    identityResolver: sandboxResolver(alteredKeys),
  });
  assert.equal(report.overallStatus, "failed");
  assert.equal(report.checks.identityResolution.status, "invalid");
  assert.equal(report.checks.signatureValidity.status, "invalid");
});
