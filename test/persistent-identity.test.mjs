import test from "node:test";
import assert from "node:assert/strict";

import { createDeterministicModelClient } from "../src/agents/model-runtime.mjs";
import { runGoldenWorkflow } from "../src/agents/golden-workflow.mjs";
import { exportPrivateKeyPkcs8, generateSigningIdentity } from "../src/crypto/keys.mjs";
import { createIdentityManifest, manifestPublicKeys } from "../src/identity/manifest.mjs";
import { loadSigningIdentitiesFromEnv } from "../src/server/signing-runtime.mjs";
import { verifyEvidenceBundle } from "../src/verifier/verify-bundle.mjs";

const T = "2026-09-02T20:00:00.000Z";
const EXP = "2027-09-02T20:00:00.000Z";

function generate(ownerId, keyId) {
  return generateSigningIdentity({ ownerId, keyId, validFrom: T, validUntil: EXP });
}

function deploymentMaterial() {
  const identities = {
    organization: generate("org_acme_support", "org-root-v1"),
    triage: generate("agent_triage", "triage-v1"),
    billing: generate("agent_billing", "billing-v1"),
    refund: generate("agent_refund", "refund-v1"),
    gateway: generate("gateway_proof", "gateway-v1"),
  };
  const manifest = createIdentityManifest({
    organization: { id: "org_acme_support", name: "Acme Support", status: "active" },
    domain: "proofroot.test",
    generatedAt: T,
    validUntil: EXP,
    rootPublicKey: identities.organization.publicRecord,
    agentPublicKeys: [identities.triage, identities.billing, identities.refund, identities.gateway].map((entry) => entry.publicRecord),
    rootPrivateKey: identities.organization.privateKey,
  });
  const privateKeys = Object.fromEntries(Object.values(identities).map((entry) => [
    entry.publicRecord.keyId,
    exportPrivateKeyPkcs8(entry.privateKey),
  ]));
  return { manifest, privateKeys };
}

test("deployment secret loader reconstructs signers that match the public domain manifest", () => {
  const { manifest, privateKeys } = deploymentMaterial();
  const loaded = loadSigningIdentitiesFromEnv({
    PROOFROOT_PUBLIC_MANIFEST_JSON: JSON.stringify(manifest),
    PROOFROOT_SIGNING_KEYS_JSON: JSON.stringify(privateKeys),
  });

  assert.equal(loaded.organization.publicRecord.fingerprint, manifest.rootKey.fingerprint);
  assert.equal(loaded.triage.publicRecord.fingerprint, manifest.agents.find((agent) => agent.id === "agent_triage").fingerprint);
  assert.equal(loaded.gateway.publicRecord.fingerprint, manifest.agents.find((agent) => agent.id === "gateway_proof").fingerprint);
});

test("persistent signers produce receipts that independently resolve to the same manifest keys", async () => {
  const { manifest, privateKeys } = deploymentMaterial();
  const signingIdentities = loadSigningIdentitiesFromEnv({
    PROOFROOT_PUBLIC_MANIFEST_JSON: JSON.stringify(manifest),
    PROOFROOT_SIGNING_KEYS_JSON: JSON.stringify(privateKeys),
  });
  const workflow = await runGoldenWorkflow({
    modelClient: createDeterministicModelClient(),
    signingIdentities,
    now: "2026-09-02T21:00:00.000Z",
    validUntil: "2026-09-02T22:00:00.000Z",
    domainName: "proofroot.test",
    namecomEnvironment: "sandbox",
  });
  const report = await verifyEvidenceBundle(workflow.evidenceBundle, {
    identityResolver: async () => ({
      status: "verified",
      source: "name.com-sandbox-provider-backed-test-double",
      publicKeys: manifestPublicKeys(manifest),
    }),
  });

  assert.equal(workflow.identity.persistent, true);
  assert.equal(workflow.identity.domainName, "proofroot.test");
  assert.equal(report.overallStatus, "verified");
  assert.equal(JSON.stringify(workflow).includes(privateKeys["org-root-v1"]), false);
});

test("mismatched private material fails closed rather than signing under the wrong published identity", () => {
  const { manifest, privateKeys } = deploymentMaterial();
  const unrelated = generate("unrelated", "unrelated-v1");
  privateKeys["triage-v1"] = exportPrivateKeyPkcs8(unrelated.privateKey);

  assert.throws(() => loadSigningIdentitiesFromEnv({
    PROOFROOT_PUBLIC_MANIFEST_JSON: JSON.stringify(manifest),
    PROOFROOT_SIGNING_KEYS_JSON: JSON.stringify(privateKeys),
  }), /does not match public record/i);
});
