import { cookies } from "next/headers";
import { NETWORK_COOKIE, type StellarNetwork } from "@/lib/network-shared";
import LegalContextView, { type LegalContextDoc } from "./LegalContextView";

/**
 * Server-rendered so the real, live LCP document is what's in the initial
 * HTML — the same principle the sibling `.well-known/contextio-legal-context.json`
 * route documents: this page must never present fabricated placeholder data
 * as if it were the live document, including to a client (crawler, reviewer
 * tooling, curl) that never runs the page's JavaScript. A prior version of
 * this page rendered a hardcoded example ("Acme Treasury Ltda", a zero hash)
 * and only replaced it with the real document via a client-side effect —
 * correct for a human watching it load in a browser, but indistinguishable
 * from genuinely fake data to anything that reads the initial response only.
 */
function apiUrlFromCookie(): string {
  const network = (cookies().get(NETWORK_COOKIE)?.value as StellarNetwork | undefined) ?? "testnet";
  const perNetwork =
    network === "mainnet" ? process.env.NEXT_PUBLIC_API_URL_MAINNET : process.env.NEXT_PUBLIC_API_URL_TESTNET;
  return perNetwork || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

async function fetchLiveDoc(): Promise<LegalContextDoc | null> {
  const API = apiUrlFromCookie();
  try {
    const r = await fetch(`${API}/.well-known/contextio-legal-context.json?domain=contextio.xyz`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as LegalContextDoc;
  } catch {
    return null;
  }
}

export default async function LegalContextPage() {
  const doc = await fetchLiveDoc();

  if (!doc) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-white">Legal Context Protocol</h1>
        <p className="text-sm text-slate-400">
          The live legal context document is temporarily unavailable. Please try again shortly — this page
          never substitutes placeholder data for the real, published document.
        </p>
      </div>
    );
  }

  return <LegalContextView doc={doc} />;
}
