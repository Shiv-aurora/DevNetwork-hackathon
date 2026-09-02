import { readFileSync } from "node:fs";

import { createNamecomClient } from "../src/integrations/namecom-client.mjs";
import { verifyIdentityManifest } from "../src/identity/manifest.mjs";
import { buildIdentityDnsRecords, reconcileIdentityDnsRecords } from "../src/identity/namecom-publication.mjs";

const environment = process.env.NAMECOM_ENV ?? "sandbox";
const domainName = process.env.PROOFROOT_DOMAIN;
const manifestTargetHost = process.env.PROOFROOT_MANIFEST_TARGET_HOST;
const manifestPublicUrl = process.env.PROOFROOT_MANIFEST_PUBLIC_URL || null;
const username = process.env.NAMECOM_USERNAME;
const token = process.env.NAMECOM_TOKEN;

if (!domainName || !manifestTargetHost || !username || !token) {
  console.error("NAMECOM_USERNAME, NAMECOM_TOKEN, PROOFROOT_DOMAIN, and PROOFROOT_MANIFEST_TARGET_HOST are required.");
  process.exit(2);
}
if (environment === "sandbox" && !manifestPublicUrl) {
  console.error("PROOFROOT_MANIFEST_PUBLIC_URL is required in sandbox because sandbox DNS records are not publicly resolvable. Use the deployed HTTPS manifest URL.");
  process.exit(2);
}

let manifest;
try {
  manifest = process.env.PROOFROOT_PUBLIC_MANIFEST_JSON
    ? JSON.parse(process.env.PROOFROOT_PUBLIC_MANIFEST_JSON)
    : JSON.parse(readFileSync(".proofroot/public-manifest.json", "utf8"));
} catch {
  console.error("A valid ProofRoot public manifest is required via PROOFROOT_PUBLIC_MANIFEST_JSON or .proofroot/public-manifest.json.");
  process.exit(3);
}
const manifestCheck = verifyIdentityManifest(manifest, manifest.rootKey);
if (!manifestCheck.valid || manifest.domain !== domainName) {
  console.error("The public manifest is invalid or does not match PROOFROOT_DOMAIN.");
  process.exit(4);
}

const client = createNamecomClient({ environment, username, token });
const plan = buildIdentityDnsRecords({
  domainName,
  manifestTargetHost,
  manifestPublicUrl,
  rootFingerprint: manifest.rootKey.fingerprint,
  agents: manifest.agents,
});

const providerState = await client.listRecords(domainName);
const providerRecords = Array.isArray(providerState?.records) ? providerState.records : [];
const actions = [];
for (const expected of plan.records) {
  const exact = providerRecords.find((record) => record.type === expected.type
    && record.host === expected.host
    && record.answer === expected.answer);
  if (exact) {
    actions.push({ action: "unchanged", id: exact.id, type: expected.type, host: expected.host });
    continue;
  }
  const replaceable = providerRecords.find((record) => record.type === expected.type && record.host === expected.host);
  if (replaceable?.id) {
    const updated = await client.updateRecord(domainName, replaceable.id, expected);
    actions.push({ action: "updated", id: updated?.id ?? replaceable.id, type: expected.type, host: expected.host });
  } else {
    const created = await client.createRecord(domainName, expected);
    actions.push({ action: "created", id: created?.id ?? null, type: expected.type, host: expected.host });
  }
}

const reconciliation = await reconcileIdentityDnsRecords({ client, plan });
if (!reconciliation.matched) {
  console.error("name.com identity publication completed but reconciliation did not match the desired record state.");
  process.exit(5);
}

console.log(JSON.stringify({
  provider: "name.com",
  environment,
  domainName,
  manifestUrl: plan.manifestUrl,
  recordCount: plan.records.length,
  actions,
  reconciled: true,
  publicDnsClaim: environment === "production" ? "requires-independent-resolution-check" : false,
  sandboxManifestBoundary: environment === "sandbox"
    ? "TXT locator is provider-backed name.com state; manifest is fetched from the explicitly configured public HTTPS URL."
    : null,
}, null, 2));
