export default function StatusChip({ children, tone = "neutral" }) {
  return <span className={`status-chip status-${tone}`}>{children}</span>;
}
