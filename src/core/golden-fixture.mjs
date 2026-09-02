import { DEMO_CONTRACT } from "./demo-contract.mjs";
import { createProofRootState } from "./domain-model.mjs";

export const DEMO_SCENARIOS = Object.freeze({
  VALID: "valid",
  AUTHORITY_ATTACK: "authority-attack",
  TAMPER_ATTACK: "tamper-attack",
});

const AGENTS = Object.freeze([
  { id: "agent_triage", name: "Triage Agent", role: "Support routing and case interpretation" },
  { id: "agent_billing", name: "Billing Agent", role: "Transaction investigation and duplicate-charge decision" },
  { id: "agent_refund", name: "Refund Agent", role: "Bounded refund request generation" },
  { id: "gateway_proof", name: "Proof Gateway", role: "Deterministic authorization and protected-tool boundary" },
]);

export function createGoldenFixture({ scenario = DEMO_SCENARIOS.VALID } = {}) {
  if (!Object.values(DEMO_SCENARIOS).includes(scenario)) {
    throw new Error(`Unknown demo scenario '${scenario}'.`);
  }

  return createProofRootState({
    fixtureVersion: "golden.v1",
    scenario,
    organization: {
      id: "org_acme_support",
      name: "Acme Support",
      status: "requested",
    },
    domainEnvironment: {
      provider: "name.com",
      environment: "sandbox",
      identityMode: "Name.com Sandbox / Provider-Backed Verification",
      status: "unverifiable",
      publicDnsAvailable: false,
      limitation: "External name.com authentication is still required before provider-backed identity claims can verify.",
    },
    organizationIdentityRoot: {
      id: "root_acme_support",
      status: "requested",
      fingerprint: null,
      manifestUrl: null,
    },
    agentIdentities: AGENTS.map((agent) => ({
      ...agent,
      status: "requested",
      keyId: null,
      publicKeyFingerprint: null,
    })),
    runs: [{
      id: `run_case_${DEMO_CONTRACT.supportCaseId}`,
      supportCaseId: DEMO_CONTRACT.supportCaseId,
      status: "requested",
      scenario,
      task: `Resolve support case #${DEMO_CONTRACT.supportCaseId}. Refund a confirmed duplicate charge only if the amount is no more than $100.`,
      requestedAmountCents: scenario === DEMO_SCENARIOS.AUTHORITY_ATTACK
        ? DEMO_CONTRACT.authorityAttackAmountCents
        : DEMO_CONTRACT.validRefundAmountCents,
      delegatedLimitCents: DEMO_CONTRACT.delegatedRefundLimitCents,
    }],
    verificationReports: [{
      id: `verification_${scenario}`,
      runId: `run_case_${DEMO_CONTRACT.supportCaseId}`,
      status: "unverifiable",
      checks: {
        identityResolution: "unverifiable",
        signatureValidity: "unverifiable",
        delegationValidity: "unverifiable",
        constraintValidity: "unverifiable",
        gatewayEvidence: "unverifiable",
        bundleIntegrity: "unverifiable",
      },
      reason: "Foundation fixture only; signed evidence is introduced in later phases.",
    }],
  });
}
