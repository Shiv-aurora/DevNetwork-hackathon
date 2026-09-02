const ENVIRONMENTS = Object.freeze({
  sandbox: Object.freeze({
    baseUrl: "https://api.dev.name.com",
    identityMode: "Name.com Sandbox / Provider-Backed Verification",
    publicDnsAvailable: false,
  }),
  production: Object.freeze({
    baseUrl: "https://api.name.com",
    identityMode: "Production environment detected; public DNS requires independent verification",
    publicDnsAvailable: "not-established-by-this-check",
  }),
});

const REQUEST_TIMEOUT_MS = 15_000;

export class NamecomCheckError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = "NamecomCheckError";
    this.exitCode = exitCode;
  }
}

function requireCredentials(username, token) {
  const missing = [];
  if (!username) missing.push("NAMECOM_USERNAME");
  if (!token) missing.push("NAMECOM_TOKEN");

  if (missing.length > 0) {
    throw new NamecomCheckError(`missing required environment variable(s): ${missing.join(", ")}.`, 2);
  }
}

async function requestJson(fetchImpl, url, authorization) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Authorization: authorization,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? "request timed out"
      : "network request failed";
    throw new NamecomCheckError(`${reason} while contacting the official name.com API.`, 5);
  }

  if (!response.ok) {
    const guidance = response.status === 401
      ? "invalid credentials or credentials for the wrong environment"
      : response.status === 403
        ? "authenticated account is not permitted to use this API operation"
        : response.status === 429
          ? "name.com rate limit reached; retry later"
          : "provider returned an unsuccessful response";
    throw new NamecomCheckError(`HTTP ${response.status} (${guidance}).`, 4);
  }

  try {
    return { status: response.status, body: await response.json() };
  } catch {
    throw new NamecomCheckError("provider returned HTTP success with an invalid JSON body.", 4);
  }
}

export async function checkNamecomEnvironment({
  environment = "sandbox",
  username,
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  const selected = ENVIRONMENTS[environment];
  if (!selected) {
    throw new NamecomCheckError(`unsupported NAMECOM_ENV '${environment}'; use sandbox or production.`, 2);
  }

  requireCredentials(username, token);

  if (environment === "sandbox" && !username.endsWith("-test")) {
    throw new NamecomCheckError("sandbox requires NAMECOM_USERNAME to end in '-test'.", 3);
  }

  const authorization = `Basic ${Buffer.from(`${username}:${token}`, "utf8").toString("base64")}`;
  const hello = await requestJson(fetchImpl, `${selected.baseUrl}/core/v1/hello`, authorization);

  if (!hello.body || typeof hello.body !== "object") {
    throw new NamecomCheckError("hello endpoint returned an unexpected response shape.", 4);
  }

  const domainState = await requestJson(
    fetchImpl,
    `${selected.baseUrl}/core/v1/domains?perPage=1&page=1&includeRenewalPrice=false`,
    authorization,
  );

  if (!domainState.body || !Array.isArray(domainState.body.domains)) {
    throw new NamecomCheckError("domains endpoint returned an unexpected response shape.", 4);
  }

  const totalCount = Number.isInteger(domainState.body.totalCount)
    ? domainState.body.totalCount
    : domainState.body.domains.length;

  return {
    provider: "name.com",
    apiVersion: "core/v1",
    environment,
    baseUrl: selected.baseUrl,
    authenticated: true,
    helloHttpStatus: hello.status,
    domainsHttpStatus: domainState.status,
    managedDomainCount: totalCount,
    sandboxManagedResourcesAvailable: environment === "sandbox" ? totalCount > 0 : null,
    identityMode: selected.identityMode,
    publicDnsAvailable: selected.publicDnsAvailable,
    limitation: environment === "sandbox"
      ? "name.com stores and returns sandbox DNS records through its API; sandbox domains and records are not publicly registered or publicly resolvable."
      : "Production API access and domain visibility do not by themselves prove that a specific DNS record resolves publicly.",
  };
}
