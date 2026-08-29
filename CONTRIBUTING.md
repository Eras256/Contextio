# Contributing to Contextio

Welcome — this doc gets you from `git clone` to a passing test suite as fast as possible. It's the human on-ramp; the full engineering rules live in [`docs/CLAUDE.md`](docs/CLAUDE.md).

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node | ≥ 20 | `node -v` |
| pnpm | ≥ 10 | `npm i -g pnpm` or `corepack enable` |
| Rust | stable + `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown` |
| Supabase CLI | optional | only for local DB work |
| Stellar CLI | optional | only for contract work |

## Build order

The monorepo builds shared packages first — apps depend on their compiled output.

```bash
pnpm install

pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter contextio-sdk build

pnpm build            # everything (TS packages + web)
pnpm contracts:build  # Soroban contracts to WASM
# or: cargo build --release --target wasm32-unknown-unknown
```

## Run locally (mock mode, offline)

No external credentials needed — the stack runs in deterministic mock mode by default.

```bash
pnpm dev        # API + Web + Worker together
pnpm dev:web    # Next.js http://localhost:3000
pnpm dev:api    # Express API http://localhost:8080
pnpm dev:worker # Agent loop (needs API running)
```

Optional local Supabase:

```bash
supabase start
pnpm supabase:reset   # migrations + seed
```

## What "done" means before opening a PR

A change isn't done when it compiles — it's done when these pass:

```bash
pnpm lint
pnpm typecheck
pnpm test          # vitest: config, shared, api, worker
pnpm test:e2e      # Playwright (web)
cargo test --all   # Soroban contract tests
```

For anything touching a live deployment, also verify against the real thing (e.g. `curl` the deployed endpoint, read the live contract) — don't infer from code alone. See `docs/CLAUDE.md` §2.

## Code style (quick hits)

- Strict TypeScript — no `any`, use `unknown` for dynamic values.
- Explicit `.js` on relative imports in backend ESM packages (`apps/api`, `apps/worker`, `packages/shared`, `packages/config`).
- `zod` validation on every state-changing HTTP endpoint before service logic.
- No secrets in commits — `.env*` is gitignored. Copy `.env.example` instead.

## Commits

Short messages that say what and why. If AI assisted the commit, add the trailer:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

See [`AI-USAGE.md`](docs/AI-USAGE.md) for the full disclosure rule. Never commit secrets.

## Finding work

- `good first issue` — scoped, documented, good for first PRs
- `help wanted` / `good-first-issue` — similar
- Advanced: treasury/payroll planner, LCP, mainnet guards — see `docs/CLAUDE.md` §4

Ask in the issue if scope is unclear — we prefer a quick question over a misaligned PR.

## Verifying your setup

On a clean checkout, this should go green with only this file:

```bash
git clone https://github.com/contextio/Contextio.git
cd Contextio
pnpm install
pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter contextio-sdk build
pnpm lint && pnpm typecheck && pnpm test
```

If it doesn't, open an issue — that's a bug in this doc.
