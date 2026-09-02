const NAMECOM_ENVIRONMENTS = Object.freeze({
  sandbox: Object.freeze({
    baseUrl: "https://api.dev.name.com",
    publicDnsAvailable: false,
    identityMode: "Name.com Sandbox / Provider-Backed Verification",
  }),
  production: Object.freeze({
    baseUrl: "https://api.name.com",
    publicDnsAvailable: "requires-independent-resolution-check",
    identityMode: "Production Public DNS (only after independent resolution succeeds)",
  }),
});

const DEFAULT_TIMEOUT_MS = 15_000;
const DNS_TYPES = new Set(["A", "AAAA", "ANAME", "CNAME", "MX", "NS", "SRV", "TXT"]);

export class NamecomApiError extends Error {
  constructor(message, { status = null, code = "NAMECOM_API_ERROR", retryAfter = null } = {}) {
    super(message);
    this.name = "NamecomApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NamecomApiError(`${name} is required.`, { code: "INVALID_ARGUMENT" });
  }
  return value.trim();
}

function requireCredentials({ environment, username, token }) {
  requireString(username, "NAMECOM_USERNAME");
  requireString(token, "NAMECOM_TOKEN");
  if (environment === "sandbox" && !username.endsWith("-test")) {
    throw new NamecomApiError("Sandbox NAMECOM_USERNAME must end in '-test'.", { code: "INVALID_CREDENTIAL_SHAPE" });
  }
}

function redactSecrets(value, secrets) {
  let text = String(value ?? "");
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[REDACTED]");
  }
  return text.slice(0, 500);
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") {
    throw new NamecomApiError("DNS record payload is required.", { code: "INVALID_ARGUMENT" });
  }
  const type = requireString(record.type, "record.type").toUpperCase();
  if (!DNS_TYPES.has(type)) {
    throw new NamecomApiError(`Unsupported DNS record type '${type}'.`, { code: "INVALID_ARGUMENT" });
  }
  const host = typeof record.host === "string" ? record.host : "";
  const answer = requireString(record.answer, "record.answer");
  const ttl = record.ttl ?? 300;
  if (!Number.isInteger(ttl) || ttl < 300) {
    throw new NamecomApiError("record.ttl must be an integer of at least 300 seconds.", { code: "INVALID_ARGUMENT" });
  }

  const normalized = { type, host, answer, ttl };
  if (record.priority !== undefined && record.priority !== null) {
    if (!Number.isInteger(record.priority) || record.priority < 0) {
      throw new NamecomApiError("record.priority must be a non-negative integer.", { code: "INVALID_ARGUMENT" });
    }
    normalized.priority = record.priority;
  }
  return normalized;
}

export function createNamecomClient({
  environment = "sandbox",
  username,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const config = NAMECOM_ENVIRONMENTS[environment];
  if (!config) {
    throw new NamecomApiError(`Unsupported name.com environment '${environment}'.`, { code: "INVALID_ENVIRONMENT" });
  }
  if (typeof fetchImpl !== "function") {
    throw new NamecomApiError("A fetch implementation is required.", { code: "INVALID_ARGUMENT" });
  }
  requireCredentials({ environment, username, token });

  const authorization = `Basic ${Buffer.from(`${username}:${token}`, "utf8").toString("base64")}`;
  const secrets = [username, token, authorization];

  async function request(path, { method = "GET", body, headers = {}, expectedStatuses = [200] } = {}) {
    let response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new NamecomApiError(timedOut ? "name.com request timed out." : "name.com network request failed.", {
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      });
    }

    if (expectedStatuses.includes(response.status)) {
      if (response.status === 204) return null;
      try {
        return await response.json();
      } catch {
        throw new NamecomApiError("name.com returned invalid JSON for a successful request.", {
          status: response.status,
          code: "INVALID_PROVIDER_RESPONSE",
        });
      }
    }

    let providerMessage = "";
    try {
      const providerBody = await response.json();
      providerMessage = [providerBody?.message, providerBody?.details].filter(Boolean).join(": ");
    } catch {
      providerMessage = "";
    }
    providerMessage = redactSecrets(providerMessage, secrets);

    const code = response.status === 401
      ? "UNAUTHENTICATED"
      : response.status === 403
        ? "PERMISSION_DENIED"
        : response.status === 404
          ? "NOT_FOUND"
          : response.status === 429
            ? "RATE_LIMITED"
            : response.status >= 500
              ? "PROVIDER_UNAVAILABLE"
              : "PROVIDER_REJECTED";

    const suffix = providerMessage ? ` ${providerMessage}` : "";
    throw new NamecomApiError(`name.com request failed with HTTP ${response.status}.${suffix}`, {
      status: response.status,
      code,
      retryAfter: response.headers?.get?.("retry-after") ?? null,
    });
  }

  function domainPath(domainName) {
    return `/core/v1/domains/${encodeURIComponent(requireString(domainName, "domainName"))}`;
  }

  return Object.freeze({
    environmentInfo: Object.freeze({
      provider: "name.com",
      apiVersion: "core/v1",
      environment,
      baseUrl: config.baseUrl,
      identityMode: config.identityMode,
      publicDnsAvailable: config.publicDnsAvailable,
      limitation: environment === "sandbox"
        ? "Sandbox DNS records are provider-backed API state and do not resolve publicly."
        : "Production API success does not itself prove public DNS resolution; resolve records independently before claiming it.",
    }),

    hello() {
      return request("/core/v1/hello");
    },

    listDomains({ page = 1, perPage = 50 } = {}) {
      return request(`/core/v1/domains?page=${page}&perPage=${perPage}&includeRenewalPrice=false`);
    },

    searchDomains({ keyword, tldFilter = ["com", "net", "org"], timeout = 2500, purchaseType = "registration" }) {
      requireString(keyword, "keyword");
      if (!Array.isArray(tldFilter) || tldFilter.length === 0 || tldFilter.length > 50) {
        throw new NamecomApiError("tldFilter must contain between 1 and 50 TLDs.", { code: "INVALID_ARGUMENT" });
      }
      return request("/core/v1/domains:search", {
        method: "POST",
        body: { keyword, timeout, tldFilter, purchaseType },
      });
    },

    checkAvailability(domainNames) {
      if (!Array.isArray(domainNames) || domainNames.length === 0 || domainNames.length > 50) {
        throw new NamecomApiError("domainNames must contain between 1 and 50 names.", { code: "INVALID_ARGUMENT" });
      }
      domainNames.forEach((name) => requireString(name, "domainName"));
      return request("/core/v1/domains:checkAvailability", {
        method: "POST",
        body: { domainNames },
      });
    },

    createDomain({ domainName, years = 1, purchaseType = "registration", purchasePrice, idempotencyKey }) {
      requireString(domainName, "domainName");
      if (!Number.isInteger(years) || years < 1) {
        throw new NamecomApiError("years must be a positive integer.", { code: "INVALID_ARGUMENT" });
      }
      const body = { domain: { domainName }, purchaseType, years };
      if (purchasePrice !== undefined) body.purchasePrice = purchasePrice;
      const headers = idempotencyKey ? { "X-Idempotency-Key": idempotencyKey } : {};
      return request("/core/v1/domains", { method: "POST", body, headers });
    },

    getDomain(domainName) {
      return request(domainPath(domainName));
    },

    listRecords(domainName, { page = 1, perPage = 100 } = {}) {
      return request(`${domainPath(domainName)}/records?page=${page}&perPage=${perPage}`);
    },

    createRecord(domainName, record) {
      return request(`${domainPath(domainName)}/records`, {
        method: "POST",
        body: normalizeRecord(record),
      });
    },

    updateRecord(domainName, id, record) {
      if (!Number.isInteger(id) || id <= 0) {
        throw new NamecomApiError("record id must be a positive integer.", { code: "INVALID_ARGUMENT" });
      }
      return request(`${domainPath(domainName)}/records/${id}`, {
        method: "PUT",
        body: normalizeRecord(record),
      });
    },

    deleteRecord(domainName, id) {
      if (!Number.isInteger(id) || id <= 0) {
        throw new NamecomApiError("record id must be a positive integer.", { code: "INVALID_ARGUMENT" });
      }
      return request(`${domainPath(domainName)}/records/${id}`, {
        method: "DELETE",
        expectedStatuses: [204],
      });
    },
  });
}
