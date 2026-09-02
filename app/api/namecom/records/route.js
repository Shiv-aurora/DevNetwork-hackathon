import { NextResponse } from "next/server";

import { assertConfiguredDomain, createNamecomClientFromEnv, safeProviderError } from "../../../../src/server/namecom-runtime.mjs";

export const runtime = "nodejs";

function statusFor(errorCode, fallback = 400) {
  if (errorCode === "MISSING_CONFIGURATION") return 503;
  if (errorCode === "DOMAIN_SCOPE_VIOLATION") return 403;
  return fallback;
}

export async function GET(request) {
  try {
    const domainName = request.nextUrl.searchParams.get("domainName");
    assertConfiguredDomain(domainName);
    const client = createNamecomClientFromEnv();
    const result = await client.listRecords(domainName);
    return NextResponse.json({ provider: "name.com", environment: client.environmentInfo.environment, result });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: statusFor(safe.error, 502) });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    assertConfiguredDomain(body.domainName);
    const client = createNamecomClientFromEnv();
    const result = await client.createRecord(body.domainName, body.record);
    return NextResponse.json({ provider: "name.com", environment: client.environmentInfo.environment, result }, { status: 201 });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: statusFor(safe.error) });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    assertConfiguredDomain(body.domainName);
    const client = createNamecomClientFromEnv();
    const result = await client.updateRecord(body.domainName, body.id, body.record);
    return NextResponse.json({ provider: "name.com", environment: client.environmentInfo.environment, result });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: statusFor(safe.error) });
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    assertConfiguredDomain(body.domainName);
    const client = createNamecomClientFromEnv();
    await client.deleteRecord(body.domainName, body.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const safe = safeProviderError(error);
    return NextResponse.json(safe, { status: statusFor(safe.error) });
  }
}
