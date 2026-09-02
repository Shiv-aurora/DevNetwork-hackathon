# ProofRoot Demo Plan

Target recording length: **2:45–3:30**.

The video should show the product working. Do not spend the first minute explaining cryptography.

## Before recording

Confirm the deployed smoke test passes with live expectations enabled:

```bash
PROOFROOT_DEPLOYMENT_URL=https://<deployment> \
EXPECT_NAMECOM_LIVE=1 \
EXPECT_GROQ_LIVE=1 \
EXPECT_PERSISTENT_IDENTITY=1 \
npm run smoke:deployed
```

Then open a clean browser session at the deployed URL.

Required visible environment state:

- correct name.com environment;
- name.com authenticated;
- configured ProofRoot domain;
- persistent signing identity configured;
- Groq configured/model-driven;
- no browser-console errors.

---

## 0:00–0:15 — Problem

### Spoken

> “Three AI agents just issued a refund. Your logs say what happened—but can you prove which agent authorized each step, what limits it had, and whether the record was changed afterward?”

### Screen

Start on the ProofRoot overview.

Show the one-line product idea:

> **The flight recorder for autonomous AI agents.**

Do not open raw evidence yet.

---

## 0:15–0:45 — Wow 1: Domain → accountability root

### Screen

Open **Domain**.

Show:

- name.com environment;
- authenticated provider status;
- selected domain;
- managed-domain or DNS record response;
- explicit sandbox label if sandbox is used.

Then open **Organization** / **Agents**.

Show:

- organization root fingerprint;
- signed manifest state;
- distinct Triage/Billing/Refund/Gateway key IDs/fingerprints.

### Spoken

> “Instead of using a domain only as a website address, ProofRoot uses a name.com-controlled namespace as the root for the organization’s agent identities. In sandbox mode these records are verified through name.com’s provider state; I’m not pretending they resolve publicly.”

If production public DNS is genuinely configured, replace the last sentence with the verified public-DNS behavior.

---

## 0:45–1:35 — Wow 2: Watch authority move

### Screen

Open **Live Run** and click **Run valid workflow**.

Let the causal graph populate/show the complete chain:

```text
Organization → Triage → Billing → Refund → Proof Gateway → Refund Tool
```

Highlight:

- `$85` requested;
- `$100` delegated cap;
- Triage route is Groq model-driven;
- signed delegation edges;
- Gateway `allowed` decision;
- protected tool transaction `sim-refund-194-usd-8500`;
- effect `confirmed`.

Then show the verification cards.

### Spoken

> “The organization signs the task. Triage uses Groq to route the duplicate-charge case. Billing verifies the controlled transaction fixture and delegates refund authority capped at one hundred dollars. Refund signs an eighty-five-dollar request. The agent does not have the protected-tool credential—the Proof Gateway does.”

> “The Gateway independently verifies the signatures, delegation chain, expiry, authority limits, exact parameters and replay state before it calls the tool. The agent signs what it wanted to do; the Gateway separately signs what it allowed and observed.”

Keep raw JSON closed unless a technical judge asks for it.

---

## 1:35–2:00 — Independent verification

### Screen

Open **Verify** or use the verification report already shown.

Show the six separate checks:

1. Identity resolution
2. Signature validity
3. Delegation validity
4. Constraint validity
5. Gateway evidence
6. Bundle integrity

### Spoken

> “This isn’t a green badge stored by the app. The verifier re-resolves identity material and recomputes the signatures, causal links, authority constraints, Gateway bindings and Run Seal.”

> “Identity, authorization and trust are kept separate. A valid signature does not mean the actor is trustworthy.”

---

## 2:00–2:30 — Wow 3A: Authority attack

### Screen

Open **Attack Lab**.

Click **Run authority attack**.

Required visible result:

```text
BLOCKED BEFORE EXECUTION
Requested: $850
Signed cap: $100
Protected tool calls: 0
Transaction created: no
```

Show the signed blocked-decision receipt briefly.

### Spoken

> “Now the exact same Refund Agent asks for eight hundred fifty dollars under its signed hundred-dollar authority. ProofRoot blocks it before the protected tool is called, and even the denial becomes signed evidence.”

---

## 2:30–3:00 — Wow 3B: History attack

### Screen

Click **Run tamper attack**.

Required visible result:

```text
VERIFICATION FAILED
Original: $85
Tampered: $850
```

Show:

- exact broken Action Request receipt;
- signature/content failure;
- affected downstream evidence.

### Spoken

> “Finally I take a real successful run and change the stored request from eighty-five dollars to eight hundred fifty. I don’t tell the verifier where I changed it. It recomputes the evidence, finds the exact broken receipt, and marks every dependent link affected.”

---

## 3:00–3:15 — Close

### Spoken

> “ProofRoot doesn’t claim cryptography solves legal accountability. It gives autonomous agent systems something more concrete: verifiable attribution, bounded delegation, enforcement at the tool boundary, and evidence that exposes tampering.”

> “That’s why name.com is structurally part of the architecture: it lets an organization publish the identity root independently of ProofRoot’s own database.”

End on the causal graph or verified run—not a generic landing page.

---

# Recording rules

- Do not show environment-variable pages or secret-management screens.
- Do not expose API keys/private signing material in terminal output.
- Do not claim public DNS in sandbox.
- Do not claim DNSSEC unless independently validated.
- Do not say “real refund” when using the deterministic simulator; say “protected deterministic refund tool” or “simulated consequential action.”
- Do not call the deterministic fallback model-driven. The final video should preferably use Groq and visibly show `modelDriven: true`.
- Keep hashes/key fingerprints secondary to the causal narrative.
- The three visual transformations should remain obvious:
  1. domain → accountability root;
  2. opaque swarm → signed authority chain;
  3. disputed/tampered action → exact failure location.

# Screenshot list

Capture after live deployment validation:

1. Overview with final runtime state.
2. Domain/name.com provider-backed identity state.
3. Agent identities and fingerprints.
4. Valid causal graph with `$85 / $100` and confirmed transaction.
5. Six-part verification report.
6. Authority attack blocked before execution.
7. Tamper attack with exact broken receipt highlighted.

Do not use screenshots containing secret values, browser devtools with credentials, or fake DNS/DNSSEC badges.
