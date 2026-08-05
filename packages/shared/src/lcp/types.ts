import { z } from "zod";

/**
 * Legal Context Protocol (LCP) — types for the document served at
 * `https://{tenant-domain}/.well-known/contextio-legal-context.json`.
 *
 * The document gives AI agents and counterparties a machine-readable, verifiable
 * statement of the terms, consent requirements, jurisdiction, and dispute
 * channels that govern agentic commerce executed on behalf of a tenant. Every
 * agent-driven Stellar transaction is bound to a specific version+hash of this
 * document so the legal basis of an action is auditable after the fact.
 *
 * This schema is intentionally close in spirit to emerging agentic-commerce
 * "terms" manifests; it is versioned so it can track a future formal spec.
 */

export const LCP_SPEC_VERSION = "0.1.0" as const;

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

export const lcpTermsSchema = z.object({
  /** Human-readable terms URL (the canonical legal prose). */
  url: z.string().url(),
  /** SHA-256 hex of the referenced terms document, for tamper-evidence. */
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  effectiveDate: z.string(),
});

export const legalContextSchema = z.object({
  specVersion: z.literal(LCP_SPEC_VERSION).default(LCP_SPEC_VERSION),
  /** Stable identifier for this legal context (uuid). */
  contextId: z.string().uuid(),
  /** Monotonic version; bump on any material change. */
  version: z.number().int().positive(),
  tenantDomain: z.string().min(1),
  provider: lcpPartySchema,
  terms: lcpTermsSchema,
  /** Operating jurisdictions this context covers (ISO 3166-1 alpha-2). */
  jurisdictions: z.array(z.string().min(2)).min(1),
  consentRequirements: z.array(lcpConsentRequirementSchema).min(1),
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
