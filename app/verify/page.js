import SurfaceHeader from "../../components/SurfaceHeader";
import VerifierClient from "../../components/VerifierClient";

export default function VerifyPage() {
  return (
    <>
      <SurfaceHeader
        eyebrow="Independent verification"
        title="No unexplained green badge."
        description="Re-run verification from the evidence itself. Identity resolution, signatures, delegation, constraints, gateway evidence, and bundle integrity remain separate inspectable results."
      />
      <VerifierClient />
    </>
  );
}
