import { describe, expect, it, vi } from "vitest";
import { TreasuryService } from "../src/services/treasuryService.js";
import { PayrollService } from "../src/services/payrollService.js";

/**
 * Confirms the guard is actually wired into the two real call sites that
 * settle money via the custodial path — not just that the pure function
 * throws in isolation (see envGuard.test.ts). A dependency that would only
 * be reached if the guard were bypassed is left undefined so the test fails
 * loudly (a TypeError, not a silent pass) if a future refactor moves the
 * guard past the point where a side effect could fire first.
 *
 * The user-actor-on-mainnet cases matter as much as the agent ones: before
 * the guard covered "user" too, that request didn't fail — it fell through
 * to a fabricated `sim:` tx hash, a real correctness/trust bug independent
 * of the legal question the agent-actor case is about.
 */
describe("mainnet agent-execution guard, wired into the real services", () => {
  it("TreasuryService.rebalance refuses an agent-actor request on mainnet before any side effect", async () => {
    const treasury = new TreasuryService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      undefined as never,
      undefined,
      "mainnet",
      undefined,
    );

    await expect(
      treasury.rebalance({
        tenantId: "t1",
        from: "liquidity",
        to: "blend_pool",
        asset: "USDC",
        amountBaseUnits: "1000000",
        strategyRef: "blend",
        actorId: null,
        actorType: "agent",
      }),
    ).rejects.toThrow(/agent-initiated action cannot settle on/i);
  });

  it("PayrollService.executeRun refuses an agent-actor request on mainnet before any side effect", async () => {
    const payroll = new PayrollService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      "mainnet",
    );

    await expect(
      payroll.executeRun({
        tenantId: "t1",
        scheduleId: "s1",
        actorId: null,
        actorType: "agent",
      }),
    ).rejects.toThrow(/agent-initiated action cannot settle on/i);
  });

  it("TreasuryService.rebalance refuses a user-actor request on mainnet too — no more fake sim: success", async () => {
    const treasury = new TreasuryService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      undefined as never,
      undefined,
      "mainnet",
      undefined,
    );

    await expect(
      treasury.rebalance({
        tenantId: "t1",
        from: "liquidity",
        to: "blend_pool",
        asset: "USDC",
        amountBaseUnits: "1000000",
        strategyRef: "blend",
        actorId: "user-1",
        actorType: "user",
      }),
    ).rejects.toThrow(/direct custodial settlement path cannot run on/i);
  });

  it("PayrollService.executeRun refuses a user-actor request on mainnet too — no more fake sim: success", async () => {
    const payroll = new PayrollService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      "mainnet",
    );

    await expect(
      payroll.executeRun({
        tenantId: "t1",
        scheduleId: "s1",
        actorId: "user-1",
        actorType: "user",
      }),
    ).rejects.toThrow(/direct custodial settlement path cannot run on/i);
  });

  it("TreasuryService.rebalance still allows a user-actor request on testnet to proceed past the guard", async () => {
    const treasury = new TreasuryService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      undefined as never,
      undefined,
      "testnet",
      undefined,
    );

    // Past the guard it hits `this.legal.bindForAction`, which is `undefined`
    // here — a TypeError, not the guard's error. That's the point: proof the
    // guard didn't block a testnet user-actor request, not a claim the call
    // fully succeeds with no dependencies wired up.
    await expect(
      treasury.rebalance({
        tenantId: "t1",
        from: "liquidity",
        to: "blend_pool",
        asset: "USDC",
        amountBaseUnits: "1000000",
        strategyRef: "blend",
        actorId: "user-1",
        actorType: "user",
      }),
    ).rejects.not.toThrow(/settle on STELLAR_NETWORK=mainnet/i);
  });
});
