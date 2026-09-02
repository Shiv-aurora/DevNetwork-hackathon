import { loadSigningIdentity } from "../crypto/keys.mjs";
import { verifyIdentityManifest } from "../identity/manifest.mjs";

const OWNER_TO_ROLE = Object.freeze({
  org_acme_support: "organization",
  agent_triage: "triage",
  agent_billing: "billing",
  agent_refund: "refund",
  gateway_proof: "gateway",
});

export function loadSigningIdentitiesFromEnv(env = process.env) {
  const manifestJson = env.PROOFROOT_PUBLIC_MANIFEST_JSON;
  const signingKeysJson = env.PROOFROOT_SIGNING_KEYS_JSON;

  if (!manifestJson && !signingKeysJson) return null;
  if (!manifestJson || !signingKeysJson) {
    throw new Error("Persistent signing configuration is incomplete: both PROOFROOT_PUBLIC_MANIFEST_JSON and PROOFROOT_SIGNING_KEYS_JSON are required.");
  }

  let manifest;
  let privateKeys;
  try {
    manifest = JSON.parse(manifestJson);
    privateKeys = JSON.parse(signingKeysJson);
  } catch {
    throw new Error("Persistent signing configuration contains invalid JSON.");
  }

  const manifestCheck = verifyIdentityManifest(manifest, manifest.rootKey);
  if (!manifestCheck.valid) {
    throw new Error(`Configured identity manifest is invalid: ${manifestCheck.reasons.join(", ")}.`);
  }

  const records = [manifest.rootKey, ...manifest.agents];
  const identities = {};
  for (const record of records) {
    const role = OWNER_TO_ROLE[record.ownerId ?? record.id];
    if (!role) continue;
    const privateKeyPkcs8 = privateKeys[record.keyId];
    if (!privateKeyPkcs8) throw new Error(`No private signing key is configured for '${record.keyId}'.`);
    const normalizedRecord = record.ownerId ? record : { ...record, ownerId: record.id };
    const loaded = loadSigningIdentity({ publicRecord: normalizedRecord, privateKeyPkcs8 });
    identities[role] = Object.freeze({
      publicRecord: loaded.publicRecord,
      signer: Object.freeze({
        signerId: loaded.publicRecord.ownerId,
        keyId: loaded.publicRecord.keyId,
        privateKey: loaded.privateKey,
      }),
    });
  }

  for (const role of Object.values(OWNER_TO_ROLE)) {
    if (!identities[role]) throw new Error(`Persistent signing identity '${role}' is missing from the configured manifest.`);
  }
  return Object.freeze(identities);
}
