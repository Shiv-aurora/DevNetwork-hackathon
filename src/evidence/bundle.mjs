import { canonicalize, canonicalDigest } from "../crypto/canonical-json.mjs";

export function createEvidenceBundle({ organization, domainEnvironment, publicKeys, receipts, runSeal }) {
  if (!organization || !domainEnvironment) throw new Error("organization and domainEnvironment are required.");
  if (!Array.isArray(publicKeys) || !Array.isArray(receipts)) throw new Error("publicKeys and receipts must be arrays.");
  if (!runSeal) throw new Error("runSeal is required.");

  const body = {
    version: "proofroot.bundle.v1",
    organization,
    domainEnvironment,
    publicKeys,
    receipts,
    runSeal,
  };

  return Object.freeze({
    ...body,
    bundleDigest: canonicalDigest(body),
  });
}

export function exportEvidenceBundle(bundle) {
  return canonicalize(bundle);
}
