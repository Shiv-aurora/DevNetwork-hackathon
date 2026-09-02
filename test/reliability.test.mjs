import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createNamecomClient, NamecomApiError } from "../src/integrations/namecom-client.mjs";
import { createDomainIdentityResolver } from "../src/identity/resolver.mjs";
import { namecomConfiguration } from "../src/server/namecom-runtime.mjs";

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("name.com rate limiting is explicit and preserves retry metadata", async () => {
  const client = createNamecomClient({
    environment: "sandbox",
    username: "proofroot-test",
    token: "secret",
    fetchImpl: async () => jsonResponse({ message: "slow down" }, 429, { "retry-after": "12" }),
  });
  await assert.rejects(
    client.listDomains(),
    (error) => error instanceof NamecomApiError
      && error.code === "RATE_LIMITED"
      && error.status === 429
      && error.retryAfter === "12",
  );
});

test("sandbox and production provider endpoints cannot be silently mixed", async () => {
  const calls = [];
  const production = createNamecomClient({
    environment: "production",
    username: "prod-user",
    token: "prod-token",
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({ domains: [], totalCount: 0 });
    },
  });
  await production.listDomains();
  assert.match(calls[0], /^https:\/\/api\.name\.com\/core\/v1\/domains/);
  assert.equal(calls[0].includes("api.dev.name.com"), false);
  assert.equal(production.environmentInfo.publicDnsAvailable, "requires-independent-resolution-check");

  assert.throws(() => createNamecomClient({
    environment: "sandbox",
    username: "prod-user",
    token: "token",
  }), /must end in '-test'/i);
});

test("malformed sandbox identity records are unverifiable instead of accepted", async () => {
  const resolver = createDomainIdentityResolver({
    environment: "sandbox",
    domainName: "proofroot.test",
    namecomClient: {
      async listRecords() {
        return { records: [{ type: "TXT", host: "_proofroot", answer: "not-proofroot" }] };
      },
    },
    fetchImpl: async () => { throw new Error("manifest fetch should not happen"); },
  });
  const result = await resolver();
  assert.equal(result.status, "unverifiable");
  assert.match(result.detail, /Malformed|not found/i);
});

test("runtime environment status never exposes provider credential values", () => {
  const config = namecomConfiguration({
    NAMECOM_ENV: "sandbox",
    NAMECOM_USERNAME: "private-user-test",
    NAMECOM_TOKEN: "private-token",
    PROOFROOT_DOMAIN: "proofroot.test",
  });
  const serialized = JSON.stringify(config);
  assert.equal(serialized.includes("private-user-test"), false);
  assert.equal(serialized.includes("private-token"), false);
  assert.equal(config.configured, true);
});

test("checked-in environment template contains no populated secret values", async () => {
  const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  for (const secretName of ["NAMECOM_USERNAME", "NAMECOM_TOKEN", "GROQ_API_KEY", "PROOFROOT_SIGNING_KEYS_JSON"]) {
    const match = envExample.match(new RegExp(`^${secretName}=(.*)$`, "m"));
    assert.ok(match, `${secretName} must be represented in .env.example`);
    assert.equal(match[1].trim(), "", `${secretName} must not contain a checked-in secret`);
  }
});
