import { z } from "zod";

/**
 * Single source of truth for environment configuration across every Contextio
 * service. Each app calls `loadEnv()` once at boot; an invalid environment
 * fails fast with a readable error instead of surfacing as a runtime null.
 */

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );

export const StellarNetwork = z.enum(["testnet", "mainnet", "local"]);
export type StellarNetwork = z.infer<typeof StellarNetwork>;

/**
 * Base schema shared by all runtimes. App-specific schemas extend this so the
 * web bundle never requires the service-role key, while the API/worker do.
 */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Stellar
  STELLAR_NETWORK: StellarNetwork.default("testnet"),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_HORIZON_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),

  // LCP
  LCP_PLATFORM_DOMAIN: z.string().min(1).default("contextio.xyz"),
});

/** Server-side (API + worker) schema: adds secrets that must never reach the browser. */
export const serverEnvSchema = baseEnvSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(8080),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: csv,
  INTERNAL_API_SECRET: z.string().min(16, "INTERNAL_API_SECRET must be at least 16 chars"),

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  STELLAR_SERVICE_SECRET: z
    .string()
    .regex(/^S[A-Z2-7]{55}$/u, "Expected a Stellar secret seed (S...)")
    .optional()
    .or(z.literal("")),
  TREASURY_CONTRACT_ID: z.string().optional().or(z.literal("")),
  PAYROLL_CONTRACT_ID: z.string().optional().or(z.literal("")),
  USDC_CONTRACT_ID: z.string().optional().or(z.literal("")),
  /** Classic issuer (G…) of the USDC used for real payroll payouts. */
  USDC_ISSUER: z.string().optional().or(z.literal("")),

  DEFINDEX_API_URL: z.string().url().default("https://api.defindex.io"),
  DEFINDEX_API_KEY: z.string().optional().or(z.literal("")),
  DEFINDEX_FACTORY_CONTRACT_ID: z.string().optional().or(z.literal("")),
  DEFINDEX_VAULT_ID: z.string().optional().or(z.literal("")),
  DEFINDEX_NETWORK: z.string().default("testnet"),

  BLEND_POOL_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_BACKSTOP_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_ORACLE_CONTRACT_ID: z.string().optional().or(z.literal("")),
  BLEND_ASSET_ID: z.string().optional().or(z.literal("")),
  /** SEP-24 off-ramp anchor base URL (testnet reference anchor by default). */
  ANCHOR_SEP24_URL: z.string().default("https://testanchor.stellar.org"),
  /**
   * SEP-31/38 anchor base URL — Contextio's own self-hosted Anchor Platform
   * (infra/anchor-platform/), not the SDF reference anchor SEP-24 still
   * uses. Real LatAm corridors (PIX/BRL, Transferencias 3.0/ARS, Bre-B/COP)
   * the reference anchor doesn't price and has no configured receive
   * assets for. Testnet-only default — fly.mainnet.toml deliberately
   * doesn't override this, so the mainnet gate in public.ts routes catches
   * it the same way it already catches ANCHOR_SEP24_URL.
   */
  ANCHOR_SEP3138_URL: z.string().default("https://contextio-anchor-platform.fly.dev"),
  // Signer for Blend supply/withdraw. Defaults to STELLAR_SERVICE_SECRET, but for
  // USDC lending it must be the account that actually holds the BlendUSDC (the
  // agent wallet), so this overrides the signer for the Blend client only.
  BLEND_SIGNER_SECRET: z.string().optional().or(z.literal("")),
  /**
   * OpenZeppelin Stellar Smart Account gating Blend supply/withdraw (Milestone
   * 1, see TECHNICAL.md §6) — `BLEND_SIGNER_SECRET`'s key becomes a
   * `Signer::Delegated` bounded by an on-chain spending-limit policy instead
   * of signing directly. Unset by default: BlendClient falls back to the
   * existing direct-signing path until this is explicitly configured, so
   * setting it is the one deliberate switch that changes the live agent's
   * signing behavior.
   */
  BLEND_SMART_ACCOUNT_ID: z.string().optional().or(z.literal("")),
  /** Context rule id on `BLEND_SMART_ACCOUNT_ID` scoped to `BLEND_ASSET_ID` (carries the real spending cap). */
  BLEND_SMART_ACCOUNT_ASSET_RULE_ID: z.coerce.number().int().default(1),
  /** Context rule id on `BLEND_SMART_ACCOUNT_ID` scoped to `BLEND_POOL_CONTRACT_ID` (signer-gate only). */
  BLEND_SMART_ACCOUNT_POOL_RULE_ID: z.coerce.number().int().default(2),

  /**
   * BlindPay off-ramp settlement (Milestone 2, licensed-partner side — see
   * TECHNICAL.md §6). Unset by default: `BlindPayClient.enabled` is false
   * until both are set. Get a free `development` instance immediately at
   * https://app.blindpay.com/sign-up — no paid plan or business
   * verification required to start sandbox integration.
   */
  BLINDPAY_API_URL: z.string().default("https://api.blindpay.com/v1"),
  BLINDPAY_API_KEY: z.string().optional().or(z.literal("")),
  BLINDPAY_INSTANCE_ID: z.string().optional().or(z.literal("")),

  FX_PROVIDER: z.enum(["mock", "http"]).default("mock"),
  FX_API_URL: z.string().url().optional().or(z.literal("")),
  FX_API_KEY: z.string().optional().or(z.literal("")),

  // Reflector — Stellar's on-chain price oracle (SEP-40). When set, real XLM/USD
  // (and other) prices are read on-chain instead of a hardcoded rate. Defaults to
  // the public Reflector "external CEX/DEX" oracle for the current network.
  REFLECTOR_PRICE_CONTRACT_ID: z.string().optional().or(z.literal("")),

  // AI advisor — the LLM that writes the agent's reasoning. Provider-neutral via
  // an OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter, a local
  // model, …). `none` keeps the agent fully deterministic (the default). The LLM
  // only explains decisions; it never changes the action or bypasses risk limits.
  AI_PROVIDER: z.enum(["none", "openai"]).default("none"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_API_KEY: z.string().optional().or(z.literal("")),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),

  // Wallet auth (Sign In With Stellar). Session JWTs are signed with the
  // Supabase JWT secret (HS256) so they also authorize Supabase Realtime/RLS.
  // A freshly-connected wallet auto-joins this tenant with AUTH_DEMO_ROLE — a
  // deliberate testnet convenience (anyone can try the demo with zero signup
  // friction) that must NEVER be set on mainnet: it grants membership (default
  // role "owner") to literally any wallet that completes SEP-53 sign-in, no
  // vetting at all. Found live 2026-08-06 still set on contextio-api-mainnet
  // (copy-pasted from testnet's config without re-examining what it does) —
  // removed there; PUBLIC_ACTIVITY_TENANT_ID below replaces its OTHER,
  // harmless read-only use. Leave AUTH_DEMO_TENANT_ID blank to disable auto-join.
  AUTH_DEMO_TENANT_ID: z.string().optional().or(z.literal("")),
  AUTH_DEMO_ROLE: z.enum(["owner", "admin", "member", "viewer"]).default("owner"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  // Which tenant's agent_decisions the public, unauthenticated /public/activity
  // feed reads (home page live feed). Deliberately separate from
  // AUTH_DEMO_TENANT_ID — showing a tenant's activity publicly is harmless
  // (sanitized fields only, no membership granted), unlike auto-enrolling
  // wallets, so this can safely stay set on mainnet even with the auto-join
  // above turned off. Falls back to AUTH_DEMO_TENANT_ID when unset so
  // testnet's existing single-var setup keeps working unchanged.
  PUBLIC_ACTIVITY_TENANT_ID: z.string().optional().or(z.literal("")),

  // Public Stellar address of the autonomous agent (shown in the Home live feed).
  AGENT_PUBLIC_ADDRESS: z.string().optional().or(z.literal("")),

  // OpenZeppelin's hosted Channels service — fee-sponsored submission with no
  // platform signer key involved (the fund account lives on their side, not
  // ours). Unset by default; get a key at https://channels.openzeppelin.com/gen
  // (mainnet) or .../testnet/gen. Safe to enable on mainnet — see RelayerClient.
  OZ_CHANNELS_API_KEY: z.string().optional().or(z.literal("")),
  OZ_CHANNELS_BASE_URL: z.string().url().default("https://channels.openzeppelin.com/testnet"),

  // Mainnet allowlist ("por invitación"): on STELLAR_NETWORK=mainnet, the
  // self-custody treasury/payout endpoints are further restricted to these
  // tenant ids — a stand-in for the KYB/tier gate on the Milestone 2 roadmap.
  // Ignored on testnet. Empty on mainnet means nobody is allowed yet.
  MAINNET_ALLOWLIST_TENANT_IDS: csv,
});

/** Worker-only extras layered on top of the server schema. */
export const workerEnvSchema = serverEnvSchema.extend({
  AGENT_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  AGENT_DRY_RUN: booleanFromString.default(true),
  API_BASE_URL: z.string().url().default("http://localhost:8080"),
  // Tenants the worker must never poll/propose for — e.g. a tenant that only
  // exists to isolate contextio-api-mainnet's public activity feed. There is
  // no `network` column on tenants yet (deferred), so this is the explicit
  // guard until that lands: without it, the worker's blanket
  // "every tenant row" polling would keep generating (harmless but real)
  // agent_decisions rows against a tenant meant to represent a clean,
  // untouched mainnet deployment.
  WORKER_EXCLUDE_TENANT_IDS: csv,
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Mainnet must be receive-only: this process may never hold a key capable of
 * moving real client funds. This is not a policy switch to be toggled back on
 * — it is the load-bearing control behind every "we never custody funds"
 * claim in the legal/compliance posture (see contextio-mainnet-launch-plan).
 * Any hot secret configured alongside STELLAR_NETWORK=mainnet fails boot
 * immediately, so misconfiguration can never silently ship a custodial signer
 * to production. Deploy a *separate* mainnet-scoped instance with these
 * secrets unset for the read-only surface (oracle, LCP, audit trail, anchor
 * status); keep the operational keys only on testnet-scoped deployments.
 */
function assertMainnetHasNoHotKey(config: {
  STELLAR_NETWORK: StellarNetwork;
  STELLAR_SERVICE_SECRET?: string;
  BLEND_SIGNER_SECRET?: string;
}): void {
  if (config.STELLAR_NETWORK !== "mainnet") return;
  const offenders = (
    [
      ["STELLAR_SERVICE_SECRET", config.STELLAR_SERVICE_SECRET],
      ["BLEND_SIGNER_SECRET", config.BLEND_SIGNER_SECRET],
    ] as const
  ).filter(([, v]) => Boolean(v));
  if (offenders.length > 0) {
    const names = offenders.map(([n]) => n).join(", ");
    throw new Error(
      `Refusing to boot: STELLAR_NETWORK=mainnet with a signer secret present (${names}). ` +
        `Mainnet must be receive-only — this process cannot be allowed to sign transactions ` +
        `that move real client funds. Unset these secrets for the mainnet deployment, or run ` +
        `against testnet while the custodial paths are still in use.`,
    );
  }
}

/**
 * Narrower, call-site companion to {@link assertMainnetHasNoHotKey} above.
 * That check stops any hot key from existing on a mainnet-configured process
 * at all, which today makes agent-signed mainnet execution structurally
 * impossible — but only as a side effect of the key being absent. This check
 * asserts the actual invariant directly, at the exact call shape that matters,
 * so it keeps failing even if a future signer — a relayer, a smart-account
 * delegate, anything that isn't literally `STELLAR_SERVICE_SECRET`/
 * `BLEND_SIGNER_SECRET` — stops counting as a "hot key" under the check above.
 *
 * Refuses on mainnet unconditionally, not only for `actorType: "agent"`. The
 * functions this guards (`TreasuryService.rebalance`, `PayrollService.
 * executeRun`) are exclusively the *custodial* execution path — the
 * self-custody prepare/submit path (the only path mainnet should ever use)
 * calls different methods entirely and never reaches this check. So a
 * `"user"` actor landing here isn't a legitimate mainnet caller either: it's
 * someone hitting the custodial route directly (bypassing the UI, which
 * only exposes prepare/submit on mainnet). Before this covered "user" too,
 * that request didn't fail — `SorobanGateway` has no hot key or contract id
 * to act with on mainnet, so it silently returned a fabricated `sim:` tx
 * hash as if something had actually settled. That's a correctness and trust
 * problem independent of the legal question below: an endpoint reporting
 * success with a fake hash when nothing happened has to be rejected outright,
 * not just quietly no-op. Refusing unconditionally fixes both at once.
 *
 * The legal half: this is the concrete difference between Contextio's
 * mainnet posture and Nirium's under art. 24 Bis 4 — mainnet money only ever
 * moves on the client's own signed XDR, never Contextio's. Removing this
 * check (or narrowing it back to `actorType: "agent"` only) is a deliberate,
 * visible change to that posture, not something a future feature should be
 * able to cause by accident. See contextio-mainnet-launch-plan for the full
 * legal context.
 */
export function assertMainnetNeverAutoExecutesTreasuryActions(
  network: StellarNetwork,
  actorType: "user" | "agent",
): void {
  if (network !== "mainnet") return;
  if (actorType === "agent") {
    throw new Error(
      "Refusing to execute: an agent-initiated action cannot settle on STELLAR_NETWORK=mainnet. " +
        "Mainnet money only moves when the client signs their own prepared transaction — route " +
        "this through the prepare/submit self-custody path instead of agent-triggered execution.",
    );
  }
  throw new Error(
    "Refusing to execute: the direct custodial settlement path cannot run on STELLAR_NETWORK=mainnet, " +
      "even for a user-initiated request. Mainnet has no signer or contract id to settle with here by " +
      "design — use the prepare/submit self-custody endpoints instead of this one.",
  );
}

export function loadServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const config = parseOrThrow(serverEnvSchema, source);
  assertMainnetHasNoHotKey(config);
  return config;
}

export function loadWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const config = parseOrThrow(workerEnvSchema, source);
  assertMainnetHasNoHotKey(config);
  return config;
}

export function loadBaseEnv(source: NodeJS.ProcessEnv = process.env): BaseEnv {
  return parseOrThrow(baseEnvSchema, source);
}
