"use client";

import { useState } from "react";

import CausalGraph from "./CausalGraph";
import EvidenceDrawer from "./EvidenceDrawer";
import VerificationReport from "./VerificationReport";

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function LiveDemoClient() {
  const [data, setData] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function execute(scenario = "valid") {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Demo run failed.");
      setData(body);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Demo run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="live-demo">
      <section className="run-launch panel">
        <div>
          <p className="eyebrow">Golden case #194</p>
          <h2>Duplicate charge → bounded $85 refund</h2>
          <p>Three distinct agents move authority through signed receipts. The Proof Gateway alone can reach the protected refund tool.</p>
        </div>
        <button className="action-button" type="button" disabled={running} onClick={() => execute("valid")}>
          {running ? "Running signed chain…" : "Run valid workflow"}
        </button>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      {data ? (
        <>
          <section className="run-summary panel">
            <div>
              <p className="eyebrow">Run</p>
              <h2 className="mono">{data.workflow.runId}</h2>
              <small className="runtime-label">{data.runtime.modelDriven ? `Model-driven · ${data.runtime.model}` : "Deterministic fallback · Groq not configured"}</small>
            </div>
            <span className={`status-chip status-${data.workflow.gateway.outcome === "confirmed" ? "success" : "warning"}`}>{data.workflow.gateway.outcome}</span>
            <div className="metric"><span>Requested</span><strong>{money(data.workflow.requestedAmountCents)}</strong></div>
            <div className="metric"><span>Delegated cap</span><strong>{money(data.workflow.delegatedLimitCents)}</strong></div>
          </section>

          <CausalGraph timeline={data.workflow.timeline} />

          <section className="timeline">
            {data.workflow.timeline.map((event, index) => (
              <article className="timeline-row" key={event.id}>
                <span className="timeline-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="eyebrow">{event.actor}</p>
                  <h3>{event.label}</h3>
                  {event.detail ? <p>{event.detail}</p> : null}
                  {event.evidenceDigest ? <code className="digest-line">{event.evidenceDigest}</code> : null}
                </div>
                <span className={`status-chip status-${event.status === "confirmed" || event.status === "allowed" ? "success" : event.status === "blocked" || event.status === "failed" ? "danger" : "neutral"}`}>{event.status}</span>
              </article>
            ))}
          </section>

          <VerificationReport report={data.verification} />
          <EvidenceDrawer label="Inspect signed evidence bundle" value={data.workflow.evidenceBundle} />
        </>
      ) : (
        <p className="foundation-note">No fake completed run is shown. Start the workflow to create a fresh signed evidence chain.</p>
      )}
    </div>
  );
}
