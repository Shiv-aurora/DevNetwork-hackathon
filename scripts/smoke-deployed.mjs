const baseUrl = (process.env.PROOFROOT_DEPLOYMENT_URL ?? "").replace(/\/$/, "");
const expectNamecom = process.env.EXPECT_NAMECOM_LIVE === "1";
const expectGroq = process.env.EXPECT_GROQ_LIVE === "1";
const expectPersistentIdentity = process.env.EXPECT_PERSISTENT_IDENTITY === "1";

if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
  console.error("PROOFROOT_DEPLOYMENT_URL must be a public HTTPS deployment URL.");
  process.exit(2);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}${body?.message ? `: ${body.message}` : ""}`);
  }
  return body;
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const health = await request("/api/health");
  requireCondition(health?.status === "ok", "Health endpoint did not report ok.");
  requireCondition(health?.protectedTool === "deterministic-simulator", "Unexpected protected-tool mode.");
  if (expectNamecom) {
    requireCondition(health?.namecom?.configured === true, "Expected name.com secrets to be configured.");
    requireCondition(health?.namecom?.domainConfigured === true, "Expected ProofRoot domain to be configured.");
  }
  if (expectGroq) requireCondition(health?.groq?.configured === true, "Expected Groq to be configured.");
  if (expectPersistentIdentity) {
    requireCondition(health?.identity?.persistentSigningConfigured === true, "Expected persistent signing identity to be configured.");
  }

  const providerStatus = await request("/api/namecom/status");
  if (expectNamecom) {
    requireCondition(providerStatus?.authenticated === true, "name.com deployment authentication did not succeed.");
    requireCondition(Number.isInteger(providerStatus?.managedDomainCount), "name.com managed-domain state was not returned.");
  }

  if (expectPersistentIdentity) {
    const manifest = await request("/.well-known/proofroot.json");
    requireCondition(manifest?.version === "proofroot.identity.v1", "Public ProofRoot identity manifest is unavailable or invalid.");
  }

  const valid = await request("/api/demo/run", {
    method: "POST",
    body: JSON.stringify({ scenario: "valid" }),
  });
  requireCondition(valid?.workflow?.requestedAmountCents === 8500, "Golden run did not request $85.");
  requireCondition(valid?.workflow?.delegatedLimitCents === 10000, "Golden run did not preserve the $100 cap.");
  requireCondition(valid?.workflow?.gateway?.outcome === "confirmed", "Golden run was not confirmed by the protected-tool path.");
  requireCondition(valid?.workflow?.gateway?.transactionId === "sim-refund-194-usd-8500", "Golden transaction identifier changed unexpectedly.");
  requireCondition(valid?.verification?.checks?.signatureValidity?.status === "valid", "Golden signatures did not verify.");
  requireCondition(valid?.verification?.checks?.gatewayEvidence?.status === "valid", "Golden gateway evidence did not verify.");
  requireCondition(valid?.verification?.checks?.bundleIntegrity?.status === "valid", "Golden bundle integrity did not verify.");
  if (expectNamecom && expectPersistentIdentity) {
    requireCondition(valid?.runtime?.persistentSigningIdentity === true, "Golden run did not use persistent manifest-backed signing identities.");
    requireCondition(valid?.runtime?.identityResolutionConfigured === true, "Golden run did not configure domain identity resolution.");
    requireCondition(valid?.verification?.checks?.identityResolution?.status === "valid", "Domain-backed identity resolution did not verify.");
    requireCondition(valid?.verification?.overallStatus === "verified", "Golden run did not verify end to end.");
  }
  if (expectGroq) {
    requireCondition(valid?.runtime?.modelProvider === "groq", "Golden run did not use Groq.");
    requireCondition(valid?.runtime?.modelDriven === true, "Golden run did not report a model-driven routing decision.");
  }

  const authority = await request("/api/demo/attacks", {
    method: "POST",
    body: JSON.stringify({ attack: "authority-violation" }),
  });
  requireCondition(authority?.attack?.result === "blocked", "Authority attack was not blocked.");
  requireCondition(authority?.attack?.protectedToolCalls === 0, "Authority attack reached the protected tool.");
  requireCondition(authority?.attack?.transactionCreated === false, "Authority attack created a transaction.");
  requireCondition(authority?.attack?.executionReceipt === null, "Authority attack produced an execution receipt.");
  requireCondition(authority?.attack?.reasonCodes?.includes("DELEGATED_LIMIT_EXCEEDED"), "Authority attack did not report delegated-limit violation.");

  const tamper = await request("/api/demo/attacks", {
    method: "POST",
    body: JSON.stringify({ attack: "evidence-tampering" }),
  });
  requireCondition(tamper?.attack?.originalAmountCents === 8500, "Tamper attack did not start from $85 evidence.");
  requireCondition(tamper?.attack?.tamperedAmountCents === 85000, "Tamper attack did not mutate evidence to $850.");
  requireCondition(tamper?.attack?.result === "failed", "Tampered bundle unexpectedly verified.");
  requireCondition(tamper?.attack?.firstFailure?.receiptId === tamper?.attack?.alteredReceiptId, "Verifier did not localize the altered Action Request.");
  requireCondition(tamper?.attack?.affectedReceiptIds?.length >= 2, "Verifier did not mark downstream evidence affected.");

  const serialized = JSON.stringify({ health, providerStatus, valid, authority, tamper });
  requireCondition(!serialized.includes("PRIVATE KEY"), "Deployment response leaked private-key material.");
  requireCondition(!serialized.includes("PROOFROOT_SIGNING_KEYS_JSON"), "Deployment response leaked signing-secret configuration content.");

  console.log(JSON.stringify({
    status: "passed",
    deployment: baseUrl,
    namecomEnvironment: health.namecom.environment,
    namecomAuthenticated: providerStatus?.authenticated === true,
    persistentIdentity: valid?.runtime?.persistentSigningIdentity === true,
    identityVerification: valid?.verification?.checks?.identityResolution?.status,
    modelProvider: valid?.runtime?.modelProvider,
    modelDriven: valid?.runtime?.modelDriven,
    goldenTransaction: valid?.workflow?.gateway?.transactionId,
    authorityAttack: authority?.attack?.result,
    tamperAttack: tamper?.attack?.result,
  }, null, 2));
} catch (error) {
  console.error(`Deployed smoke test failed: ${error instanceof Error ? error.message : "unknown failure"}`);
  process.exit(1);
}
