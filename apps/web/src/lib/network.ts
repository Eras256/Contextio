"use client";

import { useEffect, useState } from "react";
import { NETWORK_COOKIE, type StellarNetwork } from "./network-shared";

export { NETWORK_COOKIE, type StellarNetwork };

/**
 * Runtime network switch (testnet/mainnet) for a single deployment — one site,
 * not one deployment per network. State lives in a cookie (not localStorage)
 * so both client components and the one server route handler that needs it
 * (.well-known/contextio-legal-context.json/route.ts) agree on the same value.
 *
 * Switching networks reloads the page: the Stellar Wallets Kit is a
 * module-level singleton initialized with a fixed passphrase (see wallet.ts),
 * and a full reload is the simplest way to reset it consistently rather than
 * threading reactivity through every consumer.
 */

export function getClientNetwork(): StellarNetwork {
  if (typeof document === "undefined") return "testnet";
  const match = document.cookie.match(new RegExp(`(?:^|; )${NETWORK_COOKIE}=(testnet|mainnet)`));
  return (match?.[1] as StellarNetwork) ?? "testnet";
}

export function setClientNetwork(network: StellarNetwork): void {
  document.cookie = `${NETWORK_COOKIE}=${network}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}

/**
 * Resolve the API base URL for the current (or given) network. Falls back to
 * the single NEXT_PUBLIC_API_URL (local dev's .env.local only sets that one)
 * so existing local setups keep working unchanged.
 */
export function resolveApiUrl(network: StellarNetwork = getClientNetwork()): string {
  const perNetwork =
    network === "mainnet" ? process.env.NEXT_PUBLIC_API_URL_MAINNET : process.env.NEXT_PUBLIC_API_URL_TESTNET;
  return perNetwork || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

/** Reactive read of the current network, for display (e.g. the Navbar toggle). */
export function useNetwork(): StellarNetwork {
  // SSR/CSR must render the same thing on first paint (React hydration), so
  // start at the safe default and correct to the real cookie value right after mount.
  const [network, setNetwork] = useState<StellarNetwork>("testnet");
  useEffect(() => {
    setNetwork(getClientNetwork());
  }, []);
  return network;
}
