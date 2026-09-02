export default function EvidenceDrawer({ label = "Inspect raw evidence", value }) {
  if (!value) return null;
  return (
    <details className="evidence-drawer">
      <summary>{label}</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
