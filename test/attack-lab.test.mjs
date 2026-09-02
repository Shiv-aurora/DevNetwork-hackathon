import test from "node:test";
import assert from "node:assert/strict";

import { runAuthorityViolationAttack, runEvidenceTamperAttack } from "../src/attacks/attack-lab.mjs";

function ids() {
  let n = 0;
  return () => `attack${++n}`;
}

test("authority attack is blocked before any protected-tool transaction exists", async () => {
  const attack = await runAuthorityViolationAttack({ idFactory: ids() });
  assert.equal(attack.result, "blocked");
  assert.equal(attack.protectedToolCalls, 0);
  assert.equal(attack.transactionCreated, false);
  assert.equal(attack.executionReceipt, null);
  assert.match(attack.expected, /BLOCKED BEFORE EXECUTION/);
  assert.ok(attack.reasonCodes.includes("DELEGATED_LIMIT_EXCEEDED"));
});

test("tamper attack changes $85 to $850 and verification localizes the exact receipt", async () => {
  const attack = await runEvidenceTamperAttack({ idFactory: ids() });
  assert.equal(attack.originalAmountCents, 8500);
  assert.equal(attack.tamperedAmountCents, 85000);
  assert.equal(attack.result, "failed");
  assert.equal(attack.firstFailure.receiptId, attack.alteredReceiptId);
  assert.ok(attack.affectedReceiptIds.includes(attack.alteredReceiptId));
  assert.ok(attack.verification.affectedReceiptIds.length >= 2);
  assert.equal(attack.verification.checks.signatureValidity.status, "invalid");
  assert.equal(attack.verification.checks.bundleIntegrity.status, "invalid");
});
