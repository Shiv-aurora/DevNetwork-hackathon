export default function SurfaceHeader({ eyebrow, title, description, badge = "Foundation" }) {
  return (
    <header className="surface-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      <span className="phase-badge">{badge}</span>
    </header>
  );
}
