import { NextRequest, NextResponse } from "next/server";
import { NETWORK_COOKIE } from "@/lib/network-shared";

/**
 * Geo-gate for mainnet's self-custody money-moving pages ONLY.
 *
 * Two corrections made 2026-08-06, same day as the first version, after
 * real questions surfaced real gaps rather than being answered from memory:
 *
 * 1. **Scope.** The first version matched almost every page and reverted the
 *    WHOLE mainnet toggle — meaning read-only mainnet features that are
 *    genuinely live and pose zero custody risk (Reflector oracle prices,
 *    the public activity/on-chain-proof feed, the LCP document, docs,
 *    agent/integrations pages) got blocked right along with the two pages
 *    that actually have a "sign with your wallet, move real funds" button
 *    (Treasury's "Move capital", Payroll's "Pay now"). There is no
 *    solicitation concern in letting anyone, anywhere, read a public price
 *    oracle. Narrowed the matcher to just `/treasury` and `/payroll`.
 *
 * 2. **Self-lockout.** The first version had no way to recognize the
 *    project's own allowlisted operator — meaning a legitimate team member
 *    testing mainnet from Mexico (excluded from the country list, see
 *    below) would get bounced exactly like an unvetted stranger. Auth
 *    session state lives in localStorage (lib/auth.tsx), which Edge
 *    middleware cannot read — so `lib/auth.tsx` now also mirrors the
 *    session's `tenantId` into a plain (non-secret; tenant UUIDs are
 *    already public in this repo's docs/git history) `cx_tenant` cookie,
 *    and this middleware skips the geo-check entirely when it matches a
 *    known-allowlisted tenant. This is the account-level control (already
 *    the real security boundary — see below) reaching into the UI layer,
 *    not a new, separate gate.
 *
 * This is STILL NOT the real security boundary — that's
 * `MAINNET_ALLOWLIST_TENANT_IDS` on `contextio-api-mainnet` (a single
 * internal tenant today; verified via its live secrets/config, see
 * contextio-mainnet-launch-plan memory, 2026-08-06 audit). Even a visitor
 * who slips past this middleware still 403s server-side on the actual
 * prepare/submit call unless their tenant is on that allowlist.
 *
 * What this DOES do: stop the web app's two self-custody action pages from
 * letting a visitor select mainnet from a country whose non-custodial-
 * software regulatory posture hasn't been reviewed — i.e. avoid
 * "soliciting" a jurisdiction we haven't vetted, on top of the
 * account-level gate.
 *
 * Allowed list, and why:
 * - BR / AR / CO — the only product-selectable tenant countries; real
 *   PSAV research done for each (see contextio-mainnet-launch-plan,
 *   2026-08-06), all three using an "on behalf of the client" style
 *   custody/intermediation test that Contextio's client-always-signs
 *   architecture is built to sit outside of.
 *
 * NOT included, on purpose, both revisited 2026-08-06 same day after
 * reading primary sources instead of assuming either way:
 * - MX — REMOVED after reading LFPIORPI Art. 17 fracción XVI's actual
 *   current text (reforma DOF 16-07-2025) directly, not a summary. Two
 *   real problems, not just an abundance of caution: (1) its trigger is
 *   "el ofrecimiento... de intercambio... o bien, provea medios para
 *   custodiar, almacenar, o transferir activos virtuales" — "provide the
 *   MEANS to" transfer is textually broader than BR/AR/CO's "on behalf
 *   of the client" framing and arguably could reach pure signing-assistance
 *   software, not just literal custody; (2) it explicitly extends to
 *   "operaciones que se realicen con ciudadanos mexicanos desde otra
 *   jurisdicción" — extraterritorial by CITIZENSHIP, not physical
 *   location, which an IP-geolocation check cannot actually detect (a
 *   Mexican citizen browsing from Brazil would pass this middleware and
 *   still be the exact counterparty the statute names). TECHNICAL.md
 *   already flagged the whole FATF/non-custodial thesis as "awaiting
 *   written confirmation from counsel" before this was found — this
 *   reading makes that caveat concrete rather than removing it.
 * - CH — in the LCP purely as a neutral arbitration seat (same reason
 *   international contracts often pick Swiss law/venue). FINMA's stance on
 *   non-custodial software is directionally favorable (the same
 *   holds-the-keys-or-not test as everywhere else, a lighter SRO path
 *   instead of a banking license) but was never confirmed the way BR/AR/CO
 *   were, so it stays out until that changes.
 */
const MAINNET_ALLOWED_COUNTRIES = new Set(["BR", "AR", "CO"]);

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
  if (!country || MAINNET_ALLOWED_COUNTRIES.has(country)) {
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
