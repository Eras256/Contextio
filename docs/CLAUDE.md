# Contextio — Engineering Guidelines

Public engineering rules for this repository — build/test commands, code
conventions, and the non-negotiable invariants. This is a from-scratch,
public document, separate from any internal notes; it carries no business
strategy, no unreleased competitive analysis, and no third-party names.

## 1. Build and run

Prerequisites: Node ≥ 20, pnpm ≥ 10, Rust (stable + `wasm32-unknown-unknown`
target). Supabase CLI and Stellar CLI are optional, for local DB/contract work.

```bash
pnpm install

# Build shared packages first — apps depend on their compiled output.
pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter contextio-sdk build

pnpm build            # everything (TS packages + web)
pnpm contracts:build  # Soroban contracts to WASM
# or: cargo build --release --target wasm32-unknown-unknown
```

```bash
pnpm dev        # API + Web + Worker together
pnpm dev:web    # Next.js, http://localhost:3000
pnpm dev:api    # Express API, http://localhost:8080
pnpm dev:worker # Agent loop / scheduler (needs the API running)
```

All apps run in deterministic mock mode by default with no external
credentials configured, so the full stack works offline.

```bash
supabase start        # local dockerized Supabase
pnpm supabase:reset    # reset local DB (migrations + seed)
# or: supabase db reset
```

## 2. Testing — required before anything is called done

```bash
pnpm lint
pnpm typecheck
pnpm test          # vitest — config, shared, api, worker
pnpm test:e2e       # Playwright, web
cargo test --all    # Soroban contract unit tests
```

A change isn't finished when the code compiles — it's finished when these
pass and, for anything touching a live-deployed piece, the actual deployed
behavior has been checked directly (a curl against a real endpoint, a read
against a real contract), not just inferred from reading the code.

## 3. Code style

- Explicit `.js` extensions on relative imports in backend ESM packages
  (`apps/api`, `apps/worker`, `packages/shared`, `packages/config`) — Node's
  ESM resolution requires it.
- Strict TypeScript. No `any`; use `unknown` for genuinely dynamic values.
- Every state-changing HTTP endpoint validates its body with `zod` before any
  service logic runs.
- Structured logging via `@contextio/shared`'s logger; secrets and keys are
  redacted, never logged.

## 4. Architecture rules

1. **Single entry point.** All agentic actions go through `apps/api`.
   `apps/worker` never writes on-chain or to the database directly — it calls
   the API with the internal secret, so RBAC, audit logging, and the Legal
   Context Protocol gate apply identically whether the caller is the
   autonomous agent or a human operator.
2. **Auth and DB access follow the same split everywhere.** Wallet auth is
   Sign In With Stellar (SEP-53) — ed25519 challenge/verify in
   `apps/api/src/http/routes/auth.ts`; session tokens verify via the legacy
   HS256 secret or asymmetric JWKS (ES256) against the Supabase pool.
   `apps/web` uses the Supabase anon client, subject to Row Level Security;
   `apps/api` uses the service-role client to bypass RLS for controlled,
   audited writes — every write it makes on a tenant's behalf is recorded to
   `audit_logs`. Don't give the web app the service-role key, and don't have
   the API write tenant data without an audit record.
3. **Non-custodial is a structural invariant, not a setting.** A process
   configured for mainnet (`STELLAR_NETWORK=mainnet`) refuses to boot at all
   if a signer secret (`STELLAR_SERVICE_SECRET`, `BLEND_SIGNER_SECRET`) is
   present — `assertMainnetHasNoHotKey` in `packages/config/src/env.ts`,
   covered by a test that asserts the boot actually fails
   (`apps/api/test/envGuard.test.ts`), not just a comment saying it should.
   Every mainnet money-moving action is an unsigned-XDR "prepare" endpoint the
   caller's own wallet signs — there is no code path on mainnet where this
   platform can hold a key capable of moving a client's funds. Don't add one,
   and don't relax the guard to special-case around it without treating that
   as a security-relevant decision, not a config tweak.

   A second, narrower check enforces the same invariant from the call-site
   side: `assertMainnetNeverAutoExecutesTreasuryActions` (same file) refuses
   any request — `actorType: "agent"` or `"user"` — against
   `TreasuryService.rebalance`, `PayrollService.executeRun`, or the agent's
   direct DeFindex/Blend cycles when `STELLAR_NETWORK=mainnet`, independent
   of whether a signer secret happens to be present. It refuses `"user"` too
   because those two methods are exclusively the *custodial* execution path
   — self-custody prepare/submit calls different methods entirely and never
   reaches this check — so a user-actor landing here on mainnet isn't a
   legitimate caller either, and before this covered "user" it silently
   returned a fabricated `sim:` success instead of rejecting outright. This
   is deliberate belt-and-suspenders: the boot
   guard makes agent-signed mainnet execution impossible today because the
   key can't exist; this check makes it impossible even if some future signer
   (a relayer, a smart-account delegate) stopped counting as a "hot key"
   under that check. The underlying rule for any new design — a mini-app, an
   agent-to-agent payment feature, anything that moves money — is the same:
   money may flow from Contextio's own funds to an individual, but a client's
   own funds only ever move on the client's own signature. State that
   explicitly in the design, don't assume it falls out of the existing
   guards by default.
4. **State-changing treasury/payroll endpoints require a valid Legal Context
   Protocol binding.** Return **HTTP 412** if a legal context isn't published
   or a required consent is missing — this is the enforcement mechanism for
   consent, not a decorative header.
5. **New Postgres tables get Row Level Security policies.** No table holding
   tenant data ships without RLS from the migration that creates it.

## 5. Dependencies and prior art

Read other projects' code to understand an approach; don't copy it into this
repository unless its license actually permits that. A lot of real,
instructive prior art in this ecosystem publishes no license at all, which
legally means all rights reserved — readable, not reusable. Check the license
before adding anything as a dependency or copying a pattern verbatim, not
after.

## 6. Claims and evidence

- **A number presented as if a third party measured it needs that third party
  named.** A self-assessment doesn't get written up as if it were an audit
  result or an external score — say who evaluated it, or don't present it as
  a score at all.
- **Claims about a person's credentials or affiliations get confirmed with
  that person or the team directly** before they're written down — not
  inferred, not assumed to still be current because they were true once.
- **A claim about the live system's state gets checked against the live
  system** before it's written down — a contract address, an API response
  shape, a deployment's configuration. This repository's own history has
  examples of generated text being wrong about exactly these things and
  getting corrected after checking the real deployment, not before.
- **Legal or regulatory claims are read from primary sources** — actual
  statute or regulation text, actual regulator publications — not
  summarized secondhand, and are flagged as pending real legal review rather
  than presented as settled.

## 7. Commits

Commit messages are short and describe what changed and why. Commits produced
with AI assistance carry a `Co-Authored-By: Claude` trailer — see
[AI-USAGE.md](AI-USAGE.md) for the full disclosure and why history before a
certain point doesn't have one. Never commit secrets; `.env*` files are
gitignored (see [.env.example](../.env.example)).
