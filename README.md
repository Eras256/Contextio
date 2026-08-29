# Contextio: Agentic Treasury and Payroll for LATAM on Stellar

> Software is starting to move company money on its own. Afterward, nobody can
> prove that a specific payment was authorized under specific terms. Contextio
> is an AI agent that moves treasury and payroll funds for companies in
> Brazil, Argentina, and Colombia, and it binds every action it takes to a
> verifiable Legal Context Protocol (LCP) document, so that proof exists.
> Treasury settles in digital dollars and XLM on Stellar, earns yield through
> DeFindex and Blend, and off-ramps through anchors and local rails (PIX,
> Transferencias 3.0, Bre-B). Users sign in with a Stellar wallet (Sign In
> With Stellar, SEP-53), no passwords.

Contextio started as a submission for the Stellar PULSO Hackathon. It is now
a working project aimed at the SCF Integration Track and real production use.
It runs live on both Stellar testnet and mainnet. Testnet runs the full
autonomous stack: a 24/7 agent that rebalances treasury and lends idle cash
on its own. Mainnet is narrower on purpose. It serves read-only data (real
on-chain prices and real activity) and self-custody actions, nothing else.
Every mainnet transaction is built as an unsigned XDR and signed by the
tenant's own wallet. Contextio holds no key that could move mainnet funds. A
boot guard enforces that: the process will not start if a signer secret is
present. See [Mainnet](#mainnet) below for detail. Mainnet access is
invitation-only while the Soroban contracts wait for external audit. All
code in this repository is original.

## Live

### Testnet

Testnet runs full autonomy. Everything below settles for real.

| Surface | URL / ID |
| :-- | :-- |
| Web app | https://www.contextio.xyz (Testnet is the default network) |
| API (Fly.io, region GRU) | https://contextio-api.fly.dev |
| Autonomous agent (Fly.io, GRU) | app `contextio-agent`. Rebalances and lends 24/7, no human in the loop. |
| Treasury contract | [`CASGAQ...MXPTA7I`](https://stellar.expert/explorer/testnet/contract/CASGAQQVHDF4Q2XTK3QWYHRABYX7JUIO6HCLEOZZR7V3TIMVHMXPTA7I) |
| Payroll contract | [`CDXML4...OIRCT`](https://stellar.expert/explorer/testnet/contract/CDXML4PU5RVXQ7DSM7UO5OURKFUJMPGI57PRZCQ3NZTKFGPOIDIOIRCT) |
| Smart Account (policy-gated agent signer) | account [`CAMEOVP...46DCID`](https://stellar.expert/explorer/testnet/contract/CAMEOVPRT3PISVDQ5R6JY6NFUFQDR25AR6UV4IS5HXPNMHLDFN46DCID), spending-limit policy [`CDDF3B2...7K45AL`](https://stellar.expert/explorer/testnet/contract/CDDF3B2SPJFZVSAYWXJ3ROHJDKDW667HIRTP34CROWHZHEUEWK7K45AL). The live agent's Blend supply and withdraw are authorized through this, not a raw hot-key signature. |
| DeFindex vault (real yield) | [`CDR4WR...P4UJGTHS`](https://stellar.expert/explorer/testnet/contract/CDR4WRWLHN2KNAEWT4ZFOL42WDQAHF3N7TLYB7QA5IORUS7XP4UJGTHS) |
| Reflector price oracle (SEP-40) | [`CCYOZJ...OMJRN63`](https://stellar.expert/explorer/testnet/contract/CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63), live at [`/api/v1/public/oracle`](https://contextio-api.fly.dev/api/v1/public/oracle) |
| Self-hosted Anchor Platform (SEP-1/10/31/38) | app `contextio-anchor-platform`. Real protocol capability, deliberately never connected to a bank account (see [Mainnet](#mainnet) for why). |
| Client SDK (npm) | `contextio-sdk`, `npm i contextio-sdk`. Version 0.3.0, published 2026-08-06 with the real Level-4 LCP schema. Types match what the API actually returns. |
| Demo video | https://youtu.be/JI7KpNQMo0A |
| Pitch deck | https://www.contextio.xyz/pitch |

Connect Freighter (network toggle defaults to Testnet) at the web app, sign
the message, then explore live treasury, agent, and payroll data.

### Mainnet

Mainnet is live and real, and deliberately narrow.

| Surface | URL / ID |
| :-- | :-- |
| Web app | https://www.contextio.xyz. Switch the network pill in the navbar to Mainnet. |
| API (Fly.io, region GRU) | https://contextio-api-mainnet.fly.dev |
| Reflector price oracle (SEP-40, real XLM/USD) | [`CAFJZQ...P34DLN`](https://stellar.expert/explorer/public/contract/CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN), live at [`/api/v1/public/oracle`](https://contextio-api-mainnet.fly.dev/api/v1/public/oracle) |
| Legal Context Protocol document | same canonical document as testnet, below. One shared source of truth per tenant domain, not a separate copy. |
| Treasury / Payroll Soroban contracts | not deployed on mainnet. Self-custody there settles through classic Stellar operations, or calls into Blend's own audited contracts, never Contextio's unaudited ones. See [Mainnet](#mainnet) above. |
| Autonomous agent | not running on mainnet. `GET /api/v1/public/activity` on the mainnet API returns `agentAddress: null`. Verify it yourself; no autonomous hot-key process exists there. |
| Access | invitation-only, gated by an explicit tenant allowlist, while the contracts wait for external audit. |

`GET https://contextio-api-mainnet.fly.dev/readyz` reports live health.
`GET .../api/v1/public/activity` is the same honest, sanitized activity feed
as testnet's. Check it yourself; don't take the table above on faith.

---

## What's inside (monorepo)

```
contextio/
├─ apps/
│  ├─ web/         Next.js frontend: wallet sign-in, live API data, Supabase Realtime
│  ├─ api/         Express/TS backend (Fly.io): wallet auth, treasury, payroll, LCP, integrations
│  └─ worker/      Agent loop, scheduled payroll (Fly.io)
├─ packages/
│  ├─ shared/      domain types, logger, Supabase and Stellar clients, LCP module
│  ├─ config/      type-safe env (zod), RBAC capability matrix, security settings
│  ├─ tests/       fixtures, DeFindex/Blend mocks (built dep used by the API)
│  └─ sdk/         public client SDK published to npm as contextio-sdk
├─ contracts/
│  ├─ treasury/    Soroban (Rust): LCP-bound treasury flows
│  └─ payroll/     Soroban (Rust): idempotent, LCP-bound payroll runs
├─ supabase/       Postgres schema (migrations), RLS, seed, full_setup.sql
└─ .github/        CI (Node, Soroban, E2E)
```

The worker has no privileged path of its own. It acts through the API with
`x-internal-secret` auth, so legal-context enforcement, RBAC, and audit
logging apply identically to the agent and to human operators.

## Architecture (flow)

```
Company Treasury (USDC, XLM, RWA)
        │  custody stays with the company
        ▼
Stellar wallet sign-in (SEP-53) ─▶ API (Fly.io) ─▶ Soroban contracts ─▶ DeFindex / Blend / Anchors
AI Agents ──▶ API / Worker ────────────┤                    │
                    ├── Supabase (accounts, payroll, audit, LCP refs) + Realtime
                    └── Legal Context Protocol binding on every agentic tx
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the Overview page diagram.

## Authentication (Sign In With Stellar, SEP-53)

No email or password. Users connect a Stellar wallet (Freighter, xBull,
Albedo, Lobstr, and others, through Stellar Wallets Kit) and sign a server
challenge:

1. `POST /api/v1/auth/wallet/challenge` returns a stateless, HMAC-signed, time-boxed message.
2. The wallet signs it (SEP-53 message signing).
3. `POST /api/v1/auth/wallet/verify` verifies the ed25519 signature over
   `SHA256("Stellar Signed Message:\n" + message)`, maps the address to a
   user, and mints a session JWT (HS256).

That single JWT authenticates the API and authorizes Supabase Realtime/RLS
(`auth.uid() = sub`). The auth middleware also accepts asymmetric Supabase
JWTs via JWKS (ES256) for forward compatibility.

## The Legal Context Protocol (LCP)

Each tenant publishes a machine-readable terms document at
`https://{tenant-domain}/.well-known/contextio-legal-context.json` (terms,
jurisdiction, consent requirements, dispute channels, authorized settlement
networks/assets). The platform computes a canonical SHA-256 of that document
and binds the hash into every agentic Stellar transaction (treasury flow /
payroll run) and audit record. This makes the legal basis of an action
independently verifiable. Implementation:
[`packages/shared/src/lcp`](packages/shared/src/lcp). The `contextio-sdk`
lets any client re-derive and verify that hash with byte-for-byte parity.

The document is field-conformant with the independent
[Legal Context Protocol standard](https://legalcontextprotocol.org) (AAA and
Integra Ledger, with SDF as a founding contributor). `terms` is a real,
standalone markdown file, not a rendered page, which the spec disallows.
`atrHash` is a real SHA-256 hash of that file's actual bytes. `disputeResolution`
names a real arbitration venue for each jurisdiction: Brazil, Argentina,
Colombia, and Switzerland as a neutral arbitration seat. See
`/legal/disputes/{br,ar,co,ch}`.

Verify it yourself. No trust required, three commands:
```bash
# 1. Fetch the live discovery document and read the declared hash + version
curl -s "https://contextio-api.fly.dev/.well-known/contextio-legal-context.json?domain=contextio.xyz" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["atrHash"], "v"+str(d["version"]))'

# 2. Fetch the terms document it points to, independently
curl -s "https://contextio-api.fly.dev/.well-known/contextio-terms.md" -o terms.md

# 3. Hash it yourself and compare to the atrHash from step 1
sha256sum terms.md
```
As of this writing, that's
`atrHash: 0x579eeabf5f640d9cbb274824287fa7d1ef540ae9cc773e79f6d2cec913b4237e`,
document version `8`. The `sha256sum` above should produce the same value,
without the `0x` prefix. The same document and hash are served from both the
testnet and mainnet APIs. It is one canonical source of truth per tenant
domain, not a separate copy per network.

## Client SDK (`contextio-sdk`)

```bash
npm i contextio-sdk
```

```ts
import { ContextioClient, signInWithStellar, hashLegalContext } from "contextio-sdk";
import { StellarWalletsKit, Networks, defaultModules } from "@creit.tech/stellar-wallets-kit";

const client = new ContextioClient({ baseUrl: "https://contextio-api.fly.dev" });
StellarWalletsKit.init({ network: Networks.TESTNET, modules: defaultModules() });
const { address } = await StellarWalletsKit.authModal();

const session = await signInWithStellar({
  client, address,
  signMessage: async (m) => (await StellarWalletsKit.signMessage(m, { address })).signedMessage,
});
const api = client.withSession(session);
const treasury = await api.treasury();
```

Isomorphic (browser + Node >= 18), ESM, zero server deps. Source:
[`packages/sdk`](packages/sdk).

---

## Quickstart

Prerequisites: Node >= 20, pnpm >= 10, Rust (stable + `wasm32-unknown-unknown`),
and optionally the Supabase CLI and Stellar CLI.

```bash
pnpm install

# Build workspace packages first (apps depend on their d.ts):
pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter @contextio/tests build

cp .env.example .env.local    # fill in values (works in mock mode with blanks)
```

`apps/api` and `apps/worker` dev scripts auto-load the repo-root `.env.local`
(`tsx --env-file-if-exists`). `apps/web` (Next.js) loads `apps/web/.env.local`,
public `NEXT_PUBLIC_*` variables only.

### Run locally

```bash
pnpm dev:web      # http://localhost:3000  (connect a wallet, or browse demo data)
pnpm dev:api      # http://localhost:8080  (REST API; mock integrations if keys unset)
pnpm dev:worker   # agent loop (needs the API running)
```

With no DeFindex/Blend credentials, those integrations run in deterministic
mock mode, so the full stack works offline.

### Configure Supabase

1. Create a project (or `supabase start` locally).
2. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_JWT_SECRET` in `.env.local`. The JWT secret is the project's
   Legacy JWT Secret, used to verify and mint HS256 session tokens.
3. Apply schema and seed (migrations `0001` to `0004`, RLS, seed):
   ```bash
   supabase db reset            # local
   # hosted: run supabase/full_setup.sql against the project (pooler connection)
   ```
See [supabase/README.md](supabase/README.md).

### Soroban contracts

```bash
cargo test --all                                   # unit tests (fast, native)
cargo build --release --target wasm32-unknown-unknown
# deploy + wire contract ids: see contracts/README.md
```
Already deployed on testnet; IDs are in the Live table above. Set
`TREASURY_CONTRACT_ID`, `PAYROLL_CONTRACT_ID`, and `STELLAR_SERVICE_SECRET`
to settle on-chain instead of in simulation.

### Deploy

**API on Fly.io** (region GRU, single machine):
```bash
fly apps create contextio-api
fly secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  SUPABASE_JWT_SECRET=... INTERNAL_API_SECRET=... STELLAR_SERVICE_SECRET=... \
  TREASURY_CONTRACT_ID=... PAYROLL_CONTRACT_ID=... CORS_ORIGINS=https://<your-web>.vercel.app
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --ha=false
```
Run `fly deploy` from the repo root so workspace packages resolve.

**Web on Vercel** (standalone from `apps/web`):
```bash
vercel deploy --prod --cwd apps/web --yes
# set NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
#     / NEXT_PUBLIC_STELLAR_NETWORK on the Vercel project
```
After deploying the web, add its domain to the API's `CORS_ORIGINS`.

**API on Fly.io, mainnet variant. Do not copy the testnet command above.** A
mainnet deployment must set `STELLAR_NETWORK=mainnet`. It must not set
`STELLAR_SERVICE_SECRET`, `BLEND_SIGNER_SECRET`, `TREASURY_CONTRACT_ID`, or
`PAYROLL_CONTRACT_ID` at all. `assertMainnetHasNoHotKey`
(`packages/config/src/env.ts`) refuses to boot otherwise, on purpose. Only
`MAINNET_ALLOWLIST_TENANT_IDS` and `PUBLIC_ACTIVITY_TENANT_ID` are
mainnet-specific additions on top of the shared secrets above.

---

## Testing

```bash
pnpm lint          # eslint across all TS packages + next lint
pnpm typecheck     # tsc --noEmit across packages
pnpm test          # vitest (config, shared, api, worker, sdk): 38 tests
pnpm test:e2e      # Playwright E2E (web)
cargo test --all   # Soroban contract unit tests: 16
```

What's covered: LCP hashing/binding and money math (shared), env validation
(config), HTTP/auth/RBAC, agent planning, and DeFindex/Blend integration (api),
scheduler (worker), SDK LCP parity (sdk), key UI flows (web E2E), and contract
logic including idempotency, auth, and balance invariants (Soroban). CI mirrors
these in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Security posture

- **Non-custodial.** Keys stay with the company. On testnet, the agent
  invokes authorized contract methods through a policy-gated Smart Account,
  with spending-limit caps per target contract, verified with real
  transactions.
- **Mainnet cannot hold a signing key.** `assertMainnetHasNoHotKey` refuses
  to boot any process with `STELLAR_NETWORK=mainnet` if a signer secret is
  present. This is tested, and independently confirmed against the real
  deployed secrets: none are present. Every mainnet action is self-custody
  by construction.
- **Wallet auth.** Sign In With Stellar (SEP-53), verified server-side.
  Sessions are short-lived JWTs. The API also supports Supabase JWKS (ES256)
  verification. On mainnet, new wallets get a clean `401` instead of any
  auto-provisioning, verified live with a freshly generated, correctly
  signed random wallet.
- **RBAC.** Declarative capability matrix in `@contextio/config`, enforced
  at the API.
- **Mainnet access control.** `MAINNET_ALLOWLIST_TENANT_IDS` gates every
  self-custody endpoint to a real, explicit tenant allowlist, one internal
  tenant today. This is an account-level control, independent of network
  location.
- **Mainnet geo-restriction.** Self-custody actions are unavailable from the
  EU/EEA, US, and China by default. This is a blocklist of well-documented
  regimes, not a closed-until-proven-safe allowlist. It is enforced both
  technically, in `apps/web/src/middleware.ts`, and contractually, with a
  real per-action jurisdiction-attestation checkbox in
  `apps/api/src/http/schemas.ts`.
- **Input validation.** Zod on every state-changing endpoint.
- **Hardening.** Helmet and explicit headers, CORS allowlist, per-route rate
  limits, body-size cap. Secrets are redacted in logs.
- **LCP gate.** Agentic operations return HTTP 412 unless a legal context is
  published and the action's required consents are satisfied. See
  [Verify it yourself](#the-legal-context-protocol-lcp) above for the real hash.
- **RLS.** Browser and anon Supabase access is tenant-scoped. The
  service-role key is server-only. Realtime subscriptions are
  RLS-authorized with the session JWT.

See [docs/SCF-INTEGRATION.md](docs/SCF-INTEGRATION.md) and
[apps/api/README.md](apps/api/README.md) for the API surface. See
[docs/PRIOR-ART.md](docs/PRIOR-ART.md) for how Contextio compares to other
funded Stellar projects in payroll and treasury automation: named
competitors, verified against their own sites, with an honest account of
which differences are architectural and which are just naming.

## What's real today, verifiable on-chain

Every claim below has a command or a link next to it. Check it yourself
rather than taking the bullet on faith.

### Testnet

- **Autonomous agent, live 24/7.** `contextio-agent` on Fly rebalances
  treasury and lends idle cash on its own, within owner-signed rules.
  `GET /api/v1/public/activity` returns its real Stellar address and a
  rolling window of its real decisions.
- **Real Blend lending, self-custody by policy.** Idle USDC supplied to the
  Blend pool (`PoolContractV2`) is authorized through the Smart Account
  (`CAMEOVP...46DCID` above). It discovers however many Soroban auth
  contexts a call produces and gates each one against a spending-limit
  policy. Verified with real, confirmed Supply and Withdraw transactions.
- **Real DeFindex vaults.** XLM yield vaults. Users deploy their own through
  the DeFindex factory, signed in Freighter for self-custody.
- **Real on-chain price oracle, Reflector.** The treasury values XLM, and
  EURC where held, in USD from Reflector's SEP-40 oracle on Stellar, read
  through Soroban simulation, not a hardcoded rate. Live proof:
  `GET /api/v1/public/oracle`.
- **Real USDC payroll.** Salaries settle to employee wallets in BR/AR/CO in
  a Horizon batch transaction, testnet demo-scaled 1:100. Verified example:
  [`4bd1b927...bc12cf78`](https://stellar.expert/explorer/testnet/tx/4bd1b927df7ab404dcd56abe649dcd47f56aa174b8116c747ec4f1aabc12cf78).
- **Self-custody, "Move capital."** Builds an unsigned transaction. The user
  signs in Freighter, and it settles through Soroban RPC. Keys never leave
  the wallet.
- **Real, self-hosted SEP-1/10/31/38 anchor**, `contextio-anchor-platform`.
  SDF's own `stellar/anchor-platform` image, with a real quoting, discovery,
  and KYC-stub handshake. There is also a lighter, real SEP-24 off-ramp
  against SDF's public reference anchor (`GET /api/v1/public/anchor`). It is
  deliberately never connected to a real bank account; see
  [Mainnet](#mainnet) for why.
- **Real AI reasoning layer.** A pluggable LLM writes each decision's
  rationale, OpenAI by default. Bring your own key for Claude, Gemini, Grok,
  and others, through an OpenAI-compatible gateway with no SSRF risk. The
  on-chain decision stays deterministic and auditable. The LLM only
  explains it.
- **Live dashboards.** Every KPI, position, and activity row is read from
  on-chain state or the API, no mock when signed in, with verifiable
  explorer links.

### Mainnet

Mainnet runs the same codebase. The money-moving surface is structurally
cut down until the contracts are audited:

- **A hot key cannot exist on the mainnet process.**
  `assertMainnetHasNoHotKey` (`packages/config/src/env.ts`) refuses to boot
  any process with `STELLAR_NETWORK=mainnet` if a signer secret is present.
  This is tested in `apps/api/test/envGuard.test.ts`, and independently
  confirmed against the real deployed secrets on `contextio-api-mainnet`:
  no `STELLAR_SERVICE_SECRET` or `BLEND_SIGNER_SECRET` is present. This is
  why there is no autonomous agent, no Blend/DeFindex auto-rebalancing, and
  no Treasury/Payroll Soroban contract on mainnet. None of that is possible
  without a key, and Contextio has made that key impossible to hold there.
- **Self-custody Treasury and Payroll actions work the same as testnet.**
  The client builds an unsigned XDR, signs it in their own wallet, and
  submits it. Payroll settles through a classic Stellar payment operation,
  with no unaudited contract in the mainnet path. Treasury calls Blend's
  own audited pool contract directly.
- **Invitation-only.** `MAINNET_ALLOWLIST_TENANT_IDS` gates every
  self-custody endpoint to a single internal tenant today. This is a real
  account-level control, not an IP check. Verified live with a freshly
  generated, correctly SEP-53-signed random wallet: it gets a clean
  `401 "No workspace for this wallet"` instead of being auto-provisioned.
- **Geo-restricted by default, for a documented reason.** Self-custody
  actions are unavailable from the EU/EEA, the United States, and China
  until those specific regimes are reviewed. That's MiCA, FinCEN and BSA
  plus roughly 50 state money-transmitter regimes, and China's outright
  prohibition. See the Terms' "Restricted Jurisdictions" section.
  Everywhere else is open by default. This is backed by both a technical
  check, in `apps/web/src/middleware.ts`, and a real per-action
  jurisdiction-attestation checkbox.
- **Real on-chain price oracle.** Same Reflector integration as testnet,
  reading mainnet's real oracle contract from the table above, not a
  mirrored value.

**Production last mile.** Local off-ramp rails, PIX, Transferencias 3.0, and
Bre-B, need a licensed anchor partner in production, and that business
relationship doesn't exist yet. BlindPay is the researched candidate: real
Stellar support, an unsigned-XDR flow that matches this project's model, but
no API key configured anywhere. It's confirmed inert. Soroban Audit Bank is
the intended path to auditing `contracts/treasury` and `contracts/payroll`
before they touch mainnet, gated on prior SCF funding.

**What's next.** External audit of the Soroban contracts, which unblocks a
mainnet Smart Account migration mirroring testnet's. A licensed anchor
relationship for real PIX and Bre-B settlement. Multi-entity treasury. LCP
as an open standard for accountable on-chain agents.

## Team

A team building for LATAM, two of them Stellar Ambassadors:

- **Giovanny Amador (Gio)**, Founder and lead architect, Stellar México
  Ambassador. Built the full technical protocol: Soroban contracts, the
  autonomous agent, TS/Python SDKs, and the "LLM proposes, the contract
  decides" security pattern. 3rd place, Fintech World Cup MX 2026. ETH
  Uruguay and ETH MX hackathon winner.
- **Monserrat Mendoza (Monse)**, Cofounder and COO, Stellar México
  Ambassador. Leads operations, product, and UX/UI. SCF Kickstart
  co-applicant. 3rd place, Fintech World Cup MX 2026.
- **Gonzalo Chacón**, Cofounder and CCO. Program and go-to-market: 14+ years
  of enterprise delivery, Senior PM at UST, MBA in finance, Scrum Master.
  Leads commercial development and the in-person pitch across BR/AR/CO.

Gio and Monse co-created [Nirium](https://nirium.xyz) before starting
Contextio. Through that project they went through SDF SCALE and Impacta,
took part in BBVA Open Deal, and won an SCF Instaward at Alebrije/SCALE.

## Customer discovery

Built with and for real LATAM founders. We're running recorded
customer-discovery interviews validating the pain (idle cash losing value,
costly cross-border payroll, manual treasury) and our solution. Interviews:
https://drive.google.com/drive/folders/1OU8ShexpLqSakSd3ytPVS9WYWvodprUS?usp=sharing

## Contributing

Contributions, issues, and reviews are welcome, whether you're a judge
evaluating the project or a developer extending it. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full quickstart (prereqs, build order, mock dev, and what "done" means).

**Getting started.** Fork and clone the repo, then follow
[Quickstart](#quickstart): `pnpm install`, build the workspace packages,
then `cp .env.example .env.local`. Everything runs in deterministic mock
mode with blank credentials, so you can review offline. Create a feature
branch: `git checkout -b feat/your-change`.

**Before opening a PR**, keep CI green:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cargo fmt --all -- --check && cargo clippy --target wasm32-unknown-unknown -- -D warnings && cargo test --all
```

**Conventions**
- **TypeScript.** Strict types, no `any`, prefer `unknown`. Explicit `.js`
  extensions on relative imports in backend ESM packages. Validate every
  state-changing HTTP body with `zod`. Log through the structured
  `@contextio/shared` logger and redact secrets.
- **Architecture rules.** All agentic actions go through `apps/api`. The
  worker never writes on-chain or to the database directly; it calls the
  API with `x-internal-secret`. Treasury and payroll state-changers must
  carry a valid LCP binding, or return HTTP 412. New Postgres tables get
  RLS policies.
- **Soroban.** Persistent storage with `extend_ttl`. Payroll idempotency on
  `run_id`. Emitted events always include the canonical LCP SHA-256 hash.
- **Commits.** Short, imperative messages. Small, focused PRs. Never commit
  secrets; `.env*` files are gitignored (see [.env.example](.env.example)).

**Security**: please report vulnerabilities privately to the maintainers
rather than opening a public issue.

**AI assistance.** This repository is built with AI assistance. See
[docs/AI-USAGE.md](docs/AI-USAGE.md) for what is disclosed, what never gets
asserted without a human confirming it directly, and the commit-trailer
policy. Engineering rules, including build and test commands, code
conventions, and the non-custodial invariants as hard requirements, are in
[docs/CLAUDE.md](docs/CLAUDE.md).

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).

```
Copyright 2026 Contextio

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
