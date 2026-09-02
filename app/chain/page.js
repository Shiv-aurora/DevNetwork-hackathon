import SurfaceHeader from "../../components/SurfaceHeader";
import ChainExplorerClient from "../../components/ChainExplorerClient";

export default function ChainPage() {
  return (
    <>
      <SurfaceHeader
        eyebrow="Chain explorer"
        title="Intent, decision, effect."
        description="Generate a signed run and inspect the causal graph, receipt lineage, signer, content digest, and raw evidence for every consequential transition."
      />
      <ChainExplorerClient />
    </>
  );
}
