import { NextResponse } from "next/server";

import { createNamecomClientFromEnv, safeProviderError } from "../../../../src/server/namecom-runtime.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const client = createNamecomClientFromEnv();
    const result = await client.checkAvailability(body.domainNames);
    return NextResponse.json({ provider: "name.com", environment: client.environmentInfo.environment, result });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: safe.error === "MISSING_CONFIGURATION" ? 503 : 400 });
  }
}
