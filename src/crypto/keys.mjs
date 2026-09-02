import {
  createHash,
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
