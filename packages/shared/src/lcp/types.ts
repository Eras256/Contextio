import { z } from "zod";

/**
 * Legal Context Protocol (LCP) — types for the document served at
 * `https://{tenant-domain}/.well-known/contextio-legal-context.json`.
 *
 * As of v0.2.0 this is a genuine, schema-validated implementation of the
 * real, open "Legal Context Protocol" standard (legalcontextprotocol.org,
 * launched June 2026 by the AAA + Integra Ledger, with SDF as a founding
 * contributor) — not just an internal mechanism that happens to share the
 * name. Fields marked "spec:" below are the standard's own vocabulary
 * (verified field-by-field against `spec/legal-context.schema.json` in
 * github.com/legal-context-protocol/legal-context-protocol, 2026-08-05);
 * everything else is a Contextio-specific extension the standard explicitly
 * allows (`additionalProperties: true`). This reaches the standard's highest
 * disclosed trust tier, "Level 4: Integrated" (has `disputeResolution` + `api`).
 *
 * The document is served at Contextio's OWN path
 * (`/.well-known/contextio-legal-context.json`, not the standard's reserved
 * `/.well-known/legal-context.json`) — Contextio isn't the domain the
 * standard's discovery mechanism resolves against (it's per-tenant, and a
 * given tenant's actual domain is what SEP-10/wallet auth already
 * authenticates), so publishing at the reserved path would incorrectly imply
 * Contextio itself is "the" service the terms govern, for every tenant.
 *
 * Every agent-driven Stellar transaction is bound to a specific version+hash
 * of this document so the legal basis of an action is auditable after the
 * fact — this predates and is independent of the open standard's own
 * transaction-binding patterns (see `hashLegalContext`/`LcpBinding`).
 */

export const LCP_SPEC_VERSION = "0.2.0" as const;

export const lcpPartySchema = z.object({
  legalName: z.string().min(1),
  /** Jurisdiction of incorporation/registration, ISO 3166-1 alpha-2 + optional subdivision. */
  jurisdiction: z.string().min(2),
  registrationId: z.string().optional(),
  contactEmail: z.string().email(),
});

export const lcpConsentRequirementSchema = z.object({
  /** Stable id referenced by consent records and on-chain bindings. */
  id: z.string().min(1),
  description: z.string().min(1),
  /** Whether a counterparty must explicitly accept before agentic actions run. */
  required: z.boolean().default(true),
  /** Scope of operations this consent authorizes. */
  scope: z.array(z.enum(["treasury", "payroll", "yield", "onramp", "offramp"])).min(1),
});

export const lcpDisputeChannelSchema = z.object({
  type: z.enum(["arbitration", "mediation", "court", "ombudsman"]),
  provider: z.string().min(1),
  /** Where to file (URL, email, or physical venue). */
  venue: z.string().min(1),
  governingLaw: z.string().min(1),
  language: z.string().default("en"),
});

/**
 * spec: `disputeResolution` (Level 4). The official schema's shape is a
 * single object, not per-jurisdiction — Contextio populates this with the
 * primary/default channel and keeps the full BR/AR/CO breakdown in
 * `disputeChannels` (extension) below, since real per-jurisdiction detail
 * matters more to LatAm SMB counterparties than the spec's minimum shape.
 */
export const lcpDisputeResolutionSchema = z.object({
  method: z.string().min(1),
  jurisdiction: z.string().min(1),
  contact: z.string().min(1),
  /** spec format: `sha256:0x<64 lowercase hex>`. */
  clauseId: z.string().regex(/^sha256:0x[0-9a-f]{64}$/u).optional(),
  source: z.string().url().optional(),
  catalog: z.string().url().optional(),
});

/** spec: `contact` (optional). */
export const lcpContactSchema = z.object({
  legal: z.string().optional(),
  technical: z.string().optional(),
});

export const legalContextSchema = z.object({
  // ── Official Legal Context Protocol fields (legalcontextprotocol.org v1) ──
  /** spec, REQUIRED: absolute HTTPS URL of the standalone, downloadable terms document. */
  terms: z.string().url(),
  /** spec, Level 1: format of the `terms` document. Machine-readable text is recommended for agent-facing terms. */
  termsFormat: z.enum(["markdown", "json", "plain", "html", "pdf"]).default("markdown"),
  /** spec, Level 2: SHA-256 of the `terms` document's actual bytes. Format: `0x` + 64 lowercase hex. */
  atrHash: z.string().regex(/^0x[0-9a-f]{64}$/u),
  /** spec, Level 3: counterparties MUST explicitly accept before agentic actions run. */
  acceptanceRequired: z.boolean().default(true),
  /** spec, Level 4: primary dispute-resolution channel. */
  disputeResolution: lcpDisputeResolutionSchema,
  /** spec, optional: legal/technical contact points. */
  contact: lcpContactSchema.optional(),
  /** spec, Level 4: URL of a richer legal-context API (record management, verification, dispute filing). */
  api: z.string().url().optional(),

  // ── Contextio extensions (the spec declares `additionalProperties: true`) ──
  specVersion: z.literal(LCP_SPEC_VERSION).default(LCP_SPEC_VERSION),
  /** Stable identifier for this legal context (uuid). */
  contextId: z.string().uuid(),
  /** Monotonic version; bump on any material change. */
  version: z.number().int().positive(),
  tenantDomain: z.string().min(1),
  provider: lcpPartySchema,
  /** The date `terms` took effect — no spec equivalent. */
  termsEffectiveDate: z.string(),
  /** Operating jurisdictions this context covers (ISO 3166-1 alpha-2). */
  jurisdictions: z.array(z.string().min(2)).min(1),
  consentRequirements: z.array(lcpConsentRequirementSchema).min(1),
  /** Full per-jurisdiction dispute channel detail — see `disputeResolution` above for the spec-shaped primary entry. */
  disputeChannels: z.array(lcpDisputeChannelSchema).min(1),
  /** Networks + assets this context authorizes agentic settlement on. */
  settlement: z.object({
    networks: z.array(z.string()).min(1),
    assets: z.array(z.string()).min(1),
  }),
  /** ISO timestamp the document was last published. */
  publishedAt: z.string(),
});

export type LegalContext = z.infer<typeof legalContextSchema>;
export type LcpConsentRequirement = z.infer<typeof lcpConsentRequirementSchema>;
export type LcpParty = z.infer<typeof lcpPartySchema>;
export type LcpDisputeResolution = z.infer<typeof lcpDisputeResolutionSchema>;

/**
 * A binding embedded into an agentic transaction (on-chain event memo / log).
 * Compact on purpose — Soroban event topics are size-constrained.
 */
export interface LcpBinding {
  contextId: string;
  version: number;
  /** SHA-256 hex of the canonical contextio-legal-context.json at this version. */
  hash: string;
  /** Consent requirement ids satisfied for this action. */
  consents: string[];
}
