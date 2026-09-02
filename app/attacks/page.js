import SurfaceHeader from "../../components/SurfaceHeader";
import AttackLabClient from "../../components/AttackLabClient";

export default function AttacksPage() {
  return (
    <>
      <SurfaceHeader
        eyebrow="Attack lab"
        title="Break authority. Break history."
        description="Both mandatory attacks execute against the same gateway and evidence verifier used by the valid run. The red state is computed from evidence, not hardcoded into the interface."
      />
      <AttackLabClient />
    </>
  );
}
