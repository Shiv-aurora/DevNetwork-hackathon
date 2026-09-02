import { createDomainIdentityResolver } from "../identity/resolver.mjs";
import { createNamecomClientFromEnv, namecomConfiguration } from "./namecom-runtime.mjs";

export function createIdentityResolverFromEnv(env = process.env, { fetchImpl = globalThis.fetch, resolveTxtImpl } = {}) {
  const config = namecomConfiguration(env);
  if (!config.domainName) return null;

  if (config.environment === "sandbox") {
    if (!config.configured) return null;
    return createDomainIdentityResolver({
      environment: "sandbox",
      domainName: config.domainName,
      namecomClient: createNamecomClientFromEnv(env, fetchImpl),
      fetchImpl,
    });
  }

  return createDomainIdentityResolver({
    environment: "production",
    domainName: config.domainName,
    fetchImpl,
    ...(resolveTxtImpl ? { resolveTxtImpl } : {}),
  });
}
