import test from "node:test";
import assert from "node:assert/strict";

import { ENTITY_KINDS, assertProofRootState } from "../src/core/domain-model.mjs";
import { ACTION_STATUS, STATUS_MEANING } from "../src/core/statuses.mjs";
import { createGoldenFixture, DEMO_SCENARIOS } from "../src/core/golden-fixture.mjs";

test("Phase 1 defines every required core entity", () => {
  assert.deepEqual(ENTITY_KINDS, [
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
});

test("golden and attack fixtures share one valid state model", () => {
  for (const scenario of Object.values(DEMO_SCENARIOS)) {
    const fixture = createGoldenFixture({ scenario });
    assert.equal(assertProofRootState(fixture), true);
    assert.equal(fixture.fixtureVersion, "golden.v1");
    assert.equal(fixture.agentIdentities.length, 4);
    assert.equal(fixture.verificationReports[0].status, "unverifiable");
  }
});

test("status vocabulary does not conflate intent, authorization, dispatch, and confirmation", () => {
  const ordered = [
    ACTION_STATUS.REQUESTED,
    ACTION_STATUS.ALLOWED,
    ACTION_STATUS.DISPATCHED,
    ACTION_STATUS.CONFIRMED,
  ];
  assert.equal(new Set(ordered).size, ordered.length);
  for (const status of [...ordered, ACTION_STATUS.BLOCKED, ACTION_STATUS.FAILED, ACTION_STATUS.UNVERIFIABLE]) {
    assert.ok(STATUS_MEANING[status]);
  }
  assert.match(STATUS_MEANING.requested, /no authorization or tool effect/i);
  assert.match(STATUS_MEANING.allowed, /execution is not yet implied/i);
  assert.match(STATUS_MEANING.dispatched, /confirmation is not implied/i);
});

test("authority attack fixture preserves the signed-contract boundary value", () => {
  const fixture = createGoldenFixture({ scenario: DEMO_SCENARIOS.AUTHORITY_ATTACK });
  const run = fixture.runs[0];
  assert.equal(run.requestedAmountCents, 85000);
  assert.equal(run.delegatedLimitCents, 10000);
  assert.ok(run.requestedAmountCents > run.delegatedLimitCents);
});
