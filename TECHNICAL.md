# Contextio — Technical Architecture & Stellar Integration Plan

> Autonomous, non-custodial treasury & payroll for emerging-market businesses, built on **Stellar / Soroban**. This document describes the live architecture, the Stellar building blocks we integrate, and the concrete plan to harden them and launch on **mainnet**.

- **Live app:** https://www.contextio.xyz
- **API + 24/7 agent:** https://contextio-api.fly.dev
- **Self-hosted Anchor Platform (SEP-1/10/31/38):** https://contextio-anchor-platform.fly.dev/.well-known/stellar.toml
- **Repo:** https://github.com/Eras256/Contextio
- **Demo:** https://youtu.be/JI7KpNQMo0A

---

## 1. Overview

Contextio is an AI agent that runs **treasury** and **payroll** on Stellar. It keeps enough USDC liquid for payday, puts idle cash to work earning real yield (Blend, DeFindex), prices assets with an on-chain oracle (Reflector), and pays teams across borders — **non-custodial**, with every action bound to owner-signed rules and verifiable on-chain (our Legal Context Protocol). The on-chain **decision is deterministic and auditable**; an LLM only writes the human-readable rationale.

## 2. System architecture

```
        ┌──────────── User (company owner) ────────────┐
        │  Stellar wallet (Freighter via Wallets Kit)   │
        └───────────────┬───────────────────────────────┘
        Sign In With Stellar (SEP-53)  ·  self-custody signing
                        ▼
   ┌──────────────────── API (Fly.io / Express) ────────────────────┐
   │  Auth (SEP-10/53) · RBAC · Legal Context Protocol (LCP) gate    │
   │  Treasury · Payroll · Agent · Integrations                      │
   └───┬───────────┬───────────┬───────────┬───────────┬────────────┘
       ▼           ▼           ▼           ▼           ▼
   Soroban     Blend       DeFindex    Reflector   SEP-24 anchor
   contracts  (lending)    (vaults)    (oracle)    (off-ramp)
   (treasury,                                       PIX/Bre-B (prod)
    payroll)
       │
       ▼
   Supabase (Postgres) — accounts/payroll/audit/LCP refs · RLS · Realtime
       ▲
   24/7 Agent (Fly.io) — calls the API with an internal secret; it has
   **no privileged on-chain path of its own**, so LCP + RBAC + audit apply
   identically to agent and human actors.
```

**Read path:** the dashboard reads **live on-chain state** — wallet balances (Horizon), Blend/DeFindex positions, and Reflector prices via read-only Soroban simulation — aggregated into a USD snapshot (12s TTL cache).
**Write path:** treasury moves are built as unsigned XDR, **signed by the user in Freighter**, and submitted via Soroban RPC; agent/payroll actions are signed by a delegated operational key, always bound to a published LCP document.

## 3. Stellar integrations — live today (testnet)

| Building block | How Contextio uses it | Status |
|---|---|---|
| **Soroban smart contracts** | Treasury + payroll contracts; idempotent, event-driven; every event carries the LCP SHA-256 hash. | ✅ Deployed |
| **Blend** (`PoolContractV2`) | Real USDC lending of idle treasury cash; positions read live. | ✅ Live |
| **DeFindex** | Real XLM yield vaults; users deploy their own via the factory, Freighter-signed (self-custody). | ✅ Live |
| **Reflector** (SEP-40 oracle) | Real on-chain XLM/USD priced via read-only Soroban simulation → drives the treasury's USD valuation (replaces a hardcoded rate). Proof: `GET /api/v1/public/oracle`. | ✅ Live |
| **SEP-10 / SEP-53** | SEP-53 for wallet sign-in **and** agent-authorization consent; SEP-10 challenge/verify for the anchor. | ✅ Live |
| **SEP-24** | Interactive anchor off-ramp (USDC/XLM) against a testnet anchor. | ✅ Live |
| **Anchor Platform (self-hosted)** | Contextio's own deployment of SDF's `stellar/anchor-platform` (v4.6.2) — `platform` (SEP+Platform+event-processor+observer, one JVM process) + a custom Node/TS business/callback server (`apps/anchor-business`) implementing the real callback contract (`GET/PUT/DELETE /customer`, `GET /rate`) + a single-broker Kafka (KRaft) for the internal event queue + a dedicated Postgres. All 4 pieces deployed and wired on Fly.io (`infra/anchor-platform/`). Not the SDF reference anchor — our own infrastructure, our own SEP-1 identity. | ✅ Live |
| **SEP-38** | Real indicative + firm FX quotes (`GET /public/anchor/sep38`) from Contextio's own anchor's `ANCHOR_QUOTE_SERVER` — XLM priced against iso4217:USD/BRL/ARS/COP, all four verified live end-to-end (`/sep38/prices`, `/sep38/price`). No USDC pair configured yet. BRL/ARS/COP rates are a documented demo table (no confirmed live LatAm-fiat oracle on testnet — same limitation Reflector already has), USD uses the real Reflector oracle price. | ✅ Live (4 currencies) |
| **SEP-31** | Real institutional-send discovery (`GET /public/anchor/sep31`) against Contextio's own `DIRECT_PAYMENT_SERVER`. Unlike the SDF reference anchor (whose `receive` map is empty), ours has real receive assets configured for native/BRL/ARS/COP with real funding methods (PIX, Transferencias 3.0, Bre-B) and limits — verified live. Protocol + infrastructure are both real; actually *settling* a payment still needs a licensed local off-ramp partner (see Milestone 2). | ✅ Live (discovery + real receive config) |
| **Horizon** | Batch payments — real USDC payroll to employee wallets in one tx. | ✅ Live |
| **Stellar Wallets Kit** | Freighter/xBull/Albedo/Lobstr connection + self-custody signing. | ✅ Live |
| **OpenZeppelin Channels** (hosted Relayer) | Optional fee-sponsored submission for self-custody Payouts (`apps/api/src/integrations/relayer.ts`) — the fund/fee-sponsor key lives on OpenZeppelin's infrastructure, never ours, so it's safe to enable on mainnet without touching the boot guard. Falls back to direct submission when unset. | ✅ Live (optional) |
| **USDC** | Circle testnet USDC for payroll; positions read on-chain. | ✅ Live |

**Verifiable example:** USDC payroll settled to 3 employees — tx `4bd1b927df7ab404dcd56abe649dcd47f56aa174b8116c747ec4f1aabc12cf78`.

## 4. Security & trust model

- **Non-custodial:** keys stay with the company. The user signs treasury moves in Freighter; the agent uses a delegated operational key bounded by signed rules.
- **"LLM proposes, the contract decides":** the deterministic risk engine chooses the action + amount; the LLM only explains it. Funds are never moved by the model.
- **Legal Context Protocol (LCP):** every agentic action is bound to a hashed, multi-jurisdiction terms document at `/.well-known/legal-context.json`; the canonical SHA-256 is written into every treasury flow, payroll run, and audit record — independently verifiable (re-derivable via `contextio-sdk`). State-changing endpoints return **HTTP 412** without a valid LCP binding.
- **RBAC + zod validation** on every state-changing endpoint; **RLS** on all tenant data; **helmet**, CORS allowlist, rate limits; secrets redacted in logs.
- **Mainnet is receive-only by construction:** a mainnet-configured process refuses to boot if any signer secret (`STELLAR_SERVICE_SECRET`, `BLEND_SIGNER_SECRET`) is present (`packages/config/src/env.ts`) — not a policy, an enforced startup check. Money-moving actions on mainnet exist only as unsigned-XDR "prepare" endpoints (`/treasury/prepare`, `/payroll/runs/prepare`) that the caller's own wallet signs and submits; the platform never holds a key capable of broadcasting them. The legacy agent/service-signed paths (`/treasury/rebalance`, `POST /payroll/runs`) require a signer secret and therefore cannot run against mainnet at all.
- **Payroll payouts are contractor-only.** Every self-custody payout run requires an explicit `contractorAttestation` (the recipients are independent contractors under a commercial contract, never subordinate employees) — Mexican labor law (LFT Art. 101) requires salary to be paid in legal-tender currency, so paying a real "empleado" in USDC would be illegal for the client. The payroll contract's `execute_run` already supported an allowlisted `operator` calling it directly (`contracts/payroll/src/lib.rs`); the self-custody flow uses that existing path rather than the platform's admin key.
- **Mainnet is invitation-only** via an explicit tenant allowlist (`MAINNET_ALLOWLIST_TENANT_IDS`) enforced on every self-custody money-moving endpoint — a stand-in for the full KYB/tier gate on the Milestone 2 roadmap below.

## 5. Deployed contracts (testnet)

- Treasury: `CASGAQQVHDF4Q2XTK3QWYHRABYX7JUIO6HCLEOZZR7V3TIMVHMXPTA7I`
- Payroll: `CDXML4PU5RVXQ7DSM7UO5OURKFUJMPGI57PRZCQ3NZTKFGPOIDIOIRCT`
- Reflector oracle (external, base USD): `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63`
- Smart-treasury signer (OpenZeppelin Stellar Smart Accounts, Milestone 1 — see §6): `CAOCNQZF2HPSB6EVQC7XAU3NOPKJZB5L2LZ5C75QX4J3WBRCAC67UBAK`
- Spending-limit policy (`contracts/spending-limit-policy`): `CAVHNHPHFUSM4I24SDNORFXW45GEFFB46ZFQNCTFMO44ICHCOBMET3SV`

## 6. Integration roadmap — building blocks → mainnet (4 months)

**Building blocks (Integration List):** Soroban · **Blend** · **DeFindex** · **Reflector** · **SEP-24/31/38 anchor** · Stellar Wallets Kit · **OpenZeppelin Channels**.

### Milestone 1 — Unified treasury + oracle hardening *(Tranche #1)*
- Unify the per-integration service accounts into a single **smart-account treasury** (OpenZeppelin Stellar Smart Accounts, policy-based spending limits — one of Stellar's three official 2026 priorities alongside AI/agent-readiness and Soroban DX), so liquidity, **Blend** lending, and **DeFindex** vault positions are held and controlled by one account with a spending-limit policy instead of a raw secret key. This is also the real fix for autonomous agent rebalancing to ever run on mainnet — replaces the hot key the boot guard currently forbids there.
  - **Live on testnet, verified on-chain (2026-08-04):** `contracts/spending-limit-policy` (a thin wrapper over OpenZeppelin's audited `stellar_accounts::policies::spending_limit` module — not our authorization logic, theirs) + `contracts/smart-treasury` (an OpenZeppelin `SmartAccount`/`CustomAccountInterface` implementation with one `Signer::Delegated` — the agent's real Ed25519 address, `GCTULX2PT…254U`, the same one used for testnet rebalancing today — bounded by that policy, scoped to the USDC token via `ContextRuleType::CallContract`). Confirmed via `get_context_rule(0)`: the deployed rule holds exactly that signer and that policy, cap 100 USDC/day (`1_000_000_000` stroops / `17280` ledgers). 3 native contract tests cover constructor wiring, an accepted within-cap transfer, and a rejected over-cap one (`Error(Contract, #3221)`).
  - **Not yet done:** the live 24/7 testnet agent still signs Blend/DeFindex calls directly with the raw `BLEND_SIGNER_SECRET`/`STELLAR_SERVICE_SECRET` key — it has not been migrated to sign *through* this smart account. That migration (routing `AgentService`'s calls through `CAOCNQ…C67UBAK`'s `execute` entrypoint instead of straight to Blend/DeFindex) is real, separate work, deliberately not rushed in the same pass as deploying the contracts — the existing testnet demo runs live every few minutes and migrating its signing path blind risked breaking it.
- Expand **Reflector** to feed FX pairs into the agent's risk/buffer engine (not just XLM/USD valuation); pair with **SEP-38** (below) for a firm quote instead of an estimated buffer.
- *Done when:* the agent's live rebalance calls route through the smart-account signer, not just the standalone contracts existing on-chain. Like all fund-governing contract logic, moving this to mainnet still requires the Milestone-3 audit regardless of the signer model.

### Milestone 2 — Real off-ramp + multi-entity *(Tranche #2)*
- **Self-hosted Anchor Platform, standing up our own SEP-31/38 anchor** rather than just a client against someone else's — SDF's `stellar/anchor-platform` (v4.6.2) deployed for real, not the reference anchor: `platform` (sep-server + platform-server + event-processor + stellar-observer, one JVM process) + a custom Node/TS callback business server (`apps/anchor-business`, implements `GET/PUT/DELETE /customer` and `GET /rate` against the real callback API contract — verified field-by-field against `api-schema/.../callback/*.java`, not guessed) + a single-broker Kafka (KRaft mode) for the internal event queue + a dedicated Postgres. Own SEP-1 identity, own testnet distribution account (`GB7U6HCA7Y…4JOQ2IBGB5EH6`).
  - **Live on testnet (2026-08-04), verified end-to-end:** `GET /.well-known/stellar.toml` (SEP-1), `GET /auth` (SEP-10 challenge, real signed XDR), `GET /sep38/prices` + `/sep38/price` (SEP-38 — XLM priced against USD/BRL/ARS/COP, all four self-consistent to the platform's own `price*buy_amount+fee≈sell_amount` rounding check, computed with exact decimal arithmetic via `decimal.js` rather than floats — floats alone weren't precise enough once buy_amount hit the hundreds of thousands for ARS/COP), `GET /sep31/info` (SEP-31 — real `receive` config for native/BRL/ARS/COP with PIX/Transferencias 3.0/Bre-B funding methods, unlike the SDF reference anchor's empty `receive` map). Public proof still exposed the same way: `GET /api/v1/public/anchor/sep38` and `/sep31` (`apps/api/src/integrations/anchor.ts`, now pointed at `ANCHOR_SEP3138_URL` = our own anchor, separate from `ANCHOR_SEP24_URL` which still targets the SDF reference anchor since SEP-24 isn't enabled on ours yet).
  - **Not yet done:** SEP-24 (interactive deposit/withdraw) isn't enabled on our own anchor — the existing off-ramp button still uses the SDF reference anchor for that specific flow. Reporting a received SEP-31 payment back to the Platform API via JSON-RPC (closing the transaction lifecycle end-to-end) isn't wired yet either — what's verified is discovery + quoting + the SEP-10/KYC-stub handshake, not a full settled transaction.
  - **Still gated on a business step, not code:** actually *receiving* real fiat on the other end needs a licensed local off-ramp partner (e.g. a PIX/SPEI/PSE-capable provider like BlindPay or Koywe) — that relationship doesn't exist yet, and no amount of additional integration code changes that. The protocol-level anchor is real and self-operated now, not borrowed; the settlement corridor is not.
- **Stellar Disbursement Platform (SDP)** for the bulk-payout engine itself — committed in the original CV Labs Integration track application ("Blend v2 + DeFindex + SDP") but not yet built. SDP is a real multi-service deployment (dashboard + core API + transaction-submission service, its own distribution + SEP-10 accounts) built *on top of* Anchor Platform — now that the Anchor Platform layer underneath it is real and deployed, SDP is the next concrete step rather than a re-sequenced one.
- Multi-entity treasury + KYC/KYB onboarding.
- *Done when:* a real off-ramp transaction settles via SEP-31 through a licensed anchor; SDP running a real bulk disbursement; ≥1 multi-entity tenant live with KYB.

### Milestone 3 — Mainnet launch *(Tranche #3)*
- Deploy treasury + payroll Soroban contracts to **mainnet**; onboard the first pilot customer settling real value; professional user testing.
- *Done when:* contracts live on mainnet; ≥1 pilot moving real USDC payroll + treasury on mainnet.

*(Budget excludes marketing and security-audit costs, per SCF rules; audit credits are applied at Tranche #3.)*

**Audit path:** as an SCF-funded project, `contracts/treasury` and `contracts/payroll` are eligible for SDF's [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank) (5% co-payment, refundable if Critical/High/Medium findings are remediated within 20 business days) — the concrete next step for Milestone 3, rather than sourcing a full-price audit independently. No money-moving contract or endpoint goes to mainnet before this completes, regardless of which signing model it uses.

**Legal review pending:** the LCP arbitration clause (BR/AR/CO dispute channels) has not yet been reviewed by a licensed attorney and should not be treated as binding until it is. LFPIORPI fracción XVI (activos virtuales = actividad vulnerable) takes effect 2027-01-17 — well after this mainnet target, but the non-custodial design above (unsigned XDR, client signs, contractor-only payouts) is deliberately built to already sit outside that "transmisión por cuenta de terceros" assumption; get that read confirmed in writing by counsel before Jan 2027.

### Current mainnet status (2026-08-04): founders' own funds only, no clients

`contextio-api-mainnet` (https://contextio-api-mainnet.fly.dev/) is live, but scoped to read-only endpoints (Reflector oracle, audit trail, LCP viewer, anchor status — correctly reports `live:false`, no licensed anchor yet) plus self-custody Payouts, gated by `MAINNET_ALLOWLIST_TENANT_IDS` containing **only the internal demo tenant** (`00000000-0000-4000-8000-000000000001`). Treasury stays off (no `BLEND_*`/`DEFINDEX_*` contract ids configured on this deployment).

Both wallets used for testing this — treasury `GBGHQMXAAS5BQELFXAHHARKLOBX77USARAGYJ3ETEWAAEOBJHFW4RGBW` and the receiving test wallet `GAGBORWREIMHNL7GOOWSXEHXP7UATSCI5YMLKGLKKLWRRS4D4H6LIIAU` — are internally controlled (verified via Horizon: single signer each, no unexpected additions). **No third party's funds move through this deployment.**

This matters because it's the line the whole legal posture rests on: LFPIORPI's "actividad vulnerable" and Ley Fintech's ITF-reserved-activity rules both hinge on offering the service **habitually, to clients** — a third party distinct from the operator. Founders testing a flow with their own funds, in a closed allowlist nobody else can reach, doesn't cross that line; it's the same as anyone using their own wallet. The audit-Bank / lawyer-review gate above is about protecting *someone else's* money before it's exposed to unaudited code — it doesn't block the operators from dogfooding their own tool with funds they own and the risk of which they're accepting knowingly.

**This note stops being true the moment a second, real tenant is added to `MAINNET_ALLOWLIST_TENANT_IDS`.** At that point the audit + lawyer review stop being "next milestone" and become hard prerequisites, not optional — update or remove this note when that happens.

## 7. Tech stack

Stellar · Soroban (Rust) · `@stellar/stellar-sdk` v16 (Protocol 23) · Stellar Wallets Kit · Reflector (SEP-40) · Next.js · TypeScript · Express · Supabase (Postgres/Auth/Realtime) · Fly.io · Vercel. Open SDK: `contextio-sdk` (npm).

## 8. Links

Web https://www.contextio.xyz · API https://contextio-api.fly.dev · Repo https://github.com/Eras256/Contextio · Demo https://youtu.be/JI7KpNQMo0A · SDK https://www.npmjs.com/package/contextio-sdk
