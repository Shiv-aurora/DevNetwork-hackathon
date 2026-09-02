"use client";

import { useEffect, useState } from "react";

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

export default function DomainConsole() {
  const [status, setStatus] = useState(null);
  const [keyword, setKeyword] = useState("proofroot");
  const [domainName, setDomainName] = useState("");
  const [record, setRecord] = useState({ type: "TXT", host: "_proofroot-demo", answer: "v=proofroot-demo", ttl: 300 });
  const [output, setOutput] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function request(path, options) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, options);
      const body = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(body?.message ?? `Request failed with HTTP ${response.status}.`);
      setOutput(body ?? { status: "deleted" });
      return body;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Provider operation failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    const response = await fetch("/api/namecom/status");
    const body = await response.json();
    setStatus(body);
    if (body.domainName) setDomainName(body.domainName);
  }

  useEffect(() => { refreshStatus().catch(() => setStatus({ configured: false, environment: "sandbox" })); }, []);

  async function search() {
    await request("/api/namecom/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword, tldFilter: ["com", "dev", "ai"] }),
    });
  }

  async function check() {
    await request("/api/namecom/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainNames: [domainName] }),
    });
  }

  async function provisionSandbox() {
    await request("/api/namecom/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName, years: 1, idempotencyKey: `proofroot-${domainName}` }),
    });
    refreshStatus();
  }

  async function listDomains() {
    await request("/api/namecom/domains");
  }

  async function listRecords() {
    await request(`/api/namecom/records?domainName=${encodeURIComponent(domainName)}`);
  }

  async function createRecord() {
    await request("/api/namecom/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainName, record }),
    });
  }

  return (
    <div className="domain-console">
      <section className="provider-status panel">
        <div>
          <p className="eyebrow">Provider state</p>
          <h2>{status?.configured ? "name.com connected" : "name.com secrets not configured"}</h2>
          <p>{status?.identityMode ?? "Loading provider mode…"}</p>
        </div>
        <div className="status-stack">
          <span className={`status-chip status-${status?.configured && status?.authenticated ? "success" : "warning"}`}>{status?.environment ?? "sandbox"}</span>
          <small>{status?.environment === "sandbox" ? "Provider-backed DNS only · not publicly resolvable" : "Public DNS must be independently verified"}</small>
        </div>
      </section>

      <section className="domain-workbench">
        <article className="panel">
          <p className="eyebrow">Discovery</p>
          <h3>Search and check availability</h3>
          <label className="field-label">Keyword<input value={keyword} onChange={(event) => setKeyword(event.target.value)} /></label>
          <div className="button-row">
            <button className="action-button" disabled={busy || !status?.configured} onClick={search}>Search name.com</button>
            <button className="action-button secondary-action" disabled={busy || !status?.configured} onClick={listDomains}>List managed domains</button>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Provisioning</p>
          <h3>Selected accountability domain</h3>
          <label className="field-label">Domain<input value={domainName} onChange={(event) => setDomainName(event.target.value)} placeholder="proofroot-demo.test" /></label>
          <div className="button-row">
            <button className="action-button secondary-action" disabled={busy || !status?.configured || !domainName} onClick={check}>Check exact domain</button>
            <button className="action-button" disabled={busy || !status?.configured || !domainName || status?.environment !== "sandbox"} onClick={provisionSandbox}>Provision sandbox domain</button>
          </div>
          <p className="safety-note">Paid production registration is deliberately disabled. Production mode uses an existing configured domain.</p>
        </article>
      </section>

      <section className="panel dns-workbench">
        <p className="eyebrow">DNS lifecycle</p>
        <h3>Create and inspect real provider records</h3>
        <div className="record-grid">
          <label className="field-label">Type<input value={record.type} onChange={(event) => setRecord({ ...record, type: event.target.value.toUpperCase() })} /></label>
          <label className="field-label">Host<input value={record.host} onChange={(event) => setRecord({ ...record, host: event.target.value })} /></label>
          <label className="field-label record-answer">Answer<input value={record.answer} onChange={(event) => setRecord({ ...record, answer: event.target.value })} /></label>
        </div>
        <div className="button-row">
          <button className="action-button" disabled={busy || !status?.configured || !domainName} onClick={createRecord}>Create record</button>
          <button className="action-button secondary-action" disabled={busy || !status?.configured || !domainName} onClick={listRecords}>List records</button>
        </div>
        <p className="safety-note">Update/delete are implemented by the server API and used by the identity publication/reconciliation path; this console avoids destructive one-click controls during judging.</p>
      </section>

      {error ? <p className="error-banner">{error}</p> : null}
      {output ? <pre className="provider-output mono">{pretty(output)}</pre> : null}
    </div>
  );
}
