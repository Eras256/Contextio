# Stellar Integration Plan — SCF Build, Integration Track

Contextio integrates six building blocks from the official SCF Integration
List. This document states, for each one, what it does in the product, what
works today (verified live, not aspirational), and what this award funds.

Our own Soroban contracts (`treasury`, `payroll`) and the Stellar SDK/RPC are
how we build — the tools every Soroban app uses, not chosen Integration List
building blocks. No part of this budget is attributed to them. Reflector
(SEP-40 price oracle) is real and live in the product (`GET /api/v1/public/oracle`,
verified against both testnet and mainnet oracle contracts) but is likewise not
on the Integration List and isn't counted as one of the six below.

## The six building blocks

| Building block | Category | Status today | Funded work | Tranche |
| --- | --- | --- | --- | --- |
| Blend v2 | DeFi — lending | Live on testnet | Production hardening, mainnet migration post-audit | 1 |
| DeFindex | DeFi — vaults | Live on testnet | Production hardening, mainnet migration post-audit | 1 |
| Freighter Connect | Wallet | Live | Every agent action routed through self-custody signing, no execution path that bypasses it | 1 |
| Stellar Wallets Kit | Wallet | Live | Multi-wallet support (Freighter/xBull/Albedo/Lobstr) for operators | 1 |
| Anchor Platform | On/off-ramp | Self-hosted instance live on testnet (real SEP-1/10/31/38; SEP-24 still via SDF's reference anchor) | Enable SEP-24 on our own instance, close the SEP-31 transaction lifecycle, connect to a licensed off-ramp partner for real settlement | 2 |
| Stellar Disbursement Platform | Payments | Not started | Replaces the current raw Horizon batch-payment rail with multi-recipient USDC disbursement, per-employee status tracking and receipts | 2 |

### Blend v2 — treasury yield
What it does: idle USDC is supplied to Blend lending pools; the agent decides
allocation, never a human. Today: live on testnet — real positions, and the
live 24/7 agent's Blend supply/withdraw signs through a policy-gated Smart
Account (OpenZeppelin Stellar Smart Accounts), not a raw hot key, verified
with real confirmed transactions. Funded work: mainnet migration once the
Soroban contracts clear external audit (Soroban Audit Bank is the intended
path), monitoring, and a public proof endpoint (already live at
`/api/v1/public/oracle` and `/public/activity` for the pieces that don't need
the audit gate).

### DeFindex — yield vaults
What it does: second venue for idle treasury, with strategy metadata driving
allocation. Today: live vault on testnet, TVL and APY exposed at
`/api/v1/public/defindex`. Funded work: the same Smart-Account signing
migration Blend already has (DeFindex still signs directly today) and the same
mainnet-post-audit path.

### Freighter Connect and Stellar Wallets Kit — self-custody signing
What they do: the company signs; the agent proposes. Keys never leave the
operator's own wallet — verified structurally, not just by policy: a mainnet
process refuses to boot at all if a signer secret is configured
(`assertMainnetHasNoHotKey`, `packages/config/src/env.ts`, tested). Today:
live on both testnet and mainnet. Funded work: extending the same enforced
self-custody path to the remaining testnet-only flows (autonomous Blend/
DeFindex rebalancing) once the audit unblocks a mainnet-safe signing model
for them.

### Anchor Platform — local-rail off-ramp
What it does: an employee receives local currency, not USDC they cannot spend.
Today: **a real, self-hosted deployment of SDF's own `stellar/anchor-platform`**
(not the SDF reference anchor, our own SEP-1 identity and infrastructure) —
live on testnet with confirmed real SEP-1 (`stellar.toml`), SEP-10 (signed
challenge), SEP-31 (`/sep31/info`, real `receive` config for native/BRL/ARS/COP
with PIX/Transferencias 3.0/Bre-B funding methods), and SEP-38 (`/sep38/prices`,
`/sep38/price`, all four currencies self-consistent). SEP-24 isn't enabled on
this instance yet — that flow still runs against SDF's public reference anchor
today (`GET /api/v1/public/anchor`). Funded work: SEP-24 on our own instance,
closing the SEP-31 transaction lifecycle (JSON-RPC report-back), and — the
part that's a business relationship, not code — connecting to a licensed local
off-ramp partner so a SEP-31 payment actually settles in fiat. (BlindPay is the
researched candidate: real Stellar support since May 2025, an unsigned-XDR
payout flow that matches this project's non-custodial model exactly, but no
account or API key exists yet.)

### Stellar Disbursement Platform — payroll at scale
What it does: replaces the current raw Horizon batch-payment rail
(`StellarClient.sendPayments`, already settling real USDC payroll — see the
verified example in the README) with SDP's purpose-built multi-recipient
disbursement, per-employee status tracking, and receipts. Today: not started —
this is real, funded, forward work, not something already quietly built.
Funded work: full SDP integration (dashboard + core API + transaction-
submission service) with LCP-bound run records written the same way the
current payroll contract already does.

## What this replaces

This document previously stated "Four" building blocks (Soroban contracts,
anchors, DeFindex, Blend) and framed itself as hackathon judging material
("For judges," "Roadmap beyond the hackathon"). Two problems with that
version, corrected here: it counted Soroban contracts as a chosen Integration
List item when they're the platform Contextio's own code runs on, not a
building block being integrated; and it never mentioned the Stellar
Disbursement Platform at all despite SDP being a real, named part of the
funded plan.
