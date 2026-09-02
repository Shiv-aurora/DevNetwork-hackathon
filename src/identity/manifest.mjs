import { canonicalDigest, canonicalize } from "../crypto/canonical-json.mjs";
import { signCanonicalBytes, verifyCanonicalBytes } from "../crypto/keys.mjs";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${field} is required.`);
  return value.trim();
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function unsignedManifest(manifest) {
  const { contentDigest: _digest, signature: _signature, ...unsigned } = manifest;
  return unsigned;
}

function publicAgentRecord(record) {
  return Object.freeze({
    id: record.ownerId,
    keyId: record.keyId,
    algorithm: record.algorithm,
    status: record.status,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    ...(record.retiredAt ? { retiredAt: record.retiredAt } : {}),
    publicKeySpki: record.publicKeySpki,
    fingerprint: record.fingerprint,
  });
}

function normalizedPublicKeyRecord(record) {
  const ownerId = record?.ownerId ?? record?.id;
  if (!ownerId || !record?.keyId || !record?.publicKeySpki || !record?.fingerprint) {
    throw new Error("Invalid public identity key record in ProofRoot manifest.");
  }
  return Object.freeze({
    keyId: record.keyId,
    ownerId,
    algorithm: record.algorithm,
    status: record.status,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    ...(record.retiredAt ? { retiredAt: record.retiredAt } : {}),
    publicKeySpki: record.publicKeySpki,
    fingerprint: record.fingerprint,
  });
}

export function createIdentityManifest({
  organization,
  domain,
  generatedAt,
  validUntil,
  rootPublicKey,
  agentPublicKeys,
  rootPrivateKey,
}) {
  if (!organization?.id || !organization?.name) throw new Error("organization id and name are required.");
  requireString(domain, "domain");
  requireString(generatedAt, "generatedAt");
  requireString(validUntil, "validUntil");
  if (!validTimestamp(generatedAt) || !validTimestamp(validUntil) || Date.parse(validUntil) <= Date.parse(generatedAt)) {
    throw new Error("Manifest generatedAt/validUntil must define a valid forward-looking interval.");
  }
  if (!rootPublicKey?.keyId || !rootPrivateKey) throw new Error("root signing key material is required.");
  if (!Array.isArray(agentPublicKeys) || agentPublicKeys.length === 0) throw new Error("agentPublicKeys must be a non-empty array.");

  const unsigned = {
    version: "proofroot.identity.v1",
    organization: {
      id: organization.id,
      name: organization.name,
      status: organization.status ?? "active",
    },
    domain,
    generatedAt,
    validUntil,
    rootKey: publicAgentRecord(rootPublicKey),
    agents: agentPublicKeys.map(publicAgentRecord),
  };
  const canonical = canonicalize(unsigned);
  return Object.freeze({
    ...unsigned,
    contentDigest: canonicalDigest(unsigned),
    signature: Object.freeze({
      algorithm: "Ed25519",
      keyId: rootPublicKey.keyId,
      value: signCanonicalBytes(rootPrivateKey, canonical),
    }),
  });
}

export function verifyIdentityManifest(manifest, expectedRootKey = manifest?.rootKey) {
  const reasons = [];
  if (!manifest || manifest.version !== "proofroot.identity.v1") reasons.push("unsupported-manifest-version");
  if (!expectedRootKey) reasons.push("root-key-missing");
  if (manifest?.signature?.keyId !== expectedRootKey?.keyId) reasons.push("root-key-id-mismatch");
  if (manifest?.rootKey?.fingerprint !== expectedRootKey?.fingerprint) reasons.push("root-fingerprint-mismatch");

  if (!validTimestamp(manifest?.generatedAt) || !validTimestamp(manifest?.validUntil)
    || Date.parse(manifest.validUntil) <= Date.parse(manifest.generatedAt)) {
    reasons.push("invalid-manifest-validity-window");
  }

  let digestValid = false;
  let signatureValid = false;
  try {
    const unsigned = unsignedManifest(manifest);
    digestValid = canonicalDigest(unsigned) === manifest.contentDigest;
    signatureValid = verifyCanonicalBytes(expectedRootKey, canonicalize(unsigned), manifest.signature?.value ?? "");
  } catch {
    reasons.push("malformed-manifest");
  }
  if (!digestValid) reasons.push("manifest-digest-mismatch");
  if (!signatureValid) reasons.push("manifest-signature-invalid");

  const actors = [manifest?.rootKey, ...(manifest?.agents ?? [])].filter(Boolean);
  const uniqueIds = new Set(actors.map((actor) => actor.id));
  const uniqueKeys = new Set(actors.map((actor) => actor.keyId));
  if (uniqueIds.size !== actors.length) reasons.push("duplicate-identity");
  if (uniqueKeys.size !== actors.length) reasons.push("duplicate-key");
  for (const actor of actors) {
    if (actor.status === "retired" && !validTimestamp(actor.retiredAt)) reasons.push("retired-key-missing-retired-at");
  }

  return Object.freeze({
    valid: reasons.length === 0,
    digestValid,
    signatureValid,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

export function manifestPublicKeys(manifest) {
  if (!manifest?.rootKey || !Array.isArray(manifest?.agents)) throw new Error("Invalid ProofRoot identity manifest.");
  return Object.freeze([
    normalizedPublicKeyRecord(manifest.rootKey),
    ...manifest.agents.map(normalizedPublicKeyRecord),
  ]);
}
