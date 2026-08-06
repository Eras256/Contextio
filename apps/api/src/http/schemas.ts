import { z } from "zod";

/** Zod request schemas — every state-changing endpoint validates its body. */

const country = z.enum(["BR", "AR", "CO"]);
const asset = z.enum(["USDC", "XLM", "CETES", "BRL", "ARS", "COP"]);
const rail = z.enum(["PIX", "TRANSFERENCIAS_3", "BRE_B", "STELLAR", "SEP24", "SEP31"]);
const decimal = z.string().regex(/^\d+(\.\d{1,7})?$/u, "Expected a non-negative decimal");

/**
 * Restricted jurisdictions: EU/EEA (MiCA — a full CASP licensing regime),
 * the United States (FinCEN/BSA money-transmitter rules, both federal and a
 * 50-state patchwork), and China (an express, blanket prohibition on
 * commercial crypto-asset services, not just a licensing regime to clear).
 * Contextio's non-custodial thesis is genuinely researched for BR/AR/CO
 * (see TECHNICAL.md) — these three are excluded by simple, honest default
 * until the same review happens for them, not because they're assumed
 * unsafe. See apps/web/src/middleware.ts for the matching technical
 * geo-signal (defense in depth, not the boundary itself).
 */
export const restrictedJurisdictionAttestationMessage =
  "jurisdictionAttestation must be true: this action isn't available to residents of the European Union/EEA, the United States, or China pending legal review of those jurisdictions specifically (MiCA, FinCEN/BSA, and China's express prohibition on crypto services, respectively).";

export const treasuryConfigSchema = z.object({
  minLiquidityBaseUnits: z.string().regex(/^\d+$/u),
  maxYieldBps: z.number().int().min(0).max(10_000),
  countryLimitsBps: z.record(country, z.number().int().min(0).max(10_000)).default({}),
  volatilitySensitivity: z.number().int().min(0).max(100),
  agentEnabled: z.boolean().default(true),
});

/** Toggle the autonomous agent on/off — gated by a SEP-53 wallet signature (consent). */
export const agentToggleSchema = z.object({
  enabled: z.boolean(),
  address: z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)"),
  message: z.string().min(1).max(2000),
  signedMessage: z.string().min(1).max(2000),
});

/** Shared restricted-jurisdiction attestation — see restrictedJurisdictionAttestation below. */
const jurisdictionAttestation = z.literal(true, {
  errorMap: () => ({
    message: restrictedJurisdictionAttestationMessage,
  }),
});

/** Build an unsigned tx for the user to sign in their own wallet (self-custody). */
export const prepareMoveSchema = z.object({
  venue: z.enum(["blend", "defindex"]).default("blend"),
  direction: z.enum(["supply", "withdraw"]),
  asset: z.enum(["XLM", "USDC"]).default("XLM"),
  amountBaseUnits: z.string().regex(/^\d+$/u),
  address: z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)"),
  acknowledgeTerms: z.literal(true, {
    errorMap: () => ({ message: "acknowledgeTerms must be true to prepare a self-custody move." }),
  }),
  jurisdictionAttestation,
});

/** Submit a user-signed transaction envelope produced from `prepareMoveSchema`. */
export const submitMoveSchema = z.object({
  signedXdr: z.string().min(1).max(50_000),
});

export const rebalanceSchema = z.object({
  from: z.enum(["liquidity", "defindex_vault", "blend_pool"]),
  to: z.enum(["liquidity", "defindex_vault", "blend_pool"]),
  asset,
  amountBaseUnits: z.string().regex(/^\d+$/u),
  strategyRef: z.string().min(1),
});

export const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  country,
  walletAddress: z.string().nullable().optional(),
  bankReference: z.string().nullable().optional(),
  payoutAsset: asset,
  preferredRail: rail,
  salaryAmount: decimal,
  active: z.boolean().default(true),
});

export const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  cadence: z.enum(["weekly", "biweekly", "monthly", "one_off"]),
  nextRunAt: z.string().datetime(),
  asset,
  rail,
  employeeIds: z.array(z.string().uuid()).min(1),
  active: z.boolean().default(true),
});

export const runSchema = z.object({
  scheduleId: z.string().uuid(),
  dryRun: z.boolean().default(false),
});

/**
 * Build unsigned XDRs for a self-custody payroll run: the caller's own
 * treasury wallet pays and records the run, the platform never holds the
 * funds. Gated the same way the on-chain contract restricts recipients to
 * independent service providers (Art. 101 LFT bars paying subordinate salary
 * in a non-legal-tender asset) — `contractorAttestation` must be explicit,
 * per run, not a one-time account setting, so it can't be forgotten.
 */
export const preparePayrollRunSchema = z.object({
  scheduleId: z.string().uuid(),
  address: z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)"),
  contractorAttestation: z.literal(true, {
    errorMap: () => ({
      message:
        "contractorAttestation must be true: this run's recipients are independent contractors/freelancers under a commercial contract, never subordinate employees (LFT Art. 101 requires salary in legal-tender currency). Ahead of LFPIORPI Fracción XVI, effective 2027-01-17.",
    }),
  }),
  acknowledgeTerms: z.literal(true, {
    errorMap: () => ({ message: "acknowledgeTerms must be true to prepare a self-custody payout." }),
  }),
  jurisdictionAttestation,
});

export const submitPayrollRunSchema = z
  .object({
    runId: z.string().uuid(),
    scheduleId: z.string().uuid(),
    // Echoed back from `prepare` rather than recomputed, so the audit record
    // references the exact legal binding that was actually signed on-chain.
    legalContextId: z.string().min(1),
    legalContextHash: z.string().min(1),
    // null when `prepare` didn't return one (our payroll contract isn't
    // deployed on this network — mainnet, pre-audit); the payment alone
    // still settles and is recorded off-chain instead.
    signedExecuteRunXdr: z.string().min(1).max(50_000).nullable(),
    signedPaymentXdr: z.string().min(1).max(50_000).nullable(),
  })
  .refine((v) => v.signedExecuteRunXdr || v.signedPaymentXdr, {
    message: "At least one of signedExecuteRunXdr or signedPaymentXdr is required",
  });

export const publishLegalSchema = z.object({
  providerLegalName: z.string().min(1),
  providerJurisdiction: z.string().min(2),
  providerContactEmail: z.string().email(),
  termsUrl: z.string().url(),
  termsText: z.string().optional(),
  jurisdictions: z.array(z.string().min(2)).min(1),
});

export const proposeSchema = z.object({
  execute: z.boolean().default(false),
  // Optional per-request override of the LLM that writes the rationale (the
  // dashboard AI selector). `aiProvider` is a known provider id (the server maps
  // it to an OpenAI-compatible base URL); with `aiApiKey` this is a BYOK run.
  // Without a key, only `aiModel` applies (uses the server-configured provider).
  aiProvider: z.enum(["openai", "anthropic", "openrouter", "groq", "deepseek", "xai", "together"]).optional(),
  aiModel: z.string().min(1).max(96).optional(),
  aiApiKey: z.string().min(1).max(400).optional(),
  // UI language for the LLM-written rationale (the autonomous worker omits it
  // and keeps the server default, English).
  locale: z.enum(["en", "es", "pt"]).optional(),
});

export const vaultCreateSchema = z.object({
  name: z.string().min(1),
  asset: z.string().min(1),
  strategy: z.string().min(1),
});

/** Build an unsigned factory create-vault tx for the user to sign (self-custody deploy). */
export const createVaultPrepareSchema = z.object({
  asset: z.enum(["XLM", "USDC"]),
  name: z.string().min(1).max(32),
  address: z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)"),
});

/** Build an unsigned tx that renounces control of a vault (manager → null). */
export const renounceVaultSchema = z.object({
  vaultAddress: z.string().regex(/^C[A-Z2-7]{55}$/u, "Expected a Soroban contract address (C...)"),
  address: z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)"),
});

export const blendOpSchema = z.object({
  asset: z.string().min(1),
  amountBaseUnits: z.string().regex(/^\d+$/u),
});

const stellarAddress = z.string().regex(/^G[A-Z2-7]{55}$/u, "Expected a Stellar public key (G...)");

export const walletChallengeSchema = z.object({
  address: stellarAddress,
});

export const walletVerifySchema = z.object({
  address: stellarAddress,
  message: z.string().min(1).max(2000),
  hmac: z.string().min(1),
  signedMessage: z.string().min(1).max(2000),
});
