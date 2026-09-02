# Status

Current phase: Phase 0 — Lock the Demo Contract and Environments
Current objective: Finish external environment verification before expanding into the product foundation.

Completed:
- Confirmed `Shiv-aurora/DevNetwork-hackathon` was a fresh empty repository.
- Persisted the supplied product north star and implementation plan in `docs/`.
- Selected **Name.com Sandbox / Provider-Backed Verification** as the truthful default identity mode until a production domain is independently confirmed.
- Selected Vercel as the deployment target.
- Selected an explicitly labeled deterministic refund simulator for the P0 protected-tool path.
- Locked the golden demo contract: support case `#194`, valid refund `$85`, delegated cap `$100`, authority attack `$850`, tamper value `$850`.
- Added secret-safe environment configuration, a name.com connectivity checker, deterministic simulator tests, and CI.
- Updated the connectivity checker to use the current name.com CORE v1 API for both authenticated connectivity (`GET /core/v1/hello`) and read-only account state (`GET /core/v1/domains`).
- Made the checker report the active environment, HTTP results, managed-domain count, sandbox-resource availability, identity mode, and public-DNS limitation without printing credentials, account usernames, provider error bodies, or domain details.
- Configured Groq as the primary deployed AI provider in `.env.example`, with separate `GROQ_API_KEY` and `GROQ_MODEL` secret/configuration inputs and an explicitly optional local-model fallback.

Last verified:
- Remote `main` contains the expected Phase 0 contract, simulator, tests, connectivity checker, and secret exclusions.
- GitHub Actions CI completed successfully for remote commit `c8cfb14` in run `33678968635` before this handoff's changes.
- Node tests passed `5/5`, verifying the fixed demo contract, stable simulator transaction ID `sim-refund-194-usd-8500`, missing-credential failure, safe sandbox-result formatting, and secret-safe authentication failure diagnostics. These name.com tests validate checker behavior only; they are not represented as external connectivity evidence.
- On 2026-09-02, the checker was compared with the current official name.com CORE v1 documentation: sandbox base URL `https://api.dev.name.com`, HTTP Basic Auth, `-test` username suffix, `GET /core/v1/hello`, and read-only `GET /core/v1/domains`.
- name.com sandbox behavior is intentionally treated as provider-backed lookup, not public DNS.
- A real `npm run check:namecom` attempt failed clearly with exit status `2` before making a network request because `NAMECOM_USERNAME` and `NAMECOM_TOKEN` were absent from the Codex process and desktop launch environment.
- The dedicated browser session was also logged out of name.com, so no browser-held account session was available as an alternative source of real account evidence.

Blockers:
- Required sandbox credential variables `NAMECOM_USERNAME` and `NAMECOM_TOKEN` are not available in the Codex environment. Real name.com authentication, domain visibility, and sandbox-resource availability therefore remain externally unverified; Phase 0 connectivity acceptance is not complete.
- Production name.com domain availability/public DNS has not been established; no production DNS claim should be made.
- `GROQ_API_KEY` and `GROQ_MODEL` are not available, so Groq model connectivity for the later multi-agent workflow is externally unverified.

Next:
- Supply `NAMECOM_USERNAME` (including the `-test` suffix) and `NAMECOM_TOKEN` as uncommitted environment secrets, then run `NAMECOM_ENV=sandbox npm run check:namecom` and record the returned HTTP statuses and managed-domain count.
- Supply `GROQ_API_KEY` and `GROQ_MODEL` as deployment secrets/configuration and confirm the configured model can be called from the deployed app.
- Confirm CI completes successfully on `main`.
- If those checks succeed, close Phase 0 and begin Phase 1 product foundation.
