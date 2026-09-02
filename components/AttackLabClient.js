"use client";

import { useState } from "react";

import EvidenceDrawer from "./EvidenceDrawer";
import VerificationReport from "./VerificationReport";

function money(cents) {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function AttackLabClient() {
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState(null);

  async function run(attack) {
    setRunning(attack);
    setError(null);
    try {
      const response = await fetch("/api/demo/attacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attack }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Attack run failed.");
      setResult(body.attack);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Attack run failed.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <>
      <section className="attack-grid">
        <article className="attack-card">
          <p className="eyebrow">Attack A · authority</p>
          <h2>$850 request / $100 cap</h2>
          <p>Use the normal signed workflow, but have Refund Agent request eight-and-a-half times its delegated authority.</p>
          <button className="action-button secondary-action" type="button" disabled={Boolean(running)} onClick={() => run("authority-violation")}>
            {running === "authority-violation" ? "Testing gateway…" : "Run authority attack"}
          </button>
        </article>
        <article className="attack-card">
          <p className="eyebrow">Attack B · evidence</p>
          <h2>$85 receipt → $850</h2>
          <p>Create a valid confirmed run, alter its stored Action Request amount afterward, and independently verify the modified bundle.</p>
          <button className="action-button secondary-action" type="button" disabled={Boolean(running)} onClick={() => run("evidence-tampering")}>
            {running === "evidence-tampering" ? "Breaking evidence…" : "Run tamper attack"}
          </button>
        </article>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}

      {result?.attack === "authority-violation" ? (
        <section className="attack-result panel danger-panel">
          <p className="eyebrow">Live result</p>
          <h2>BLOCKED BEFORE EXECUTION</h2>
          <div className="attack-facts">
            <div><span>Requested</span><strong>{money(result.workflow.requestedAmountCents)}</strong></div>
            <div><span>Signed cap</span><strong>{money(result.workflow.delegatedLimitCents)}</strong></div>
            <div><span>Protected tool calls</span><strong>{result.protectedToolCalls}</strong></div>
            <div><span>Transaction created</span><strong>{result.transactionCreated ? "yes" : "no"}</strong></div>
          </div>
          <p className="reason-line">{result.reasonCodes.join(" · ")}</p>
          <EvidenceDrawer label="Inspect signed blocked-decision receipt" value={result.decisionReceipt} />
          <VerificationReport report={result.verification} />
        </section>
      ) : null}

      {result?.attack === "evidence-tampering" ? (
        <section className="attack-result panel danger-panel">
          <p className="eyebrow">Live result</p>
          <h2>VERIFICATION FAILED</h2>
          <div className="attack-facts">
            <div><span>Original</span><strong>{money(result.originalAmountCents)}</strong></div>
            <div><span>Tampered</span><strong>{money(result.tamperedAmountCents)}</strong></div>
            <div><span>Broken receipt</span><strong className="mono">{result.alteredReceiptId}</strong></div>
            <div><span>Affected links</span><strong>{result.affectedReceiptIds.length}</strong></div>
          </div>
          <VerificationReport report={result.verification} />
          <EvidenceDrawer label="Inspect tampered evidence bundle" value={result.tamperedBundle} />
        </section>
      ) : null}
    </>
  );
}
