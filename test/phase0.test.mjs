import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_CONTRACT } from "../src/core/demo-contract.mjs";
import { executeDeterministicRefund } from "../src/integrations/refund-simulator.mjs";

test("golden demo amounts are locked", () => {
  assert.equal(DEMO_CONTRACT.supportCaseId, "194");
  assert.equal(DEMO_CONTRACT.validRefundAmountCents, 8500);
  assert.equal(DEMO_CONTRACT.delegatedRefundLimitCents, 10000);
  assert.equal(DEMO_CONTRACT.authorityAttackAmountCents, 85000);
  assert.equal(DEMO_CONTRACT.tamperAttackAmountCents, 85000);
  assert.ok(DEMO_CONTRACT.validRefundAmountCents <= DEMO_CONTRACT.delegatedRefundLimitCents);
  assert.ok(DEMO_CONTRACT.authorityAttackAmountCents > DEMO_CONTRACT.delegatedRefundLimitCents);
});

test("refund simulator is explicit and deterministic", () => {
  const input = {
    caseId: DEMO_CONTRACT.supportCaseId,
    amountCents: DEMO_CONTRACT.validRefundAmountCents,
    currency: DEMO_CONTRACT.currency,
  };

  const first = executeDeterministicRefund(input);
  const second = executeDeterministicRefund(input);

  assert.equal(first.simulated, true);
  assert.match(first.provider, /simulator/i);
  assert.equal(first.status, "confirmed");
  assert.equal(first.transactionId, "sim-refund-194-usd-8500");
  assert.deepEqual(first, second);
});
