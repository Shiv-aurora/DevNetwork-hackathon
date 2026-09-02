const DEFAULT_NODES = [
  { id: "root", label: "Organization", role: "Mandate" },
  { id: "triage", label: "Triage", role: "Route" },
  { id: "billing", label: "Billing", role: "Investigate" },
  { id: "refund", label: "Refund", role: "Request" },
  { id: "gateway", label: "Proof Gateway", role: "Decide" },
  { id: "tool", label: "Refund Tool", role: "Effect" },
];

function statusFor(nodeId, timeline = []) {
  return timeline.find((event) => event.id === nodeId)?.status ?? "pending";
}

export default function CausalGraph({ timeline = [], affectedReceiptIds = [] }) {
  const affected = new Set(affectedReceiptIds);
  return (
    <section className="causal-graph" aria-label="ProofRoot causal chain">
      {DEFAULT_NODES.map((node, index) => {
        const event = timeline.find((entry) => entry.id === node.id);
        const status = statusFor(node.id, timeline);
        const isAffected = event?.evidenceDigest && affected.has(event.evidenceDigest);
        return (
          <article className={`causal-node state-${status}${isAffected ? " is-affected" : ""}`} key={node.id}>
            <div className="node-index">{String(index + 1).padStart(2, "0")}</div>
            <div>
              <strong>{node.label}</strong>
              <small>{node.role}</small>
            </div>
            <span className="node-state">{status}</span>
          </article>
        );
      })}
    </section>
  );
}
