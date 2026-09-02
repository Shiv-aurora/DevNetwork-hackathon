import { canonicalDigest } from "../crypto/canonical-json.mjs";
import { RECEIPT_TYPES, verifySignedReceipt } from "../evidence/receipts.mjs";

export const VERIFICATION_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
  UNVERIFIABLE: "unverifiable",
});

function result(status, detail, extra = {}) {
  return Object.freeze({ status, detail, ...extra });
}

function unsignedBundle(bundle) {
  const { bundleDigest: _digest, ...body } = bundle ?? {};
  return body;
}

function validAt(publicKey, createdAt) {
  if (!publicKey || publicKey.status === "suspended") return false;
  const at = Date.parse(createdAt);
  const start = Date.parse(publicKey.validFrom);
  if (!Number.isFinite(at) || !Number.isFinite(start) || at < start) return false;
  if (publicKey.validUntil) {
    const end = Date.parse(publicKey.validUntil);
    if (!Number.isFinite(end) || at > end) return false;
  }
  if (publicKey.status === "retired" && publicKey.retiredAt) {
    const retired = Date.parse(publicKey.retiredAt);
    if (Number.isFinite(retired) && at >= retired) return false;
  }
  return publicKey.status === "active" || publicKey.status === "retired";
}

function samePublicKey(a, b) {
  return a?.keyId === b?.keyId
    && a?.ownerId === b?.ownerId
    && a?.algorithm === b?.algorithm
    && a?.fingerprint === b?.fingerprint
    && a?.publicKeySpki === b?.publicKeySpki;
}

async function resolveIdentity(bundle, identityResolver) {
  if (typeof identityResolver !== "function") {
    return {
      check: result(
        VERIFICATION_STATUS.UNVERIFIABLE,
        "No external domain/provider identity resolver was supplied. Signatures can be checked against bundle keys, but domain ownership/publication is not independently established.",
        { source: "bundle-only" },
      ),
      publicKeys: bundle.publicKeys ?? [],
    };
  }

  try {
    const resolved = await identityResolver({
      organization: bundle.organization,
      domainEnvironment: bundle.domainEnvironment,
    });
    if (!resolved || resolved.status !== "verified" || !Array.isArray(resolved.publicKeys)) {
      return {
        check: result(
          resolved?.status === "invalid" ? VERIFICATION_STATUS.INVALID : VERIFICATION_STATUS.UNVERIFIABLE,
          resolved?.detail ?? "Identity resolver did not produce verified public identity material.",
          { source: resolved?.source ?? "external-resolver" },
        ),
        publicKeys: bundle.publicKeys ?? [],
      };
    }

    const bundleKeys = new Map((bundle.publicKeys ?? []).map((key) => [key.keyId, key]));
    const mismatches = resolved.publicKeys.filter((key) => !samePublicKey(key, bundleKeys.get(key.keyId)));
    if (mismatches.length > 0) {
      return {
        check: result(VERIFICATION_STATUS.INVALID, "Externally resolved public keys do not match the keys committed in the evidence bundle.", {
          source: resolved.source ?? "external-resolver",
          mismatchedKeyIds: mismatches.map((key) => key.keyId),
        }),
        publicKeys: resolved.publicKeys,
      };
    }

    return {
      check: result(VERIFICATION_STATUS.VALID, resolved.detail ?? "Public identity material resolved independently and matches the bundle.", {
        source: resolved.source ?? "external-resolver",
        limitation: resolved.limitation ?? null,
      }),
      publicKeys: resolved.publicKeys,
    };
  } catch {
    return {
      check: result(VERIFICATION_STATUS.UNVERIFIABLE, "External identity resolution failed without changing cryptographic evidence results.", {
        source: "external-resolver",
      }),
      publicKeys: bundle.publicKeys ?? [],
    };
  }
}

function verifyReceiptSet(receipts, runSeal, publicKeys) {
  const keys = new Map(publicKeys.map((key) => [key.keyId, key]));
  const all = [...receipts, runSeal];
  const receiptResults = [];
  const failedDigests = new Set();

  for (const receipt of all) {
    const key = keys.get(receipt?.keyId);
    const cryptographic = key
      ? verifySignedReceipt(receipt, key)
      : { valid: false, digestValid: false, signatureValid: false, reasons: ["public-key-not-found"] };
    const keyValidity = key ? validAt(key, receipt?.createdAt) : false;
    const valid = cryptographic.valid && keyValidity;
    if (!valid && receipt?.contentDigest) failedDigests.add(receipt.contentDigest);
    receiptResults.push(Object.freeze({
      receiptId: receipt?.receiptId ?? null,
      type: receipt?.type ?? null,
      contentDigest: receipt?.contentDigest ?? null,
      signerId: receipt?.signerId ?? null,
      keyId: receipt?.keyId ?? null,
      valid,
      digestValid: cryptographic.digestValid === true,
      signatureValid: cryptographic.signatureValid === true,
      keyValidAtEventTime: keyValidity,
      reasons: Object.freeze([
        ...(cryptographic.reasons ?? []),
        ...(!keyValidity ? ["signer-key-not-valid-at-event-time"] : []),
      ]),
    }));
  }

  return { receiptResults, failedDigests };
}

function verifyParentLinks(receipts) {
  const byDigest = new Map(receipts.map((receipt) => [receipt.contentDigest, receipt]));
  const failures = [];
  const expectedParentCount = new Map([
    [RECEIPT_TYPES.ROOT_MANDATE, 0],
    [RECEIPT_TYPES.DELEGATION, 1],
    [RECEIPT_TYPES.ACTION_REQUEST, 1],
    [RECEIPT_TYPES.GATEWAY_DECISION, 1],
    [RECEIPT_TYPES.EXECUTION, 1],
  ]);

  for (const receipt of receipts) {
    const expected = expectedParentCount.get(receipt.type);
    if (expected === undefined) {
      failures.push({ receiptId: receipt.receiptId, reason: "unsupported-receipt-type" });
      continue;
    }
    if (!Array.isArray(receipt.parentDigests) || receipt.parentDigests.length !== expected) {
      failures.push({ receiptId: receipt.receiptId, reason: "unexpected-parent-count" });
      continue;
    }
    for (const digest of receipt.parentDigests) {
      if (!byDigest.has(digest)) failures.push({ receiptId: receipt.receiptId, parentDigest: digest, reason: "missing-parent" });
    }
  }
  return failures;
}

function delegationChecks(receipts) {
  const root = receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ROOT_MANDATE);
  const delegations = receipts.filter((receipt) => receipt.type === RECEIPT_TYPES.DELEGATION);
  const action = receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ACTION_REQUEST);
  const failures = [];
  if (!root || delegations.length === 0 || !action) {
    return { failures: [{ reason: "required-delegation-evidence-missing" }], effectiveAuthority: null };
  }

  let expectedParent = root.contentDigest;
  let expectedFrom = root.claims.firstAgentId;
  let parentMax = Number.isInteger(root.claims?.constraints?.maxRefundCents)
    ? root.claims.constraints.maxRefundCents
    : null;
  let parentActions = Array.isArray(root.claims?.constraints?.permittedActions)
    ? root.claims.constraints.permittedActions
    : null;
  let effectiveAuthority = null;

  for (const delegation of delegations) {
    if (delegation.parentDigests?.[0] !== expectedParent || delegation.claims?.parentDigest !== expectedParent) {
      failures.push({ receiptId: delegation.receiptId, reason: "delegation-parent-mismatch" });
    }
    if (delegation.signerId !== expectedFrom || delegation.claims?.fromAgentId !== expectedFrom) {
      failures.push({ receiptId: delegation.receiptId, reason: "delegator-lineage-mismatch" });
    }
    const childMax = Number.isInteger(delegation.claims?.constraints?.maxRefundCents)
      ? delegation.claims.constraints.maxRefundCents
      : null;
    if (parentMax !== null && (childMax === null || childMax > parentMax)) {
      failures.push({ receiptId: delegation.receiptId, reason: "authority-expanded" });
    }
    const childActions = Array.isArray(delegation.claims?.permittedActions) ? delegation.claims.permittedActions : null;
    if (parentActions && (!childActions || childActions.some((actionName) => !parentActions.includes(actionName)))) {
      failures.push({ receiptId: delegation.receiptId, reason: "actions-expanded" });
    }
    expectedParent = delegation.contentDigest;
    expectedFrom = delegation.claims?.toAgentId;
    parentMax = childMax;
    parentActions = childActions;
    effectiveAuthority = delegation.claims;
  }

  if (action.parentDigests?.[0] !== expectedParent || action.claims?.delegationDigest !== expectedParent) {
    failures.push({ receiptId: action.receiptId, reason: "action-delegation-mismatch" });
  }
  if (action.signerId !== expectedFrom || action.claims?.agentId !== expectedFrom) {
    failures.push({ receiptId: action.receiptId, reason: "action-agent-lineage-mismatch" });
  }

  const requestedAmount = action.claims?.parametersEvidence?.display?.amountCents;
  if (Number.isInteger(requestedAmount) && parentMax !== null && requestedAmount > parentMax) {
    failures.push({ receiptId: action.receiptId, reason: "delegated-limit-exceeded", requestedAmount, maxAmount: parentMax });
  }
  if (parentActions && !parentActions.includes(action.claims?.action)) {
    failures.push({ receiptId: action.receiptId, reason: "action-not-permitted" });
  }

  return { failures, effectiveAuthority };
}

function gatewayBindings(receipts) {
  const action = receipts.find((receipt) => receipt.type === RECEIPT_TYPES.ACTION_REQUEST);
  const decision = receipts.find((receipt) => receipt.type === RECEIPT_TYPES.GATEWAY_DECISION);
  const execution = receipts.find((receipt) => receipt.type === RECEIPT_TYPES.EXECUTION);
  const failures = [];

  if (!action || !decision) return [{ reason: "action-or-gateway-decision-missing" }];
  if (decision.parentDigests?.[0] !== action.contentDigest || decision.claims?.requestDigest !== action.contentDigest) {
    failures.push({ receiptId: decision.receiptId, reason: "decision-request-binding-invalid" });
  }
  if (decision.claims?.decision === "allowed") {
    if (!execution) failures.push({ receiptId: decision.receiptId, reason: "allowed-decision-missing-execution-evidence" });
    if (execution && (execution.parentDigests?.[0] !== decision.contentDigest || execution.claims?.decisionDigest !== decision.contentDigest)) {
      failures.push({ receiptId: execution.receiptId, reason: "execution-decision-binding-invalid" });
    }
  } else if (execution) {
    failures.push({ receiptId: execution.receiptId, reason: "blocked-or-denied-action-has-execution-receipt" });
  }
  return failures;
}

function runSealCheck(receipts, runSeal) {
  if (!runSeal || runSeal.type !== RECEIPT_TYPES.RUN_SEAL) {
    return { valid: false, reason: "run-seal-missing" };
  }
  const actual = [...new Set(receipts.map((receipt) => receipt.contentDigest))].sort();
  const claimed = Array.isArray(runSeal.claims?.receiptDigests)
    ? [...new Set(runSeal.claims.receiptDigests)].sort()
    : [];
  const parents = Array.isArray(runSeal.parentDigests) ? [...new Set(runSeal.parentDigests)].sort() : [];
  const valid = JSON.stringify(actual) === JSON.stringify(claimed) && JSON.stringify(actual) === JSON.stringify(parents);
  return { valid, reason: valid ? null : "run-seal-receipt-set-mismatch", actual, claimed };
}

function computeAffected(receipts, runSeal, failedReceiptIds) {
  const failed = new Set(failedReceiptIds);
  const byId = new Map(receipts.map((receipt) => [receipt.receiptId, receipt]));
  const digestToId = new Map(receipts.map((receipt) => [receipt.contentDigest, receipt.receiptId]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const receipt of receipts) {
      if (failed.has(receipt.receiptId)) continue;
      const parentIds = (receipt.parentDigests ?? []).map((digest) => digestToId.get(digest)).filter(Boolean);
      if (parentIds.some((id) => failed.has(id))) {
        failed.add(receipt.receiptId);
        changed = true;
      }
    }
  }
  const known = [...failed].filter((id) => byId.has(id));
  if (known.length > 0 && runSeal?.receiptId) known.push(runSeal.receiptId);
  return [...new Set(known)];
}

export async function verifyEvidenceBundle(bundle, { identityResolver } = {}) {
  const receipts = Array.isArray(bundle?.receipts) ? bundle.receipts : [];
  const runSeal = bundle?.runSeal ?? null;
  const identity = await resolveIdentity(bundle ?? {}, identityResolver);

  const bundleDigestValid = Boolean(bundle?.bundleDigest)
    && canonicalDigest(unsignedBundle(bundle)) === bundle.bundleDigest;
  const bundleStructureValid = bundle?.version === "proofroot.bundle.v1"
    && Array.isArray(bundle?.publicKeys)
    && Array.isArray(bundle?.receipts)
    && Boolean(runSeal);

  const { receiptResults } = verifyReceiptSet(receipts, runSeal, identity.publicKeys);
  const signatureFailures = receiptResults.filter((entry) => !entry.valid);
  const parentFailures = verifyParentLinks(receipts);
  const delegation = delegationChecks(receipts);
  const gatewayFailures = gatewayBindings(receipts);
  const seal = runSealCheck(receipts, runSeal);

  const checks = Object.freeze({
    identityResolution: identity.check,
    signatureValidity: signatureFailures.length === 0
      ? result(VERIFICATION_STATUS.VALID, "Every receipt signature, content digest, and signer key validity check passed.")
      : result(VERIFICATION_STATUS.INVALID, `${signatureFailures.length} receipt signature/key check(s) failed.`, { failures: signatureFailures }),
    delegationValidity: parentFailures.length === 0 && delegation.failures.filter((failure) => !["delegated-limit-exceeded", "action-not-permitted", "authority-expanded", "actions-expanded"].includes(failure.reason)).length === 0
      ? result(VERIFICATION_STATUS.VALID, "Delegation lineage and causal parent links are internally consistent.")
      : result(VERIFICATION_STATUS.INVALID, "Delegation lineage or parent-link verification failed.", { failures: [...parentFailures, ...delegation.failures] }),
    constraintValidity: delegation.failures.filter((failure) => ["delegated-limit-exceeded", "action-not-permitted", "authority-expanded", "actions-expanded"].includes(failure.reason)).length === 0
      ? result(VERIFICATION_STATUS.VALID, "Delegated authority attenuates correctly and the action remains within the signed constraints.")
      : result(VERIFICATION_STATUS.INVALID, "One or more delegation constraints were violated.", { failures: delegation.failures }),
    gatewayEvidence: gatewayFailures.length === 0
      ? result(VERIFICATION_STATUS.VALID, "Action, gateway decision, and execution evidence are bound consistently.")
      : result(VERIFICATION_STATUS.INVALID, "Gateway evidence binding failed.", { failures: gatewayFailures }),
    bundleIntegrity: bundleStructureValid && bundleDigestValid && seal.valid
      ? result(VERIFICATION_STATUS.VALID, "Bundle digest and Run Seal commit to the included receipt set.")
      : result(VERIFICATION_STATUS.INVALID, "Bundle digest, structure, or Run Seal integrity failed.", {
        bundleStructureValid,
        bundleDigestValid,
        runSealValid: seal.valid,
        runSealReason: seal.reason,
      }),
  });

  const invalidChecks = Object.entries(checks).filter(([, check]) => check.status === VERIFICATION_STATUS.INVALID);
  const unverifiableChecks = Object.entries(checks).filter(([, check]) => check.status === VERIFICATION_STATUS.UNVERIFIABLE);

  const failedReceiptIds = new Set(signatureFailures.map((entry) => entry.receiptId).filter(Boolean));
  for (const failure of [...parentFailures, ...delegation.failures, ...gatewayFailures]) {
    if (failure.receiptId) failedReceiptIds.add(failure.receiptId);
  }
  if (!seal.valid && runSeal?.receiptId) failedReceiptIds.add(runSeal.receiptId);
  const firstFailure = receipts.find((receipt) => failedReceiptIds.has(receipt.receiptId))
    ?? (runSeal && failedReceiptIds.has(runSeal.receiptId) ? runSeal : null);
  const affectedReceiptIds = computeAffected(receipts, runSeal, failedReceiptIds);

  const overallStatus = invalidChecks.length > 0
    ? "failed"
    : unverifiableChecks.length > 0
      ? "evidence-valid-identity-unverifiable"
      : "verified";

  return Object.freeze({
    version: "proofroot.verification.v1",
    overallStatus,
    checks,
    receiptResults: Object.freeze(receiptResults),
    firstFailure: firstFailure ? Object.freeze({
      receiptId: firstFailure.receiptId,
      type: firstFailure.type,
      contentDigest: firstFailure.contentDigest,
    }) : null,
    affectedReceiptIds: Object.freeze(affectedReceiptIds),
    provenClaims: Object.freeze([
      ...(checks.signatureValidity.status === VERIFICATION_STATUS.VALID ? ["receipt-integrity-and-signatures"] : []),
      ...(checks.delegationValidity.status === VERIFICATION_STATUS.VALID ? ["causal-delegation-lineage"] : []),
      ...(checks.constraintValidity.status === VERIFICATION_STATUS.VALID ? ["delegation-constraint-compliance"] : []),
      ...(checks.gatewayEvidence.status === VERIFICATION_STATUS.VALID ? ["gateway-decision-and-effect-binding"] : []),
      ...(checks.bundleIntegrity.status === VERIFICATION_STATUS.VALID ? ["sealed-bundle-integrity"] : []),
      ...(checks.identityResolution.status === VERIFICATION_STATUS.VALID ? ["externally-resolved-identity-binding"] : []),
    ]),
    limitations: Object.freeze([
      ...(checks.identityResolution.status !== VERIFICATION_STATUS.VALID ? ["Identity material was not independently resolved from the configured domain/provider path."] : []),
      "ProofRoot proves signed attribution, delegation evidence, gateway decisions, and observed tool responses; it does not prove legal liability or every external real-world consequence.",
    ]),
  });
}
