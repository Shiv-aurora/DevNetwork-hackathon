const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_TIMEOUT_MS = 20_000;

export class ModelRuntimeError extends Error {
  constructor(message, { code = "MODEL_RUNTIME_ERROR", status = null } = {}) {
    super(message);
    this.name = "ModelRuntimeError";
    this.code = code;
    this.status = status;
  }
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ModelRuntimeError(`${field} is required.`, { code: "MISSING_CONFIGURATION" });
  }
  return value.trim();
}

function parseJsonContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ModelRuntimeError("Model returned no message content.", { code: "INVALID_MODEL_RESPONSE" });
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new ModelRuntimeError("Model response was not valid JSON.", { code: "INVALID_MODEL_RESPONSE" });
  }
}

export function createGroqModelClient({
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  requireString(apiKey, "GROQ_API_KEY");
  requireString(model, "GROQ_MODEL");
  if (typeof fetchImpl !== "function") throw new ModelRuntimeError("fetch implementation is required.");

  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${GROQ_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...options.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      throw new ModelRuntimeError(timedOut ? "Groq request timed out." : "Groq network request failed.", {
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
      });
    }

    if (!response.ok) {
      throw new ModelRuntimeError(`Groq request failed with HTTP ${response.status}.`, {
        code: response.status === 401 ? "UNAUTHENTICATED" : response.status === 429 ? "RATE_LIMITED" : "PROVIDER_REJECTED",
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch {
      throw new ModelRuntimeError("Groq returned invalid JSON.", { code: "INVALID_PROVIDER_RESPONSE", status: response.status });
    }
  }

  return Object.freeze({
    provider: "groq",
    model,
    modelDriven: true,

    async listModels() {
      return request("/models");
    },

    async decideJson({ system, user, validate }) {
      const payload = await request("/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: `${system}\nRespond only with a JSON object. Do not reveal chain-of-thought or hidden reasoning.` },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      const value = parseJsonContent(payload);
      if (validate && !validate(value)) {
        throw new ModelRuntimeError("Model JSON did not satisfy the required decision contract.", { code: "INVALID_MODEL_DECISION" });
      }
      return Object.freeze({
        value,
        provider: "groq",
        model: payload.model ?? model,
        requestId: payload.id ?? null,
        modelDriven: true,
      });
    },
  });
}

export function createDeterministicModelClient() {
  return Object.freeze({
    provider: "deterministic-fallback",
    model: "proofroot-fixture-v1",
    modelDriven: false,
    async listModels() {
      return { data: [{ id: "proofroot-fixture-v1", active: true }] };
    },
    async decideJson({ fallbackValue, validate }) {
      const value = structuredClone(fallbackValue ?? {});
      if (validate && !validate(value)) {
        throw new ModelRuntimeError("Deterministic fallback did not satisfy decision contract.", { code: "INVALID_FALLBACK" });
      }
      return Object.freeze({
        value,
        provider: "deterministic-fallback",
        model: "proofroot-fixture-v1",
        requestId: null,
        modelDriven: false,
      });
    },
  });
}

export function createConfiguredModelClient({ env = process.env, fetchImpl = globalThis.fetch, allowFallback = true } = {}) {
  if (env.GROQ_API_KEY && env.GROQ_MODEL) {
    return createGroqModelClient({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, fetchImpl });
  }
  if (!allowFallback) {
    throw new ModelRuntimeError("GROQ_API_KEY and GROQ_MODEL are required.", { code: "MISSING_CONFIGURATION" });
  }
  return createDeterministicModelClient();
}

export async function verifyGroqConnectivity({ apiKey, model, fetchImpl = globalThis.fetch } = {}) {
  const client = createGroqModelClient({ apiKey, model, fetchImpl });
  const models = await client.listModels();
  const available = Array.isArray(models?.data) && models.data.some((entry) => entry.id === model && entry.active !== false);
  if (!available) {
    throw new ModelRuntimeError(`Configured GROQ_MODEL '${model}' was not returned as an active model.`, { code: "MODEL_NOT_AVAILABLE" });
  }
  return Object.freeze({ provider: "groq", authenticated: true, model, modelAvailable: true });
}
