import { NextResponse } from "next/server";

import { createConfiguredModelClient } from "../../../../src/agents/model-runtime.mjs";
import { runAuthorityViolationAttack, runEvidenceTamperAttack } from "../../../../src/attacks/attack-lab.mjs";
import { createIdentityResolverFromEnv } from "../../../../src/server/identity-runtime.mjs";
import { loadSigningIdentitiesFromEnv } from "../../../../src/server/signing-runtime.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const attack = body.attack ?? "authority-violation";
    const modelClient = createConfiguredModelClient({ allowFallback: true });
    const signingIdentities = loadSigningIdentitiesFromEnv();
    const identityResolver = createIdentityResolverFromEnv();
    const options = {
      modelClient,
      ...(signingIdentities ? { signingIdentities } : {}),
      ...(identityResolver ? { identityResolver } : {}),
    };

    const result = attack === "authority-violation"
      ? await runAuthorityViolationAttack(options)
      : attack === "evidence-tampering"
        ? await runEvidenceTamperAttack(options)
        : null;

    if (!result) {
      return NextResponse.json({ error: "UNKNOWN_ATTACK", message: "Use authority-violation or evidence-tampering." }, { status: 400 });
    }
    return NextResponse.json({ attack: result });
  } catch (error) {
    return NextResponse.json({
      error: "ATTACK_RUN_FAILED",
      message: error instanceof Error ? error.message : "Attack run failed.",
    }, { status: 500 });
  }
}
