# ProofRoot Implementation Plan

This plan defines **what must be built and validated**, not how to implement it. The coding agent may choose the architecture, frameworks, libraries, and internal sequencing required to satisfy these outcomes.

The project is operating under a compressed hackathon deadline. Complete and stabilize every P0 requirement before starting P1 or P2 work.

---

## Priority Model

### P0 — Submission-critical

The end-to-end judging path must work reliably and visibly.

### P1 — Valuable after P0 is stable

Adds credibility, interoperability, and stronger evidence without changing the core story.

### P2 — Stretch only

Must never endanger deployment, demo reliability, or submission assets.

---

# Phase 0 — Lock the Demo Contract and Environments

## Objective

Remove infrastructure ambiguity before product development expands.

## Required outcomes

- Confirm the repository is a fresh project for this hackathon.
- Confirm name.com credentials work against at least the official sandbox.
- Determine whether a production name.com-managed domain is available for public DNS verification.
- Select and document one of two supported identity modes:
  - **Production Public DNS**, or
  - **Name.com Sandbox / Provider-Backed Verification**.
- Confirm the chosen deployment target.
- Confirm the AI model access available for the multi-agent workflow.
- Choose the protected demo tool:
  - a real test-mode external refund API, or
  - a deterministic refund simulator with explicit labeling and transaction IDs.
- Establish the golden support-case scenario and exact expected valid outcome.
- Establish the two mandatory attack scenarios.
- Ensure every required secret is represented in configuration and excluded from source control.

## Acceptance criteria

- A name.com connectivity check succeeds.
- The application can state which name.com environment it is using.
- The selected domain path is documented and reproducible.
- The team knows whether public DNS resolution is genuinely available.
- The protected tool returns a stable confirmation identifier.
- The golden task, valid amount, delegated limit, and attack values are fixed.
- No fake production or DNSSEC claim is required for the demo to work.

---

# Phase 1 — Establish the Product Foundation

## Objective

Create the complete product shell and shared domain model before filling in advanced behavior.

## Required outcomes

- Create the major user-facing surfaces:
  - domain onboarding;
  - organization identity;
  - agent registry;
  - live run;
  - chain explorer;
  - independent verification;
  - attack lab.
- Establish the core entities:
  - organization;
  - domain environment;
  - organization identity root;
  - agent identity;
  - key record;
  - root mandate;
  - delegation receipt;
  - action request receipt;
  - gateway decision receipt;
  - execution receipt;
  - run seal;
  - verification report.
- Establish stable lifecycle states for domains, agents, runs, receipts, and tool effects.
- Create a resettable golden demo fixture.
- Create clear status terminology for requested, allowed, blocked, dispatched, confirmed, failed, and unverifiable.

## Acceptance criteria

- Every P0 screen is reachable.
- The valid demo and attack demos can share one consistent data model.
- No status label conflates request intent with confirmed execution.
- The entire demo can be reset without manual database repair.

---

# Phase 2 — Build the name.com Domain Lifecycle

## Objective

Make name.com functionally central and visibly integrated.

## Required outcomes

- Search name.com for candidate accountability domains.
- Check availability and relevant purchase state before provisioning.
- Support domain creation or registration in the chosen environment.
- List the account’s managed domains.
- Select an existing production domain when public DNS mode is used.
- Create the organization ProofRoot TXT record.
- Create the manifest host A or CNAME record.
- Create visible per-agent locator records or equivalent identity records.
- List the records created by ProofRoot.
- Update an identity or lifecycle record.
- Delete or retire a record through the product.
- Persist name.com resource identifiers and environment metadata.
- Expose useful name.com errors instead of silently substituting local data.
- Make production and sandbox state visually unmistakable.

## Acceptance criteria

- The demo shows real successful name.com API operations.
- Record state displayed by ProofRoot matches record state returned by name.com.
- Production public DNS mode resolves records publicly.
- Sandbox mode retrieves records through name.com and explicitly states that they are not publicly resolvable.
- No local mock is presented as a name.com API result.
- Search, availability, provisioning, create, list, update, and delete paths are all represented in the working product or its reliable demo path.

---

# Phase 3 — Create the Domain-Backed Identity Registry

## Objective

Bind organization and agent identities to the name.com-managed domain.

## Required outcomes

- Create one organization accountability identity.
- Create one organization root signing identity.
- Publish a compact domain record containing the ProofRoot version, manifest locator, root-key fingerprint, and status.
- Serve a signed organization identity manifest under the selected domain path.
- Create distinct identities and key pairs for:
  - Triage Agent;
  - Billing Agent;
  - Refund Agent;
  - Proof Gateway.
- Represent each agent’s role, status, public key, validity window, and organization relationship.
- Make public identity material retrievable by the verifier.
- Keep private key material out of all public manifests, client responses, logs, and repository content.
- Preserve enough key metadata to verify every receipt created during the demo.
- Support active and retired identity states.

## Acceptance criteria

- Every agent has a unique identity and unique signing key.
- The same agent identity cannot validate a signature produced by another agent key.
- The verifier can start from the domain and locate the organization identity manifest.
- The manifest signature and published fingerprint agree.
- Identity status and key validity are displayed as separate facts from trust or authorization.
- Public identity claims remain valid after a normal page refresh or redeployment.

---

# Phase 4 — Finalize the Evidence Contract

## Objective

Create stable, deterministic, signed evidence objects for every consequential transition.

## Required outcomes

- Define and version the Root Mandate.
- Define and version the Delegation Receipt.
- Define and version the Action Request Receipt.
- Define and version the Gateway Decision Receipt.
- Define and version the Execution Receipt.
- Define and version the Run Seal.
- Establish one stable canonical representation for signed content.
- Assign stable content digests independent of database row identifiers.
- Include unique receipt identifiers, run identifiers, timestamps, nonces, signer identities, key identifiers, and parent evidence digests.
- Bind every action request to its exact delegation evidence.
- Bind every gateway decision to the exact request evaluated.
- Bind every execution receipt to the exact allowed decision and observed tool response.
- Represent sensitive inputs and outputs through redacted fields and digests rather than exposing private content by default.
- Distinguish dispatched effects from confirmed effects.
- Represent blocked and denied actions as signed evidence.
- Establish an exportable evidence bundle format.

## Acceptance criteria

- The same material receipt content always produces the same content digest.
- Changing a material field invalidates the original signature.
- Each receipt identifies its signer and key.
- Every non-root receipt references the evidence that caused it.
- A verifier can distinguish a claimed action from a gateway-confirmed tool response.
- A blocked action is visible and verifiable.
- Raw model chain-of-thought is never included in the evidence format.

---

# Phase 5 — Build the Proof Gateway

## Objective

Create the trusted boundary that enforces delegation limits and signs execution evidence.

## Required outcomes

- Place the protected refund tool behind the Proof Gateway.
- Ensure agents do not receive direct protected-tool credentials.
- Require every protected action to include a signed Action Request Receipt.
- Resolve and verify the requesting agent identity.
- Verify the full delegation chain back to the Root Mandate.
- Verify receipt signatures, key validity, timestamps, expiry, nonces, and parent links.
- Enforce authority attenuation across delegations.
- Enforce the refund amount limit and permitted action.
- Produce a signed decision for every allowed, blocked, denied, or failed request.
- Execute only allowed requests.
- Capture the actual protected-tool request and observed response.
- Produce a signed Execution Receipt for dispatched and confirmed effects.
- Return human-readable reason codes for every rejection.
- Prevent replay of a one-time action request.

## Acceptance criteria

- A valid $85 request under a $100 delegation reaches the protected tool.
- An $850 request under the same delegation is blocked before the tool is called.
- A request with an invalid signature is blocked.
- A request with an expired or missing delegation is blocked.
- A valid tool response produces an execution receipt with a transaction identifier.
- The execution receipt states whether the effect was dispatched or confirmed.
- Every gateway outcome is visible in the chain explorer.

---

# Phase 6 — Build the Multi-Agent Golden Workflow

## Objective

Demonstrate why accountability becomes difficult when authority moves through autonomous agents.

## Required outcomes

- Implement the Triage Agent role.
- Implement the Billing Agent role.
- Implement the Refund Agent role.
- Give each role distinct context and authority.
- Start the workflow from a signed Root Mandate.
- Have Triage Agent interpret the support case and delegate billing investigation.
- Have Billing Agent determine whether the charge is duplicated and delegate a bounded refund request.
- Have Refund Agent generate the signed action request.
- Route the action through the Proof Gateway.
- Complete the valid $85 refund scenario.
- Ensure at least one material routing or task decision is model-driven.
- Provide a deterministic demo fixture or controlled fallback so the golden path remains recordable.
- Show live progress and signed handoffs in the user interface.

## Acceptance criteria

- The three agents are visibly distinct rather than labels on one undifferentiated process.
- Every agent-to-agent handoff creates a signed Delegation Receipt.
- The final action is causally linked to the original Root Mandate.
- The valid workflow reaches a confirmed tool result.
- Re-running the golden scenario produces the same understandable narrative.
- A judge can explain the chain without reading raw JSON.

---

# Phase 7 — Build Independent Verification and the Chain Explorer

## Objective

Prove that verification is based on evidence, not a status badge stored by the application.

## Required outcomes

- Allow a completed run to be verified as a bundle.
- Begin verification from the organization domain or explicitly labeled sandbox provider record.
- Retrieve the relevant organization and agent public identity material.
- Verify organization-manifest integrity.
- Verify every receipt signature.
- Verify key validity and agent status at the relevant event time.
- Verify parent-child digest links.
- Verify delegation constraints and authority attenuation.
- Verify action-to-decision and decision-to-execution bindings.
- Verify the Run Seal against the included receipt set.
- Produce separate results for:
  - identity resolution;
  - signature validity;
  - delegation validity;
  - constraint validity;
  - gateway evidence;
  - bundle integrity.
- Render the run as a causal graph and readable timeline.
- Allow inspection of human-readable evidence and raw evidence.
- Highlight the first failing receipt and downstream affected evidence.

## Acceptance criteria

- A valid run verifies from beginning to end.
- Verification can be re-run rather than relying on cached UI state.
- A verifier reports why a check failed.
- Trust, identity, authorization, and execution evidence are not collapsed into one unexplained score.
- The graph remains understandable at normal demo zoom.
- The final report states both proven claims and limitations.

---

# Phase 8 — Build the Attack Lab

## Objective

Turn abstract security claims into visible behavior.

## Required outcomes

### Mandatory attack A — Authority violation

- Re-run the refund workflow with Refund Agent requesting $850 under a signed $100 cap.
- Show the Proof Gateway evaluating the same evidence checks as the valid run.
- Block the action before tool execution.
- Generate and display a signed blocked-decision receipt.
- Prove that no protected-tool transaction was created.

### Mandatory attack B — Evidence tampering

- Start from the valid $85 run.
- Modify a material stored receipt field to show $850.
- Re-run independent verification.
- Fail the content digest or signature check.
- Identify the precise altered receipt.
- Mark downstream dependent receipts as affected rather than independently valid.

### Optional attack C — Identity impersonation

- Copy the Refund Agent identifier.
- sign a request with an unrelated key;
- reject the request because the signature does not match the published identity.

### Optional attack D — Replay or missing evidence

- Replay an already consumed one-time request or remove a referenced parent receipt.
- reject the replay or fail bundle integrity.

## Acceptance criteria

- Both mandatory attacks work live and are resettable.
- The authority attack demonstrates prevention, not merely after-the-fact logging.
- The tampering attack demonstrates verification failure from evidence, not a hardcoded red state.
- Attack results are understandable in under ten seconds each.
- The product never claims that a blocked request was executed.

---

# Phase 9 — Complete the Product Experience

## Objective

Make the technical system easy to understand and difficult to forget.

## Required outcomes

- Make the causal graph the visual centerpiece.
- Show the organization domain and name.com environment persistently where relevant.
- Create compact identity cards for agents and the gateway.
- Animate or visibly mark receipt creation and verification.
- Distinguish agent intent from gateway execution evidence in the interface.
- Use consistent status language and icons.
- Provide plain-language explanations beside cryptographic details.
- Add a raw evidence drawer for technical judges.
- Add empty, loading, success, warning, and failure states.
- Add a one-click demo reset.
- Add a guided sequence for the valid run and both attacks.
- Ensure the interface works at the resolution used for video recording.
- Remove generic dashboard content unrelated to the judging story.

## Acceptance criteria

- The project is understandable before opening raw evidence.
- The three wow moments are reachable without navigating through setup noise.
- No screen displays fake verification, fake DNS propagation, or fake DNSSEC.
- The valid path is visually satisfying and the failure path is immediately obvious.
- The entire demo can be completed comfortably within a 2–4 minute video.

---

# Phase 10 — Reliability, Security, and Edge-Case Validation

## Objective

Ensure the demo remains technically credible under inspection.

## Required outcomes

- Test valid identity and signature verification.
- Test wrong-key impersonation.
- Test receipt-content tampering.
- Test missing parent evidence.
- Test expired delegation.
- Test over-broad child delegation.
- Test amount-limit violation.
- Test one-time request replay.
- Test gateway tool failure and timeout.
- Test name.com authentication failure.
- Test name.com rate-limit or service failure handling.
- Test missing or malformed DNS identity records.
- Test production and sandbox environment separation.
- Test application reset and demo reseeding.
- Verify secrets never appear in client bundles, logs, screenshots, repository history, or evidence exports.
- Verify that private model reasoning is not stored.
- Verify that redacted fields and digests remain sufficient for the demo claims.
- Verify that every public claim in the UI matches the implemented guarantee.

## Acceptance criteria

- All P0 security and integration tests pass.
- The app fails closed for invalid or unverifiable protected actions.
- Name.com outages produce explicit recoverable states rather than fabricated success.
- Sandbox mode is always labeled.
- The application can recover from a failed demo run through reset.
- No critical browser-console or server errors occur during the golden path.

---

# Phase 11 — Deployment, Documentation, and Submission

## Objective

Turn the working build into a judge-ready submission.

## Required outcomes

- Deploy the frontend and backend.
- Confirm production configuration and secret management.
- Confirm the live URL works in a clean browser session.
- Confirm the domain manifest and public records resolve when production mode is claimed.
- Add a clear README containing:
  - problem;
  - one-line pitch;
  - architecture overview;
  - name.com API usage;
  - demo workflow;
  - security guarantees;
  - explicit non-guarantees;
  - local setup;
  - environment variables;
  - test instructions;
  - sandbox limitation;
  - screenshots.
- Add an architecture diagram showing:
  - name.com domain and DNS;
  - organization and agent identities;
  - multi-agent delegation;
  - Proof Gateway;
  - protected tool;
  - evidence store;
  - independent verifier.
- Record a 2–4 minute end-to-end demo.
- Create strong screenshots for the Devpost page.
- Prepare the Devpost project description.
- State precisely where name.com performs indispensable work.
- State that the project is a standards-aware product prototype, not a claim to have invented agent identity or solved legal accountability.
- Credit any external libraries, assets, or standards references used.

## Acceptance criteria

- A new viewer can understand the product from the first 15 seconds of the video.
- The video visibly shows real name.com API-backed behavior.
- The video includes the valid run, authority block, and tamper failure.
- The repository is public or correctly shared.
- Setup instructions work from a clean environment.
- No secret is committed.
- The Devpost page uses the final ProofRoot name and pitch consistently.

---

# Phase 12 — Stretch Work

Start this phase only after the submission-critical path is deployed, tested, recorded, and documented.

## P1 options

- Replace the deterministic refund simulator with a real test-mode external API.
- Add agent suspension and key rotation while preserving historical verification.
- Add a standalone verification command or downloadable verification bundle.
- Add stronger Run Seal and receipt-set completeness validation.
- Add an MCP adapter demonstrating a protected MCP tool behind the Proof Gateway.
- Add a second consequential action type.
- Add a richer incident report generated from verified evidence.

## P2 options

- Configure and validate real DNSSEC.
- Register evidence checkpoints with a transparency service.
- Add an independent witness signature.
- Add cross-organization action evidence.
- Add multiple organizations and delegated trust roots.
- Add a general SDK for external agent frameworks.
- Add formal policy templates.
- Add hardware-backed key storage.
- Add privacy-preserving selective disclosure.

## Acceptance rule

No stretch feature may remain partially integrated in the public demo. A smaller complete build is stronger than a larger interface containing fake or nonfunctional security controls.

---

# Required Cut Order

If the build falls behind, remove work in this order:

1. DNSSEC.
2. Transparency service.
3. Cross-organization behavior.
4. General SDK.
5. MCP adapter.
6. Real external refund provider.
7. Key rotation.
8. Additional attack cases beyond the two mandatory attacks.
9. Additional agents beyond Triage, Billing, and Refund.

Never cut:

- real name.com API integration;
- one organization domain root;
- distinct agent identities;
- signed delegation and action requests;
- the Proof Gateway;
- one valid consequential action;
- the $850 authority-block attack;
- the receipt-tampering attack;
- independent verification;
- the causal graph;
- clear sandbox-versus-production disclosure;
- deployment and submission assets.

---

# Final Definition of Done

ProofRoot is ready to submit only when all of the following are true:

- The application is deployed and publicly reachable.
- name.com authentication and domain operations are real.
- The active environment is visible and truthful.
- A domain is provisioned or selected through the product.
- Organization and agent identity records exist through name.com.
- Three distinct agents complete the golden task.
- Every handoff produces signed evidence.
- The Proof Gateway alone controls the protected tool.
- The valid $85 request is confirmed by the tool path.
- The invalid $850 request is blocked before execution.
- A material receipt edit causes independent verification to fail.
- The verifier identifies the exact broken link.
- The chain graph distinguishes intent, decision, and effect.
- The security claims and limitations are documented.
- The README, architecture diagram, screenshots, and demo video are complete.
- The submission consistently uses the final name **ProofRoot** and the final one-line pitch.
