/** Public types for the Contextio SDK. Mirror the API's JSON response shapes. */

export type Country = "BR" | "AR" | "CO";
export type Asset = "USDC" | "XLM" | "CETES" | "BRL" | "ARS" | "COP";
export type Strategy = "liquidity" | "defindex_vault" | "blend_pool";
export type Rail = "PIX" | "TRANSFERENCIAS_3" | "BRE_B" | "STELLAR" | "SEP24" | "SEP31";

export interface TreasuryConfig {
  minLiquidityBaseUnits: string;
  maxYieldBps: number;
  volatilitySensitivity: number;
  countryLimitsBps: Record<string, number>;
}

export interface TreasuryPosition {
  asset: string;
  strategy: Strategy;
  strategyRef: string | null;
  amountBaseUnits: string;
  apyBps: number | null;
}

export interface TreasurySnapshot {
  config: TreasuryConfig | null;
  positions: TreasuryPosition[];
  totals: {
    liquidBaseUnits: string;
    yieldBaseUnits: string;
    totalBaseUnits: string;
    yieldShareBps: number;
  };
}

export interface Obligation {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  asset: string;
  requiredBaseUnits: string;
  employeeCount?: number;
}

export interface AgentDecision {
  id: string;
  action: string;
  rationale: string;
  status: string;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  createdAt: string;
}

export interface LegalState {
  published: boolean;
  hash?: string;
  document?: LegalContext;
}

// ── Wallet sign-in (SEP-53) ────────────────────────────────────────────────
export interface WalletChallenge {
  message: string;
  hmac: string;
}

export interface WalletSession {
  token: string;
  tokenType: "Bearer";
  expiresAt: string;
  address: string;
  userId: string;
  tenantId: string;
  role: string;
}

// ── Legal Context Protocol ─────────────────────────────────────────────────
export interface LcpParty {
  legalName: string;
  jurisdiction: string;
  registrationId?: string;
  contactEmail: string;
}

export interface LcpConsentRequirement {
  id: string;
  description: string;
  required: boolean;
  scope: Array<"treasury" | "payroll" | "yield" | "onramp" | "offramp">;
}

export interface LcpDisputeChannel {
  type: "arbitration" | "mediation" | "court" | "ombudsman";
  provider: string;
  venue: string;
  governingLaw: string;
  language: string;
}

/** spec: `disputeResolution` (Level 4) from the real Legal Context Protocol standard. */
export interface LcpDisputeResolution {
  method: string;
  jurisdiction: string;
  contact: string;
  clauseId?: string;
  source?: string;
  catalog?: string;
}

/**
 * As of SDK 0.3.0 / LCP spec version 0.2.0, this is a genuine implementation
 * of the real "Legal Context Protocol" open standard (legalcontextprotocol.org,
 * June 2026, AAA + Integra Ledger) — fields without a `spec:` note below
 * are Contextio-specific extensions the standard's schema explicitly allows
 * (`additionalProperties: true`).
 */
export interface LegalContext {
  /** spec, REQUIRED: absolute HTTPS URL of the standalone terms document. */
  terms: string;
  /** spec: format of the `terms` document. */
  termsFormat: "markdown" | "json" | "plain" | "html" | "pdf";
  /** spec, Level 2: SHA-256 of `terms`' actual bytes — `0x` + 64 lowercase hex. */
  atrHash: string;
  /** spec, Level 3. */
  acceptanceRequired: boolean;
  /** spec, Level 4: primary dispute-resolution channel (see `disputeChannels` for full per-jurisdiction detail). */
  disputeResolution: LcpDisputeResolution;
  /** spec, optional. */
  contact?: { legal?: string; technical?: string };
  /** spec, Level 4. */
  api?: string;

  specVersion: string;
  contextId: string;
  version: number;
  tenantDomain: string;
  provider: LcpParty;
  termsEffectiveDate: string;
  jurisdictions: string[];
  consentRequirements: LcpConsentRequirement[];
  disputeChannels: LcpDisputeChannel[];
  settlement: { networks: string[]; assets: string[] };
  publishedAt: string;
}

/** Compact binding embedded into agentic Stellar transactions. */
export interface LcpBinding {
  contextId: string;
  version: number;
  hash: string;
  consents: string[];
}

export interface ProposeOptions {
  execute?: boolean;
  aiProvider?: "openai" | "anthropic" | "openrouter" | "groq" | "deepseek" | "xai" | "together";
  aiModel?: string;
  aiApiKey?: string;
  locale?: "en" | "es" | "pt";
}
