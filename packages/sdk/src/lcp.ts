import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import type { LegalContext } from "./types.js";

/**
 * Deterministic JSON canonicalization (subset of RFC 8785 / JCS): object keys
 * sorted, no insignificant whitespace, arrays preserved in order, `undefined`
 * dropped. Byte-for-byte identical to the Contextio platform so an SDK consumer
 * can independently re-derive and verify a legal context's SHA-256.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot canonicalize non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
  }
  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

/** SHA-256 (hex) of a legal context over its canonical JSON form. */
export function hashLegalContext(context: LegalContext): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalize(context))));
}

/**
 * Verify a legal context document against an expected hash (e.g. one bound into
 * an on-chain event or returned by the API). Case-insensitive hex compare.
 */
export function verifyLegalContext(context: LegalContext, expectedHash: string): boolean {
  return hashLegalContext(context).toLowerCase() === expectedHash.toLowerCase();
}

/**
 * Contextio's own document, at Contextio's own path — NOT the reserved
 * `/.well-known/legal-context.json` from the AAA/Integra Ledger/SDF "Legal
 * Context Protocol" open standard (legalcontextprotocol.org, June 2026),
 * which uses an unrelated schema. Named "LCP" internally since before that
 * standard existed; kept off its reserved path to avoid the collision.
 */
export const LCP_WELL_KNOWN_PATH = "/.well-known/contextio-legal-context.json";

export function legalContextUrl(tenantDomain: string): string {
  return `https://${tenantDomain}${LCP_WELL_KNOWN_PATH}`;
}
