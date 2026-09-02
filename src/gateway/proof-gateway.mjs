import { randomUUID } from "node:crypto";

import { canonicalDigest } from "../crypto/canonical-json.mjs";
import {
  createExecutionReceipt,
  createGatewayDecisionReceipt,
  redactedDigest,
  RECEIPT_TYPES,
  verifySignedReceipt,
} from "../evidence/receipts.mjs";

export const GATEWAY_REASON_CODES = Object.freeze({
  ALL_CHECKS_PASSED: "ALL_CHECKS_PASSED",
  REQUEST_SIGNATURE_INVALID: "REQUEST_SIGNATURE_INVALID",
  SIGNER_KEY_INVALID: "SIGNER_KEY_INVALID",
  ROOT_EXPIRED: "ROOT_EXPIRED",
  DELEGATION_EXPIRED: "DELEGATION_EXPIRED",
  PARENT_LINK_INVALID: "PARENT_LINK_INVALID",
  DELEGATION_CHAIN_INVALID: "DELEGATION_CHAIN_INVALID",
  AUTHORITY_EXPANSION: "AUTHORITY_EXPANSION",
  ACTION_NOT_PERMITTED: "ACTION_NOT_PERMITTED",
  DELEGATED_LIMIT_EXCEEDED: "DELEGATED_LIMIT_EXCEEDED",
  PARAMETERS_EVIDENCE_MISMATCH: "PARAMETERS_EVIDENCE_MISMATCH",
  REPLAY_DETECTED: "REPLAY_DETECTED",
  TOOL_MISMATCH: "TOOL_MISMATCH",
  PROTECTED_TOOL_FAILED: "PROTECTED_TOOL_FAILED",
});

export class ReplayStore {
  #consumed = new Set();

  consume(nonce) {
    if (this.#consumed.has(nonce)) return false;
    this.#consumed.add(nonce);
    return true;
  }

  has(nonce) {
    return this.#consumed.has(nonce);
  }

  reset() {
    this.#consumed.clear();
  }
}

function isoTime(value, field) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${field} must be a valid ISO timestamp.`);
  return time;
}

function keyValidAt(record, timestamp) {
  if (!record) return false;
  const eventTime = isoTime(timestamp, "receipt.createdAt");
  if (eventTime < isoTime(record.validFrom, "key.validFrom")) return false;
  if (record.validUntil && eventTime > isoTime(record.validUntil, "key.validUntil")) return false;
  if (record.status === "suspended") return false;
  if (record.status === "retired" && record.retiredAt && eventTime >= isoTime(record.retiredAt, "key.retiredAt")) return false;
  return record.status === "active" || record.status === "retired";
}

function receiptCheck(receipt, publicKeysById) {
  const publicKey = publicKeysById.get(receipt?.keyId);
  const signature = publicKey ? verifySignedReceipt(receipt, publicKey) : { valid: false };
  return {
    publicKey,
    signatureValid: signature.valid === true,
    keyValid: publicKey ? keyValidAt(publicKey, receipt.createdAt) : false,
  };
}

function maxRefundFrom(authority) {
  const value = authority?.constraints?.maxRefundCents;
  return Number.isInteger(value) ? value : null;
}

function actionsFrom(authority) {
  const direct = authority?.permittedActions;
  if (Array.isArray(direct)) return direct;
  const constrained = authority?.constraints?.permittedActions;
  return Array.isArray(constrained) ? constrained : null;
}

function isSubset(child, parent) {
  if (!parent) return true;
  if (!child) return false;
  const parentSet = new Set(parent);
  return child.every((value) => parentSet.has(value));
}

function verifyDelegationLineage({ rootMandate, delegations, actionRequest, publicKeysById, now }) {
  const reasons = [];
  const details = [];

  if (rootMandate?.type !== RECEIPT_TYPES.ROOT_MANDATE || actionRequest?.type !== RECEIPT_TYPES.ACTION_REQUEST) {
    reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
    return { valid: false, reasons, details, effectiveAuthority: null };
  }

  const rootCheck = receiptCheck(rootMandate, publicKeysById);
  details.push({ receiptId: rootMandate.receiptId, ...rootCheck });
  if (!rootCheck.signatureValid) reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
  if (!rootCheck.keyValid) reasons.push(GATEWAY_REASON_CODES.SIGNER_KEY_INVALID);
  if (isoTime(now, "now") > isoTime(rootMandate.claims.validUntil, "root.validUntil")) {
    reasons.push(GATEWAY_REASON_CODES.ROOT_EXPIRED);
  }

  let expectedParentDigest = rootMandate.contentDigest;
  let expectedFromAgent = rootMandate.claims.firstAgentId;
  let parentAuthority = {
    constraints: rootMandate.claims.constraints ?? {},
    permittedActions: actionsFrom(rootMandate.claims),
  };

  for (const delegation of delegations) {
    const check = receiptCheck(delegation, publicKeysById);
    details.push({ receiptId: delegation?.receiptId, ...check });

    if (delegation?.type !== RECEIPT_TYPES.DELEGATION || !check.signatureValid) {
      reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
    }
    if (!check.keyValid) reasons.push(GATEWAY_REASON_CODES.SIGNER_KEY_INVALID);
    if (delegation?.signerId !== delegation?.claims?.fromAgentId || delegation?.claims?.fromAgentId !== expectedFromAgent) {
      reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
    }
    if (delegation?.claims?.parentDigest !== expectedParentDigest || delegation?.parentDigests?.[0] !== expectedParentDigest) {
      reasons.push(GATEWAY_REASON_CODES.PARENT_LINK_INVALID);
    }
    if (isoTime(now, "now") > isoTime(delegation.claims.expiresAt, "delegation.expiresAt")) {
      reasons.push(GATEWAY_REASON_CODES.DELEGATION_EXPIRED);
    }

    const parentMax = maxRefundFrom(parentAuthority);
    const childMax = maxRefundFrom(delegation.claims);
    if (parentMax !== null && (childMax === null || childMax > parentMax)) {
      reasons.push(GATEWAY_REASON_CODES.AUTHORITY_EXPANSION);
    }
    if (!isSubset(actionsFrom(delegation.claims), actionsFrom(parentAuthority))) {
      reasons.push(GATEWAY_REASON_CODES.AUTHORITY_EXPANSION);
    }

    parentAuthority = delegation.claims;
    expectedParentDigest = delegation.contentDigest;
    expectedFromAgent = delegation.claims.toAgentId;
  }

  if (delegations.length === 0) reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
  if (actionRequest.claims.delegationDigest !== expectedParentDigest || actionRequest.parentDigests?.[0] !== expectedParentDigest) {
    reasons.push(GATEWAY_REASON_CODES.PARENT_LINK_INVALID);
  }
  if (actionRequest.claims.agentId !== expectedFromAgent || actionRequest.signerId !== expectedFromAgent) {
    reasons.push(GATEWAY_REASON_CODES.DELEGATION_CHAIN_INVALID);
  }

  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
    details,
    effectiveAuthority: parentAuthority,
  };
}

function requestEvidenceMatches(actionRequest, toolRequest) {
  const evidence = actionRequest?.claims?.parametersEvidence;
  if (evidence?.redacted === true && typeof evidence.digest === "string") {
    return evidence.digest === canonicalDigest(toolRequest);
  }
  return canonicalDigest(evidence) === canonicalDigest(toolRequest);
}

function decisionForReasons(reasons) {
  const policyReasons = new Set([
    GATEWAY_REASON_CODES.AUTHORITY_EXPANSION,
    GATEWAY_REASON_CODES.ACTION_NOT_PERMITTED,
    GATEWAY_REASON_CODES.DELEGATED_LIMIT_EXCEEDED,
  ]);
  return reasons.some((reason) => policyReasons.has(reason)) ? "blocked" : "denied";
}

function receiptIdentity(prefix, idFactory) {
  return `${prefix}_${idFactory()}`;
}

export async function evaluateProtectedAction({
  rootMandate,
  delegations,
  actionRequest,
  publicKeys,
  gatewaySigner,
  toolRequest,
  protectedTool,
  protectedToolName = "refund-simulator",
  protectedAction = "refund.create",
  replayStore = new ReplayStore(),
  now = new Date().toISOString(),
  idFactory = randomUUID,
}) {
  if (!gatewaySigner?.signerId || !gatewaySigner?.keyId || !gatewaySigner?.privateKey) {
    throw new Error("gatewaySigner is required.");
  }
  if (typeof protectedTool !== "function") throw new Error("protectedTool must be a function.");
  if (!Array.isArray(publicKeys)) throw new Error("publicKeys must be an array.");

  const publicKeysById = new Map(publicKeys.map((record) => [record.keyId, record]));
  const reasons = [];
  const checks = {
    requestSignature: false,
    requesterKey: false,
    delegationChain: false,
    parentLinks: false,
    authorityAttenuation: false,
    actionPermitted: false,
    amountWithinLimit: false,
    parametersBound: false,
    replayFresh: false,
    toolMatches: false,
  };

  const requestCheck = receiptCheck(actionRequest, publicKeysById);
  checks.requestSignature = requestCheck.signatureValid;
  checks.requesterKey = requestCheck.keyValid;
  if (!requestCheck.signatureValid) reasons.push(GATEWAY_REASON_CODES.REQUEST_SIGNATURE_INVALID);
  if (!requestCheck.keyValid) reasons.push(GATEWAY_REASON_CODES.SIGNER_KEY_INVALID);

  const lineage = verifyDelegationLineage({ rootMandate, delegations, actionRequest, publicKeysById, now });
  reasons.push(...lineage.reasons);
  checks.delegationChain = lineage.valid;
  checks.parentLinks = !lineage.reasons.includes(GATEWAY_REASON_CODES.PARENT_LINK_INVALID);
  checks.authorityAttenuation = !lineage.reasons.includes(GATEWAY_REASON_CODES.AUTHORITY_EXPANSION);

  checks.toolMatches = actionRequest?.claims?.tool === protectedToolName
    && actionRequest?.claims?.action === protectedAction;
  if (!checks.toolMatches) reasons.push(GATEWAY_REASON_CODES.TOOL_MISMATCH);

  const permittedActions = actionsFrom(lineage.effectiveAuthority);
  checks.actionPermitted = Array.isArray(permittedActions) && permittedActions.includes(protectedAction);
  if (!checks.actionPermitted) reasons.push(GATEWAY_REASON_CODES.ACTION_NOT_PERMITTED);

  const maxRefundCents = maxRefundFrom(lineage.effectiveAuthority);
  checks.amountWithinLimit = Number.isInteger(toolRequest?.amountCents)
    && maxRefundCents !== null
    && toolRequest.amountCents <= maxRefundCents;
  if (!checks.amountWithinLimit) reasons.push(GATEWAY_REASON_CODES.DELEGATED_LIMIT_EXCEEDED);

  checks.parametersBound = requestEvidenceMatches(actionRequest, toolRequest);
  if (!checks.parametersBound) reasons.push(GATEWAY_REASON_CODES.PARAMETERS_EVIDENCE_MISMATCH);

  const evidenceValidBeforeReplay = requestCheck.signatureValid
    && requestCheck.keyValid
    && lineage.valid
    && checks.parametersBound;
  checks.replayFresh = evidenceValidBeforeReplay ? replayStore.consume(actionRequest.nonce) : false;
  if (evidenceValidBeforeReplay && !checks.replayFresh) reasons.push(GATEWAY_REASON_CODES.REPLAY_DETECTED);

  const uniqueReasons = [...new Set(reasons)];
  const allowed = uniqueReasons.length === 0;
  const decision = allowed ? "allowed" : decisionForReasons(uniqueReasons);
  const decisionReceipt = createGatewayDecisionReceipt({
    receiptId: receiptIdentity("receipt_decision", idFactory),
    runId: actionRequest.runId,
    createdAt: now,
    nonce: receiptIdentity("nonce_decision", idFactory),
    requestDigest: actionRequest.contentDigest,
    decision,
    checks,
    reasonCodes: allowed ? [GATEWAY_REASON_CODES.ALL_CHECKS_PASSED] : uniqueReasons,
    signer: gatewaySigner,
  });

  if (!allowed) {
    return Object.freeze({
      outcome: decision,
      checks: Object.freeze({ ...checks }),
      reasonCodes: Object.freeze(uniqueReasons),
      decisionReceipt,
      executionReceipt: null,
      toolResult: null,
    });
  }

  try {
    const toolResult = await protectedTool(toolRequest);
    const effectStatus = toolResult?.status === "confirmed" ? "confirmed" : "dispatched";
    const executionReceipt = createExecutionReceipt({
      receiptId: receiptIdentity("receipt_execution", idFactory),
      runId: actionRequest.runId,
      createdAt: now,
      nonce: receiptIdentity("nonce_execution", idFactory),
      decisionDigest: decisionReceipt.contentDigest,
      tool: protectedToolName,
      toolRequestEvidence: redactedDigest(toolRequest),
      toolResponseEvidence: redactedDigest(toolResult),
      effectStatus,
      transactionId: toolResult?.transactionId ?? null,
      signer: gatewaySigner,
    });
    return Object.freeze({
      outcome: effectStatus,
      checks: Object.freeze({ ...checks }),
      reasonCodes: Object.freeze([GATEWAY_REASON_CODES.ALL_CHECKS_PASSED]),
      decisionReceipt,
      executionReceipt,
      toolResult,
    });
  } catch {
    const executionReceipt = createExecutionReceipt({
      receiptId: receiptIdentity("receipt_execution", idFactory),
      runId: actionRequest.runId,
      createdAt: now,
      nonce: receiptIdentity("nonce_execution", idFactory),
      decisionDigest: decisionReceipt.contentDigest,
      tool: protectedToolName,
      toolRequestEvidence: redactedDigest(toolRequest),
      toolResponseEvidence: redactedDigest({ error: "protected-tool-failed" }),
      effectStatus: "failed",
      transactionId: null,
      signer: gatewaySigner,
    });
    return Object.freeze({
      outcome: "failed",
      checks: Object.freeze({ ...checks }),
      reasonCodes: Object.freeze([GATEWAY_REASON_CODES.PROTECTED_TOOL_FAILED]),
      decisionReceipt,
      executionReceipt,
      toolResult: null,
    });
  }
}
