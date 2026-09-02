import { createNamecomClient, NamecomApiError } from "../integrations/namecom-client.mjs";

export function namecomConfiguration(env = process.env) {
  const environment = env.NAMECOM_ENV ?? "sandbox";
  const configured = Boolean(env.NAMECOM_USERNAME && env.NAMECOM_TOKEN);
  return Object.freeze({
    environment,
    configured,
    domainName: env.PROOFROOT_DOMAIN ?? null,
    identityMode: environment === "sandbox"
      ? "Name.com Sandbox / Provider-Backed Verification"
      : "Production Public DNS (requires independent resolution validation)",
    publicDnsAvailable: environment === "sandbox" ? false : "not-yet-verified",
  });
}

export function createNamecomClientFromEnv(env = process.env, fetchImpl = globalThis.fetch) {
  const config = namecomConfiguration(env);
  if (!config.configured) {
    throw new NamecomApiError("name.com is not configured in the server environment.", {
      code: "MISSING_CONFIGURATION",
    });
  }
  return createNamecomClient({
    environment: config.environment,
    username: env.NAMECOM_USERNAME,
    token: env.NAMECOM_TOKEN,
    fetchImpl,
  });
}

export function assertConfiguredDomain(domainName, env = process.env) {
  const configuredDomain = env.PROOFROOT_DOMAIN;
  if (!configuredDomain) return;
  if (domainName !== configuredDomain) {
    throw new NamecomApiError("Requested domain does not match the configured ProofRoot domain.", {
      code: "DOMAIN_SCOPE_VIOLATION",
    });
  }
}

export function safeProviderError(error) {
  if (error instanceof NamecomApiError) {
    return Object.freeze({
      error: error.code,
      message: error.message,
      status: error.status,
      retryAfter: error.retryAfter,
    });
  }
  return Object.freeze({ error: "INTERNAL_ERROR", message: "Unexpected provider integration failure." });
}
