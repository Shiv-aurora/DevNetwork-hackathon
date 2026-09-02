import Link from "next/link";
import SurfaceHeader from "../components/SurfaceHeader";

const moments = [
  ["01", "Root identity", "Turn a name.com-managed domain into the discoverable accountability root for an agent organization."],
  ["02", "Authority chain", "Watch bounded authority move Organization → Triage → Billing → Refund → Gateway → Tool."],
  ["03", "Proof failure", "Exceed authority or alter evidence and see the exact point where verification must fail."],
];

export default function Home() {
  return (
    <>
      <SurfaceHeader eyebrow="System overview" title="Proof before trust." description="ProofRoot separates what an agent requested from what the credential-holding gateway actually allowed and observed." badge="Phase 1" />
      <section className="hero-grid">
        <article className="hero-card hero-primary">
          <p className="eyebrow">Golden case #194</p>
          <h2>$85 refund under a $100 delegated limit</h2>
          <p>The product shell is live. Cryptographic evidence and external provider verification remain deliberately unclaimed until their implementation phases.</p>
          <Link className="primary-link" href="/run">Open live run →</Link>
        </article>
        <article className="hero-card">
          <p className="eyebrow">Environment</p>
          <h3>Name.com sandbox</h3>
          <p>Provider-backed verification mode. Public DNS is explicitly unavailable in sandbox and real authentication remains pending credentials.</p>
          <Link className="text-link" href="/domain">Inspect domain surface</Link>
        </article>
      </section>
      <section className="section-block">
        <div className="section-heading"><p className="eyebrow">Demo contract</p><h2>Three moments, one causal story</h2></div>
        <div className="moment-grid">
          {moments.map(([number, title, copy]) => <article className="moment-card" key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </section>
    </>
  );
}
