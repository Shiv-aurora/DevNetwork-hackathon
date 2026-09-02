import SurfaceHeader from "../../components/SurfaceHeader";
import LiveDemoClient from "../../components/LiveDemoClient";

export default function RunPage() {
  return (
    <>
      <SurfaceHeader
        eyebrow="Live run"
        title="Watch authority move through the swarm."
        description="Run the golden support case end to end. Every agent handoff becomes signed evidence; only the Proof Gateway can turn a valid request into an observed tool effect."
      />
      <LiveDemoClient />
    </>
  );
}
