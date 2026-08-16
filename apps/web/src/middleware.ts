import { NextRequest, NextResponse } from "next/server";
import { NETWORK_COOKIE } from "@/lib/network-shared";

/**
 * Geo-gate for mainnet's self-custody money-moving pages ONLY — rebuilt
 * 2026-08-06 from an allowlist to a blocklist, same day as the allowlist
 * version, after direct feedback: an allowlist means you must actively
 * research and clear every country before anyone from it can use the
 * product — which is how a real team member (Mexico) ended up excluded
 * despite there being no actual finding against Mexico specifically, just
 * an absence of a finished review. That doesn't scale and isn't the right
 * default. A blocklist flips the default to open, and only excludes the
 * small number of jurisdictions with a well-known, well-documented regime
 * that's expensive to get wrong:
 *
 * - **EU / EEA** — MiCA (Regulation (EU) 2023/1114), a comprehensive,
 *   union-wide crypto-asset-service-provider licensing regime, fully
 *   applicable since Dec 2024. Not researched for Contextio's specific
 *   non-custodial pattern yet.
 * - **United States** — FinCEN/BSA money-transmitter rules apply at the
 *   federal level, compounded by up to 50 separate state money-transmitter
 *   licensing regimes. FinCEN's own 2019 guidance (FIN-2019-G001) draws a
 *   custodial/non-custodial line similar to the FATF test used elsewhere in
 *   this project, but the sheer fragmentation (federal + 50 states) makes
 *   "confirmed safe" a much bigger research project than any single
 *   country reviewed so far.
 * - **China** — not the same kind of exclusion as the two above: not a
 *   regime pending review, but an already-effective, blanket prohibition.
 *   The People's Bank of China's September 2021 notice ("Notice on Further
 *   Preventing and Disposing of the Risks of Speculation in Virtual
 *   Currency Trading", 关于进一步防范和处置虚拟货币交易炒作风险的通知)
 *   declares crypto-asset business activity illegal and expressly extends
 *   that prohibition to offshore platforms serving mainland Chinese
 *   residents over the internet — explicit extraterritorial reach, not an
 *   open research question like MiCA or FinCEN above. Hong Kong SAR, Macao
 *   SAR, and Taiwan are outside this specific restriction (not currently
 *   in `BLOCKED_COUNTRIES` below).
 *
 * BR/AR/CO/MX and everywhere else are no longer individually vetted before
 * being let through — the honest default is "open unless we know of a
 * specific, well-documented reason not to be," not "closed until proven
 * safe everywhere," which was never going to scale past three countries.
 * TECHNICAL.md's per-country PSAV research for BR/AR/CO and the LFPIORPI
 * finding for Mexico stand as-is — they inform the Terms clause and the
 * counsel questions list, they just no longer gate who can even reach
 * these two pages.
 *
 * This is STILL NOT the real security boundary — that's
 * `MAINNET_ALLOWLIST_TENANT_IDS` on `contextio-api-mainnet` (a single
 * internal tenant today; verified via its live secrets/config AND, as of
 * today, a real rejected-signup test — see contextio-mainnet-launch-plan
 * memory, 2026-08-06). Even a visitor who slips past this middleware still
 * 403s server-side on the actual prepare/submit call unless their tenant is
 * on that allowlist, and now also has to check the two attestation boxes
 * (restrictedJurisdictionAttestationMessage in apps/api/src/http/schemas.ts)
 * that back this same restricted-jurisdiction list contractually, not just
 * technically.
 */
const BLOCKED_COUNTRIES = new Set([
  // EU (27)
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
  // EEA, non-EU (3)
  "IS", "LI", "NO",
  // United States + China
  "US", "CN",
]);

// Mirrors contextio-api-mainnet's real MAINNET_ALLOWLIST_TENANT_IDS (single
// internal tenant, see fly.mainnet.toml — the value isn't secret, it's
// already public in git history/docs). Kept as a literal here rather than a
// Vercel env var to avoid two copies drifting silently out of sync in
// opposite directions; update both together if this ever changes.
const BYPASS_TENANT_IDS = new Set(["adba87a4-bfdf-4b00-bac4-f2f0f1d6bb72"]);

// Only the two pages with an actual "sign with your wallet, move real
// funds" self-custody action belong here — everything else that's live on
// mainnet (oracle, public activity, LCP, docs, agent, integrations) stays
// reachable from anywhere, since reading public data isn't a solicitation
// concern.
const GATED_PATH_PREFIXES = ["/treasury", "/payroll"];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (!GATED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const wantsMainnet = req.cookies.get(NETWORK_COOKIE)?.value === "mainnet";
  if (!wantsMainnet) return NextResponse.next();

  const tenantId = req.cookies.get("cx_tenant")?.value;
  if (tenantId && BYPASS_TENANT_IDS.has(tenantId)) return NextResponse.next();

  const country = req.headers.get("x-vercel-ip-country");
  // No header at all means this isn't running behind Vercel's edge (local
  // dev, or a proxy that strips it) — fail open rather than break local
  // testing. The API allowlist is still the real boundary either way.
  if (!country || !BLOCKED_COUNTRIES.has(country)) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  res.cookies.set(NETWORK_COOKIE, "testnet", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  // Short-lived marker so the client can show one explanatory notice and
  // then clear it — see components/GeoBlockNotice.tsx.
  res.cookies.set("cxnet_geo_blocked", country, { path: "/", maxAge: 30 });
  return res;
}

export const config = {
  matcher: ["/treasury/:path*", "/payroll/:path*"],
};
