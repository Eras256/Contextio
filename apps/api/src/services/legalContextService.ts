import { randomUUID, createHash } from "node:crypto";
import { type Logger } from "@contextio/shared";
import {
  bindLegalContext,
  buildLegalContext,
  hashLegalContext,
  legalContextUrl,
  parseLegalContext,
  verifyBinding,
  type LcpBinding,
  type LegalContext,
} from "@contextio/shared/lcp";
import type { Repository } from "../db/repository.js";

/**
 * Owns the Legal Context Protocol lifecycle: build/publish per-tenant
 * documents, serve them at `.well-known`, and (critically) produce + verify the
 * bindings that every agentic operation must carry. This is the compliance
 * backbone for agentic commerce on Stellar.
 */
export class LegalContextService {
  constructor(
    private readonly repo: Repository,
    private readonly logger: Logger,
  ) {}

  /** Returns the latest published document for a tenant, or null if unpublished. */
  async getForTenant(tenantId: string): Promise<{ document: LegalContext; hash: string } | null> {
    const row = await this.repo.getLegalContextByTenant(tenantId);
    if (!row) return null;
    return { document: parseLegalContext(row.document), hash: row.hash as string };
  }

  /** Resolve a document by tenant domain — used to serve `.well-known`. */
  async getForDomain(domain: string): Promise<LegalContext | null> {
    const row = await this.repo.getLegalContextByDomain(domain);
    return row ? parseLegalContext(row.document) : null;
  }

  /**
   * Create or update a tenant's legal context. Bumps version on every publish so
   * historical bindings remain verifiable against the version they referenced.
   */
  async publish(input: {
    tenantId: string;
    tenantDomain: string;
    providerLegalName: string;
    providerJurisdiction: string;
    providerContactEmail: string;
    termsUrl: string;
    termsText?: string;
    jurisdictions: string[];
    actorId: string | null;
    /** Public base URL of this API deployment — becomes the LCP document's spec `api` field. */
    apiBaseUrl: string;
  }): Promise<{ document: LegalContext; hash: string; url: string }> {
    const existing = await this.repo.getLegalContextByTenant(input.tenantId);
    const nextVersion = existing ? (existing.version as number) + 1 : 1;
    const contextId = existing ? (existing.context_id as string) : randomUUID();

    // atrHash (per the Legal Context Protocol standard, Level 2) must be a
    // hash of the terms document's ACTUAL bytes — a verifier fetches `terms`
    // independently and compares. Hashing the URL string as a fallback (the
    // old behavior when a caller omitted `termsText`) produces a value that
    // silently fails that comparison, which isn't real compliance, just a
    // shape that looks like it. Require the real content instead.
    if (!input.termsText) {
      throw new Error(
        "legal.publish: termsText is required — atrHash must hash the terms document's real " +
          "content, not the URL string, or independent verification will fail",
      );
    }
    const termsSha256 = createHash("sha256").update(input.termsText, "utf8").digest("hex");

    const document = buildLegalContext({
      contextId,
      version: nextVersion,
      tenantDomain: input.tenantDomain,
      providerLegalName: input.providerLegalName,
      providerJurisdiction: input.providerJurisdiction,
      providerContactEmail: input.providerContactEmail,
      termsUrl: input.termsUrl,
      termsSha256,
      termsEffectiveDate: new Date().toISOString().slice(0, 10),
      jurisdictions: input.jurisdictions,
      apiUrl: `${input.apiBaseUrl.replace(/\/$/, "")}/api/v1/legal`,
    });
    const hash = hashLegalContext(document);

    await this.repo.upsertLegalContext({
      id: existing ? (existing.id as string) : randomUUID(),
      tenantId: input.tenantId,
      contextId,
      version: nextVersion,
      document: document as unknown as Record<string, unknown>,
      hash,
    });

    this.logger.info({ tenantId: input.tenantId, version: nextVersion, hash }, "Published legal context");
    return { document, hash, url: legalContextUrl(input.tenantDomain) };
  }

  /**
   * Produce a binding for an agentic action, asserting the tenant has a
   * published context that authorizes the requested consent scopes. Throws when
   * no context exists — the caller's middleware turns this into a 412.
   */
  async bindForAction(tenantId: string, satisfiedConsents: string[]): Promise<LcpBinding> {
    const current = await this.getForTenant(tenantId);
    if (!current) {
      throw new Error("No legal context published for tenant; agentic action blocked");
    }
    // A binding asserts the tenant's full consent posture: every consent the
    // published context marks as required (the tenant accepted these at publish
    // time), plus any extra ones the action explicitly relies on. This lets a
    // treasury-scoped action bind without re-listing payroll consent, while LCP
    // still enforces that no required consent is ever missing.
    const required = current.document.consentRequirements
      .filter((c) => c.required)
      .map((c) => c.id);
    const consents = Array.from(new Set([...required, ...satisfiedConsents]));
    const binding = bindLegalContext(current.document, consents);
    if (!verifyBinding(current.document, binding)) {
      throw new Error("Legal context binding failed verification");
    }
    return binding;
  }
}
