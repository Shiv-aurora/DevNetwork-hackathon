import { NextResponse } from "next/server";

import { createIdentityResolverFromEnv } from "../../../../src/server/identity-runtime.mjs";
import { verifyEvidenceBundle } from "../../../../src/verifier/verify-bundle.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const bundle = body.bundle ?? body;
    const identityResolver = createIdentityResolverFromEnv();
    const verification = await verifyEvidenceBundle(bundle, {
      ...(identityResolver ? { identityResolver } : {}),
    });
    return NextResponse.json({ verification });
  } catch (error) {
    return NextResponse.json({
      error: "VERIFICATION_FAILED_TO_RUN",
      message: error instanceof Error ? error.message : "Verification could not run.",
    }, { status: 400 });
  }
}
