import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { createGoldenFixture } from "../../src/core/golden-fixture.mjs";

const chain = ["Organization", "Triage", "Billing", "Refund", "Proof Gateway", "Refund Tool"];

export default function RunPage() {
  const run = createGoldenFixture().runs[0];
  return (
    <>
      <SurfaceHeader eyebrow="Live run" title="Watch authority move." description={run.task} />
      <section className="run-summary panel"><div><p className="eyebrow">Run</p><h2 className="mono">{run.id}</h2></div><StatusChip tone="neutral">{run.status}</StatusChip><div className="metric"><span>Requested</span><strong>${(run.requestedAmountCents / 100).toFixed(0)}</strong></div><div className="metric"><span>Delegated cap</span><strong>${(run.delegatedLimitCents / 100).toFixed(0)}</strong></div></section>
      <section className="chain-strip" aria-label="Golden causal chain">{chain.map((node, index) => <div className="chain-node" key={node}><span>{index + 1}</span><strong>{node}</strong><small>{index === 0 ? "mandate" : index === chain.length - 1 ? "effect" : "handoff"}</small></div>)}</section>
      <p className="foundation-note">Foundation state only: no node above is shown as signed, authorized, dispatched, or confirmed yet.</p>
    </>
  );
}
