import { canonicalize, canonicalDigest } from "../crypto/canonical-json.mjs";
import { signCanonicalBytes, verifyCanonicalBytes } from "../crypto/keys.mjs";

export const RECEIPT_TYPES = Object.freeze({
  ROOT_MANDATE: "root-mandate",
  DELEGATION: "delegation-receipt",
  ACTION_REQUEST: "action-request-receipt",
  GATEWAY_DECISION: "gateway-decision-receipt",
  EXECUTION: "execution-receipt",
  RUN_SEAL: "run-seal",
});

const FORBIDDEN_EVIDENCE_KEYS = new Set([
  "chainofthought",
  "rawreasoning",
  "hiddenreasoning",
  "modelchainofthought",
]);

function normalizedKey(key) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function assertNoPrivateReasoning(value, path = "claims") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPrivateReasoning(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_KEYS.has(normalizedKey(key))) {
      throw new Error(`Private model reasoning field '${path}.${key}' is forbidden in ProofRoot evidence.`);
    }
    assertNoPrivateReasoning(child, `${path}.${key}`);
  }
}

function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${field} is required.`);
}

function unsignedReceipt(receipt) {
  const { contentDigest: _digest, signature: _signature, ...unsigned } = receipt;
  return unsigned;
}

export function redactedDigest(value) {
  return Object.freeze({ redacted: true, digest: canonicalDigest(value) });
}

export function createSignedReceipt({
  type,
  receiptId,
  runId,
  createdAt,
  nonce,
  signerId,
  keyId,
  parentDigests = [],
  claims,
  privateKey,
}) {
  for (const [field, value] of Object.entries({ type, receiptId, runId, createdAt, nonce, signerId, keyId })) {
    requireString(value, field);
  }
  if (!Object.values(RECEIPT_TYPES).includes(type)) throw new Error(`Unsupported receipt type '${type}'.`);
  if (!Array.isArray(parentDigests) || parentDigests.some((digest) => typeof digest !== "string")) {
    throw new Error("parentDigests must be an array of digest strings.");
  }
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new Error("claims must be an object.");
  if (!privateKey) throw new Error("privateKey is required to sign a receipt.");

  assertNoPrivateReasoning(claims);

  const unsigned = {
    version: "proofroot.receipt.v1",
    type,
    receiptId,
    runId,
    createdAt,
    nonce,
    signerId,
    keyId,
    parentDigests: [...parentDigests],
    claims,
  };

  const canonical = canonicalize(unsigned);
  return Object.freeze({
    ...unsigned,
    contentDigest: canonicalDigest(unsigned),
    signature: Object.freeze({
      algorithm: "Ed25519",
      value: signCanonicalBytes(privateKey, canonical),
    }),
  });
}

export function verifySignedReceipt(receipt, publicKeyRecord) {
  const reasons = [];
  if (!receipt || receipt.version !== "proofroot.receipt.v1") reasons.push("unsupported-receipt-version");
  if (!receipt?.contentDigest) reasons.push("missing-content-digest");
  if (!receipt?.signature?.value) reasons.push("missing-signature");
  if (receipt?.keyId !== publicKeyRecord?.keyId) reasons.push("key-id-mismatch");
  if (receipt?.signerId !== publicKeyRecord?.ownerId) reasons.push("signer-owner-mismatch");

  let digestValid = false;
  let signatureValid = false;
  try {
    const unsigned = unsignedReceipt(receipt);
    digestValid = canonicalDigest(unsigned) === receipt.contentDigest;
    signatureValid = verifyCanonicalBytes(publicKeyRecord, canonicalize(unsigned), receipt.signature?.value ?? "");
  } catch {
    reasons.push("malformed-receipt");
  }

  if (!digestValid) reasons.push("content-digest-mismatch");
  if (!signatureValid) reasons.push("signature-invalid");

  return Object.freeze({
    valid: reasons.length === 0,
    digestValid,
    signatureValid,
    reasons: Object.freeze([...new Set(reasons)]),
  });
}

function signerFields(signer) {
  if (!signer?.signerId || !signer?.keyId || !signer?.privateKey) throw new Error("Complete signer material is required.");
  return signer;
}

export function createRootMandate({ receiptId, runId, createdAt, nonce, principalId, firstAgentId, task, constraints, validUntil, signer }) {
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.ROOT_MANDATE,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: [],
    claims: { principalId, firstAgentId, task, constraints, validUntil },
  });
}

export function createDelegationReceipt({ receiptId, runId, createdAt, nonce, fromAgentId, toAgentId, parentDigest, purpose, permittedActions, constraints, expiresAt, signer }) {
  requireString(parentDigest, "parentDigest");
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.DELEGATION,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: [parentDigest],
    claims: { fromAgentId, toAgentId, parentDigest, purpose, permittedActions, constraints, expiresAt },
  });
}

export function createActionRequestReceipt({ receiptId, runId, createdAt, nonce, agentId, delegationDigest, tool, action, parametersEvidence, expectedEffect, signer }) {
  requireString(delegationDigest, "delegationDigest");
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.ACTION_REQUEST,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: [delegationDigest],
    claims: { agentId, delegationDigest, tool, action, parametersEvidence, expectedEffect },
  });
}

export function createGatewayDecisionReceipt({ receiptId, runId, createdAt, nonce, requestDigest, decision, checks, reasonCodes, signer }) {
  requireString(requestDigest, "requestDigest");
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.GATEWAY_DECISION,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: [requestDigest],
    claims: { requestDigest, decision, checks, reasonCodes },
  });
}

export function createExecutionReceipt({ receiptId, runId, createdAt, nonce, decisionDigest, tool, toolRequestEvidence, toolResponseEvidence, effectStatus, transactionId, signer }) {
  requireString(decisionDigest, "decisionDigest");
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.EXECUTION,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: [decisionDigest],
    claims: { decisionDigest, tool, toolRequestEvidence, toolResponseEvidence, effectStatus, transactionId },
  });
}

export function createRunSeal({ receiptId, runId, createdAt, nonce, receiptDigests, signer }) {
  if (!Array.isArray(receiptDigests) || receiptDigests.length === 0) throw new Error("receiptDigests must contain at least one receipt digest.");
  const normalized = [...new Set(receiptDigests)].sort();
  const s = signerFields(signer);
  return createSignedReceipt({
    type: RECEIPT_TYPES.RUN_SEAL,
    receiptId, runId, createdAt, nonce,
    signerId: s.signerId, keyId: s.keyId, privateKey: s.privateKey,
    parentDigests: normalized,
    claims: { receiptDigests: normalized },
  });
}
