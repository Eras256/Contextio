import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { NETWORK_COOKIE, type StellarNetwork } from "@/lib/network-shared";

/**
 * Canonical LCP document for this tenant domain. The Legal Context Protocol
 * hashes the document served here, so it MUST be the real, published document
 * (with the real terms hash) — we proxy it from the API rather than serving a
 * static placeholder, guaranteeing it matches what's bound on-chain.
 *
 * Runs on the server, so it can't read the network from localStorage — it
 * reads the same `cxnet` cookie the client-side toggle sets (see
 * lib/network.ts), which is what keeps both sides pointed at the same network.
 */
function apiUrlFromCookie(): string {
  const network = (cookies().get(NETWORK_COOKIE)?.value as StellarNetwork | undefined) ?? "testnet";
  const perNetwork =
    network === "mainnet" ? process.env.NEXT_PUBLIC_API_URL_MAINNET : process.env.NEXT_PUBLIC_API_URL_TESTNET;
  return perNetwork || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

export async function GET(request: Request) {
  const API = apiUrlFromCookie();
  const acceptHeader = request.headers.get("accept") ?? "";
  if (acceptHeader.includes("text/html")) {
    const url = new URL(request.url);
    url.pathname = "/legal-context";
    return NextResponse.redirect(url);
  }

  try {
    const r = await fetch(`${API}/.well-known/legal-context.json?domain=contextio.xyz`, {
      cache: "no-store",
    });
    if (r.ok) {
      const doc = await r.json();
      return NextResponse.json(doc, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  } catch {
    /* fall through to 503 — never serve a fake/placeholder canonical document */
  }
  return NextResponse.json(
    { error: "legal_context_unavailable" },
    { status: 503, headers: { "Access-Control-Allow-Origin": "*" } },
  );
}
