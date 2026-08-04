import { z } from "zod";

/**
 * The "business server" behind Contextio's self-hosted Anchor Platform
 * deployment. Small, standalone env schema (not @contextio/config's full
 * server/worker surface) — this service only ever talks to the Anchor
 * Platform's callback contract, never to Supabase/treasury/payroll directly.
 */
const schema = z.object({
  PORT: z.coerce.number().default(8091),
  // Shared secret the `platform` service sends as `X-Api-Key` on every
  // callback request (callback_api.auth.type: api_key in the AP config) —
  // proves the request actually came from our own Anchor Platform instance.
  CALLBACK_API_AUTH_SECRET: z.string().min(16),
  // Base URL + secret for calling BACK into the Anchor Platform's own
  // Platform API (port 8085) to report transaction status changes.
  PLATFORM_API_BASE_URL: z.string().url(),
  PLATFORM_API_AUTH_SECRET: z.string().min(16),
  STELLAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  STELLAR_RPC_URL: z.string().url().default("https://soroban-testnet.stellar.org"),
  REFLECTOR_PRICE_CONTRACT_ID: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid anchor-business environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}
