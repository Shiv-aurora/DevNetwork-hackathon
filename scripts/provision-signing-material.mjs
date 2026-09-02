import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { exportPrivateKeyPkcs8, generateSigningIdentity } from "../src/crypto/keys.mjs";
import { createIdentityManifest } from "../src/identity/manifest.mjs";

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const domain = process.env.PROOFROOT_DOMAIN;
if (!domain) {
  console.error("PROOFROOT_DOMAIN is required before provisioning persistent signing material.");
  process.exit(2);
}

const directory = resolve(".proofroot");
const manifestPath = resolve(directory, "public-manifest.json");
const signingKeysPath = resolve(directory, "signing-keys.json");
if (!force && (existsSync(manifestPath) || existsSync(signingKeysPath))) {
  console.error("Provisioning material already exists in .proofroot/. Refusing to rotate keys implicitly; use --force only for intentional re-provisioning.");
  process.exit(3);
}

mkdirSync(directory, { recursive: true });
const generatedAt = new Date().toISOString();
const validUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
const ids = {
  organization: ["org_acme_support", "org-root-v1"],
  triage: ["agent_triage", "triage-v1"],
  billing: ["agent_billing", "billing-v1"],
  refund: ["agent_refund", "refund-v1"],
  gateway: ["gateway_proof", "gateway-v1"],
};
const identities = Object.fromEntries(Object.entries(ids).map(([role, [ownerId, keyId]]) => [
  role,
  generateSigningIdentity({ ownerId, keyId, validFrom: generatedAt, validUntil }),
]));

const manifest = createIdentityManifest({
  organization: { id: "org_acme_support", name: "Acme Support", status: "active" },
  domain,
  generatedAt,
  validUntil,
  rootPublicKey: identities.organization.publicRecord,
  agentPublicKeys: [
    identities.triage.publicRecord,
    identities.billing.publicRecord,
    identities.refund.publicRecord,
    identities.gateway.publicRecord,
  ],
  rootPrivateKey: identities.organization.privateKey,
});
const signingKeys = Object.fromEntries(Object.values(identities).map((identity) => [
  identity.publicRecord.keyId,
  exportPrivateKeyPkcs8(identity.privateKey),
]));

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o644 });
writeFileSync(signingKeysPath, `${JSON.stringify(signingKeys, null, 2)}\n`, { mode: 0o600 });

console.log(JSON.stringify({
  status: "provisioned",
  domain,
  manifestPath,
  signingKeysPath,
  instruction: "Keep signing-keys.json private. Configure PROOFROOT_PUBLIC_MANIFEST_JSON from public-manifest.json and PROOFROOT_SIGNING_KEYS_JSON from signing-keys.json in the deployment secret environment.",
}, null, 2));
