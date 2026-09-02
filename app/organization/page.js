import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { createGoldenFixture } from "../../src/core/golden-fixture.mjs";

export default function OrganizationPage() {
  const fixture = createGoldenFixture();
  return (
    <>
      <SurfaceHeader eyebrow="Organization identity" title="One root. Explicitly not trusted yet." description="The organization root is modeled now; signing keys, manifest fingerprints, and domain publication arrive in the identity phase." />
      <article className="identity-root panel">
        <div><p className="eyebrow">Organization</p><h2>{fixture.organization.name}</h2><p className="mono">{fixture.organization.id}</p></div>
        <StatusChip tone="neutral">{fixture.organizationIdentityRoot.status}</StatusChip>
        <dl><div><dt>Root fingerprint</dt><dd>Not issued</dd></div><div><dt>Manifest</dt><dd>Not published</dd></div><div><dt>Trust claim</dt><dd>None</dd></div></dl>
      </article>
    </>
  );
}
