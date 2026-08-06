/**
 * One-off migration: republish the demo tenant's Legal Context Protocol
 * document under the new, genuinely spec-compliant schema (LCP_SPEC_VERSION
 * 0.2.0 — see packages/shared/src/lcp/types.ts). Bumps the on-chain-bound
 * version (existing bindings stay verifiable against their own recorded
 * version); this just makes the NEXT version conformant.
 *
 * Usage (from repo root):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx apps/api/scripts/republish-lcp-v2.ts
 */
import { createServiceClient, createLogger, lcp } from "@contextio/shared";
import { Repository } from "../src/db/repository.js";
import { LegalContextService } from "../src/services/legalContextService.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

async function main() {
  const supabase = createServiceClient({
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  });
  const repo = new Repository(supabase);
  const logger = createLogger({ service: "republish-lcp-v2", level: "info" });
  const legal = new LegalContextService(repo, logger);

  const tenantId = "00000000-0000-4000-8000-000000000001";
  const apiBaseUrl = "https://contextio-api.fly.dev";
  const termsUrl = `${apiBaseUrl}${lcp.LCP_WELL_KNOWN_PATH.replace("contextio-legal-context.json", "contextio-terms.md")}`;

  const result = await legal.publish({
    tenantId,
    tenantDomain: "contextio.xyz",
    providerLegalName: "Contextio",
    providerJurisdiction: "BR",
    providerContactEmail: "legal@contextio.xyz",
    termsUrl,
    termsText: lcp.CANONICAL_TERMS_MARKDOWN,
    jurisdictions: ["BR", "AR", "CO"],
    actorId: null,
    apiBaseUrl,
  });

  console.log("Republished. New version:", result.document.version);
  console.log("terms:", result.document.terms);
  console.log("atrHash:", result.document.atrHash);
  console.log("disputeResolution:", result.document.disputeResolution);
  console.log("api:", result.document.api);
  console.log("document hash:", result.hash);
  console.log("url:", result.url);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
