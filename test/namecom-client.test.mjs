import test from "node:test";
import assert from "node:assert/strict";

import { createNamecomClient, NamecomApiError } from "../src/integrations/namecom-client.mjs";

function response(body, status = 200, headers = {}) {
  if (status === 204) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function recordingClient(handler) {
  const calls = [];
  const client = createNamecomClient({
    environment: "sandbox",
    username: "proofroot-test",
    token: "sandbox-secret-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return handler(url, options, calls.length - 1);
    },
  });
  return { client, calls };
}

test("name.com client exposes truthful sandbox environment metadata", () => {
  const { client } = recordingClient(() => response({}));
  assert.equal(client.environmentInfo.environment, "sandbox");
  assert.equal(client.environmentInfo.baseUrl, "https://api.dev.name.com");
  assert.equal(client.environmentInfo.publicDnsAvailable, false);
  assert.match(client.environmentInfo.limitation, /do not resolve publicly/i);
});

test("domain discovery uses literal CORE v1 colon endpoints and registration filtering", async () => {
  const { client, calls } = recordingClient(() => response({ results: [] }));
  await client.searchDomains({ keyword: "proofroot", tldFilter: ["com", "dev"] });
  await client.checkAvailability(["proofroot.com"]);

  assert.equal(calls[0].url, "https://api.dev.name.com/core/v1/domains:search");
  assert.equal(calls[1].url, "https://api.dev.name.com/core/v1/domains:checkAvailability");
  assert.equal(calls[0].url.includes("%3A"), false);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    keyword: "proofroot",
    timeout: 2500,
    tldFilter: ["com", "dev"],
    purchaseType: "registration",
  });
});

test("domain creation uses CORE payload and optional idempotency key without leaking secrets", async () => {
  const { client, calls } = recordingClient(() => response({ domain: { domainName: "proofroot.test" }, order: 42, totalPaid: 9.99 }));
  const result = await client.createDomain({
    domainName: "proofroot.test",
    years: 1,
    idempotencyKey: "idem-proofroot-1",
  });

  assert.equal(calls[0].url, "https://api.dev.name.com/core/v1/domains");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Idempotency-Key"], "idem-proofroot-1");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    domain: { domainName: "proofroot.test" },
    purchaseType: "registration",
    years: 1,
  });
  assert.equal(result.order, 42);
  assert.equal(JSON.stringify(result).includes("sandbox-secret-token"), false);
});

test("DNS lifecycle uses create, list, full-overwrite update, and delete endpoints", async () => {
  const { client, calls } = recordingClient((url, options) => {
    if (options.method === "DELETE") return response(null, 204);
    if (options.method === "GET") return response({ records: [] });
    return response({ id: 77, type: "TXT", host: "_proofroot", answer: "v=proofroot1", ttl: 300 });
  });

  await client.createRecord("proofroot.test", {
    type: "TXT",
    host: "_proofroot",
    answer: "v=proofroot1",
    ttl: 300,
  });
  await client.listRecords("proofroot.test");
  await client.updateRecord("proofroot.test", 77, {
    type: "TXT",
    host: "_proofroot",
    answer: "v=proofroot1 status=active",
    ttl: 300,
  });
  const deleted = await client.deleteRecord("proofroot.test", 77);

  assert.equal(calls[0].url, "https://api.dev.name.com/core/v1/domains/proofroot.test/records");
  assert.match(calls[1].url, /\/records\?page=1&perPage=100$/);
  assert.equal(calls[2].url, "https://api.dev.name.com/core/v1/domains/proofroot.test/records/77");
  assert.equal(calls[2].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    type: "TXT",
    host: "_proofroot",
    answer: "v=proofroot1 status=active",
    ttl: 300,
  });
  assert.equal(calls[3].options.method, "DELETE");
  assert.equal(deleted, null);
});

test("DNS client rejects invalid TTL locally before provider calls", async () => {
  const { client, calls } = recordingClient(() => response({}));
  await assert.rejects(
    Promise.resolve().then(() => client.createRecord("proofroot.test", {
      type: "TXT", host: "_proofroot", answer: "value", ttl: 60,
    })),
    /at least 300/i,
  );
  assert.equal(calls.length, 0);
});

test("provider failures are classified and credentials are redacted", async () => {
  const { client } = recordingClient(() => response({
    message: "Permission denied for proofroot-test",
    details: "token sandbox-secret-token invalid",
  }, 403));

  await assert.rejects(
    client.listDomains(),
    (error) => error instanceof NamecomApiError
      && error.code === "PERMISSION_DENIED"
      && error.status === 403
      && !error.message.includes("proofroot-test")
      && !error.message.includes("sandbox-secret-token"),
  );
});
