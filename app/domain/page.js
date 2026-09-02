import SurfaceHeader from "../../components/SurfaceHeader";
import DomainConsole from "../../components/DomainConsole";

export default function DomainPage() {
  return (
    <>
      <SurfaceHeader
        eyebrow="Domain onboarding"
        title="Turn a domain into an agent accountability root."
        description="Search, check, provision in sandbox, inspect managed domains, and create/list DNS records through the real name.com server integration. Sandbox limitations remain explicit."
      />
      <DomainConsole />
    </>
  );
}
