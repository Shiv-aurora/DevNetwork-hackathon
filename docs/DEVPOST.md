# ProofRoot — Devpost Copy

## Project name

**ProofRoot**

## Tagline

**The flight recorder for autonomous AI agents.**

## One-line pitch

ProofRoot gives every AI agent a domain-backed identity and turns every delegation and consequential tool call into a signed, independently verifiable chain of custody.

## Inspiration

Multi-agent systems are moving from chat to action. They can issue refunds, write to databases, change infrastructure, contact customers, and delegate work to other agents without a human approving every step.

That creates a basic incident question that ordinary logs do not answer strongly enough:

> Which agent requested this action, who gave it authority, what limits applied, what actually reached the tool boundary, and was the evidence changed afterward?

ProofRoot started from the idea that agent accountability needs two things ordinary application logs often blur together:

1. signed evidence of what agents were authorized to request;
2. separate evidence from the credential-holding boundary about what the system actually allowed and observed.

## What it does

ProofRoot is an accountability layer for multi-agent systems.

An organization establishes an identity root under a name.com-managed domain. The public identity material describes the organization, its agent identities, their public signing keys, status, and validity periods.

When agents work:

- the organization signs a Root Mandate;
- every agent-to-agent handoff creates a signed Delegation Receipt;
- the final agent signs an Action Request Receipt;
- the Proof Gateway independently verifies identity evidence, the complete delegation lineage, signatures, expiry, authority attenuation, action scope, exact parameters, and replay state;
- only an allowed action reaches the protected tool;
- the Gateway signs what it allowed or blocked and what response it observed;
- a separate verifier reconstructs the run from the evidence rather than trusting a stored UI status.

The result is a causal chain a judge can read:

```text
Organization → Triage → Billing → Refund → Proof Gateway → Refund Tool
```

## Demo

Our golden scenario is support case `#194`:

> Refund a confirmed duplicate charge only if the amount is no more than `$100`.

Three agents participate:

- **Triage Agent** routes the support case;
- **Billing Agent** confirms the controlled duplicate-charge fixture;
- **Refund Agent** may request a refund but cannot call the protected tool directly.

In the valid run, Billing delegates a `$100` cap and Refund requests `$85`. The Proof Gateway verifies the signed chain and the deterministic protected refund tool confirms transaction:

```text
sim-refund-194-usd-8500
```

At least one material routing decision is model-driven through Groq in the deployed configuration. A clearly labeled deterministic fallback keeps the recorded path reproducible if the model provider is temporarily unavailable.

## Three demo moments

### 1. Domain → agent accountability root

ProofRoot uses name.com for domain discovery/provisioning and identity-related DNS lifecycle, including the organization root TXT record, manifest locator, and per-agent records.

The domain is not just branding. It is the organization-controlled namespace from which the verifier discovers who is claiming these agent identities.

### 2. Opaque swarm → signed chain of custody

Every consequential transition is signed and causally linked.

The interface makes two facts visibly separate:

- **Agent requested:** refund `$85`.
- **Gateway confirmed:** protected tool returned transaction `sim-refund-194-usd-8500`.

### 3. Break authority or history → exact failure

**Authority attack:** Refund Agent requests `$850` under a signed `$100` cap.

Result:

> **BLOCKED BEFORE EXECUTION**

The protected tool is never called and the signed denial becomes evidence.

**History attack:** take the real successful `$85` run and modify the stored Action Request to display `$850`.

Result:

> **VERIFICATION FAILED**

The verifier finds the exact altered receipt and marks downstream dependent evidence affected.

## Why name.com is indispensable

Without the domain layer, ProofRoot would need to operate a proprietary central registry mapping agent identifiers to organizations and public keys. A verifier would have to trust that ProofRoot-controlled directory before it could even begin checking the evidence.

With name.com, the organization controls the namespace under which its ProofRoot identity locator is published.

The hackathon integration uses the name.com CORE API across:

- authenticated environment checks;
- domain search;
- availability;
- sandbox provisioning;
- managed-domain listing;
- DNS record creation;
- DNS record listing;
- DNS record update;
- DNS record deletion/retirement;
- identity-record reconciliation.

### Sandbox disclosure

The official name.com sandbox stores DNS records but does not publish them to public DNS.

When the demo uses sandbox, ProofRoot explicitly labels the mode:

**Name.com Sandbox / Provider-Backed Verification**

In that mode the verifier obtains the root TXT record from the real name.com API and follows its locator to the real public HTTPS identity manifest. ProofRoot does not pretend that the sandbox hostname itself resolves publicly.

If an existing production name.com-managed domain is used, ProofRoot can instead resolve the public `_proofroot.<domain>` TXT record.

## How we built it

ProofRoot is a Next.js/React application with a Node.js cryptographic and verification core.

### Identity

- separate Ed25519 identities for the organization, three agents, and Proof Gateway;
- signed organization identity manifest;
- SHA-256 public-key fingerprints;
- persistent deployment keys held only in secret environment variables;
- name.com-backed identity discovery.

### Evidence

ProofRoot implements six signed evidence types:

1. Root Mandate
2. Delegation Receipt
3. Action Request Receipt
4. Gateway Decision Receipt
5. Execution Receipt
6. Run Seal

Evidence uses deterministic canonical JSON and SHA-256 content digests so material changes invalidate the original signature.

### Gateway

The Proof Gateway verifies:

- request signature;
- key validity;
- complete delegation chain;
- causal parent hashes;
- expiry;
- authority attenuation;
- permitted action;
- refund amount cap;
- signed-vs-actual tool parameters;
- one-time replay state.

Only then can it call the protected tool.

### Independent verifier

The verifier reports six separate results rather than one trust score:

- identity resolution;
- signature validity;
- delegation validity;
- constraint validity;
- Gateway evidence;
- bundle integrity.

It also localizes the first broken receipt and downstream evidence affected by that failure.

### AI

Groq is the primary deployed model provider for the Triage routing decision. The response is constrained to validated structured JSON and raw model chain-of-thought is never requested or stored as evidence.

## Challenges we ran into

### Separating intent from effect

An agent signing “I issued a refund” is weak evidence because the agent itself does not independently prove what the external tool did. The architecture became much stronger once we separated agent-signed intent from Gateway-signed boundary evidence.

### Sandbox honesty

The name.com sandbox lets us create and manage DNS record state but those records do not resolve publicly. Instead of faking a DNS success badge, ProofRoot has an explicit provider-backed sandbox mode and keeps production public-DNS claims separate.

### Key continuity

Per-run keys are useful during development, but they cannot support a domain-backed identity claim if the domain publishes different keys. The deployed architecture therefore loads persistent private keys from secrets and cryptographically checks that they match the signed public manifest before signing any run evidence.

### Making cryptography understandable

A screen full of hashes would lose most judges. We made the causal graph the primary interface and kept raw receipts available behind evidence drawers for technical inspection.

## Accomplishments

- Complete signed multi-agent causal chain.
- Distinct cryptographic identity for every agent and Gateway.
- Deterministic Proof Gateway enforcement instead of passive logging.
- Valid `$85` action and live `$850` authority block using the same code path.
- Real evidence mutation causing cryptographic verification failure.
- Exact first-failure and downstream-impact localization.
- name.com domain/DNS lifecycle integrated into the actual identity architecture.
- Persistent deployment-key continuity without committing private material.
- Independent verification that separates identity, signatures, authorization constraints, Gateway evidence, and bundle integrity.

## What we learned

The biggest lesson was that “agent accountability” becomes much more concrete when the architecture stops trying to prove the model’s internal intent.

We do not need chain-of-thought to answer the important operational questions. We need signed authority, deterministic enforcement at the credential boundary, observed tool evidence, and a verifier that can reconstruct the chain later.

We also learned that identity and trust must remain separate. A domain and a valid signature can establish attribution. They do not prove that the operator is safe, correct, or legally responsible.

## What's next

After the hackathon P0 path is stable, the natural extensions are:

- agent/key rotation while preserving historical verification;
- standalone downloadable verification bundles/CLI;
- stronger replay persistence for horizontally scaled gateways;
- MCP tool adapter behind the Proof Gateway;
- additional consequential action types;
- optional DNSSEC validation when genuinely configured;
- external witness/transparency anchoring.

Those are intentionally secondary to making the core demo reliable and defensible.

## Built with

- Next.js
- React
- Node.js
- Ed25519 / SHA-256
- name.com CORE API
- Groq API
- Vercel
- GitHub Actions

## Security claims and limitations

ProofRoot demonstrates verifiable attribution, bounded delegation, Gateway enforcement evidence, observed tool-response evidence, run-bundle integrity, and tamper detection.

It does not claim to determine legal liability, prove a human personally approved an action, reveal a model's hidden reasoning, make a domain owner trustworthy, provide DNSSEC when DNSSEC is absent, prove every external real-world consequence, or replace OAuth/IAM/MCP authorization.
