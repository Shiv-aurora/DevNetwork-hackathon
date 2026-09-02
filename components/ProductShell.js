import Link from "next/link";
import ResetDemoButton from "./ResetDemoButton";

const NAV = [
  ["/domain", "Domain"],
  ["/organization", "Organization"],
  ["/agents", "Agents"],
  ["/run", "Live Run"],
  ["/chain", "Chain"],
  ["/verify", "Verify"],
  ["/attacks", "Attack Lab"],
];

export default function ProductShell({ children }) {
  const namecomEnvironment = process.env.NAMECOM_ENV ?? "sandbox";
  const namecomConfigured = Boolean(process.env.NAMECOM_USERNAME && process.env.NAMECOM_TOKEN);
  const groqConfigured = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          <span className="brand-mark">PR</span>
          <span><strong>ProofRoot</strong><small>Agent accountability</small></span>
        </Link>
        <nav className="nav-list" aria-label="Product navigation">
          {NAV.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
        <div className="sidebar-foot">
          <span className="environment-dot" /> name.com {namecomEnvironment}
          <small>{namecomConfigured ? "Provider credentials configured" : "Provider secrets pending"}</small>
          <small>{groqConfigured ? "Groq model configured" : "Deterministic AI fallback active"}</small>
          <ResetDemoButton />
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
