const LABELS = {
  identityResolution: "Identity resolution",
  signatureValidity: "Signature validity",
  delegationValidity: "Delegation validity",
  constraintValidity: "Constraint validity",
  gatewayEvidence: "Gateway evidence",
  bundleIntegrity: "Bundle integrity",
};

function symbol(status) {
  if (status === "valid") return "✓";
  if (status === "invalid") return "×";
  return "?";
}

export default function VerificationReport({ report }) {
  if (!report) return null;
  return (
    <section>
      <div className="verification-summary">
        <div>
          <p className="eyebrow">Independent result</p>
          <h2>{report.overallStatus}</h2>
        </div>
        {report.firstFailure ? (
          <div className="failure-callout">
            <span>First broken link</span>
            <strong className="mono">{report.firstFailure.receiptId}</strong>
          </div>
        ) : null}
      </div>
      <div className="verification-grid">
        {Object.entries(report.checks ?? {}).map(([key, check]) => (
          <article className={`verification-card verify-${check.status}`} key={key}>
            <span className="verify-icon">{symbol(check.status)}</span>
            <h3>{LABELS[key] ?? key}</h3>
            <span className={`status-chip status-${check.status === "valid" ? "success" : check.status === "invalid" ? "danger" : "warning"}`}>{check.status}</span>
            <p>{check.detail}</p>
          </article>
        ))}
      </div>
      {report.limitations?.length ? (
        <div className="limitations">
          <p className="eyebrow">What this does not prove</p>
          {report.limitations.map((item) => <p key={item}>{item}</p>)}
        </div>
      ) : null}
    </section>
  );
}
