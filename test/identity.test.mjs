import test from "node:test";
import assert from "node:assert/strict";

import { generateSigningIdentity } from "../src/crypto/keys.mjs";
import { createIdentityManifest, manifestPublicKeys, verifyIdentityManifest } from "../src/identity/manifest.mjs";
import { buildIdentityDnsRecords, publishIdentityDnsRecords, reconcileIdentityDnsRecords } from "../src/identity/namecom-publication.mjs";
import { createDomainIdentityResolver } from "../src/identity/resolver.mjs";

const T = "2026-09-02T21:00:00.000Z";
const NOW = "2026-09-02T21:30:00.000Z";
const EXP = "2026-09-02T22:00:00.000Z";

function identity(ownerId) {
  return generateSigningIdentity({ ownerId, keyId: `key_${ownerId}`, validFrom: T, validUntil: EXP });
}

function demoManifest(domain = "proofroot.test") {
  const root = identity("org_acme_support");
  const agents = ["agent_triage", "agent_billing", "agent_refund", "gateway_proof"].map(identity);
  const manifest = createIdentityManifest({
    organization: { id: "org_acme_support", name: "Acme Support" },
    domain,
    generatedAt: T,
    validUntil: EXP,
    rootPublicKey: root.publicRecord,
    agentPublicKeys: agents.map((entry) => entry.publicRecord),
    rootPrivateKey: root.privateKey,
  });
  return { root, agents, manifest };
}

test("signed organization identity manifest verifies and contains no private key material", () => {
  const { root, manifest } = demoManifest();
  const result = verifyIdentityManifest(manifest, root.publicRecord);
  assert.equal(result.valid, true);
  assert.equal(manifest.agents.length, 4);
  assert.equal(new Set(manifest.agents.map((agent) => agent.id)).size, 4);
  assert.equal(new Set(manifest.agents.map((agent) => agent.keyId)).size, 4);
  assert.equal(JSON.stringify(manifest).includes("PRIVATE KEY"), false);
});

test("material manifest tampering invalidates signature and digest", () => {
  const { root, manifest } = demoManifest();
  const altered = structuredClone(manifest);
  altered.agents[0].status = "retired";
  const result = verifyIdentityManifest(altered, root.publicRecord);
  assert.equal(result.valid, false);
  assert.equal(result.digestValid, false);
  assert.equal(result.signatureValid, false);
});

test("name.com publication plan creates organization root, manifest host, and per-agent locators", () => {
  const { manifest } = demoManifest("proofroot.test");
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.test",
    manifestTargetHost: "cname.vercel-dns.com",
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  assert.equal(plan.manifestUrl, "https://proof.proofroot.test/.well-known/proofroot.json");
  assert.equal(plan.records[0].type, "TXT");
  assert.equal(plan.records[0].host, "_proofroot");
  assert.match(plan.records[0].answer, /v=proofroot1/);
  assert.match(plan.records[0].answer, /fp=sha256:/);
  assert.deepEqual(plan.records.map((record) => record.type), ["TXT", "CNAME", "TXT", "TXT", "TXT", "TXT"]);
});

test("sandbox publication can point provider-backed TXT at a separately reachable HTTPS manifest", () => {
  const { manifest } = demoManifest("proofroot.test");
  const publicManifestUrl = "https://proofroot-demo.vercel.app/.well-known/proofroot.json";
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.test",
    manifestTargetHost: "proofroot-demo.vercel.app",
    manifestPublicUrl: publicManifestUrl,
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  assert.equal(plan.manifestUrl, publicManifestUrl);
  assert.match(plan.records[0].answer, new RegExp(`manifest=${publicManifestUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(plan.records[1].type, "CNAME");
  assert.equal(plan.records[1].host, "proof");
});

test("publication and reconciliation preserve provider record IDs without local fake success", async () => {
  const { manifest } = demoManifest();
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.test",
    manifestTargetHost: "cname.vercel-dns.com",
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  let nextId = 10;
  const providerRecords = [];
  const client = {
    async createRecord(_domain, record) {
      const saved = { ...record, id: nextId++ };
      providerRecords.push(saved);
      return saved;
    },
    async listRecords() {
      return { records: providerRecords };
    },
  };
  const published = await publishIdentityDnsRecords({ client, plan });
  assert.equal(published.createdRecords.length, 6);
  assert.equal(published.createdRecords[0].providerRecordId, 10);
  const reconciled = await reconcileIdentityDnsRecords({ client, plan });
  assert.equal(reconciled.matched, true);
  assert.equal(reconciled.records.every((entry) => entry.providerRecordId !== null), true);
});

test("sandbox identity resolver verifies provider-backed TXT, signed manifest, and fingerprint", async () => {
  const { manifest } = demoManifest();
  const publicManifestUrl = "https://proofroot-demo.vercel.app/.well-known/proofroot.json";
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.test",
    manifestTargetHost: "proofroot-demo.vercel.app",
    manifestPublicUrl: publicManifestUrl,
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  const resolver = createDomainIdentityResolver({
    environment: "sandbox",
    domainName: "proofroot.test",
    namecomClient: {
      async listRecords() {
        return { records: [{ id: 1, ...plan.records[0] }] };
      },
    },
    fetchImpl: async (url) => {
      assert.equal(url, publicManifestUrl);
      return new Response(JSON.stringify(manifest), { status: 200, headers: { "content-type": "application/json" } });
    },
    now: () => Date.parse(NOW),
  });
  const resolved = await resolver();
  assert.equal(resolved.status, "verified");
  assert.equal(resolved.source, "name.com-sandbox-provider-backed");
  assert.deepEqual(resolved.publicKeys.map((key) => key.keyId), manifestPublicKeys(manifest).map((key) => key.keyId));
  assert.match(resolved.limitation, /not publicly resolvable/i);
});

test("identity resolver rejects an otherwise valid but expired signed manifest", async () => {
  const { manifest } = demoManifest();
  const publicManifestUrl = "https://proofroot-demo.vercel.app/.well-known/proofroot.json";
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.test",
    manifestTargetHost: "proofroot-demo.vercel.app",
    manifestPublicUrl: publicManifestUrl,
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  const resolver = createDomainIdentityResolver({
    environment: "sandbox",
    domainName: "proofroot.test",
    namecomClient: { async listRecords() { return { records: [{ id: 1, ...plan.records[0] }] }; } },
    fetchImpl: async () => new Response(JSON.stringify(manifest), { status: 200 }),
    now: () => Date.parse("2026-09-02T22:30:00.000Z"),
  });
  const resolved = await resolver();
  assert.equal(resolved.status, "invalid");
  assert.match(resolved.detail, /not valid at the current verification time/i);
});

test("production identity resolver uses public DNS rather than name.com provider lookup", async () => {
  const { manifest } = demoManifest("proofroot.example");
  const plan = buildIdentityDnsRecords({
    domainName: "proofroot.example",
    manifestTargetHost: "cname.vercel-dns.com",
    rootFingerprint: manifest.rootKey.fingerprint,
    agents: manifest.agents,
  });
  let resolvedName;
  const resolver = createDomainIdentityResolver({
    environment: "production",
    domainName: "proofroot.example",
    resolveTxtImpl: async (name) => {
      resolvedName = name;
      return [[plan.records[0].answer]];
    },
    fetchImpl: async () => new Response(JSON.stringify(manifest), { status: 200 }),
    now: () => Date.parse(NOW),
  });
  const resolved = await resolver();
  assert.equal(resolvedName, "_proofroot.proofroot.example");
  assert.equal(resolved.status, "verified");
  assert.equal(resolved.source, "public-dns");
});
