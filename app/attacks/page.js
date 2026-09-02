import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";

export default function AttacksPage() {
  return (
    <>
      <SurfaceHeader eyebrow="Attack lab" title="Make the failure visible." description="The mandatory attack scenarios are locked into the same domain model as the golden run; actual enforcement and cryptographic failure detection arrive with the gateway and verifier phases." />
      <section className="attack-grid">
        <article className="attack-card"><p className="eyebrow">Attack A · authority</p><h2>$850 request / $100 cap</h2><p>Expected later behavior: Proof Gateway blocks the request before the protected tool is called and signs the blocked decision.</p><StatusChip tone="warning">staged — not executed</StatusChip></article>
        <article className="attack-card"><p className="eyebrow">Attack B · evidence</p><h2>$85 receipt → $850</h2><p>Expected later behavior: independent verification detects the altered material field and marks downstream dependent evidence affected.</p><StatusChip tone="warning">staged — not verified</StatusChip></article>
      </section>
    </>
  );
}
