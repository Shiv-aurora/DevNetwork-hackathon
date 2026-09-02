# ProofRoot

> **The flight recorder for autonomous AI agents.**

**One-sentence pitch:** ProofRoot gives every AI agent a domain-backed identity and turns every delegation and consequential tool call into a signed, independently verifiable chain of custody.

**Ten-second explanation:** When several AI agents act for a company and something goes wrong, ProofRoot proves which agent requested each step, who delegated it, what constraints applied, and what the tool gateway actually executed.

---

## 1. Project Status

This document is the final product vision for the **DevNetwork [API + Cloud + AI] Hackathon 2026**, with the **name.com Domain API Challenge** as the primary prize target.

ProofRoot is a fresh hackathon project. It is not intended to invent a universal identity standard, solve legal responsibility, or become a research paper during the build. It is intended to deliver a technically credible, memorable, end-to-end product demonstration of verifiable accountability evidence for multi-agent systems.

The project should optimize for:

1. a complete working demo;
2. deep and visible name.com API usage;
3. a technically defensible security model;
4. immediate visual clarity;
5. a narrow scope that can be completed reliably in a compressed final-day build.

---

## 2. Competition Strategy

The name.com challenge rewards:

- central and deep use of the name.com API;
- multiple API surfaces rather than one superficial call;
- an unexpected use of domains;
- strong technical execution and edge-case handling;
- plausible real-world value;
- a clear working demo.

ProofRoot attacks that rubric directly.

Most name.com projects will treat a domain as a website address or branding asset. ProofRoot treats an organization-controlled domain as the public root from which independent systems can discover and verify its AI-agent identities.

The target is not to use the greatest number of sponsors. The target is to make one sponsor structurally necessary. No unrelated sponsor API should be added unless it materially improves the core accountability workflow.

---

## 3. The Problem

### Exact user

Engineering, security, platform, and compliance teams deploying multi-agent systems that can invoke consequential tools such as:

- refunds and payments;
- database writes;
- cloud infrastructure changes;
- customer communications;
- ticket resolution;
- procurement actions;
- document or approval workflows.

### Painful moment

A multi-agent workflow produces a bad or disputed outcome:

> “Why did the system issue this refund, which agent requested it, who gave that agent authority, and was the audit record changed afterward?”

Ordinary application logs may show that an event occurred, but they commonly fail to provide independently verifiable answers to all of the following:

- Which distinct agent runtime requested the action?
- Was that agent impersonated?
- Which parent task or agent delegated the work?
- What limits or conditions were attached to the delegation?
- Did the agent remain within those limits?
- What request reached the consequential tool boundary?
- Was the action blocked, dispatched, confirmed, or merely claimed as complete?
- Was the stored history modified after the event?

The problem becomes harder as agents create sub-agents, hand tasks to specialized agents, and call tools without a human present at every step.

---

## 4. Why Now

Agent identity and delegation are becoming immediate infrastructure problems rather than distant theory. The MCP roadmap explicitly recognizes that callers are increasingly cloud agents or sub-agents with narrower authority than their parents, while current systems still rely heavily on pasted API keys and long-lived tokens.

At the same time, active standards work is exploring signed action records, delegation evidence, confirmed-effect bindings, and independently verifiable accountability profiles. ProofRoot should treat that work as evidence that the problem is timely, not claim that those drafts are finalized standards or that ProofRoot invented the category.

The hackathon product opportunity is to turn these emerging security ideas into a concrete experience a judge can understand in seconds:

> assign a task → watch agents delegate → observe a real tool decision → inspect cryptographic evidence → attack the record → see verification fail.

---

## 5. Core Product Thesis

**Accountability requires more than agent-generated logs.**

An agent signing its own statement only proves that the holder of that agent key signed a statement. It does not independently establish that the claimed tool effect occurred.

ProofRoot therefore creates two distinct forms of evidence:

1. **Agent evidence** — signed records of task authorization, delegation, and action requests.
2. **Boundary evidence** — signed records from an accountability gateway describing what it allowed, blocked, sent to the tool, and observed in response.

The core insight is:

> **The agent signs what it intended to do; the credential-holding gateway separately signs what the system actually allowed and observed.**

This distinction is the technical center of the project. Without it, ProofRoot would be a dressed-up logging dashboard.

---

## 6. Product Model

ProofRoot has three primary product components.

### 6.1 Domain Identity Registry

An organization establishes an accountability root under a domain it controls through name.com.

The domain layer provides:

- an organization-controlled public namespace;
- a discoverable location for the ProofRoot identity manifest;
- a public fingerprint or locator for the organization accountability key;
- discoverable agent identity records;
- agent lifecycle state such as active, suspended, or retired;
- a way for an external verifier to find identity material without trusting a centralized ProofRoot directory.

The preferred public identity pattern is:

- a name.com-managed domain;
- a DNS TXT record advertising the ProofRoot version, manifest location, and root-key fingerprint;
- an A or CNAME record routing an agent identity host to the manifest service;
- a signed HTTPS identity manifest containing organization and agent public keys, status, and validity periods;
- optional per-agent DNS locator records for visible name.com API depth.

DNS is the public discovery and organization-control layer. The signed manifest is the richer identity document. Plain DNS must not be described as cryptographically authenticated unless DNSSEC is actually configured and validated.

### 6.2 Proof Gateway

The Proof Gateway sits in front of consequential tools.

It must be the only component holding the credentials required to execute the protected demo action. Agents may request an action, but they cannot bypass the gateway and call the tool directly.

For each request, the gateway:

- resolves the requesting agent identity;
- verifies the request signature;
- verifies the root task and delegation chain;
- checks action scope, amount limits, expiry, and other deterministic constraints;
- blocks invalid or excessive requests before execution;
- invokes the tool only after validation succeeds;
- records whether the action was blocked, dispatched, confirmed, errored, or timed out;
- signs a gateway decision and execution receipt.

This component turns ProofRoot from passive observability into enforceable accountability evidence.

### 6.3 Chain Explorer and Independent Verifier

The Chain Explorer shows the causal graph of a multi-agent run.

The independent verifier must be able to inspect an exported evidence bundle and verify it using publicly discoverable identity material rather than trusting a green badge stored in the application database.

It verifies:

- receipt structure and canonical content;
- cryptographic signatures;
- agent-key and organization-key bindings;
- key validity and agent status for the relevant event time;
- parent-child receipt hashes;
- delegation attenuation and constraints;
- gateway decisions and execution evidence;
- run-seal integrity;
- tampering, missing referenced records, replay, and impersonation failures.

---

## 7. Evidence Objects

ProofRoot should use a small, explicit evidence model.

### 7.1 Root Mandate

The signed starting instruction for a run.

It identifies:

- the organization or authenticated principal initiating the task;
- the root task;
- the first agent;
- high-level scope and limits;
- validity window;
- a unique run identifier.

### 7.2 Delegation Receipt

A signed handoff from one agent to another.

It identifies:

- delegating agent;
- receiving agent;
- parent mandate or delegation;
- task purpose;
- permitted actions or tools;
- explicit constraints;
- expiry;
- unique nonce;
- parent evidence digest.

A child may receive equal or narrower authority, never broader authority than its parent possessed.

### 7.3 Action Request Receipt

A signed statement that a particular agent runtime requested a specific tool action under a particular delegation.

It binds:

- agent identity;
- tool and action name;
- relevant parameters or their privacy-preserving digests;
- referenced delegation;
- timestamp and nonce;
- expected effect;
- parent evidence digest.

### 7.4 Gateway Decision Receipt

A gateway-signed record of the deterministic checks performed at the tool boundary.

It records:

- request receipt being evaluated;
- identity and signature result;
- delegation-chain result;
- constraint results;
- decision: allowed, blocked, denied, or escalated;
- reason codes;
- gateway identity and signature.

A blocked action is first-class accountability evidence, not an absent event.

### 7.5 Execution Receipt

A gateway-signed record of what was sent to the tool and what response the gateway observed.

It distinguishes:

- request accepted;
- effect dispatched;
- effect confirmed by the tool response;
- effect failed or timed out.

It includes the tool transaction identifier, redacted material fields, request and response digests, timestamps, and the gateway signature.

The correct claim is:

> “The Proof Gateway sent this request and observed this result.”

The incorrect claim is:

> “Cryptography proves every external real-world consequence occurred exactly as described.”

### 7.6 Run Seal

A signed closing record committing to the receipts included in a completed run.

It allows the verifier to detect changes or removals relative to the sealed bundle. It does not prove that an intentionally omitted event never existed outside the protected gateway.

---

## 8. Security and Accountability Claims

### ProofRoot can credibly demonstrate

- A receipt has not changed since it was signed.
- A request was signed by the private key corresponding to a published agent identity.
- An organization-controlled domain published the identity locator used by the verifier.
- One agent delegated a bounded task to another agent.
- A child request stayed within or exceeded the signed delegation constraints.
- The Proof Gateway allowed or blocked a request after deterministic checks.
- The Proof Gateway sent a particular protected-tool request and observed a particular response.
- A sealed run bundle is internally consistent.
- A copied identity without the correct private key fails verification.

### ProofRoot must not claim

- that it determines legal liability;
- that a cryptographically valid domain owner is trustworthy;
- that a signature reveals the model’s internal reasoning or true intent;
- that it proves a specific human personally approved an action unless a real human-authorization mechanism is implemented;
- that plain DNS provides DNSSEC guarantees;
- that DNS revocation propagates instantly everywhere;
- that a self-operated gateway is an independent third party;
- that history is globally immutable or complete if actions can bypass the gateway;
- that it replaces OAuth, MCP authorization, workload identity, or enterprise IAM.

### Required trust assumptions

- Protected tool credentials are held only by the Proof Gateway.
- Agent private keys are not compromised.
- The organization domain and identity-manifest hosting path remain under authorized control.
- The gateway signing key and gateway runtime remain trustworthy.
- The verifier treats signature validity, identity resolution, authorization evidence, and trust decisions as separate results.

ProofRoot provides **verifiable attribution, delegation lineage, boundary enforcement evidence, and tamper detection**. These are technical foundations for accountability, not the complete social, legal, or moral concept of accountability.

---

## 9. Why name.com Is Structurally Necessary

ProofRoot must use the name.com API for a complete domain lifecycle, not merely link to a landing page.

### Required name.com surfaces

- search for candidate accountability domains;
- check availability and price state;
- register or provision a domain in the appropriate environment;
- list managed domains;
- create identity-related TXT records;
- create an A or CNAME record for the manifest endpoint;
- list and display the records created by ProofRoot;
- update identity or lifecycle records;
- delete or retire records where appropriate;
- clearly surface whether the project is using sandbox or production.

### Sponsor necessity test

Without the domain and DNS layer, ProofRoot would need a centralized proprietary registry controlled by ProofRoot itself. External verifiers would have to trust that registry to map an agent identifier to its operator and public key.

With the domain layer, the organization controls its namespace and publishes the locator under infrastructure it already owns. ProofRoot becomes a verifier of organization-published identity evidence rather than the universal owner of every agent identity.

The product could theoretically support other registrars later, but the hackathon implementation is powered by name.com as the control plane for domain provisioning and DNS identity publication. Vendor replaceability does not make the integration cosmetic; removing domain-controlled public resolution changes the architecture and weakens the product promise.

### Sandbox truthfulness

The official name.com sandbox stores DNS records but does not publish them to public DNS. Therefore:

- the preferred judging configuration uses a real name.com-managed production domain for public lookup;
- the sandbox remains valid for demonstrating search, registration, and DNS record lifecycle;
- when sandbox is used, verification must be labeled **Name.com Sandbox / provider-backed lookup**;
- the product must never pretend a sandbox record is publicly resolvable;
- production and sandbox data must never be silently mixed.

### DNSSEC

DNSSEC is valuable production hardening, but it is not required for the hackathon MVP. It should only be shown if the zone is genuinely signed and the verifier genuinely validates the chain. A fake DNSSEC badge is worse than omitting DNSSEC.

---

## 10. Multi-Agent Demonstration

The product must demonstrate a real multi-agent chain because accountability is most valuable when authority is distributed.

### Demo organization

A fictional SaaS company operates three agents:

1. **Triage Agent** — understands the customer issue and routes work.
2. **Billing Agent** — inspects the relevant transaction and determines whether a duplicate charge exists.
3. **Refund Agent** — may request a refund but cannot directly access the refund tool.

Each agent has:

- a distinct identity;
- a distinct key;
- a distinct role;
- limited context;
- bounded authority;
- visible domain-backed identity metadata.

### Golden task

> “Resolve support case #194. The customer reports a duplicate charge. Refund a confirmed duplicate charge only if the amount is no more than $100.”

### Valid run

1. The organization signs the root mandate.
2. Triage Agent inspects the case and delegates billing investigation.
3. Billing Agent confirms an $85 duplicate charge and delegates a refund request capped at $100.
4. Refund Agent signs a request for an $85 refund.
5. Proof Gateway verifies identity, signatures, lineage, and constraints.
6. Proof Gateway calls a test-mode refund tool or a deterministic protected-tool simulator.
7. The tool returns a transaction identifier and confirmation state.
8. Proof Gateway signs the execution receipt.
9. ProofRoot seals and displays the complete causal chain.

At least one meaningful workflow decision should be model-driven so the demonstration is genuinely agentic. The golden path must also be reproducible and resettable for recording and judging.

---

## 11. Three Demo Wow Moments

### Wow 1 — Deploy an accountable agent organization

The user chooses or provisions a domain through name.com and clicks **Create Agent Organization**.

ProofRoot visibly creates identity records for the organization and the three agents. The interface shows:

- domain under management;
- name.com environment;
- manifest location;
- organization root fingerprint;
- per-agent identity and status;
- actual DNS records created through the API.

The result is not “we bought a domain.” The result is “this domain is now the public accountability root for an agent organization.”

### Wow 2 — Watch authority move through the swarm

The support task runs live.

The chain graph grows:

> Organization → Triage → Billing → Refund → Proof Gateway → Refund Tool

Each signed handoff visibly locks into the chain. The final action displays two separate facts:

- **Agent requested:** refund $85.
- **Gateway confirmed:** protected tool returned refund transaction `...`.

This makes the intent-versus-execution distinction obvious without requiring the judge to understand cryptography first.

### Wow 3 — Break the chain and watch proof fail

The attack lab performs two attacks.

**Authority attack:** Refund Agent requests $850 despite a signed $100 limit.

Result:

> **BLOCKED BEFORE EXECUTION — delegated limit exceeded**

The denial itself receives a signed gateway receipt.

**History attack:** Change a stored successful receipt from $85 to $850.

Result:

> **VERIFICATION FAILED — content digest and signature no longer match**

The graph identifies the exact broken receipt and all downstream evidence affected by it.

An impersonation attack using the correct agent name but the wrong private key is a valuable optional third attack.

---

## 12. Product Surfaces

### Domain Onboarding

- search and availability;
- environment selection;
- registration/provisioning status;
- domain verification;
- DNS record lifecycle;
- transparent sandbox limitations.

### Agent Registry

- organization identity;
- agent identities and roles;
- public-key fingerprints;
- active, suspended, and retired states;
- manifest and DNS status;
- creation and lifecycle history.

### Live Run

- root task;
- active agents;
- signed delegation edges;
- current constraints;
- gateway checks;
- protected-tool outcome;
- clear distinction between requested, dispatched, confirmed, blocked, and failed.

### Chain Explorer

- causal graph;
- receipt timeline;
- receipt type and signer;
- human-readable claims;
- raw evidence drawer;
- verification result per receipt;
- full-run verification result.

### Attack Lab

- over-limit request;
- receipt tampering;
- identity impersonation;
- optional replay or missing-parent test;
- immediate, visually clear failure localization.

### Independent Verification

- import or select an evidence bundle;
- resolve domain-backed identity material;
- verify without trusting stored UI status;
- produce a concise verification report;
- expose each check separately rather than one unexplained score.

---

## 13. MVP Scope

### P0 — Required to submit

- fresh repository and deployed application;
- working name.com authentication and environment detection;
- domain search and availability flow;
- domain registration or provisioning flow in sandbox or production;
- real name.com DNS create, list, update, and delete behavior;
- one organization accountability root;
- three separately identified agents;
- signed root mandate, delegations, action request, gateway decision, and execution evidence;
- protected tool accessible only through the Proof Gateway;
- valid multi-agent refund workflow;
- independent chain verification;
- live authority-violation attack;
- live receipt-tampering attack;
- chain visualization;
- clear production-versus-sandbox labeling;
- resettable golden demo;
- public repository, setup documentation, deployed link, screenshots, and demo video.

### P1 — Add only after P0 is stable

- real external test-mode refund API;
- organization and agent key rotation with historical verification;
- agent suspension and lifecycle records;
- exportable self-contained verification bundle;
- replay detection;
- signed run seal and stronger bundle-completeness checks;
- additional gateway failure states;
- optional MCP adapter around the protected tool.

### P2 — Explicit stretch work

- genuine DNSSEC validation;
- transparency-log anchoring;
- third-party witness signatures;
- multiple organizations;
- cross-organization actions;
- arbitrary agent-framework SDKs;
- general-purpose policy language;
- human identity credentials;
- multi-tenant enterprise administration;
- legal or regulatory reporting.

### Deliberate exclusions

Do not build:

- a new universal agent protocol;
- a blockchain;
- a generic AI governance dashboard;
- a broad no-code agent builder;
- a fake public agent ecosystem;
- a legal-liability engine;
- chain-of-thought capture;
- a centralized “trust score” claiming that valid identity means safe behavior;
- unrelated sponsor integrations.

---

## 14. Design Direction

The interface should feel like security infrastructure made legible, not another generic SaaS dashboard.

The visual hierarchy should emphasize:

1. **identity** — who the agent is;
2. **authority** — who delegated what;
3. **decision** — what the gateway allowed or blocked;
4. **effect** — what the protected tool confirmed;
5. **proof** — whether the evidence verifies.

Recommended visual language:

- a strong causal graph as the product centerpiece;
- clear green, amber, and red verification states;
- compact identity cards with domain and key fingerprints;
- animated signing/verification transitions;
- an evidence drawer for technically sophisticated judges;
- plain-language explanations beside cryptographic details;
- no dense wall of hashes as the default experience;
- no decorative agent avatars that distract from the proof chain.

The project should be understandable before a judge opens any raw receipt.

---

## 15. Judging Alignment

### API integration depth

ProofRoot uses name.com across domain discovery, availability, provisioning, DNS creation, lookup, update, and retirement. DNS state is part of the actual verification path.

### Creativity and originality

The domain is used as an organization-controlled accountability root for AI-agent identities rather than as branding or hosting.

### Technical execution

The project demonstrates asymmetric identity, bounded delegation, causal hash linking, deterministic gateway checks, separate intent and execution evidence, independent verification, and adversarial failure cases.

### Real-world viability

Teams deploying agents with access to consequential tools need incident reconstruction, attributable actions, bounded authority, and evidence that survives database tampering. ProofRoot could become an SDK and gateway layer for agent frameworks and MCP-connected tools, but the hackathon build remains a focused proof of the core workflow.

### Presentation and demo

The project has three visible transformations:

- ordinary domain → agent accountability root;
- opaque agent swarm → signed chain of custody;
- disputed action → exact, verifiable failure location.

### Overall hackathon criteria

- **Progress:** a complete integration across domain infrastructure, agents, security evidence, enforcement, UI, deployment, and attacks.
- **Concept:** a clear problem created by autonomous multi-agent action.
- **Feasibility:** a focused developer-security product rather than a speculative universal network.

---

## 16. Naming Decision

The project name is **ProofRoot**.

Do not use **AgentPassport** as the final public name. “Agent Passport” is already used by multiple commercial and open-source projects in 2026, and its framing overemphasizes identity while ProofRoot’s strongest contribution is the complete evidence chain from delegation to tool execution.

**ProofRoot** communicates both parts of the product:

- **Proof** — signed, independently checkable evidence;
- **Root** — identity anchored in the organization’s domain.

### Public tagline

> **The flight recorder for autonomous AI agents.**

### Devpost one-line pitch

> **ProofRoot gives every AI agent a domain-backed identity and turns every delegation and consequential tool call into a signed, independently verifiable chain of custody.**

### Spoken opening

> “Three AI agents just issued a refund. Your logs say what happened—but can you prove which agent authorized each step, what limits it had, and whether the record was changed afterward?”

---

## 17. Definition of Success

The concept is complete when a judge can watch the following without accepting any unexplained claims:

1. ProofRoot provisions or selects a name.com-managed domain.
2. Name.com API activity creates the organization and agent identity records.
3. Three agents complete a real multi-step task with bounded delegation.
4. Every handoff produces signed evidence.
5. The Proof Gateway alone controls the consequential tool.
6. The gateway blocks an over-authority request before execution.
7. A valid request reaches the tool and produces gateway-signed execution evidence.
8. A separate verifier reconstructs and verifies the chain using domain-resolved identity material.
9. Changing one material field causes verification to fail at the exact affected link.
10. The interface clearly states what was proven, what was merely observed, and what remains outside the guarantee.

That is a technically meaningful product, a defensible use of name.com, and a demo a judge is unlikely to confuse with a generic agent dashboard.

---

## 18. External Reference Anchors

These references establish competition alignment and technical timing. They are context, not specifications that must be implemented wholesale.

- [DevNetwork Hackathon 2026 and name.com Domain API Challenge](https://api-cloud-ai-hackathon-2026.devpost.com/)
- [name.com Core API Overview](https://docs.name.com/api/v1/overview)
- [name.com Testing Environment and sandbox DNS limitation](https://docs.name.com/guides/testing-environment)
- [MCP Roadmap: Agent Identity and Enterprise-Ready Security](https://modelcontextprotocol.io/development/roadmap)
- [IETF work in progress: Agent Action Capsule](https://datatracker.ietf.org/doc/html/draft-mih-scitt-agent-action-capsule-04)
- [IETF work in progress: Agent Accountability Composition](https://datatracker.ietf.org/doc/html/draft-mih-sato-agent-accountability-composition-01)
