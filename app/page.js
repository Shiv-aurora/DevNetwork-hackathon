import Link from "next/link";
import SurfaceHeader from "../components/SurfaceHeader";

const moments = [
  ["01", "Root identity", "Publish a signed organization/agent manifest under a name.com-controlled namespace, with sandbox truthfully labeled provider-backed."],
  ["02", "Authority chain", "Watch Organization → Triage → Billing → Refund → Proof Gateway → Tool produce a causally linked signed evidence chain."],
  ["03", "Proof failure", "Request $850 under a $100 cap or mutate the successful $85 receipt and see the exact enforcement or verification failure."],
];

export default function Home() {
  const namecomEnvironment = process.env.NAMECOM_ENV ?? "sandbox";
  const namecomConfigured = Boolean(process.env.NAMECOM_USERNAME && process.env.NAMECOM_TOKEN);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);

  return (
    <>
      <SurfaceHeader
        eyebrow="System overview"
        title="Proof before trust."
        description="ProofRoot gives agents distinct signing identities, makes delegated authority explicit, puts consequential tools behind a verifying gateway, and independently checks the evidence afterward."
        badge="P0 core built"
      />
      <section className="hero-grid">
        <article className="hero-card hero-primary">
          <p className="eyebrow">Golden case #194</p>
          <h2>$85 refund under a $100 delegated limit</h2>
          <p>The signed multi-agent workflow, gateway enforcement, deterministic protected tool, run seal, verifier, and both mandatory attacks are implemented. Run it to create fresh evidence.</p>
          <Link className="primary-link" href="/run">Run the proof chain →</Link>
        </article>
        <article className="hero-card">
          <p className="eyebrow">Deployment state</p>
          <h3>Name.com {namecomEnvironment}</h3>
          <p>{namecomConfigured ? "Provider credentials are configured in the runtime." : "Provider code is ready; name.com secrets still need to be supplied in the deployment environment."}</p>
          <p>{groqConfigured ? "Groq is configured for the model-driven Triage decision." : "Groq is not configured here, so the explicitly labeled deterministic fallback is used."}</p>
          <Link className="text-link" href="/domain">Inspect domain lifecycle →</Link>
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
