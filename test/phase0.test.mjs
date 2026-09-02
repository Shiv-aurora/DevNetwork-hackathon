import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_CONTRACT } from "../src/core/demo-contract.mjs";
import { executeDeterministicRefund } from "../src/integrations/refund-simulator.mjs";
import { checkNamecomEnvironment, NamecomCheckError } from "../src/integrations/namecom-check.mjs";

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

test("name.com check fails clearly when credentials are missing", async () => {
  await assert.rejects(
    checkNamecomEnvironment({ environment: "sandbox" }),
    (error) => error instanceof NamecomCheckError
      && error.exitCode === 2
      && error.message.includes("NAMECOM_USERNAME")
      && error.message.includes("NAMECOM_TOKEN"),
  );
});

test("name.com check formats successful sandbox responses without exposing credentials", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/core/v1/hello")) {
      return new Response(JSON.stringify({ motd: "Welcome", username: "account-test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ domains: [], totalCount: 0, from: 0, to: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const result = await checkNamecomEnvironment({
    environment: "sandbox",
    username: "account-test",
    token: "private-test-token",
    fetchImpl,
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, "https://api.dev.name.com/core/v1/hello");
  assert.match(requests[1].url, /\/core\/v1\/domains\?/);
  assert.equal(result.authenticated, true);
  assert.equal(result.managedDomainCount, 0);
  assert.equal(result.publicDnsAvailable, false);
  assert.equal(JSON.stringify(result).includes("private-test-token"), false);
});

test("name.com check reports invalid authentication without echoing provider bodies", async () => {
  const fetchImpl = async () => new Response(
    JSON.stringify({ message: "Unauthenticated", details: "sensitive provider detail" }),
    { status: 401, headers: { "content-type": "application/json" } },
  );

  await assert.rejects(
    checkNamecomEnvironment({
      environment: "sandbox",
      username: "account-test",
      token: "private-test-token",
      fetchImpl,
    }),
    (error) => error instanceof NamecomCheckError
      && error.exitCode === 4
      && error.message.includes("HTTP 401")
      && !error.message.includes("sensitive provider detail")
      && !error.message.includes("private-test-token"),
  );
});
