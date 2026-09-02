"use client";

import { useState } from "react";

import EvidenceDrawer from "./EvidenceDrawer";
import VerificationReport from "./VerificationReport";

export default function VerifierClient() {
  const [bundleText, setBundleText] = useState("");
  const [report, setReport] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function verifyBundle(candidate) {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: candidate }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Verification failed to run.");
      setReport(body.verification);
      setBundle(candidate);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Verification failed to run.");
    } finally {
      setRunning(false);
    }
  }

  async function verifyFreshRun() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "valid" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Could not create a fresh run.");
      setBundleText(JSON.stringify(body.workflow.evidenceBundle, null, 2));
      setBundle(body.workflow.evidenceBundle);
      setReport(body.verification);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Could not verify fresh run.");
    } finally {
      setRunning(false);
    }
  }

  function verifyPasted() {
    try {
      const parsed = JSON.parse(bundleText);
      verifyBundle(parsed);
    } catch {
      setError("Evidence bundle is not valid JSON.");
    }
  }

  return (
    <div className="verifier-console">
      <section className="verifier-actions panel">
        <div>
          <p className="eyebrow">Evidence source</p>
          <h2>Re-run verification from evidence, not UI state.</h2>
          <p>Create a fresh signed bundle or paste an exported `proofroot.bundle.v1` bundle below.</p>
        </div>
        <button className="action-button" type="button" disabled={running} onClick={verifyFreshRun}>Verify fresh golden run</button>
      </section>
      <textarea
        className="bundle-input mono"
        aria-label="Evidence bundle JSON"
        placeholder="Paste an exported ProofRoot evidence bundle here…"
        value={bundleText}
        onChange={(event) => setBundleText(event.target.value)}
      />
      <button className="action-button secondary-action" type="button" disabled={running || !bundleText.trim()} onClick={verifyPasted}>
        {running ? "Verifying…" : "Verify pasted bundle"}
      </button>
      {error ? <p className="error-banner">{error}</p> : null}
      <VerificationReport report={report} />
      <EvidenceDrawer label="Inspect verification input" value={bundle} />
    </div>
  );
}
