import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { createGoldenFixture } from "../../src/core/golden-fixture.mjs";

export default function DomainPage() {
  const { domainEnvironment } = createGoldenFixture();
  return (
    <>
      <SurfaceHeader eyebrow="Domain onboarding" title="Accountability starts at the namespace." description="This surface will own name.com discovery, provisioning, and DNS identity lifecycle. It currently exposes only claims supported by Phase 0 evidence." />
      <section className="detail-grid">
        <article className="panel"><p className="eyebrow">Active environment</p><h2>Name.com Sandbox</h2><StatusChip tone="warning">External auth pending</StatusChip><dl><div><dt>Identity mode</dt><dd>{domainEnvironment.identityMode}</dd></div><div><dt>Public DNS</dt><dd>No — sandbox</dd></div><div><dt>Provider state</dt><dd>{domainEnvironment.status}</dd></div></dl></article>
        <article className="panel"><p className="eyebrow">Truth boundary</p><h3>No simulated DNS success</h3><p>{domainEnvironment.limitation}</p><p className="note">Phase 2 will add real search, availability, provision, create, list, update, and retire operations against name.com.</p></article>
      </section>
    </>
  );
}
