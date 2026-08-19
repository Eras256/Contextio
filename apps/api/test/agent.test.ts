import { describe, expect, it } from "vitest";
import { createLogger } from "@contextio/shared";
import { AgentService } from "../src/services/agentService.js";
import type { TreasuryService } from "../src/services/treasuryService.js";
import type { PayrollService } from "../src/services/payrollService.js";
import type { Oracle } from "../src/integrations/oracle.js";

const logger = createLogger({ service: "agent-test", pretty: false, level: "silent" });

function buildAgent(opts: {
  liquid: string;
  yield: string;
  minLiquidity: string;
  maxYieldBps: number;
  obligation: string;
  obligationDays: number;
  volatility: number;
  volatilitySensitivity: number;
}): AgentService {
  const total = (BigInt(opts.liquid) + BigInt(opts.yield)).toString();
  const treasury = {
    snapshot: async () => ({
      config: {
        id: "c",
        tenantId: "t1",
        minLiquidityBaseUnits: opts.minLiquidity,
        maxYieldBps: opts.maxYieldBps,
        countryLimitsBps: {},
        volatilitySensitivity: opts.volatilitySensitivity,
        updatedAt: "",
      },
      positions: [],
      totals: {
        liquidBaseUnits: opts.liquid,
        yieldBaseUnits: opts.yield,
        totalBaseUnits: total,
        yieldShareBps: 0,
      },
    }),
  } as unknown as TreasuryService;

  const payroll = {
    upcomingObligations: async () => [
      {
        scheduleId: "s1",
        scheduleName: "Monthly",
        nextRunAt: new Date(Date.now() + opts.obligationDays * 86_400_000).toISOString(),
        asset: "USDC",
        requiredBaseUnits: opts.obligation,
        employeeCount: 3,
      },
    ],
  } as unknown as PayrollService;

  const oracle: Oracle = {
    getFx: async () => ({ pair: "USD/BRL", rate: 5.45, volatility: opts.volatility, asOf: "" }),
    getYield: async () => ({ source: "defindex", strategyRef: "v", apyBps: 1075, asOf: "" }),
  };

  return new AgentService(
    {} as never,
    treasury,
    {} as never, // defindex (unused in plan tests)
    {} as never, // blend (unused in plan tests)
    payroll,
    oracle,
    {} as never,
    {} as never,
    {} as never, // ai advisor — not live in plan tests (deterministic fallback)
    logger,
    "testnet",
  );
}

describe("AgentService.plan", () => {
  it("allocates excess liquidity to yield when buffer is satisfied", async () => {
    const agent = buildAgent({
      liquid: "2000000000000", // 200k
      yield: "0",
      minLiquidity: "500000000000", // 50k
      maxYieldBps: 6000,
      obligation: "100000000000", // 10k due in 30 days (outside horizon)
      obligationDays: 30,
      volatility: 0.12,
      volatilitySensitivity: 60,
    });
    const plan = await agent.plan("t1", "BR");
    expect(plan.action).toBe("deposit_vault");
    expect(BigInt((plan.payload as { amountBaseUnits: string }).amountBaseUnits)).toBeGreaterThan(0n);
  });

  it("withdraws from yield when liquidity is short of upcoming payroll", async () => {
    const agent = buildAgent({
      liquid: "100000000000", // 10k liquid
      yield: "1000000000000", // 100k in yield
      minLiquidity: "500000000000", // 50k min
      maxYieldBps: 9000,
      obligation: "800000000000", // 80k due in 3 days (within horizon)
      obligationDays: 3,
      volatility: 0.12,
      volatilitySensitivity: 60,
    });
    const plan = await agent.plan("t1", "BR");
    expect(plan.action).toBe("withdraw_vault");
  });

  it("holds when allocation is within the target band", async () => {
    const agent = buildAgent({
      liquid: "550000000000",
      yield: "0",
      minLiquidity: "500000000000",
      maxYieldBps: 0, // no room for yield
      obligation: "0",
      obligationDays: 30,
      volatility: 0.12,
      volatilitySensitivity: 60,
    });
    const plan = await agent.plan("t1", "BR");
    expect(plan.action).toBe("noop");
  });
});
