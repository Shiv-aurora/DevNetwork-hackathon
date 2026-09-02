import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";

function fingerprintPublicDer(der) {
  return `sha256:${createHash("sha256").update(der).digest("hex")}`;
}

export function generateSigningIdentity({ ownerId, keyId, validFrom, validUntil = null }) {
  if (!ownerId || !keyId || !validFrom) throw new Error("ownerId, keyId, and validFrom are required.");

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });

  return {
    publicRecord: Object.freeze({
      keyId,
      ownerId,
      algorithm: "Ed25519",
      status: "active",
      validFrom,
      validUntil,
      publicKeySpki: publicDer.toString("base64"),
      fingerprint: fingerprintPublicDer(publicDer),
    }),
    privateKey,
  };
}

export function publicKeyFromRecord(record) {
  if (!record || record.algorithm !== "Ed25519" || !record.publicKeySpki) {
    throw new Error("Unsupported or incomplete public key record.");
  }
  return createPublicKey({ key: Buffer.from(record.publicKeySpki, "base64"), type: "spki", format: "der" });
}

export function exportPrivateKeyPkcs8(privateKey) {
  if (!privateKey) throw new Error("privateKey is required.");
  return privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
}

export function loadSigningIdentity({ publicRecord, privateKeyPkcs8 }) {
  if (!publicRecord?.keyId || !privateKeyPkcs8) throw new Error("publicRecord and privateKeyPkcs8 are required.");
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyPkcs8, "base64"),
    type: "pkcs8",
    format: "der",
  });
  const derivedPublic = createPublicKey(privateKey).export({ type: "spki", format: "der" });
  if (derivedPublic.toString("base64") !== publicRecord.publicKeySpki
    || fingerprintPublicDer(derivedPublic) !== publicRecord.fingerprint) {
    throw new Error(`Private key does not match public record '${publicRecord.keyId}'.`);
  }
  return Object.freeze({ publicRecord: Object.freeze({ ...publicRecord }), privateKey });
}

export function signCanonicalBytes(privateKey, canonicalBytes) {
  return cryptoSign(null, Buffer.from(canonicalBytes, "utf8"), privateKey).toString("base64");
}

export function verifyCanonicalBytes(publicRecord, canonicalBytes, signatureBase64) {
  try {
    return cryptoVerify(
      null,
      Buffer.from(canonicalBytes, "utf8"),
      publicKeyFromRecord(publicRecord),
      Buffer.from(signatureBase64, "base64"),
    );
  } catch {
    return false;
  }
}
