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
- **Contextio is a software provider, not a money-transmission or exchange entity — the self-hosted Anchor Platform (§3, §6 Milestone 2) does not change that.** It exists on testnet, deliberately disconnected from any real bank account or payment processor, to prove Contextio can operate anchor-grade SEP-1/10/31/38 infrastructure — a technical capability, not a production settlement path. Real fiat settlement, when it exists, will run through a **licensed third-party anchor** (the BlindPay/Koywe conversation referenced throughout this doc): Contextio's software talks to *their* anchor via SEP-31/38, exactly as it already does with SEP-24 today. Contextio itself is deliberately never the counterparty that converts or transmits fiat on a client's behalf — that's the specific activity that would trigger ITF licensing under Mexico's Ley Fintech/LRITF and "actividad vulnerable" under LFPIORPI fracción XVI (virtual-asset exchange/transfer conducted regularly on behalf of third parties). The underlying legal thesis (FATF: a software provider with no control over funds is not a VASP) still awaits written confirmation from counsel before mainnet — see the mainnet-launch tracking notes; this boundary is written down here so it stays explicit regardless of how much anchor-side technical capability gets built.

## 5. Deployed contracts (testnet)

- Treasury: `CASGAQQVHDF4Q2XTK3QWYHRABYX7JUIO6HCLEOZZR7V3TIMVHMXPTA7I`
- Payroll: `CDXML4PU5RVXQ7DSM7UO5OURKFUJMPGI57PRZCQ3NZTKFGPOIDIOIRCT`
- Reflector oracle (external, base USD): `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63`
- Smart-treasury signer v5 (OpenZeppelin Stellar Smart Accounts, Milestone 1 — see §6): `CAMEOVPRT3PISVDQ5R6JY6NFUFQDR25AR6UV4IS5HXPNMHLDFN46DCID` (v1-v4 are superseded/abandoned — smart-account admin functions are unreachable post-deploy, see §6, so every design fix means a fresh address, never an in-place upgrade)
- Spending-limit policy v3 (`contracts/spending-limit-policy`, unmodified OpenZeppelin logic): `CDDF3B2SPJFZVSAYWXJ3ROHJDKDW667HIRTP34CROWHZHEUEWK7K45AL` (v1/v2 superseded — v2 briefly added custom Blend-parsing that turned out unnecessary, see §6)

## 6. Integration roadmap — building blocks → mainnet (4 months)

**Building blocks (Integration List):** Soroban · **Blend** · **DeFindex** · **Reflector** · **SEP-24/31/38 anchor** · Stellar Wallets Kit · **OpenZeppelin Channels**.

### Milestone 1 — Unified treasury + oracle hardening *(Tranche #1)*
- Unify the per-integration service accounts into a single **smart-account treasury** (OpenZeppelin Stellar Smart Accounts, policy-based spending limits — one of Stellar's three official 2026 priorities alongside AI/agent-readiness and Soroban DX), so liquidity, **Blend** lending, and **DeFindex** vault positions are held and controlled by one account with a spending-limit policy instead of a raw secret key. This is also the real fix for autonomous agent rebalancing to ever run on mainnet — replaces the hot key the boot guard currently forbids there.
  - **The signing mechanism is proven end-to-end with real, confirmed testnet transactions (2026-08-04)** — not just simulation, not just unit tests. `StellarClient.invokeViaSmartAccount` (`packages/shared/src/stellar/client.ts`) builds the two-entry authorization OpenZeppelin's `Signer::Delegated` pattern requires (the smart account's own credentials carrying a hand-built `AuthPayload`, plus a second entry where the agent's real Ed25519 key signs the nested `__check_auth` call) and has moved real value through it: [a confirmed `USDC.transfer`](https://stellar.expert/explorer/testnet/tx/54dde178ab9348b6219809bdf5a0c17df32ccd8c9cb5235fee879f18ebb91d5a) authorized purely by the smart account, no raw hot-key signature on the funds-moving operation itself.
  - **Two non-obvious contract-level findings, both found by testing against the real deployed contract rather than trusting the crate's docs/tests in isolation:**
    1. OpenZeppelin's generic `ExecutionEntryPoint::execute(target, fn, args)` helper is a dead end for a policy like ours: its own `require_auth()` always produces a *self*-referential context (`contract: <the smart account itself>, fn_name: "execute"`), which can never match a `CallContract(target)`-scoped rule or a policy that inspects `fn_name` (like `spending_limit`, which only recognizes `fn_name == "transfer"`). The fix is calling the target contract directly (`usdc.transfer(smartAccount, to, amount)`, no `execute()` wrapper) — that makes the target's own internal `require_auth` produce a context that actually matches.
    2. Smart-account admin functions (`add_context_rule`, `add_policy`, `remove_policy`, ...) are **unreachable after deployment** — each is itself gated by the same self-referential `require_auth()` pattern, and by default no rule exists that authorizes calls *on the smart account itself*. Every context rule the account will ever need must be baked into the constructor at deploy time; there is no in-place way to add one later. This is why the deployed address has moved twice this session (v1 → v2 → v3) instead of being patched.
  - **Rules are scoped per target CONTRACT, not per asset** — confirmed on real Blend calls: a direct `blendPool.submit(...)` call's outer auth context carries the *pool's* address, and Blend's own internal call to the underlying token's `transfer()` (for a `Supply` request) surfaces as a **second, separate** auth context carrying the *token's* address — both need their own matching `CallContract(...)` rule. `spending_limit`'s stock, unmodified `enforce()` (`fn_name == "transfer"` only) gates a real Blend Supply natively with **zero custom parsing**, as long as a rule is scoped to the underlying reserve token contract (Blend's `CAQCFVLO…SRCJU`, a *different* contract than the app's everyday `USDC_CONTRACT_ID` — testnet has two distinct USDC-pegged SACs in play). An earlier version of `contracts/spending-limit-policy` added a `translate_blend_submit` helper to re-express `submit()` itself as a synthetic transfer — **removed after confirming it double-recorded the same spend against two independent rule buckets** (once via the translation on the pool-level rule, once via the real nested context on the token-level rule) with no safety benefit. The policy contract is back to a pure, unmodified pass-through to OpenZeppelin's audited module.
  - **Confirmed on real `Withdraw` calls too:** pulling funds back out of Blend does **not** generate a second nested context requiring the smart account's auth at all (the underlying token leg's "from" is the pool's own reserve, not the smart account) — so a `Withdraw` naturally needs only the outer gateway rule, with nothing recorded against the spending cap. No special-casing needed; `StellarClient.invokeViaSmartAccount` discovers however many contexts a call actually produces (by walking the recorded invocation tree from one `simulateTransaction` recording pass) and maps each one to a rule id via a caller-supplied `contextRuleIdByTarget`, rather than assuming a fixed count.
  - **Final v5 deploy** (`CAMEOVPRT…HLDFN46DCID`, policy v3 `CDDF3B2S…7K45AL`) has three rules, split into two kinds: **capped** rules (carry the spending-limit policy, real cap) — rule 0 `CallContract(USDC_CONTRACT_ID)` for plain transfers, rule 1 `CallContract(<Blend reserve token>)` for the real Blend Supply/Repay outflow; and one **gateway** rule (signer-gate only, deliberately no policy) — rule 2 `CallContract(BLEND_POOL_ID)`, since attaching a cap there too is exactly the double-counting bug described above. Each capped rule is independently capped at 100 USDC/day (a deliberate choice: per-target caps, not one shared pool; worst-case ceiling is the sum across capped targets). **Verified end-to-end with real, confirmed transactions**, not just simulation: a real 0.1 USDC Blend Supply (recorded once, correctly, against rule 1 only) and a real 0.05 USDC Blend Withdraw (correctly recorded nothing) both went through, fully authorized by the smart account. `contexta-smart-treasury` gained tests for the capped/gateway rule split; `contexta-spending-limit-policy` is back to its original test-free pass-through. All 21 contract tests across the workspace pass.
  - **Done (2026-08-05): the live 24/7 agent now signs Blend through the smart account, not the raw hot key.** `BlendClient` (`apps/api/src/integrations/blend.ts`) gained a `smartAccountId` config field — unset by default (existing direct-signing behavior unchanged) — that, when present, routes `supply`/`withdraw` through `invokeViaSmartAccount` instead of `submitOperationXdr`, and switches `getVaultData`'s position read (`positionHolderAddress`) from the signer's own classic address to the smart account's, since that's now who actually holds and controls the position. Reuses Blend SDK's own `PoolContractV2.submit()` to build the request (just extracts its args instead of hand-encoding the `Request` struct again), so the on-chain shape is exactly what Blend's SDK already produces. Before flipping the config, migrated the live position for real: withdrew the agent's entire existing ~50 USDC Blend position from its classic address (an over-request the pool correctly capped to the exact available balance), transferred it into the smart account, and re-supplied it there — verified via the actual compiled `BlendClient` class (not a throwaway script) reading back the correct position afterward. `contextio-api` (the Fly app hosting `AgentService`) redeployed with `BLEND_SMART_ACCOUNT_ID` set; `contextio-agent` (the worker) needed no changes at all, since it only ever calls into `apps/api`'s endpoints, never Blend directly (per the single-entry-point rule).
  - **Not yet done:** the equivalent migration for DeFindex (still signs directly) — deliberately scoped to Blend first, since that's the integration the live agent actually uses most; extending `contexta-spending-limit-policy` with a DeFindex-shaped rule is real, separate work, not yet started.
- Expand **Reflector** to feed FX pairs into the agent's risk/buffer engine (not just XLM/USD valuation); pair with **SEP-38** (below) for a firm quote instead of an estimated buffer.
- *Done when:* the agent's live rebalance calls route through the smart-account signer, not just the standalone contracts existing on-chain. Like all fund-governing contract logic, moving this to mainnet still requires the Milestone-3 audit regardless of the signer model.

### Milestone 2 — Real off-ramp + multi-entity *(Tranche #2)*
- **Self-hosted Anchor Platform, standing up our own SEP-31/38 anchor** rather than just a client against someone else's — SDF's `stellar/anchor-platform` (v4.6.2) deployed for real, not the reference anchor: `platform` (sep-server + platform-server + event-processor + stellar-observer, one JVM process) + a custom Node/TS callback business server (`apps/anchor-business`, implements `GET/PUT/DELETE /customer` and `GET /rate` against the real callback API contract — verified field-by-field against `api-schema/.../callback/*.java`, not guessed) + a single-broker Kafka (KRaft mode) for the internal event queue + a dedicated Postgres. Own SEP-1 identity, own testnet distribution account (`GB7U6HCA7Y…4JOQ2IBGB5EH6`).
  - **Live on testnet (2026-08-04), verified end-to-end:** `GET /.well-known/stellar.toml` (SEP-1), `GET /auth` (SEP-10 challenge, real signed XDR), `GET /sep38/prices` + `/sep38/price` (SEP-38 — XLM priced against USD/BRL/ARS/COP, all four self-consistent to the platform's own `price*buy_amount+fee≈sell_amount` rounding check, computed with exact decimal arithmetic via `decimal.js` rather than floats — floats alone weren't precise enough once buy_amount hit the hundreds of thousands for ARS/COP), `GET /sep31/info` (SEP-31 — real `receive` config for native/BRL/ARS/COP with PIX/Transferencias 3.0/Bre-B funding methods, unlike the SDF reference anchor's empty `receive` map). Public proof still exposed the same way: `GET /api/v1/public/anchor/sep38` and `/sep31` (`apps/api/src/integrations/anchor.ts`, now pointed at `ANCHOR_SEP3138_URL` = our own anchor, separate from `ANCHOR_SEP24_URL` which still targets the SDF reference anchor since SEP-24 isn't enabled on ours yet).
  - **Not yet done:** SEP-24 (interactive deposit/withdraw) isn't enabled on our own anchor — the existing off-ramp button still uses the SDF reference anchor for that specific flow. Reporting a received SEP-31 payment back to the Platform API via JSON-RPC (closing the transaction lifecycle end-to-end) isn't wired yet either — what's verified is discovery + quoting + the SEP-10/KYC-stub handshake, not a full settled transaction.
  - **Still gated on a business step, not code:** actually *receiving* real fiat on the other end needs a licensed local off-ramp partner — that relationship doesn't exist yet, and no amount of additional integration code changes that. **Koywe is ruled out** (checked its real docs, 2026-08-05: only Ethereum/Polygon/BSC, no Stellar support at all). **BlindPay is the live candidate** — confirmed multi-chain including Stellar, PIX/SPEI/PSE/Argentina-transfers, and it absorbs the KYC/compliance layer itself (Contextio would collect the data, BlindPay verifies it). No dedicated partnership email found; their [demo call](https://cal.com/blindpay/demo-call-blindpay) is the real entry point — a business step for a human to take, not something to build. The protocol-level anchor is real and self-operated now, not borrowed; the settlement corridor is not. **By design, that stays true even after a partner relationship exists** — real settlement routes through the licensed partner's own anchor, not this one (see §4); this instance never gets connected to a real bank account.
- **Stellar Disbursement Platform (SDP)** for the bulk-payout engine itself — committed in the original CV Labs Integration track application ("Blend v2 + DeFindex + SDP") but not yet built. SDP is a real multi-service deployment (dashboard + core API + transaction-submission service, its own distribution + SEP-10 accounts) built *on top of* Anchor Platform — now that the Anchor Platform layer underneath it is real and deployed, SDP is the next concrete step rather than a re-sequenced one.
- Multi-entity treasury + KYC/KYB onboarding.
- *Done when:* a real off-ramp transaction settles via SEP-31 through a licensed anchor; SDP running a real bulk disbursement; ≥1 multi-entity tenant live with KYB.

### Milestone 3 — Mainnet launch *(Tranche #3)*
- Deploy treasury + payroll Soroban contracts to **mainnet**; onboard the first pilot customer settling real value; professional user testing.
- *Done when:* contracts live on mainnet; ≥1 pilot moving real USDC payroll + treasury on mainnet.

*(Budget excludes marketing and security-audit costs, per SCF rules; audit credits are applied at Tranche #3.)*

**Audit path:** SDF's [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank) (5% co-payment, refundable if Critical/High/Medium findings are remediated within 20 business days) is the intended route for `contracts/treasury`/`contracts/payroll` — cheaper and more Stellar-native than sourcing a full-price audit independently — but it's **gated on prior SCF funding, which Contextio doesn't have yet** (checked its real eligibility rules, 2026-08-05: mandatory requirement is "funded through the Stellar Community Fund," not a standalone application). Contextio would qualify easily once funded — it's squarely a "financial protocol managing on-chain value," one of the program's automatic-eligibility priority categories. Contact for when that's true: `sorobanaudits@stellar.org` (or `communityfund@stellar.org` first, to actually get the SCF funding). No money-moving contract or endpoint goes to mainnet before an audit completes, regardless of which signing model it uses.

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
