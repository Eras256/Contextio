/**
 * Plain constant + type shared by both the client-side network toggle
 * (lib/network.ts, "use client") and the server-only route handler
 * (.well-known/contextio-legal-context.json/route.ts) — kept directive-free so a
 * server file can import it without crossing a client-component boundary.
 */
export type StellarNetwork = "testnet" | "mainnet";

export const NETWORK_COOKIE = "cxnet";
