# @contextio/api

Node/TypeScript backend for Contextio — the agentic treasury & payroll platform.
Express, layered into **routes → services → integrations → data access**, with a
DI composition root (`src/container.ts`) so every layer is unit-testable.

## Responsibilities

| Area | Module |
| --- | --- |
| Auth & multi-tenancy | `http/middleware/auth.ts` (Supabase JWT + internal worker secret) |
| RBAC | `http/middleware/rbac.ts` + `@contextio/config` capability matrix |
| Treasury | `services/treasuryService.ts`, `http/routes/treasury.ts` |
| Payroll | `services/payrollService.ts`, `http/routes/payroll.ts` |
| Legal Context (LCP) | `services/legalContextService.ts`, `http/routes/legal.ts` |
| Agent orchestration | `services/agentService.ts`, `http/routes/agent.ts` |
| Integrations | `integrations/{defindex,blend,soroban,oracle}.ts` |

## API surface (REST, `/api/v1`)

```
GET    /healthz                         liveness (public)
GET    /readyz                          readiness incl. downstream checks (public)
GET    /.well-known/contextio-legal-context.json  serve tenant LCP doc (public, resolved by Host/?domain)

GET    /api/v1/treasury                 snapshot (balances, allocation)
PUT    /api/v1/treasury/config          risk profile + agent params
POST   /api/v1/treasury/rebalance       manual rebalance (LCP-bound)

GET    /api/v1/payroll/employees        list / POST create-update / DELETE :id
GET    /api/v1/payroll/schedules        list / POST create-update
GET    /api/v1/payroll/obligations      upcoming obligations + liquidity need
GET    /api/v1/payroll/runs             history / POST execute (dryRun supported)

GET    /api/v1/legal                    current legal context
POST   /api/v1/legal/publish            publish/version contextio-legal-context.json

GET    /api/v1/agent/decisions          agent decision log
POST   /api/v1/agent/propose            evaluate + (optionally) execute a rebalance
POST   /api/v1/agent/decisions/:id/execute

GET    /api/v1/integrations/defindex/vaults    POST create
GET    /api/v1/integrations/blend/position     POST supply/withdraw
GET    /api/v1/integrations/stellar/status

GET    /api/v1/audit                    audit log
```

All `/api/v1` routes require either an end-user `Authorization: Bearer <supabase-jwt>`
plus `x-tenant-id`, or the worker's `x-internal-secret` plus `x-tenant-id`.

## Local development

```bash
pnpm --filter @contextio/api dev      # tsx watch on :8080
pnpm --filter @contextio/api test     # vitest (HTTP + agent unit tests)
pnpm --filter @contextio/api build
```

Set environment per `.env.example` at the repo root. With `DEFINDEX_API_KEY`,
`BLEND_POOL_CONTRACT_ID` and `STELLAR_SERVICE_SECRET` unset, the integrations run
in **deterministic mock mode** so the whole API works offline.

## Deploy (Fly.io)

```bash
fly apps create contextio-api
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... \
  INTERNAL_API_SECRET=... STELLAR_SERVICE_SECRET=...
# Run from the monorepo root so workspace packages resolve:
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
```

Region `gru` (São Paulo) minimizes latency for BR/AR/CO. Health check hits
`/healthz`. See `fly.toml` for the optional `release_command` migration hook.

## Security notes

- Service-role Supabase key is server-only; never shipped to the browser.
- Helmet + explicit headers, CORS allowlist, per-route rate limits, 256KB body cap.
- Every agentic operation is blocked (HTTP 412) unless a legal context is published
  and the action's required consents are satisfied — enforced in the service layer.
