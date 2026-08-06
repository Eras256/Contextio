/**
 * One-off: republish the demo tenant's Legal Context Protocol document with
 * Switzerland (CH) added to `jurisdictions` — the real EMEA dispute channel
 * (Swiss Arbitration Centre, see components/DisputeChannel.tsx) alongside
 * the existing BR/AR/CO coverage. Ties to the real EMEA reach Contextio
 * already has: BlindPay's Stellar-SEPA payout rail and EURC pricing.
 *
 * Usage (from repo root):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... tsx apps/api/scripts/republish-lcp-emea.ts
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
  const logger = createLogger({ service: "republish-lcp-emea", level: "info" });
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
    jurisdictions: ["BR", "AR", "CO", "CH"],
    actorId: null,
    apiBaseUrl,
  });

  console.log("Republished. New version:", result.document.version);
  console.log("jurisdictions:", result.document.jurisdictions);
  console.log("disputeChannels:", result.document.disputeChannels);
  console.log("settlement.assets:", result.document.settlement.assets);
  console.log("document hash:", result.hash);
  console.log("url:", result.url);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
