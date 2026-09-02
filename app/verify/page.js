import SurfaceHeader from "../../components/SurfaceHeader";
import StatusChip from "../../components/StatusChip";
import { createGoldenFixture } from "../../src/core/golden-fixture.mjs";

const labels = {
  identityResolution: "Identity resolution",
  signatureValidity: "Signature validity",
  delegationValidity: "Delegation validity",
  constraintValidity: "Constraint validity",
  gatewayEvidence: "Gateway evidence",
  bundleIntegrity: "Bundle integrity",
};

export default function VerifyPage() {
  const report = createGoldenFixture().verificationReports[0];
  return (
    <>
      <SurfaceHeader eyebrow="Independent verification" title="No unexplained green badge." description="Verification is intentionally decomposed into independently inspectable checks. Until signed evidence exists, every result stays unverifiable." />
      <section className="verification-grid">{Object.entries(report.checks).map(([key, value]) => <article className="verification-card" key={key}><span className="verify-icon">?</span><h3>{labels[key]}</h3><StatusChip tone="warning">{value}</StatusChip></article>)}</section>
      <p className="foundation-note">{report.reason}</p>
    </>
  );
}
