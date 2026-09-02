import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { verifyIdentityManifest } from "../../src/identity/manifest.mjs";

const ROLES = {
  agent_triage: ["Triage Agent", "Support routing and case interpretation"],
  agent_billing: ["Billing Agent", "Transaction investigation and duplicate-charge decision"],
  agent_refund: ["Refund Agent", "Bounded refund request generation"],
  gateway_proof: ["Proof Gateway", "Deterministic authorization and protected-tool boundary"],
};

function configuredAgents() {
  if (!process.env.PROOFROOT_PUBLIC_MANIFEST_JSON) return null;
  try {
    const manifest = JSON.parse(process.env.PROOFROOT_PUBLIC_MANIFEST_JSON);
    if (!verifyIdentityManifest(manifest, manifest.rootKey).valid) return null;
    return manifest.agents;
  } catch {
    return null;
  }
}

export default function AgentsPage() {
  const manifestAgents = configuredAgents();
  const agents = Object.entries(ROLES).map(([id, [name, role]]) => {
    const published = manifestAgents?.find((agent) => agent.id === id);
    return { id, name, role, published };
  });

  return (
    <>
      <SurfaceHeader
        eyebrow="Agent registry"
        title="Distinct actors. Distinct keys. Bounded authority."
        description="Triage, Billing, Refund, and the Proof Gateway use separate signing identities. Persistent keys are published through the signed domain manifest only after deployment provisioning."
      />
      <section className="agent-grid">
        {agents.map((agent, index) => (
          <article className="agent-card" key={agent.id}>
            <div className="agent-index">{String(index + 1).padStart(2, "0")}</div>
            <div><p className="eyebrow">{agent.id}</p><h2>{agent.name}</h2><p>{agent.role}</p></div>
            <StatusChip tone={agent.published ? "success" : "warning"}>{agent.published?.status ?? "persistent publication pending"}</StatusChip>
            <dl>
              <div><dt>Key ID</dt><dd className="mono">{agent.published?.keyId ?? "Generated per run"}</dd></div>
              <div><dt>Fingerprint</dt><dd className="mono">{agent.published?.fingerprint ?? "Persistent key awaits deployment"}</dd></div>
              <div><dt>Domain identity</dt><dd>{agent.published ? "Present in signed manifest" : "Not yet published"}</dd></div>
            </dl>
          </article>
        ))}
      </section>
    </>
  );
}
