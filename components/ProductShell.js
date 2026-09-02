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
          <span className="environment-dot" /> Name.com sandbox
          <small>Provider verification pending</small>
          <ResetDemoButton />
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
