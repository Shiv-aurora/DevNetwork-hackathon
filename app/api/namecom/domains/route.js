import { NextResponse } from "next/server";

import { createNamecomClientFromEnv, namecomConfiguration, safeProviderError } from "../../../../src/server/namecom-runtime.mjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const client = createNamecomClientFromEnv();
    const result = await client.listDomains();
    return NextResponse.json({ provider: "name.com", environment: client.environmentInfo.environment, result });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: safe.error === "MISSING_CONFIGURATION" ? 503 : 502 });
  }
}

export async function POST(request) {
  const config = namecomConfiguration();
  if (config.environment !== "sandbox") {
    return NextResponse.json({
      error: "PRODUCTION_PURCHASE_DISABLED",
      message: "ProofRoot does not register paid production domains through the application. Select an existing production domain or use the sandbox lifecycle.",
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const client = createNamecomClientFromEnv();
    const result = await client.createDomain({
      domainName: body.domainName,
      years: body.years ?? 1,
      purchaseType: "registration",
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json({ provider: "name.com", environment: "sandbox", result }, { status: 201 });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: safe.error === "MISSING_CONFIGURATION" ? 503 : 400 });
  }
}
