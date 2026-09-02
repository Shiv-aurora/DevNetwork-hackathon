# ProofRoot Deployment Runbook

This runbook covers the remaining environment-sensitive work after the repository's secret-free implementation is complete.

## Rules

1. Never commit credentials or private signing keys.
2. Never paste secrets into GitHub files, issues, commits, screenshots, demo bundles, browser responses, or Devpost copy.
3. Use the name.com **sandbox** unless an existing name.com-managed production domain is already available and intentionally selected.
4. Do not purchase a paid production domain from automation.
5. Sandbox DNS state must never be described as publicly resolvable.
6. Do not claim DNSSEC unless a real DNSSEC chain is configured and validated.
7. A deployed domain-backed run must sign with the persistent private keys matching the published manifest. Do not use ephemeral per-run identities for that claim.

---

## 1. Start from clean `main`

```bash
git checkout main
git pull --ff-only
npm install
npm test
npm run build
```

Read before changing deployment state:

- `docs/VISION.md`
- `docs/IMPLEMENTATION.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/STATUS.md`

---

## 2. Supply local secrets outside Git

Use shell/environment secret injection or an ignored `.env.local`.

Required for name.com sandbox:

```text
NAMECOM_ENV=sandbox
NAMECOM_USERNAME=<sandbox username ending in -test>
NAMECOM_TOKEN=<secret>
```

Required for Groq:

```text
GROQ_API_KEY=<secret>
GROQ_MODEL=<model id>
```

Do not add actual values to `.env.example`.

---

## 3. Verify the external providers

### name.com

```bash
npm run check:namecom
```

Required evidence:

- authenticated request succeeds;
- environment is reported as sandbox or production;
- managed-domain request succeeds;
- no credential value appears in output.

### Groq

```bash
npm run check:groq
```

Required evidence:

- authentication succeeds;
- configured model appears available;
- no API key appears in output.

If either check fails, fix the real environment/credential issue. Do not substitute a mock and mark the provider validated.

---

## 4. Select the ProofRoot domain

### Preferred safe path: name.com sandbox

Run the application locally with the sandbox secrets:

```bash
npm run dev
```

Use `/domain` to:

1. search candidate domains;
2. check the exact selected domain;
3. provision it in the sandbox;
4. list managed domains and confirm name.com returns it.

Then set:

```text
PROOFROOT_DOMAIN=<selected sandbox domain>
PROOFROOT_IDENTITY_MODE=namecom-sandbox
```

Sandbox domains/records are provider-backed test state. They are not public DNS.

### Production path

Use production only if an existing name.com-managed production domain is already available and deliberately selected.

Set:

```text
NAMECOM_ENV=production
PROOFROOT_DOMAIN=<existing managed production domain>
PROOFROOT_IDENTITY_MODE=production-public-dns
```

Do **not** automate a paid production purchase.

Before calling the mode `Production Public DNS`, independently resolve the ProofRoot TXT record after publication.

---

## 5. Generate persistent signing material locally

After `PROOFROOT_DOMAIN` is fixed:

```bash
npm run provision:identity
```

This writes only ignored local files:

```text
.proofroot/public-manifest.json
.proofroot/signing-keys.json
```

`public-manifest.json` contains only public identity material and a root signature.

`signing-keys.json` contains private PKCS#8 signing material. Treat it as a secret.

The script refuses implicit overwrite. Do not use `--force` unless key rotation/re-provisioning is intentional.

---

## 6. Create/link the Vercel project

Create or link a Vercel project to:

```text
Shiv-aurora/DevNetwork-hackathon
```

The framework should be detected as Next.js.

Configure the following Vercel environment variables for the environments used by the demo:

```text
NAMECOM_ENV
NAMECOM_USERNAME
NAMECOM_TOKEN
PROOFROOT_DOMAIN
PROOFROOT_IDENTITY_MODE
PROOFROOT_PUBLIC_MANIFEST_JSON
PROOFROOT_SIGNING_KEYS_JSON
GROQ_API_KEY
GROQ_MODEL
REFUND_TOOL_MODE=deterministic-simulator
DEPLOYMENT_TARGET=vercel
```

Set:

- `PROOFROOT_PUBLIC_MANIFEST_JSON` to the complete JSON contents of `.proofroot/public-manifest.json`.
- `PROOFROOT_SIGNING_KEYS_JSON` to the complete JSON contents of `.proofroot/signing-keys.json` **as a Vercel secret/environment value only**.

Do not echo the private JSON to shared logs.

Deploy once so a stable public Vercel URL exists.

---

## 7. Determine the public manifest URL

The deployed route must work:

```text
https://<deployment-host>/.well-known/proofroot.json
```

Fetch it and verify that it returns the exact signed public manifest configured in Vercel.

### Sandbox

Because sandbox DNS cannot resolve publicly, set locally for publication:

```text
PROOFROOT_MANIFEST_PUBLIC_URL=https://<public-vercel-host>/.well-known/proofroot.json
```

The name.com sandbox `_proofroot` TXT record will point to this real HTTPS URL.

This produces the truthful verification chain:

```text
name.com sandbox provider-backed TXT
        ↓ contains manifest locator + root fingerprint
public Vercel HTTPS manifest
        ↓ signed public identity material
ProofRoot verifier
```

### Production

Add `proof.<PROOFROOT_DOMAIN>` as a Vercel custom domain.

Use the exact CNAME target Vercel requires for that custom domain. Do not assume the target if Vercel reports a different one.

The preferred production manifest URL is:

```text
https://proof.<PROOFROOT_DOMAIN>/.well-known/proofroot.json
```

---

## 8. Publish the ProofRoot identity records through name.com

Set locally:

```text
PROOFROOT_MANIFEST_TARGET_HOST=<actual Vercel/custom-domain CNAME target>
```

For sandbox, also keep `PROOFROOT_MANIFEST_PUBLIC_URL` set to the real Vercel manifest URL.

Run:

```bash
npm run publish:identity
```

The script reconciles:

- `_proofroot` TXT;
- `proof` CNAME;
- Triage locator TXT;
- Billing locator TXT;
- Refund locator TXT;
- Proof Gateway locator TXT.

It updates an existing record at the same host/type when necessary instead of creating endless duplicates.

Required result:

```text
reconciled: true
```

Record the non-sensitive provider record IDs in `docs/STATUS.md` if useful.

---

## 9. Validate identity resolution

### Sandbox

The deployed verifier must:

1. call name.com with server-side sandbox credentials;
2. retrieve `_proofroot` from provider-backed record state;
3. read the manifest URL from that record;
4. fetch the real public Vercel manifest;
5. verify the manifest root signature and fingerprint;
6. verify that the receipt signer keys match the manifest public keys.

The UI/report must continue to state that sandbox DNS itself is not public DNS.

### Production

The deployed verifier must:

1. resolve public `_proofroot.<domain>` TXT;
2. fetch the domain manifest URL;
3. verify manifest signature/fingerprint;
4. verify receipt keys against the manifest.

Do not call this DNSSEC unless DNSSEC is separately configured and tested.

---

## 10. Validate Groq model-driven execution

Run the golden workflow in the deployed application.

Required runtime result:

```text
modelProvider: groq
modelDriven: true
```

The resulting Triage → Billing delegation purpose must contain the validated structured model decision.

If Groq is unavailable, the deterministic fallback may keep the demo operable, but the final submission should not claim that run was model-driven.

---

## 11. Validate the deployed judging path

From a clean browser session:

### Domain

- environment label is correct;
- real name.com status succeeds;
- real provider state appears;
- sandbox warning remains visible when applicable.

### Valid run

Run case `#194`.

Required:

- `$85` request;
- `$100` signed cap;
- Triage/Billing/Refund are distinct identities;
- signed Root/Delegation/Action/Gateway/Execution evidence exists;
- Gateway decision is `allowed`;
- protected simulator returns `sim-refund-194-usd-8500`;
- execution is `confirmed`;
- identity resolution is valid in the configured mode;
- all six verification dimensions pass;
- no private key appears in network responses or evidence.

### Authority attack

Required:

- `$850` request;
- Gateway returns blocked;
- reason includes `DELEGATED_LIMIT_EXCEEDED`;
- protected tool call count is zero;
- no Execution Receipt exists;
- no transaction exists.

### Tamper attack

Required:

- start from a valid `$85` run;
- stored Action Request display amount changes to `$850`;
- verification fails from the altered evidence;
- first broken receipt is the Action Request;
- downstream Gateway/Execution/Run Seal evidence is marked affected.

---

## 12. Runtime and security inspection

Inspect:

- Vercel build logs;
- Vercel runtime errors/logs;
- browser console;
- browser network responses;
- exported evidence bundle;
- screenshots selected for submission.

Required:

- no critical runtime errors;
- no provider secrets/private signing keys;
- no raw model chain-of-thought;
- no fake DNS/DNSSEC language;
- no blocked action represented as executed.

---

## 13. Final repository validation

```bash
npm test
npm run build
git status --short
```

Inspect the final diff before committing.

Do not commit:

- `.env*` other than `.env.example`;
- `.proofroot/`;
- Vercel local metadata containing secrets;
- name.com tokens;
- Groq keys;
- signing key JSON.

Update:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/STATUS.md`

with the actual live provider/deployment evidence.

Push only safe repository changes.

---

## 14. Submission artifacts

After the deployed browser path is stable:

1. capture final screenshots;
2. record the 2–4 minute demo using `docs/DEMO.md`;
3. finalize Devpost using `docs/DEVPOST.md`;
4. verify every public security claim against the live implementation one last time.
