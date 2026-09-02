import { NextResponse } from "next/server";

import { namecomConfiguration } from "../../../src/server/namecom-runtime.mjs";

export const runtime = "nodejs";

export async function GET() {
  const namecom = namecomConfiguration();
  const persistentIdentityConfigured = Boolean(
    process.env.PROOFROOT_PUBLIC_MANIFEST_JSON
    && process.env.PROOFROOT_SIGNING_KEYS_JSON,
  );
  const groqConfigured = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_MODEL);

  return NextResponse.json({
    status: "ok",
    service: "proofroot",
    version: "0.1.0",
    deploymentTarget: process.env.DEPLOYMENT_TARGET ?? "vercel",
    namecom: {
      environment: namecom.environment,
      configured: namecom.configured,
      domainConfigured: Boolean(namecom.domainName),
      identityMode: namecom.identityMode,
      publicDnsAvailable: namecom.publicDnsAvailable,
    },
    groq: {
      configured: groqConfigured,
      modelConfigured: Boolean(process.env.GROQ_MODEL),
    },
    identity: {
      persistentSigningConfigured: persistentIdentityConfigured,
      publicManifestConfigured: Boolean(process.env.PROOFROOT_PUBLIC_MANIFEST_JSON),
    },
    protectedTool: process.env.REFUND_TOOL_MODE ?? "deterministic-simulator",
  });
}
