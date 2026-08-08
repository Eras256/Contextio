# Prior art

Contextio occupies two axes on Stellar — payroll and treasury automation — and
both already have funded, live neighbors. This document names them, describes
what each actually does (verified against their own sites/docs/press, not
assumed), and states plainly what Contextio does differently. Where a
difference is architectural pattern rather than a unique idea, that's said
directly rather than implied otherwise.

## Payroll

**[dolphinze](https://app.dolphinze.com/)** — global payroll infrastructure for
independent contractors on Stellar. The framing is close to Contextio's own:
paying contractors, not employees, using Stellar rails. We were not able to
confirm dolphinze's custody model or whether it carries any equivalent to a
legal-context binding — that's an open question, not a claimed advantage.

**[Zebec](https://zebec.io/)** — real-time, per-second streaming stablecoin
payroll on Stellar, selected directly by the Stellar Development Foundation as
an enterprise payroll partner, with off-ramp access through MoneyGram and
card-network spending. This is the most consequential payroll neighbor: it has
distribution (MoneyGram, cards) Contextio does not have yet, and any
differentiation claim against it needs to rest on mechanism, not scale.

**[CodeLnPay](https://pay.codeln.com)** — cross-border salary payments for
African remote workers, multi-currency (fiat and crypto). Different
geography and a narrower rail mix than Contextio's treasury-linked payroll;
the overlap is real but the served market doesn't overlap.

**[Bitwage](https://bitwage.com)** — an established crypto payroll provider
that added USDC-on-Stellar as a funding rail. Real, live, and predates the
SCF program; a genuine payroll-rail alternative regardless of funding source.

## Treasury and non-custodial execution

**[Bando](https://bando.cool/)** — B2B treasury for Mexican companies, routing
idle cash into tokenized CETES (Mexican government debt) via Etherfuse, with
institutional custody for the underlying instrument provided by Anchorage
Digital. The closest *market* overlap found — Mexican corporate treasury — even
though Contextio's own served markets are Brazil, Argentina, and Colombia.
Bando is an investment-access product; Contextio is an agent that continuously
decides allocation across liquidity, yield, and payroll, with every decision
bound to a legal-context record the client signs for directly, not routed
through a third-party custodian.

**[Arka.fund](https://arka.fund/)** — Soroban-native, non-custodial investment
vehicles with DAO governance, share-token NAV, and single-transaction unwind on
redemption. Genuinely non-custodial by contract design. It has no payroll
dimension and no legal-context-binding layer — a different shape of product,
not a naming difference.

**[Tezoro](https://www.tezoro.io/)** — a DeFi yield router that describes
itself as fully non-custodial: its contracts can only algorithmically
distribute assets among a whitelisted set of vaults and cannot move funds
outside that set. This is architecturally close to Contextio's own
policy-gated Smart Account signing — the same idea (non-custodial execution
scoped by an on-chain whitelist/policy, not a raw key) arrived at independently
on different infrastructure. Contextio's difference here is the Soroban-native
implementation proven with confirmed transactions and the legal-context layer
on top of it, not the scoping idea itself.

**[Untangled Finance](https://untangled.finance/)** — non-custodial, largely
EVM-based automated asset management built on Safe smart accounts and Zodiac
Roles: every fund movement out of a vault must satisfy an on-chain permission
role. This is the closest architectural parallel found to Contextio's own
Smart Account plus spending-limit policy — the pattern of policy-scoped
non-custodial execution instead of a raw signing key is not unique to
Contextio; Untangled reached a materially similar design independently.
Contextio's difference is Stellar/Soroban-native execution and the
legal-context-binding layer, not the underlying pattern.

**Automated Finance** — a general-purpose on-chain treasury automation
platform for DAOs and businesses, funded through the Stellar Community Fund.
No independently verifiable official site was found during this review (not
linked here for that reason); broad and under-documented publicly beyond the
SCF listing itself, so no domain focus (payroll, LatAm regulatory work,
legal-context binding) was found to compare against directly.

**[Lumexo](https://lumexo.io/)** — a non-custodial Stellar wallet with an
integrated DEX and Blend lending, device-generated keys. A consumer wallet
with DeFi built in, not an agentic treasury or payroll product — a different
category, included here because it's another real non-custodial claim in the
same ecosystem.

## What this leaves

"Non-custodial" is claimed by at least five of the projects above and is not,
by itself, a distinguishing statement anymore. Policy-scoped execution instead
of a raw signing key — the pattern behind Contextio's Smart Account — was
independently arrived at by at least two funded peers (Tezoro, Untangled) on
different infrastructure. Neither of those facts is hidden here.

What was not found anywhere else in this review: a mechanism that binds every
agent-executed action to a legal/consent record that is (a) independently
verifiable by a third party without trusting the platform's own claims — three
commands reproduce the hash — and (b) field-conformant with a real, externally
governed open standard (the Legal Context Protocol, legalcontextprotocol.org,
with the Stellar Development Foundation as a founding contributor) rather than
a bespoke, self-defined compliance layer. Combined with a boot-time invariant
that makes custodial capability structurally impossible to configure on
mainnet, rather than a policy choice a future change could quietly relax, that
combination — not "non-custodial," not "payroll," not "treasury" — is the
part of Contextio not found in the projects reviewed above.
