import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { verifyIdentityManifest } from "../../src/identity/manifest.mjs";

function configuredManifest() {
  if (!process.env.PROOFROOT_PUBLIC_MANIFEST_JSON) return null;
  try {
    const manifest = JSON.parse(process.env.PROOFROOT_PUBLIC_MANIFEST_JSON);
    const verification = verifyIdentityManifest(manifest, manifest.rootKey);
    return verification.valid ? manifest : null;
  } catch {
    return null;
  }
}

export default function OrganizationPage() {
  const manifest = configuredManifest();
  return (
    <>
      <SurfaceHeader
        eyebrow="Organization identity"
        title="One public root for the agent organization."
        description="The root signing identity anchors the signed manifest. Domain publication makes that public key material independently discoverable without turning identity into a trust score."
      />
      <article className="identity-root panel">
        <div>
          <p className="eyebrow">Organization</p>
          <h2>{manifest?.organization?.name ?? "Acme Support"}</h2>
          <p className="mono">{manifest?.organization?.id ?? "org_acme_support"}</p>
        </div>
        <StatusChip tone={manifest ? "success" : "warning"}>{manifest ? "signed manifest configured" : "deployment manifest pending"}</StatusChip>
        <dl>
          <div><dt>Root fingerprint</dt><dd className="mono">{manifest?.rootKey?.fingerprint ?? "Generated per run; persistent root awaits deployment provisioning"}</dd></div>
          <div><dt>Manifest endpoint</dt><dd className="mono">/.well-known/proofroot.json</dd></div>
          <div><dt>Domain</dt><dd>{manifest?.domain ?? process.env.PROOFROOT_DOMAIN ?? "Not configured"}</dd></div>
          <div><dt>Identity claim</dt><dd>{manifest ? "Signed identity material available" : "No persistent domain-backed identity claim yet"}</dd></div>
          <div><dt>Trust claim</dt><dd>None — identity, authorization, and trust remain separate</dd></div>
        </dl>
      </article>
    </>
  );
}
