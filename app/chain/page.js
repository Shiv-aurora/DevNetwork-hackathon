import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";

const receipts = [
  ["Root Mandate", "Organization → Triage", "Starting authority and run constraints"],
  ["Delegation Receipt", "Triage → Billing", "Bounded investigation authority"],
  ["Delegation Receipt", "Billing → Refund", "Refund authority capped at $100"],
  ["Action Request", "Refund → Gateway", "Exact protected-tool request"],
  ["Gateway Decision", "Gateway", "Deterministic authorization outcome"],
  ["Execution Receipt", "Gateway → Tool", "Observed protected-tool response"],
  ["Run Seal", "Gateway", "Commitment to the final evidence set"],
];

export default function ChainPage() {
  return (
    <>
      <SurfaceHeader eyebrow="Chain explorer" title="Intent, decision, effect." description="The explorer reserves a distinct evidence object for every consequential transition so later verification never collapses request intent into execution." />
      <section className="timeline">{receipts.map(([title, actor, copy], index) => <article className="timeline-row" key={`${title}-${index}`}><span className="timeline-number">{String(index + 1).padStart(2, "0")}</span><div><p className="eyebrow">{actor}</p><h3>{title}</h3><p>{copy}</p></div><StatusChip>not signed</StatusChip></article>)}</section>
    </>
  );
}
