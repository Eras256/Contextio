# SCF Integration Track mapping

How Contextio aligns with Stellar Community Fund **Integration Track** expectations.

| Expectation | How Contextio meets it |
| --- | --- |
| Integrates ≥ 1 Stellar building block | **Four**: Soroban contracts, anchors (SEP-24/31), DeFindex vaults, Blend pools. |
| Clear user & market | LATAM SMBs/startups paying cross-border teams in BR/AR/CO; digital-dollar treasury + local-rail payroll. |
| Working testnet demo | End-to-end flow runs on testnet; deterministic mock fallbacks make it fully demoable offline. |
| Production-grade architecture | pnpm monorepo, type-safe config, RBAC, audit logging, CI, Dockerized Fly.io deploy, RLS. |
| Compliance / trust | **Legal Context Protocol** binds terms, consent, jurisdiction & dispute channels to every agentic transaction. |
| Non-custodial design | Keys stay with the company; the agent executes only within signed, on-chain-enforced limits. |

## Stellar building blocks used

- **Soroban smart contracts** — `treasury` and `payroll` crates settle agentic
  actions and emit LCP-bound events; balance invariants + run idempotency enforced
  on-chain.
- **Anchors (SEP-24/31)** — modeled per payroll line for digital-dollar
  on/off-ramp to PIX, Transferencias 3.0, and Bre-B.
- **DeFindex** — RWA / CETES yield vaults; deposit/withdraw + strategy metadata.
- **Blend** — USDC supply yield via lending pools (testnet contracts).
- **Stellar SDK / RPC** — transaction build → simulate/prepare → sign → submit →
  poll, plus contract event streaming (`packages/shared/src/stellar`).

## For judges — where to look

- Architecture overview → [ARCHITECTURE.md](ARCHITECTURE.md) and the web Overview diagram.
- API surface → [apps/api/README.md](../apps/api/README.md).
- Smart contract interfaces → [contracts/README.md](../contracts/README.md).
- LCP document (live) → `/.well-known/contextio-legal-context.json` (served by the API).
- LCP implementation → [packages/shared/src/lcp](../packages/shared/src/lcp).
- Customer discovery → [customer-discovery.md](customer-discovery.md) (to be filled in).

## Roadmap beyond the hackathon

1. Wire specific LATAM anchors (Brazil/Argentina/Colombia) for real on/off-ramps.
2. Move the agent service account to a multisig / smart account; timelocked upgrades.
3. Replace deterministic FX/yield mocks with on-chain oracles (e.g. Reflector) and
   licensed FX feeds.
4. Plug an external AI model into `AgentService.plan()` for richer proposals,
   keeping the deterministic risk constraints and LCP gate as guardrails.
5. Distributed worker (queue + leader election) for multi-machine scale.
