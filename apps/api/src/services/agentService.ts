import { randomUUID } from "node:crypto";
import { type Logger, fromBaseUnits, applyBps } from "@contextio/shared";
import type { AgentDecision, Country } from "@contextio/shared";
import { assertMainnetNeverAutoExecutesTreasuryActions, type StellarNetwork } from "@contextio/config";
import type { Repository } from "../db/repository.js";
import type { TreasuryService, TreasurySnapshot } from "./treasuryService.js";
import type { PayrollService, UpcomingObligation } from "./payrollService.js";
import type { Oracle } from "../integrations/oracle.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";
import type { DefindexClient } from "../integrations/defindex.js";
import type { BlendClient } from "../integrations/blend.js";
import type { AiAdvisor } from "../integrations/ai.js";

export interface RebalancePlan {
  action: AgentDecision["action"];
  rationale: string;
  payload: Record<string, unknown>;
}

/**
 * Per-call planning options — the dashboard AI selector can run the agent with
 * any provider's own key (BYOK) for one request; the autonomous worker passes
 * none of these and uses the server-configured provider (OpenAI on Fly).
 */
export interface PlanOptions {
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  /** UI language (en|es|pt) for the LLM rationale; omitted → English. */
  locale?: string;
}

/** Planning horizon: obligations due within this many days drive liquidity need. */
const LIQUIDITY_HORIZON_DAYS = 7;
/** Default yield vault the agent moves excess liquidity into. */
const DEFAULT_YIELD_VAULT = "vault_cetes_rwa_001";
/** Heartbeat size (bps of total) for the band-rebalance cycle that keeps the
 *  agent actively settling on-chain even when the treasury is within target. */
const HEARTBEAT_BPS = 100;

/**
 * The agent. This is the orchestration layer — deterministic and auditable for
 * the actual on-chain decision. A pluggable LLM (the {@link AiAdvisor}) is wired
 * in at `plan()` to write the human-readable rationale, but the platform never
 * lets it change the action/amount, bypass the risk constraints, or skip the
 * legal-context binding enforced on execution. The LLM explains; it never bypasses.
 */
export class AgentService {
  constructor(
    private readonly repo: Repository,
    private readonly treasury: TreasuryService,
    private readonly defindex: DefindexClient,
    private readonly blend: BlendClient,
    private readonly payroll: PayrollService,
    private readonly oracle: Oracle,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly ai: AiAdvisor,
    private readonly logger: Logger,
    private readonly network: StellarNetwork,
  ) {}

  /**
   * Real DeFindex yield cycle: keep a live position in the platform's DeFindex
   * vault inside a small band by depositing (or withdrawing) a fixed step on
   * each call — a genuine, verifiable on-chain yield move. Records an executed
   * agent decision (with the Stellar tx + LCP binding) so it shows in the feed.
   * No-op when DeFindex isn't live. Routed through the API like every agent
   * action; the worker calls it on a slow cadence.
   */
  async runYieldCycle(tenantId: string): Promise<AgentDecision | null> {
    assertMainnetNeverAutoExecutesTreasuryActions(this.network, "agent");

    const vaultId = this.defindex.vaultId;
    if (!this.defindex.live || !vaultId) return null;

    const STEP = 10_000_000n; // 1 XLM (7 decimals)
    const BAND_CEILING = 500_000_000n; // ~50 XLM — keep the position bounded

    const snap = await this.defindex.getVaultData();
    const position = snap.ok ? BigInt(snap.value.positionBaseUnits || "0") : 0n;
    const apyBps = snap.ok ? snap.value.apyBps : 0;
    const deposit = position < BAND_CEILING;

    const binding = await this.legal.bindForAction(tenantId, ["treasury-management"]);
    const current = await this.legal.getForTenant(tenantId);

    const r = deposit
      ? await this.defindex.deposit(vaultId, STEP.toString())
      : await this.defindex.withdraw(vaultId, STEP.toString());
    if (!r.ok) {
      this.logger.warn({ tenantId, err: r.error.message }, "DeFindex yield cycle deferred");
      return null;
    }

    const apyPct = (apyBps / 100).toFixed(2);
    const decision: AgentDecision = {
      id: randomUUID(),
      tenantId,
      action: deposit ? "deposit_vault" : "withdraw_vault",
      rationale: deposit
        ? `Allocated 1 XLM of idle cash into the DeFindex Blend vault (~${apyPct}% APY) — real, on-chain yield.`
        : `Pulled 1 XLM back from the DeFindex vault to keep the yield position within band.`,
      payload: {
        from: deposit ? "liquidity" : "defindex_vault",
        to: deposit ? "defindex_vault" : "liquidity",
        asset: "XLM",
        amountBaseUnits: STEP.toString(),
        amount: "1",
        strategyRef: vaultId,
        venue: "defindex",
        apyBps,
      },
      status: "executed",
      legalContextId: current?.document.contextId ?? null,
      legalContextHash: binding.hash,
      stellarTxHash: r.value.txHash ?? null,
      createdAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
    };
    const saved = await this.repo.insertDecision(decision);
    await this.audit.record({
      tenantId,
      actorId: null,
      actorType: "agent",
      action: "integration.defindex.deposit",
      detail: { decisionId: saved.id, txHash: r.value.txHash, deposit },
      legalContextId: saved.legalContextId,
    });
    this.logger.info({ tenantId, decisionId: saved.id, txHash: r.value.txHash, deposit }, "DeFindex yield cycle settled");
    return saved;
  }

  /**
   * Real Blend lending cycle: supply (or withdraw) a fixed XLM step into the
   * live Blend pool to keep a position inside a band — a genuine, verifiable
   * on-chain lend. Records an executed agent decision (Stellar tx + LCP binding)
   * so it shows in the feed. No-op when Blend isn't live.
   */
  async runBlendCycle(tenantId: string): Promise<AgentDecision | null> {
    assertMainnetNeverAutoExecutesTreasuryActions(this.network, "agent");

    if (!this.blend.live) return null;

    const STEP = 10_000_000n; // 1 XLM
    const BAND_CEILING = 500_000_000n; // ~50 XLM

    const snap = await this.blend.getVaultData();
    const position = snap.ok ? BigInt(snap.value.positionBaseUnits || "0") : 0n;
    const apyBps = snap.ok ? snap.value.supplyApyBps : 0;
    const supply = position < BAND_CEILING;

    const binding = await this.legal.bindForAction(tenantId, ["treasury-management"]);
    const current = await this.legal.getForTenant(tenantId);

    const r = supply
      ? await this.blend.supply("", STEP.toString())
      : await this.blend.withdraw("", STEP.toString());
    if (!r.ok) {
      this.logger.warn({ tenantId, err: r.error.message }, "Blend lending cycle deferred");
      return null;
    }

    const apyPct = (apyBps / 100).toFixed(2);
    const assetName = snap.ok ? snap.value.asset : "XLM";
    const decision: AgentDecision = {
      id: randomUUID(),
      tenantId,
      action: supply ? "blend_supply" : "blend_withdraw",
      rationale: supply
        ? `Lent 1 ${assetName} into the Blend pool (~${apyPct}% supply APY) — real, on-chain lending.`
        : `Pulled 1 ${assetName} back from the Blend pool to keep the lending position within band.`,
      payload: {
        from: supply ? "liquidity" : "blend_pool",
        to: supply ? "blend_pool" : "liquidity",
        asset: assetName,
        amountBaseUnits: STEP.toString(),
        amount: "1",
        strategyRef: this.blend.poolId,
        venue: "blend",
        apyBps,
      },
      status: "executed",
      legalContextId: current?.document.contextId ?? null,
      legalContextHash: binding.hash,
      stellarTxHash: r.value.txHash ?? null,
      createdAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
    };
    const saved = await this.repo.insertDecision(decision);
    await this.audit.record({
      tenantId,
      actorId: null,
      actorType: "agent",
      action: "integration.blend.supply",
      detail: { decisionId: saved.id, txHash: r.value.txHash, supply },
      legalContextId: saved.legalContextId,
    });
    this.logger.info({ tenantId, decisionId: saved.id, txHash: r.value.txHash, supply }, "Blend lending cycle settled");
    return saved;
  }

  /**
   * Planner: given the current snapshot, obligations and FX volatility, decide
   * whether to move excess liquidity into yield or pull yield back to cover
   * upcoming payroll. The action and amount are computed deterministically; when
   * an LLM provider is configured the rationale is then written by the AI
   * reasoning layer (the action/amount are never changed by it).
   */
  async plan(tenantId: string, country: Country, opts?: PlanOptions): Promise<RebalancePlan> {
    const [snapshot, obligations, fx] = await Promise.all([
      this.treasury.snapshot(tenantId),
      this.payroll.upcomingObligations(tenantId),
      this.oracle.getFx(country),
    ]);

    if (!snapshot.config) {
      return { action: "noop", rationale: "No treasury config; nothing to plan.", payload: {} };
    }

    const liquid = BigInt(snapshot.totals.liquidBaseUnits);
    const total = BigInt(snapshot.totals.totalBaseUnits);
    const minLiquidity = BigInt(snapshot.config.minLiquidityBaseUnits);

    // Near-term obligations within the horizon.
    const horizonCutoff = Date.now() + LIQUIDITY_HORIZON_DAYS * 86_400_000;
    const nearObligations = obligations.filter(
      (o) => new Date(o.nextRunAt).getTime() <= horizonCutoff,
    );
    const obligationSum = nearObligations.reduce((acc, o) => acc + BigInt(o.requiredBaseUnits), 0n);

    // Volatility raises the required buffer: sensitivity (0–100) scaled by FX vol.
    const volBufferBps = Math.round(snapshot.config.volatilitySensitivity * fx.volatility * 100);
    const volBuffer = applyBps(obligationSum > 0n ? obligationSum : minLiquidity, volBufferBps);
    const requiredLiquidity = bigMax(minLiquidity, obligationSum) + volBuffer;

    // Cap on how much may sit in yield.
    const maxYield = applyBps(total, snapshot.config.maxYieldBps);
    const currentYield = BigInt(snapshot.totals.yieldBaseUnits);

    let result: RebalancePlan | null = null;

    if (liquid > requiredLiquidity) {
      const excess = liquid - requiredLiquidity;
      const yieldRoom = maxYield > currentYield ? maxYield - currentYield : 0n;
      const moveAmount = bigMin(excess, yieldRoom);
      if (moveAmount > 0n) {
        result = {
          action: "deposit_vault",
          rationale:
            `Liquid ${fromBaseUnits(liquid)} exceeds required ${fromBaseUnits(requiredLiquidity)} ` +
            `(payroll due ${fromBaseUnits(obligationSum)} + ${fromBaseUnits(volBuffer)} ${fx.pair} ` +
            `volatility buffer). Allocating ${fromBaseUnits(moveAmount)} to CETES vault for yield.`,
          payload: this.movePayload("liquidity", "defindex_vault", moveAmount, fx),
        };
      }
      // At the yield cap — fall through to the band heartbeat below.
    } else if (liquid < requiredLiquidity && currentYield > 0n) {
      const shortfall = requiredLiquidity - liquid;
      const moveAmount = bigMin(shortfall, currentYield);
      result = {
        action: "withdraw_vault",
        rationale:
          `Liquid ${fromBaseUnits(liquid)} below required ${fromBaseUnits(requiredLiquidity)} ` +
          `for upcoming payroll. Withdrawing ${fromBaseUnits(moveAmount)} from CETES vault to cover obligations.`,
        payload: this.movePayload("defindex_vault", "liquidity", moveAmount, fx),
      };
    }

    if (!result) {
      // Band rebalance heartbeat: keep funds actively cycling inside the safe band
      // (above the liquidity floor, below the yield cap) so the agent is always
      // working and settling a real on-chain transaction every cycle.
      const heartbeat = bigMax(applyBps(total, HEARTBEAT_BPS), 1n);
      const yieldHeadroom = maxYield > currentYield ? maxYield - currentYield : 0n;
      const liquidHeadroom = liquid > requiredLiquidity ? liquid - requiredLiquidity : 0n;
      if (yieldHeadroom >= heartbeat && liquidHeadroom >= heartbeat) {
        result = {
          action: "deposit_vault",
          rationale: `Band rebalance: moving ${fromBaseUnits(heartbeat)} into yield, keeping allocation inside the target band.`,
          payload: this.movePayload("liquidity", "defindex_vault", heartbeat, fx),
        };
      } else if (currentYield >= heartbeat) {
        result = {
          action: "withdraw_vault",
          rationale: `Band rebalance: returning ${fromBaseUnits(heartbeat)} to the liquid reserve, keeping allocation inside the target band.`,
          payload: this.movePayload("defindex_vault", "liquidity", heartbeat, fx),
        };
      }
    }

    if (!result) {
      result = {
        action: "noop",
        rationale: "Treasury within the target band and at its limits; holding this cycle.",
        payload: { liquid: fromBaseUnits(liquid), requiredLiquidity: fromBaseUnits(requiredLiquidity) },
      };
    }

    // Reasoning layer: when an LLM is available — the server-configured provider
    // (the autonomous Fly agent) OR a per-request BYOK key from the dashboard
    // selector — let it write the rationale for a real action. It never changes
    // the action or amount; any failure leaves the deterministic rationale intact.
    const byok = Boolean(opts?.aiApiKey && opts?.aiProvider);
    if (result.action !== "noop" && this.ai && (this.ai.live || byok)) {
      const p = result.payload as { amountBaseUnits?: string; asset?: string };
      const advice = await this.ai.advise(
        {
          action: result.action,
          amount: fromBaseUnits(BigInt(p.amountBaseUnits ?? "0")),
          asset: p.asset ?? "USDC",
          liquid: fromBaseUnits(liquid),
          requiredLiquidity: fromBaseUnits(requiredLiquidity),
          currentYield: fromBaseUnits(currentYield),
          obligationSum: fromBaseUnits(obligationSum),
          fxPair: fx.pair,
          fxVolatility: fx.volatility,
          country,
        },
        { provider: opts?.aiProvider, model: opts?.aiModel, apiKey: opts?.aiApiKey, language: opts?.locale },
      );
      if (advice) {
        result = {
          ...result,
          rationale: advice.rationale,
          payload: {
            ...result.payload,
            ai: { provider: opts?.aiProvider || this.ai.provider, model: opts?.aiModel || this.ai.model },
            ...(advice.risk ? { aiRisk: advice.risk } : {}),
          },
        };
      }
    }

    return result;
  }

  private movePayload(
    from: "liquidity" | "defindex_vault" | "blend_pool",
    to: "liquidity" | "defindex_vault" | "blend_pool",
    amount: bigint,
    fx: { pair: string; rate: number; volatility: number },
  ): Record<string, unknown> {
    return {
      from,
      to,
      asset: "USDC",
      amountBaseUnits: amount.toString(),
      amount: fromBaseUnits(amount),
      strategyRef: DEFAULT_YIELD_VAULT,
      fx: { pair: fx.pair, rate: fx.rate, volatility: fx.volatility },
    };
  }

  /** Persist a plan as a proposed decision (status: proposed). */
  async propose(tenantId: string, country: Country, opts?: PlanOptions): Promise<AgentDecision> {
    const plan = await this.plan(tenantId, country, opts);
    const current = await this.legal.getForTenant(tenantId);
    const decision: AgentDecision = {
      id: randomUUID(),
      tenantId,
      action: plan.action,
      rationale: plan.rationale,
      payload: plan.payload,
      status: "proposed",
      legalContextId: current?.document.contextId ?? null,
      legalContextHash: current?.hash ?? null,
      stellarTxHash: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    const saved = await this.repo.insertDecision(decision);
    this.logger.info({ tenantId, decisionId: saved.id, action: saved.action }, "Agent proposed decision");
    await this.audit.record({
      tenantId,
      actorId: null,
      actorType: "agent",
      action: "agent.decision.proposed",
      detail: { decisionId: saved.id, action: saved.action },
      legalContextId: saved.legalContextId,
    });
    return saved;
  }

  /**
   * Approve + execute a previously proposed decision. Re-binds the legal context
   * at execution time so a stale proposal cannot settle under outdated terms.
   */
  async execute(
    tenantId: string,
    decision: AgentDecision,
    actorId: string | null,
    actorType: "user" | "agent",
  ): Promise<AgentDecision> {
    if (decision.action === "noop") {
      await this.repo.updateDecision(decision.id, {
        status: "executed",
        decidedAt: new Date().toISOString(),
      });
      return { ...decision, status: "executed" };
    }

    const p = decision.payload as {
      from: "liquidity" | "defindex_vault" | "blend_pool";
      to: "liquidity" | "defindex_vault" | "blend_pool";
      asset: string;
      amountBaseUnits: string;
      strategyRef: string;
    };

    const { txHash, legalContextHash } = await this.treasury.rebalance({
      tenantId,
      from: p.from,
      to: p.to,
      asset: p.asset,
      amountBaseUnits: p.amountBaseUnits,
      strategyRef: p.strategyRef,
      actorId,
      actorType,
    });

    await this.repo.updateDecision(decision.id, {
      status: "executed",
      stellarTxHash: txHash,
      legalContextHash,
      decidedAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId,
      actorId,
      actorType,
      action: "agent.decision.approved",
      detail: { decisionId: decision.id, txHash },
      legalContextId: decision.legalContextId,
    });
    return { ...decision, status: "executed", stellarTxHash: txHash, legalContextHash };
  }

  listDecisions(tenantId: string): Promise<AgentDecision[]> {
    return this.repo.listDecisions(tenantId);
  }
}

function bigMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
function bigMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export type { TreasurySnapshot, UpcomingObligation };
