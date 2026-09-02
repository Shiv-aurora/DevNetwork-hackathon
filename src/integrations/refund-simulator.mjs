function normalizeCaseId(caseId) {
  return String(caseId).replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function executeDeterministicRefund({ caseId, amountCents, currency = "USD" }) {
  if (!caseId) throw new Error("caseId is required");
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be a positive integer");
  }

  return Object.freeze({
    provider: "ProofRoot deterministic refund simulator",
    simulated: true,
    status: "confirmed",
    transactionId: `sim-refund-${normalizeCaseId(caseId)}-${currency.toLowerCase()}-${amountCents}`,
    caseId: String(caseId),
    amountCents,
    currency,
  });
}
