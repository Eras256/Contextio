import { describe, expect, it } from "vitest";
import { loadServerEnv, assertMainnetNeverAutoExecutesTreasuryActions } from "@contextio/config";

/**
 * The claim we make everywhere ("mainnet is receive-only, the process cannot
 * sign even if it wanted to") is only true if this actually throws — verified
 * here the same way Nirium verifies theirs live via `fly secrets list`: don't
 * just trust the code read-through, assert the behavior.
 */
function baseSource(overrides: Record<string, string>): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    SUPABASE_JWT_SECRET: "test-jwt-secret-please-change",
    STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
    INTERNAL_API_SECRET: "internal-secret-for-tests-1234567890",
    ...overrides,
  };
}

const VALID_SECRET = "S" + "A".repeat(55);

describe("mainnet boot guard", () => {
  it("boots fine on testnet with a signer secret present", () => {
    expect(() =>
      loadServerEnv(baseSource({ STELLAR_NETWORK: "testnet", STELLAR_SERVICE_SECRET: VALID_SECRET })),
    ).not.toThrow();
  });

  it("boots fine on mainnet with no signer secret", () => {
    expect(() => loadServerEnv(baseSource({ STELLAR_NETWORK: "mainnet" }))).not.toThrow();
  });

  it("refuses to boot on mainnet with STELLAR_SERVICE_SECRET present", () => {
    expect(() =>
      loadServerEnv(baseSource({ STELLAR_NETWORK: "mainnet", STELLAR_SERVICE_SECRET: VALID_SECRET })),
    ).toThrow(/receive-only/i);
  });

  it("refuses to boot on mainnet with BLEND_SIGNER_SECRET present", () => {
    expect(() =>
      loadServerEnv(baseSource({ STELLAR_NETWORK: "mainnet", BLEND_SIGNER_SECRET: VALID_SECRET })),
    ).toThrow(/receive-only/i);
  });
});

/**
 * The narrower, call-site companion check: even if a future signer somehow
 * doesn't count as a "hot key" under the boot guard above, the *custodial*
 * execution path (the only thing this guards — self-custody prepare/submit
 * calls different methods that never reach this check) must never settle on
 * mainnet for any actor. Blocking "user" too closes a real, separate bug: a
 * user-actor hitting the custodial route directly on mainnet used to fall
 * through to a fabricated `sim:` success instead of a clean rejection.
 */
describe("assertMainnetNeverAutoExecutesTreasuryActions", () => {
  it("allows an agent-initiated action on testnet", () => {
    expect(() => assertMainnetNeverAutoExecutesTreasuryActions("testnet", "agent")).not.toThrow();
  });

  it("allows a user-initiated action on testnet (the custodial demo path)", () => {
    expect(() => assertMainnetNeverAutoExecutesTreasuryActions("testnet", "user")).not.toThrow();
  });

  it("refuses an agent-initiated action on mainnet", () => {
    expect(() => assertMainnetNeverAutoExecutesTreasuryActions("mainnet", "agent")).toThrow(
      /agent-initiated action cannot settle on/i,
    );
  });

  it("refuses a user-initiated action on mainnet too — the custodial path isn't a valid mainnet caller for anyone", () => {
    expect(() => assertMainnetNeverAutoExecutesTreasuryActions("mainnet", "user")).toThrow(
      /direct custodial settlement path cannot run on/i,
    );
  });
});
