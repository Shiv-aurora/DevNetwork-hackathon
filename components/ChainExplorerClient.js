"use client";

import { useState } from "react";

import CausalGraph from "./CausalGraph";

const TITLES = {
  "root-mandate": "Root Mandate",
  "delegation-receipt": "Delegation Receipt",
  "action-request-receipt": "Action Request Receipt",
  "gateway-decision-receipt": "Gateway Decision Receipt",
  "execution-receipt": "Execution Receipt",
  "run-seal": "Run Seal",
};

function receiptStatus(receipt) {
  if (receipt.type === "gateway-decision-receipt") return receipt.claims.decision;
  if (receipt.type === "execution-receipt") return receipt.claims.effectStatus;
  return "signed";
}

export default function ChainExplorerClient() {
  const [workflow, setWorkflow] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "valid" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not create signed chain.");
      setWorkflow(body.workflow);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not create signed chain.");
    } finally {
      setRunning(false);
    }
  }

  const receipts = workflow ? [...workflow.receipts, workflow.runSeal] : [];

  return (
    <div className="chain-explorer">
      <section className="panel chain-launch">
        <div>
          <p className="eyebrow">Causal evidence</p>
          <h2>Generate the chain, then inspect every signed link.</h2>
          <p>The graph separates agent intent, gateway decision, and observed tool effect. Raw JSON is available per receipt but never required to understand the narrative.</p>
        </div>
        <button className="action-button" type="button" disabled={running} onClick={load}>{running ? "Creating receipts…" : "Load signed golden chain"}</button>
      </section>
      {error ? <p className="error-banner">{error}</p> : null}
      {workflow ? (
        <>
          <CausalGraph timeline={workflow.timeline} />
          <section className="timeline receipt-list">
            {receipts.map((receipt, index) => (
              <article className="timeline-row receipt-row" key={receipt.receiptId}>
                <span className="timeline-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="eyebrow">{receipt.signerId}</p>
                  <h3>{TITLES[receipt.type] ?? receipt.type}</h3>
                  <code className="digest-line">{receipt.contentDigest}</code>
                  <p>{receipt.parentDigests.length === 0 ? "Root evidence" : `${receipt.parentDigests.length} causal parent${receipt.parentDigests.length === 1 ? "" : "s"}`}</p>
                  <details className="inline-evidence"><summary>Raw evidence</summary><pre>{JSON.stringify(receipt, null, 2)}</pre></details>
                </div>
                <span className={`status-chip status-${["allowed", "confirmed", "signed"].includes(receiptStatus(receipt)) ? "success" : "danger"}`}>{receiptStatus(receipt)}</span>
              </article>
            ))}
          </section>
        </>
      ) : <p className="foundation-note">No stored green badge is used. Generate a run to inspect the evidence created by that run.</p>}
    </div>
  );
}
