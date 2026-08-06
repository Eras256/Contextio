import { NextRequest, NextResponse } from "next/server";
import { NETWORK_COOKIE } from "@/lib/network-shared";

/**
 * Geo-gate for the mainnet network toggle.
 *
 * This is NOT the real security boundary — that's already
 * `MAINNET_ALLOWLIST_TENANT_IDS` on `contextio-api-mainnet` (a single
 * internal tenant today; verified via its live secrets/config, see
 * contextio-mainnet-launch-plan memory, 2026-08-06 audit). Even a visitor
 * who slips past this middleware can only look at read-only mainnet data —
 * every money-touching action still 403s server-side unless their tenant is
 * on that allowlist.
 *
 * What this DOES do: stop the web app itself from letting a visitor select
 * mainnet from a country whose non-custodial-software regulatory posture
 * hasn't been reviewed — i.e. avoid "soliciting" a jurisdiction we haven't
 * vetted, on top of the account-level gate.
 *
 * Allowed list, and why:
 * - BR / AR / CO — the only product-selectable tenant countries; real PSAV
 *   research done for each (see contextio-mainnet-launch-plan, 2026-08-06).
 * - MX — never a selectable product country, but the deepest compliance
 *   research this project has (LFPIORPI/Ley Fintech, FATF functional-control
 *   test) was built specifically for it, and the operating team is
 *   Mexico-based.
 * NOT included: CH. It's in the LCP purely as a neutral arbitration seat
 * (same reason international contracts often pick Swiss law/venue) — FINMA's
 * stance on non-custodial software is directionally favorable (the same
 * holds-the-keys-or-not test as everywhere else, lighter SRO path instead of
 * a banking license) but was never confirmed the way BR/AR/CO/MX were, so it
 * stays out of this allowlist until that changes.
 */
const MAINNET_ALLOWED_COUNTRIES = new Set(["BR", "AR", "CO", "MX"]);

export function middleware(req: NextRequest) {
  const wantsMainnet = req.cookies.get(NETWORK_COOKIE)?.value === "mainnet";
  if (!wantsMainnet) return NextResponse.next();

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|icon).*)"],
};
