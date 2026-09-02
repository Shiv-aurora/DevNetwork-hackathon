import { NextResponse } from "next/server";

import { verifyIdentityManifest } from "../../../src/identity/manifest.mjs";

export const runtime = "nodejs";

export async function GET() {
  const encoded = process.env.PROOFROOT_PUBLIC_MANIFEST_JSON;
  if (!encoded) {
    return NextResponse.json({
      status: "unconfigured",
      message: "ProofRoot public identity manifest has not been provisioned in this deployment.",
    }, { status: 503 });
  }

  try {
    const manifest = JSON.parse(encoded);
    const verification = verifyIdentityManifest(manifest, manifest.rootKey);
    if (!verification.valid) {
      return NextResponse.json({
        status: "invalid",
        message: "Configured ProofRoot identity manifest failed local cryptographic validation.",
        reasons: verification.reasons,
      }, { status: 500 });
    }
    return NextResponse.json(manifest, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return NextResponse.json({
      status: "invalid",
      message: "Configured ProofRoot identity manifest is not valid JSON.",
    }, { status: 500 });
  }
}
