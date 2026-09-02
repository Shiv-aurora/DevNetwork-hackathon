import test from "node:test";
import assert from "node:assert/strict";

import {
  createConfiguredModelClient,
  createDeterministicModelClient,
  createGroqModelClient,
  ModelRuntimeError,
  verifyGroqConnectivity,
} from "../src/agents/model-runtime.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("configured runtime uses deterministic fallback only when Groq secrets are absent", async () => {
  const fallback = createConfiguredModelClient({ env: {} });
  assert.equal(fallback.provider, "deterministic-fallback");
  assert.equal(fallback.modelDriven, false);

  await assert.rejects(
    Promise.resolve().then(() => createConfiguredModelClient({ env: {}, allowFallback: false })),
    (error) => error instanceof ModelRuntimeError && error.code === "MISSING_CONFIGURATION",
  );
});

test("Groq client calls OpenAI-compatible chat completions and returns validated JSON only", async () => {
  const calls = [];
  const client = createGroqModelClient({
    apiKey: "groq-secret",
    model: "demo-model",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        id: "req_1",
        model: "demo-model",
        choices: [{ message: { content: JSON.stringify({ route: "billing", shouldInvestigate: true }) } }],
      });
    },
  });

  const result = await client.decideJson({
    system: "Route support work.",
    user: "Duplicate charge reported.",
    validate: (value) => value.route === "billing" && value.shouldInvestigate === true,
  });

  assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(calls[0].options.headers.Authorization, "Bearer groq-secret");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.model, "demo-model");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.match(body.messages[0].content, /Do not reveal chain-of-thought/i);
  assert.deepEqual(result.value, { route: "billing", shouldInvestigate: true });
  assert.equal(result.modelDriven, true);
});

test("invalid Groq JSON fails closed instead of inventing a decision", async () => {
  const client = createGroqModelClient({
    apiKey: "groq-secret",
    model: "demo-model",
    fetchImpl: async () => jsonResponse({ choices: [{ message: { content: "not-json" } }] }),
  });

  await assert.rejects(
    client.decideJson({ system: "x", user: "y" }),
    (error) => error instanceof ModelRuntimeError && error.code === "INVALID_MODEL_RESPONSE",
  );
});

test("Groq HTTP errors never echo API keys", async () => {
  const client = createGroqModelClient({
    apiKey: "super-private-key",
    model: "demo-model",
    fetchImpl: async () => jsonResponse({ error: { message: "super-private-key is bad" } }, 401),
  });

  await assert.rejects(
    client.listModels(),
    (error) => error instanceof ModelRuntimeError
      && error.code === "UNAUTHENTICATED"
      && !error.message.includes("super-private-key"),
  );
});

test("deterministic fallback is explicitly labeled and validates its contract", async () => {
  const client = createDeterministicModelClient();
  const result = await client.decideJson({
    fallbackValue: { route: "billing" },
    validate: (value) => value.route === "billing",
  });
  assert.equal(result.provider, "deterministic-fallback");
  assert.equal(result.modelDriven, false);
  assert.deepEqual(result.value, { route: "billing" });
});

test("Groq connectivity check confirms configured model appears active", async () => {
  const result = await verifyGroqConnectivity({
    apiKey: "groq-secret",
    model: "demo-model",
    fetchImpl: async (url) => {
      assert.equal(url, "https://api.groq.com/openai/v1/models");
      return jsonResponse({ data: [{ id: "demo-model", active: true }] });
    },
  });
  assert.deepEqual(result, {
    provider: "groq",
    authenticated: true,
    model: "demo-model",
    modelAvailable: true,
  });
});
