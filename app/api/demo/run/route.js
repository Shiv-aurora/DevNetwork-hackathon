import { NextResponse } from "next/server";

import { createConfiguredModelClient } from "../../../../src/agents/model-runtime.mjs";
import { runGoldenWorkflow, WORKFLOW_SCENARIOS } from "../../../../src/agents/golden-workflow.mjs";
import { createIdentityResolverFromEnv } from "../../../../src/server/identity-runtime.mjs";
import { getServerReplayStore } from "../../../../src/server/replay-runtime.mjs";
import { loadSigningIdentitiesFromEnv } from "../../../../src/server/signing-runtime.mjs";
import { verifyEvidenceBundle } from "../../../../src/verifier/verify-bundle.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scenario = body.scenario ?? WORKFLOW_SCENARIOS.VALID;
    const modelClient = createConfiguredModelClient({ allowFallback: true });
    const signingIdentities = loadSigningIdentitiesFromEnv();
    const workflow = await runGoldenWorkflow({
      scenario,
      modelClient,
      replayStore: getServerReplayStore(),
      ...(signingIdentities ? { signingIdentities } : {}),
    });
    const identityResolver = createIdentityResolverFromEnv();
    const verification = await verifyEvidenceBundle(workflow.evidenceBundle, {
      ...(identityResolver ? { identityResolver } : {}),
    });

    return NextResponse.json({
      workflow,
      verification,
      runtime: {
        modelProvider: workflow.routingDecision.provider,
        model: workflow.routingDecision.model,
        modelDriven: workflow.routingDecision.modelDriven,
        persistentSigningIdentity: workflow.identity.persistent,
        identityResolutionConfigured: Boolean(identityResolver),
        replayProtection: "process-runtime",
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "DEMO_RUN_FAILED",
      message: error instanceof Error ? error.message : "Demo run failed.",
    }, { status: 500 });
  }
}
