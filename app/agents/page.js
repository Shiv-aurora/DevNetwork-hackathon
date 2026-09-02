import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { createGoldenFixture } from "../../src/core/golden-fixture.mjs";

export default function AgentsPage() {
  const { agentIdentities } = createGoldenFixture();
  return (
    <>
      <SurfaceHeader eyebrow="Agent registry" title="Distinct actors, distinct authority." description="Each runtime has a separate identity slot and role. Phase 3 will issue distinct keys and publish the identity manifest." />
      <section className="agent-grid">
        {agentIdentities.map((agent, index) => <article className="agent-card" key={agent.id}><div className="agent-index">0{index + 1}</div><div><p className="eyebrow">{agent.id}</p><h2>{agent.name}</h2><p>{agent.role}</p></div><StatusChip>{agent.status}</StatusChip><dl><div><dt>Key</dt><dd>Not issued</dd></div><div><dt>Domain identity</dt><dd>Pending</dd></div></dl></article>)}
      </section>
    </>
  );
}
