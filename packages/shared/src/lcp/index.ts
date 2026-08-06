import { createHash } from "node:crypto";
import { canonicalize } from "./canonical.js";
import {
  legalContextSchema,
  LCP_SPEC_VERSION,
  type LcpBinding,
  type LegalContext,
} from "./types.js";

export * from "./types.js";
export { canonicalize } from "./canonical.js";
export { CANONICAL_TERMS_MARKDOWN } from "./termsDocument.js";

/**
 * Compute the tamper-evident SHA-256 (hex) of a legal context over its
 * canonical JSON form. The same bytes are served at `.well-known` and bound
 * into on-chain events, so verifiers can re-derive and compare.
 */
export function hashLegalContext(context: LegalContext): string {
  const parsed = legalContextSchema.parse(context);
  const canonical = canonicalize(parsed);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/** Validate a candidate document and return the parsed, typed value. */
export function parseLegalContext(input: unknown): LegalContext {
  return legalContextSchema.parse(input);
}

/**
 * Produce the binding to attach to an agentic action. `satisfiedConsents` are
 * the consent requirement ids the action relied on; we verify they actually
 * exist in the context to prevent dangling references.
 */
export function bindLegalContext(
  context: LegalContext,
  satisfiedConsents: string[],
): LcpBinding {
  const known = new Set(context.consentRequirements.map((c) => c.id));
  const unknown = satisfiedConsents.filter((c) => !known.has(c));
  if (unknown.length > 0) {
    throw new Error(`Unknown consent requirement ids: ${unknown.join(", ")}`);
  }
  const required = context.consentRequirements.filter((c) => c.required).map((c) => c.id);
  const missing = required.filter((c) => !satisfiedConsents.includes(c));
  if (missing.length > 0) {
    throw new Error(`Missing required consents: ${missing.join(", ")}`);
  }
  return {
    contextId: context.contextId,
    version: context.version,
    hash: hashLegalContext(context),
    consents: satisfiedConsents,
  };
}

/**
 * Verify that a previously recorded binding still matches a context document —
 * used by auditors and by the API's pre-execution middleware.
 */
export function verifyBinding(context: LegalContext, binding: LcpBinding): boolean {
  return (
    binding.contextId === context.contextId &&
    binding.version === context.version &&
    binding.hash === hashLegalContext(context)
  );
}

/**
 * Canonical `.well-known` path for a tenant's legal context document.
 * Deliberately NOT `/.well-known/legal-context.json` — that path is reserved
 * by the AAA/Integra Ledger/SDF "Legal Context Protocol" open standard
 * (legalcontextprotocol.org, launched June 2026), which uses an unrelated
 * schema. Contextio's document predates that standard and isn't an
 * implementation of it; kept off its reserved path to avoid the collision.
 */
export const LCP_WELL_KNOWN_PATH = "/.well-known/contextio-legal-context.json";

export function legalContextUrl(tenantDomain: string): string {
  return `https://${tenantDomain}${LCP_WELL_KNOWN_PATH}`;
}

/**
 * Build a fresh legal context document from tenant inputs and sensible LATAM
 * defaults. Real prose lives at `terms` (the spec-required URL); this
 * manifest references it and carries `atrHash` = SHA-256 of that document's
 * actual bytes, per the Legal Context Protocol standard's Level 2 definition.
 */
export interface BuildLegalContextInput {
  contextId: string;
  version: number;
  tenantDomain: string;
  providerLegalName: string;
  providerJurisdiction: string;
  providerContactEmail: string;
  termsUrl: string;
  /** SHA-256 hex (64 lowercase chars, no `0x` prefix) of the `termsUrl` document's actual bytes. */
  termsSha256: string;
  termsEffectiveDate: string;
  jurisdictions: string[];
  /** spec `api`: URL of Contextio's own legal-context API for this tenant. */
  apiUrl: string;
}

export function buildLegalContext(input: BuildLegalContextInput): LegalContext {
  const now = new Date().toISOString();
  return legalContextSchema.parse({
    // Official Legal Context Protocol fields.
    terms: input.termsUrl,
    termsFormat: "markdown",
    atrHash: `0x${input.termsSha256.toLowerCase()}`,
    acceptanceRequired: true,
    disputeResolution: {
      method: "Contextio arbitration — see `disputeChannels` for the per-jurisdiction venue (BR/AR/CO)",
      jurisdiction: input.jurisdictions.join(", "),
      contact: input.providerContactEmail,
      source: `https://${input.tenantDomain}/legal/disputes/${input.jurisdictions[0]?.toLowerCase() ?? "br"}`,
    },
    contact: {
      legal: input.providerContactEmail,
      technical: input.providerContactEmail,
    },
    api: input.apiUrl,

    // Contextio extensions.
    specVersion: LCP_SPEC_VERSION,
    contextId: input.contextId,
    version: input.version,
    tenantDomain: input.tenantDomain,
    provider: {
      legalName: input.providerLegalName,
      jurisdiction: input.providerJurisdiction,
      contactEmail: input.providerContactEmail,
    },
    termsEffectiveDate: input.termsEffectiveDate,
    jurisdictions: input.jurisdictions,
    consentRequirements: [
      {
        id: "treasury-management",
        description: "Authorize AI agents to allocate idle treasury between liquidity and yield.",
        required: true,
        scope: ["treasury", "yield"],
      },
      {
        id: "payroll-execution",
        description: "Authorize scheduled payroll settlement to listed employees/contractors.",
        required: true,
        scope: ["payroll", "offramp"],
      },
    ],
    // Coverage across the LATAM markets Contextio operates in (Brazil,
    // Argentina, Colombia) plus Switzerland — the real, verifiable EMEA
    // channel (Swiss Arbitration Centre, ex-SCAI) added 2026-08-06 for
    // tenants operating in Europe/Middle East/Africa, alongside the real
    // technical EMEA reach already live: BlindPay's Stellar-SEPA payout rail
    // and EURC pricing via the same Reflector oracle used for USDC/XLM.
    disputeChannels: [
      {
        type: "arbitration",
        provider: "Contextio arbitration — Brazil",
        venue: `https://${input.tenantDomain}/legal/disputes/br`,
        governingLaw: "BR",
        language: "pt",
      },
      {
        type: "arbitration",
        provider: "Contextio arbitration — Argentina",
        venue: `https://${input.tenantDomain}/legal/disputes/ar`,
        governingLaw: "AR",
        language: "es",
      },
      {
        type: "arbitration",
        provider: "Contextio arbitration — Colombia",
        venue: `https://${input.tenantDomain}/legal/disputes/co`,
        governingLaw: "CO",
        language: "es",
      },
      {
        type: "arbitration",
        provider: "Contextio arbitration — Switzerland (EMEA)",
        venue: `https://${input.tenantDomain}/legal/disputes/ch`,
        governingLaw: "CH",
        language: "en",
      },
    ],
    settlement: {
      networks: ["stellar:testnet", "stellar:pubnet"],
      assets: ["USDC", "XLM", "BRL", "ARS", "COP", "EURC"],
    },
    publishedAt: now,
  });
}
