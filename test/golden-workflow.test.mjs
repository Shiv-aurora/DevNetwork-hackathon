import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicModelClient } from "../src/agents/model-runtime.mjs";
import { runGoldenWorkflow, WORKFLOW_SCENARIOS } from "../src/agents/golden-workflow.mjs";
import { RECEIPT_TYPES } from "../src/evidence/receipts.mjs";

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

test("golden multi-agent workflow produces a complete signed valid chain", async () => {
  const workflow = await runGoldenWorkflow({
    modelClient: createDeterministicModelClient(),
    idFactory: ids(),
  });

  assert.equal(workflow.scenario, "valid");
  assert.equal(workflow.requestedAmountCents, 8500);
  assert.equal(workflow.delegatedLimitCents, 10000);
  assert.equal(workflow.gateway.outcome, "confirmed");
  assert.equal(workflow.gateway.transactionId, "sim-refund-194-usd-8500");
  assert.equal(workflow.routingDecision.provider, "deterministic-fallback");
  assert.equal(workflow.routingDecision.modelDriven, false);

  const types = workflow.receipts.map((receipt) => receipt.type);
  assert.deepEqual(types, [
    RECEIPT_TYPES.ROOT_MANDATE,
    RECEIPT_TYPES.DELEGATION,
    RECEIPT_TYPES.DELEGATION,
    RECEIPT_TYPES.ACTION_REQUEST,
    RECEIPT_TYPES.GATEWAY_DECISION,
    RECEIPT_TYPES.EXECUTION,
  ]);
  assert.equal(workflow.runSeal.type, RECEIPT_TYPES.RUN_SEAL);
  assert.equal(workflow.timeline.length, 6);
  assert.equal(JSON.stringify(workflow).includes("PRIVATE KEY"), false);
});

test("injected model decision is materially used for the Triage-to-Billing delegation", async () => {
  const modelClient = {
    async decideJson({ validate }) {
      const value = {
        route: "billing",
        category: "duplicate-charge",
        shouldInvestigate: true,
        summary: "Model routed the duplicate-charge case to Billing for transaction verification.",
      };
      assert.equal(validate(value), true);
      return {
        value,
        provider: "groq",
        model: "test-groq-model",
        requestId: "req_model_1",
        modelDriven: true,
      };
    },
  };

  const workflow = await runGoldenWorkflow({ modelClient, idFactory: ids() });
  assert.equal(workflow.routingDecision.modelDriven, true);
  assert.equal(workflow.routingDecision.provider, "groq");
  assert.equal(workflow.routingDecision.requestId, "req_model_1");
  const triageDelegation = workflow.receipts.find((receipt) => receipt.receiptId.includes("triage_billing"));
  assert.equal(triageDelegation.claims.purpose, workflow.routingDecision.summary);
});

test("authority attack follows the same signed workflow but is blocked before execution", async () => {
  let protectedToolCalls = 0;
  const workflow = await runGoldenWorkflow({
    scenario: WORKFLOW_SCENARIOS.AUTHORITY_ATTACK,
    modelClient: createDeterministicModelClient(),
    protectedTool: async () => {
      protectedToolCalls += 1;
      throw new Error("must never execute");
    },
    idFactory: ids(),
  });

  assert.equal(workflow.requestedAmountCents, 85000);
  assert.equal(workflow.gateway.outcome, "blocked");
  assert.equal(protectedToolCalls, 0);
  assert.equal(workflow.receipts.some((receipt) => receipt.type === RECEIPT_TYPES.EXECUTION), false);
  assert.equal(workflow.timeline.at(-1).actor, "Proof Gateway");
});

test("workflow exposes visible request amount while keeping customer identity digested", async () => {
  const workflow = await runGoldenWorkflow({
    modelClient: createDeterministicModelClient(),
    idFactory: ids(),
  });
  const actionRequest = workflow.receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ACTION_REQUEST);
  assert.equal(actionRequest.claims.parametersEvidence.display.amountCents, 8500);
  assert.equal(actionRequest.claims.parametersEvidence.customer.redacted, true);
  assert.equal(JSON.stringify(actionRequest).includes("customer_case_194"), false);
});
