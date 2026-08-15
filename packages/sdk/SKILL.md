---
name: contextio-sdk
description: Use when integrating contextio-sdk for its verifiable, non-custodial Legal Context Protocol (LCP) binding on Stellar treasury and payroll: Sign In With Stellar (SEP-53) wallet auth, reading a tenant's treasury/payroll/agent state, triggering an agent proposal, and independently hashing/verifying an LCP document against an on-chain hash.
---

# Contextio SDK Integration

## Overview

`contextio-sdk` (npm: `contextio-sdk`, current version `0.3.0`) is a typed,
isomorphic (browser + Node >=18) TypeScript client for the Contextio API:
agentic, non-custodial treasury & payroll infrastructure on Stellar. ESM,
ships its own `.d.ts`, and has exactly one runtime dependency
(`@noble/hashes`, used only for LCP hashing).

It covers three things:

1. A typed HTTP client for the Contextio API's tenant-scoped endpoints
   (`ContextioClient`).
2. A **Sign In With Stellar (SEP-53)** handshake helper, wallet-agnostic:
   works with Freighter, Stellar Wallets Kit, or any signer that can produce
   a SEP-53 signature (`signInWithStellar`).
3. **Legal Context Protocol (LCP)** canonicalization + SHA-256
   hashing/verification, so a client can independently re-derive a legal
   context document's hash instead of trusting the API's own claim
   (`hashLegalContext`, `verifyLegalContext`, `canonicalize`).

## When to Use

- Building a client (web app, bot, backend script) that needs to authenticate
  a Stellar wallet against Contextio and read a tenant's treasury, payroll
  obligations, or agent decision history.
- Triggering an agent proposal on a tenant's behalf, optionally executing it.
- Independently verifying that a Legal Context Protocol document matches a
  hash bound into an on-chain event or returned by the API, without trusting
  the API's own claim.

**Do NOT use this SDK for:** direct treasury rebalancing, payroll run
submission, or calling DeFi protocols (Blend, DeFindex) directly. None of
that is part of the public client surface as of `0.3.0`. Those are internal
API/worker responsibilities. The only state-changing call the SDK exposes is
`propose()` (see below).

## Installation

```bash
npm i contextio-sdk
```

## Client Setup

```ts
import { ContextioClient } from "contextio-sdk";

const client = new ContextioClient({
  baseUrl: "https://contextio-api.fly.dev", // or any other Contextio deployment
});
```

`ContextioClientOptions`:

| Field | Required | Notes |
|---|---|---|
| `baseUrl` | yes | Trailing slashes are stripped automatically. |
| `accessToken` | no | Session JWT. Only needed to construct an already-authenticated client directly. |
| `tenantId` | no | Sent as `x-tenant-id` on every request; pairs with `accessToken`. |
| `fetch` | no | Custom `fetch` implementation; defaults to `globalThis.fetch`. |

Every request is sent to `${baseUrl}/api/v1${path}` with a JSON body.
Non-2xx responses throw `ContextioApiError` (see Error Handling below).

## Sign In With Stellar (SEP-53)

Contextio auth is a challenge/verify handshake: request a challenge message,
have the user's wallet sign it (SEP-53), then exchange the signature for a
session JWT. `signInWithStellar` does all three steps:

```ts
import { ContextioClient, signInWithStellar } from "contextio-sdk";
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";

const client = new ContextioClient({ baseUrl: "https://contextio-api.fly.dev" });

StellarWalletsKit.init({ network: Networks.TESTNET, modules: defaultModules() });
const { address } = await StellarWalletsKit.authModal();

const session = await signInWithStellar({
  client,
  address,
  signMessage: async (msg) =>
    (await StellarWalletsKit.signMessage(msg, { address })).signedMessage,
});
// session: WalletSession { token, tokenType, expiresAt, address, userId, tenantId, role }
```

`signMessage` is a `SignMessageFn`: any `(message: string) => Promise<string> | string`
that returns the base64 SEP-53 signature. This makes the SDK wallet-agnostic;
swap in Freighter's `signMessage` directly, or any other adapter, without
changing anything else.

`session.tenantId` and `session.role` come back from the handshake: the
API resolves them server-side from the wallet's existing tenant membership,
so there is no separate "pick a tenant" call. A wallet with no membership on
any tenant gets a `401` (`ContextioApiError`) from `verify()`/
`signInWithStellar()` instead of a session. The SDK doesn't create tenants
or memberships.

To do the two steps manually instead of using the helper:

```ts
const { message, hmac } = await client.challenge(address);
const signedMessage = await mySigner.sign(message);
const session = await client.verify({ address, message, hmac, signedMessage });
```

Once you have a session, get an authenticated client:

```ts
const api = client.withSession(session); // carries accessToken + tenantId forward
```

Every method below except `challenge`/`verify` requires a client obtained
this way: calling them on an unauthenticated `client` throws a plain
`Error("Endpoint ... requires a session — call withSession() first")`
locally, before any network call is made.

## Tenant-Scoped Reads

```ts
const treasury = await api.treasury();     // TreasurySnapshot
const obligations = await api.obligations(); // Obligation[]
const decisions = await api.decisions();     // AgentDecision[]
const legal = await api.legal();             // LegalState
```

- **`treasury()`** returns a `TreasurySnapshot`: the tenant's `config`
  (`minLiquidityBaseUnits`, `maxYieldBps`, `volatilitySensitivity`,
  `countryLimitsBps`) plus `positions[]` (`asset`, `strategy`, `strategyRef`,
  `amountBaseUnits`, `apyBps`) and aggregate `totals`
  (`liquidBaseUnits`, `yieldBaseUnits`, `totalBaseUnits`, `yieldShareBps`).
  All amounts are strings in base units. Parse with a bignum type, don't
  coerce to `number`.
- **`obligations()`** returns upcoming payroll obligations: `scheduleId`,
  `scheduleName`, `nextRunAt` (ISO string), `asset`, `requiredBaseUnits`,
  optional `employeeCount`.
- **`decisions()`** returns the agent's decision history: `id`, `action`,
  `rationale`, `status`, `legalContextHash` (nullable), `stellarTxHash`
  (nullable, set once the decision actually settled on-chain), `createdAt`.
- **`legal()`** returns a `LegalState`: `published` (boolean), and if `true`,
  `hash` + the full `document` (a `LegalContext`, see LCP section).

## Triggering an Agent Proposal

```ts
const decision = await api.propose(); // dry-run: plans, doesn't execute
const executed = await api.propose(true); // shorthand for { execute: true }

const withAi = await api.propose({
  execute: true,
  aiProvider: "anthropic",       // "openai" | "anthropic" | "openrouter" | "groq" | "deepseek" | "xai" | "together"
  aiModel: "claude-3-5-sonnet-latest",
  aiApiKey: process.env.MY_KEY,  // bring-your-own-key, sent per-request, not stored server-side
  locale: "es",                  // "en" | "es" | "pt", language the rationale is written in
});
```

`propose(options?: boolean | ProposeOptions)` calls `POST /agent/propose` and
returns a single `AgentDecision`. The **on-chain decision** (which action, if
any, and the amount) is always computed deterministically server-side:
`aiProvider`/`aiModel`/`aiApiKey` only affect which LLM writes the
human-readable `rationale` text attached to that decision, never the action
itself.

Two things worth knowing before calling this with `execute: true`:

- It is the SDK's only state-changing call. If the decision resolves to a
  real action (not a no-op), passing `execute: true` can produce a genuine
  on-chain transaction. Don't call it unconditionally from code paths that
  should be read-only.
- Executing a decision requires a **published Legal Context Protocol
  document** for the tenant. If one isn't published, execution fails, but
  that failure does **not** surface as a thrown `ContextioApiError`. The
  API records the proposal regardless, then returns a normal `200` whose
  body is the decision plus an extra `executionError: string` field (not
  part of the typed `AgentDecision` interface). Check for that field on the
  object `propose()` resolves to; don't rely on a `try`/`catch` around the
  call to catch this case.

## Verifying a Legal Context (LCP)

```ts
import { hashLegalContext, verifyLegalContext, legalContextUrl } from "contextio-sdk";

const doc = await client.wellKnownLegalContext("acme.contextio.xyz");
const hash = hashLegalContext(doc);              // canonical SHA-256, hex
verifyLegalContext(doc, onChainHashFromEvent);    // boolean
```

`wellKnownLegalContext(domain)` fetches
`${baseUrl}/.well-known/contextio-legal-context.json?domain=<domain>`: the
Contextio API's own mirror endpoint for a tenant's published document, not a
raw request to `domain` itself. It works without a session.

`hashLegalContext` runs a deterministic JSON canonicalization (a subset of
RFC 8785 / JCS: sorted keys, no insignificant whitespace, `undefined`
dropped) that is byte-for-byte identical to how the Contextio platform
computes the hash it binds into on-chain events. That means you can fetch a
document independently, recompute its hash with `hashLegalContext`, and
compare it against a hash you got from elsewhere (an on-chain event, an API
response) without trusting Contextio's server to tell you the truth.

`legalContextUrl(tenantDomain)` and the exported `LCP_WELL_KNOWN_PATH`
constant (`/.well-known/contextio-legal-context.json`) point at Contextio's
**own** document path: a different, Contextio-specific path and schema from
the reserved `/.well-known/legal-context.json` used by the independent, open
Legal Context Protocol standard (`legalcontextprotocol.org`, AAA + Integra
Ledger). As of SDK `0.3.0` Contextio's `LegalContext` shape is
field-conformant with that open standard (`terms`, `termsFormat`, `atrHash`,
`acceptanceRequired`, `disputeResolution`, `contact`, `api`), plus
Contextio-specific extensions the standard's schema allows
(`consentRequirements`, `disputeChannels`, `settlement`, `jurisdictions`,
and more), but the two paths don't collide and code written against one
shouldn't assume it can read the other.

## Error Handling

```ts
import { ContextioApiError, type AgentDecision } from "contextio-sdk";

type ProposeResult = AgentDecision & { executionError?: string };

try {
  const result = (await api.propose(true)) as ProposeResult;
  if (result.executionError) {
    console.warn("proposal recorded but not executed:", result.executionError);
  }
} catch (err) {
  if (err instanceof ContextioApiError) {
    console.error(err.status, err.message);
  }
  throw err;
}
```

`ContextioApiError` carries the HTTP `status` and a `message` taken from the
response body's `error` field when present, otherwise a generic
`API <path> -> <status>` string, thrown for any non-2xx response (auth
failures, validation errors, unexpected server errors). Calling an
authenticated method on a client that never went through `withSession()`
throws a plain `Error` instead: that's a local guard before any request is
made, not a server error.

## Quick Reference

| Task | Method | Auth required |
|---|---|---|
| Request a SEP-53 challenge | `client.challenge(address)` | no |
| Exchange a signed challenge for a session | `client.verify({...})` | no |
| Full sign-in handshake | `signInWithStellar({ client, address, signMessage })` | no |
| Get an authenticated client | `client.withSession(session)` | n/a |
| Read treasury snapshot | `api.treasury()` | yes |
| Read payroll obligations | `api.obligations()` | yes |
| Read agent decision history | `api.decisions()` | yes |
| Read legal context state | `api.legal()` | yes |
| Trigger/execute an agent proposal | `api.propose(options?)` | yes |
| Fetch a tenant's public LCP document | `client.wellKnownLegalContext(domain)` | no |
| Hash / verify an LCP document | `hashLegalContext(doc)` / `verifyLegalContext(doc, hash)` | n/a |

## Common Mistakes

- **Calling `treasury()`/`obligations()`/`decisions()`/`legal()`/`propose()`
  before `withSession()`.** These throw immediately with a clear local error.
  The fix is always to sign in first and use the client `withSession()`
  returns, not the original one.
- **Calling `propose({ execute: true })` as if it were a read.** It's the
  one state-changing call in the SDK; a non-no-op decision can produce a real
  on-chain transaction. Default to `propose()` (no execute) when you only
  want to see what the agent would do.
- **Expecting a missing Legal Context Protocol document to throw.** It
  doesn't, for `propose({ execute: true })`: the proposal is still recorded,
  the API returns `200`, and the failure only shows up as an
  `executionError` string on the returned object. Check for that field
  explicitly; a bare `try`/`catch` around `propose()` will not see it. Note
  that `executionError` is not declared on the `AgentDecision` type `propose()`
  is typed to return: it's a real field the API can add to the JSON body
  that the current `.d.ts` doesn't model, so reading it needs a local cast
  (as in the example above), and TypeScript won't warn you if you forget to
  check for it.
- **Confusing `LCP_WELL_KNOWN_PATH` with the reserved
  `/.well-known/legal-context.json`** from the independent, open Legal
  Context Protocol standard. Contextio's own document lives at a different
  path (`/.well-known/contextio-legal-context.json`) precisely to avoid that
  collision, even though the document shape is now spec-conformant.
- **Treating `TreasurySnapshot`/`Obligation` amount fields as numbers.**
  `amountBaseUnits` / `requiredBaseUnits` / `liquidBaseUnits` etc. are all
  strings (base units of the asset) to avoid floating-point precision loss.
  Parse with a bignum library, don't do `Number(x)` on them.
- **Assuming `aiProvider`/`aiModel`/`aiApiKey` change what the agent does.**
  They only change which LLM writes the `rationale` string on the returned
  `AgentDecision`; the action and amount are computed deterministically
  regardless of which AI provider (or none) is configured.
