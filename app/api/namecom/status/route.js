import { NextResponse } from "next/server";

import { createNamecomClientFromEnv, namecomConfiguration, safeProviderError } from "../../../../src/server/namecom-runtime.mjs";

export const runtime = "nodejs";

export async function GET() {
  const config = namecomConfiguration();
  if (!config.configured) {
    return NextResponse.json({ provider: "name.com", ...config, authenticated: false });
  }

  try {
    const client = createNamecomClientFromEnv();
    const [hello, domains] = await Promise.all([client.hello(), client.listDomains({ perPage: 1 })]);
    return NextResponse.json({
      provider: "name.com",
      ...config,
      authenticated: true,
      hello: Boolean(hello),
      managedDomainCount: Number.isInteger(domains?.totalCount) ? domains.totalCount : (domains?.domains?.length ?? 0),
    });
  } catch (error) {
    return NextResponse.json({ provider: "name.com", ...config, authenticated: false, ...safeProviderError(error) }, { status: 502 });
  }
}
