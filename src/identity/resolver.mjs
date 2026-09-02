import { resolveTxt as nodeResolveTxt } from "node:dns/promises";

import { manifestPublicKeys, verifyIdentityManifest } from "./manifest.mjs";

function parseProofRootTxt(value) {
  const fields = {};
  for (const segment of String(value).split(";")) {
    const [key, ...rest] = segment.split("=");
    if (key && rest.length > 0) fields[key.trim()] = rest.join("=").trim();
  }
  if (fields.v !== "proofroot1" || !fields.manifest || !fields.fp) {
    throw new Error("Malformed ProofRoot root TXT record.");
  }
  return fields;
}

async function fetchManifest(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Identity manifest returned HTTP ${response.status}.`);
  return response.json();
}

async function sandboxRootRecord(client, domainName) {
  const state = await client.listRecords(domainName);
  const records = Array.isArray(state?.records) ? state.records : [];
  const record = records.find((entry) => entry.type === "TXT" && entry.host === "_proofroot");
  if (!record?.answer) throw new Error("ProofRoot organization TXT record was not found in name.com sandbox state.");
  return { answer: record.answer, source: "name.com-sandbox-provider-backed" };
}

async function publicRootRecord(domainName, resolveTxtImpl) {
  const answers = await resolveTxtImpl(`_proofroot.${domainName}`);
  const values = answers.map((parts) => parts.join(""));
  const answer = values.find((value) => value.includes("v=proofroot1"));
  if (!answer) throw new Error("Public ProofRoot organization TXT record was not found.");
  return { answer, source: "public-dns" };
}

function manifestCurrentAt(manifest, nowMs) {
  const generatedAt = Date.parse(manifest?.generatedAt);
  const validUntil = Date.parse(manifest?.validUntil);
  return Number.isFinite(generatedAt)
    && Number.isFinite(validUntil)
    && generatedAt <= nowMs
    && nowMs <= validUntil;
}

export function createDomainIdentityResolver({
  environment,
  domainName,
  namecomClient = null,
  fetchImpl = globalThis.fetch,
  resolveTxtImpl = nodeResolveTxt,
  now = () => Date.now(),
} = {}) {
  if (!["sandbox", "production"].includes(environment)) throw new Error("environment must be sandbox or production.");
  if (typeof domainName !== "string" || domainName.length === 0) throw new Error("domainName is required.");
  if (typeof fetchImpl !== "function") throw new Error("fetchImpl is required.");
  if (typeof now !== "function") throw new Error("now must be a function.");
  if (environment === "sandbox" && (!namecomClient || typeof namecomClient.listRecords !== "function")) {
    throw new Error("namecomClient is required for sandbox provider-backed identity resolution.");
  }

  return async function resolveProofRootIdentity() {
    try {
      const rootRecord = environment === "sandbox"
        ? await sandboxRootRecord(namecomClient, domainName)
        : await publicRootRecord(domainName, resolveTxtImpl);
      const locator = parseProofRootTxt(rootRecord.answer);
      const manifest = await fetchManifest(locator.manifest, fetchImpl);
      const manifestCheck = verifyIdentityManifest(manifest, manifest.rootKey);

      if (!manifestCheck.valid) {
        return {
          status: "invalid",
          source: rootRecord.source,
          detail: `Identity manifest failed cryptographic verification: ${manifestCheck.reasons.join(", ")}.`,
          publicKeys: manifestPublicKeys(manifest),
        };
      }
      if (!manifestCurrentAt(manifest, now())) {
        return {
          status: "invalid",
          source: rootRecord.source,
          detail: "Identity manifest is not valid at the current verification time.",
          publicKeys: manifestPublicKeys(manifest),
        };
      }
      if (manifest.domain !== domainName) {
        return {
          status: "invalid",
          source: rootRecord.source,
          detail: "Identity manifest domain does not match the resolved organization domain.",
          publicKeys: manifestPublicKeys(manifest),
        };
      }
      if (manifest.rootKey.fingerprint !== locator.fp) {
        return {
          status: "invalid",
          source: rootRecord.source,
          detail: "Published root-key fingerprint does not match the signed manifest.",
          publicKeys: manifestPublicKeys(manifest),
        };
      }

      return {
        status: "verified",
        source: rootRecord.source,
        publicKeys: manifestPublicKeys(manifest),
        manifest,
        detail: environment === "sandbox"
          ? "Identity manifest and root fingerprint verified from name.com sandbox provider-backed DNS state."
          : "Identity manifest and root fingerprint verified from publicly resolved DNS state.",
        limitation: environment === "sandbox"
          ? "The name.com sandbox record is verified through the provider API and is not publicly resolvable DNS."
          : "Plain DNS discovery is not a DNSSEC guarantee unless DNSSEC is separately configured and validated.",
      };
    } catch (error) {
      return {
        status: "unverifiable",
        source: environment === "sandbox" ? "name.com-sandbox-provider-backed" : "public-dns",
        detail: error instanceof Error ? error.message : "Identity resolution failed.",
        publicKeys: [],
      };
    }
  };
}
