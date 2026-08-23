# Contributing to Contextio

Thank you for your interest in contributing to Contextio. This guide is intended for human contributors arriving from GitHub who want to understand the repository, run it locally, choose an appropriately scoped change, and open a verifiable pull request.

Contextio is a TypeScript and Rust monorepo with a Next.js web application, an Express API, a worker service, shared packages, a public client SDK, Supabase migrations, and Soroban contracts. Before contributing, read the project [README](./README.md), the [architecture overview](./docs/ARCHITECTURE.md), and the repository’s engineering rules in [`docs/CLAUDE.md`](./docs/CLAUDE.md).

## Before you start

Please search the existing issues and pull requests before opening a new issue. Issues labeled `good first issue` are intended to provide a focused entry point for new contributors; issues labeled `help wanted` may require more project context. Advanced work can involve payment flows, authentication, database access, on-chain contracts, or deployment infrastructure, so confirm the scope before beginning.

For a change that is already tracked, comment on the issue if you intend to work on it. This helps avoid duplicate work and gives maintainers an opportunity to clarify the expected behavior. Do not expose credentials, customer data, wallet secrets, or private deployment information in an issue or pull request.

## Prerequisites

| Tool | Requirement | Why it is needed |
| --- | --- | --- |
| Node.js | Version 20 or newer | Frontend, API, worker, and package tooling |
| pnpm | Version 10 or newer | Workspace installation and scripts |
| Rust | Stable toolchain | Soroban contract development and tests |
| Rust target | `wasm32-unknown-unknown` | Building Soroban contracts to WebAssembly |
| Docker | Required for local Supabase work | Runs the local database services |
| Supabase CLI | Optional | Local database startup and reset |
| Stellar CLI | Optional | Local Stellar and contract workflows |

Check the installed versions before starting:

```bash
node --version
pnpm --version
rustc --version
rustup target list --installed
```

If the WebAssembly target is missing, install it with:

```bash
rustup target add wasm32-unknown-unknown
```

## Clone and install

Clone the repository and install the workspace dependencies:

```bash
git clone https://github.com/contextio/Contextio.git
cd Contextio
pnpm install
```

The application packages depend on compiled shared type declarations. Build the foundational packages in this order before running the complete build:

```bash
pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter contextio-sdk build
pnpm --filter @contextio/tests build
```

Create a local environment file from the checked-in example:

```bash
cp .env.example .env.local
```

The default development workflow uses deterministic mock integrations when external DeFindex, Blend, and other service credentials are not configured. This allows the main application stack to run locally without connecting to production services.

Never commit `.env.local`, service credentials, wallet secrets, private keys, database passwords, or service-role keys. The web application may use only the public `NEXT_PUBLIC_*` values intended for browser delivery; server-side secrets belong in the API, worker, or deployment secret store.

## Run the local stack

You can run the services together with:

```bash
pnpm dev
```

For focused development, run the services separately:

```bash
pnpm dev:web      # Next.js web application at http://localhost:3000
pnpm dev:api      # Express API at http://localhost:8080
pnpm dev:worker   # Agent loop and scheduler; requires the API
```

With no external integration credentials, the services use mock behavior where supported. For changes that depend on a real service, document the required environment variables and test the live behavior only in an authorized development or test environment.

## Local Supabase

Use the Supabase CLI and Docker for a local database environment:

```bash
supabase start
pnpm supabase:reset
```

The reset command applies the migrations and seed data. Read [`supabase/README.md`](./supabase/README.md) before changing schema or seed behavior. Every new Postgres table that stores tenant data must include Row Level Security policies in the same migration that creates it.

## Soroban contracts

Contract changes should be tested natively and built for the WebAssembly target:

```bash
cargo test --all
cargo build --release --target wasm32-unknown-unknown
```

The repository also provides a contract build script:

```bash
pnpm contracts:build
```

Read [`contracts/README.md`](./contracts/README.md) before changing deployment configuration or contract identifiers. Do not use production wallet secrets in local development.

## Required validation

A change is not complete when it merely compiles. Run the checks relevant to the files you changed, and run the complete validation set before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
cargo test --all
pnpm build
```

For a formatting-only check, use:

```bash
pnpm format:check
```

If the change affects web behavior, run `pnpm test:e2e` and manually verify the relevant flow at the local web URL. If the change affects contracts, run both `cargo test --all` and the WebAssembly build. If the change affects database schema, reset the local Supabase database and verify migrations, seed data, and RLS behavior.

In the pull request description, include the commands you ran and their results. If a required check cannot be run locally, explain why and identify what remains to be verified.

## Repository map

| Path | Responsibility |
| --- | --- |
| `apps/web` | Next.js frontend, wallet sign-in, live data, and Supabase Realtime UI |
| `apps/api` | Express and TypeScript backend, authentication, treasury, payroll, LCP, and integrations |
| `apps/worker` | Agent loop and scheduled work; it calls the API rather than writing directly to the database or chain |
| `apps/anchor-business` | Anchor-related business service workflows |
| `packages/shared` | Shared domain types, logging, Supabase/Stellar clients, and LCP utilities |
| `packages/config` | Type-safe environment configuration, RBAC, and security settings |
| `packages/tests` | Shared fixtures and integration mocks |
| `packages/sdk` | Public `contextio-sdk` client package |
| `contracts` | Rust Soroban treasury and payroll contracts |
| `supabase` | Postgres migrations, RLS policies, seed data, and setup scripts |
| `.github` | Continuous integration workflows |

## Engineering conventions

Use explicit `.js` extensions for relative imports in backend ESM packages where required by Node’s ESM resolution. Keep TypeScript strict and prefer `unknown` to `any` for genuinely dynamic values. Validate every state-changing HTTP request with Zod before service logic runs, and use the shared structured logger without writing secrets or private keys to logs.

Preserve the repository’s architectural boundaries. Agent actions go through `apps/api`; the worker must not bypass API authorization, audit logging, or Legal Context Protocol checks. Web clients use public Supabase access subject to Row Level Security, while controlled server-side writes must be authorized and audited.

Treat non-custodial mainnet behavior as a security invariant. Mainnet flows must not introduce a hot key capable of moving a customer’s funds. Mainnet money-moving actions use unsigned XDR preparation for the customer’s own wallet to sign. Do not weaken the related configuration or call-site guards without treating the change as security-sensitive.

State-changing treasury and payroll endpoints must enforce a valid Legal Context Protocol binding and return the repository’s defined precondition error when the required legal context or consent is missing. Keep auditable LCP and security enforcement logic public and reviewable; do not add proprietary decision logic to this repository without checking the architecture rules first.

## Commit messages and AI assistance

Use short commit messages that describe what changed and why. Keep each commit focused and avoid mixing unrelated refactors with the requested fix or documentation change.

If AI assistance is used, follow the repository’s disclosure and co-authorship rule in [`docs/CLAUDE.md`](./docs/CLAUDE.md) and [`AI-USAGE.md`](./AI-USAGE.md), including the required `Co-Authored-By: Claude` trailer where applicable. Never use AI assistance as a reason to skip tests, review, security checks, or factual verification.

## Pull request checklist

Before opening a pull request, confirm that:

- The change addresses a specific issue or clearly explains its purpose.
- The scope is focused and the implementation follows the repository architecture.
- Tests, type checks, lint, formatting checks, and builds relevant to the change pass.
- Database changes include migrations, seed behavior where needed, and RLS policies.
- UI changes include screenshots or a clear description of the verified behavior.
- No credentials, private keys, tokens, customer data, or generated secrets are included.
- The pull request describes limitations, environment requirements, and any follow-up work.
- The pull request links the related issue and explains how the acceptance criteria were verified.

For this guide specifically, a clean checkout should be able to follow the installation instructions, run `pnpm test`, and find this file from the root `README.md`.

## Reporting security issues

Do not report security vulnerabilities in a public issue. Follow [`SECURITY.md`](./SECURITY.md) for the private reporting process. Avoid posting wallet addresses together with sensitive operational details, deployment credentials, database connection strings, or authentication material.

## Further reading

The following documents provide additional context:

- [Project README](./README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Engineering rules](./docs/CLAUDE.md)
- [Privacy policy](./PRIVACY.md)
- [Security policy](./SECURITY.md)
- [Threat model](./THREAT_MODEL.md)
- [Issue #5: Write CONTRIBUTING.md for first-time contributors](https://github.com/contextio/Contextio/issues/5)
