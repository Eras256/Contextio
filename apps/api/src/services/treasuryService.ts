import { randomUUID } from "node:crypto";
import { type Logger, fromBaseUnits } from "@contextio/shared";
import type { stellar } from "@contextio/shared";
import type { ReflectorClient } from "../integrations/reflector.js";
import type { TreasuryConfig, TreasuryPosition } from "@contextio/shared";
import type { Repository } from "../db/repository.js";
import type { DefindexClient } from "../integrations/defindex.js";
import type { BlendClient } from "../integrations/blend.js";
import type { SorobanGateway } from "../integrations/soroban.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";

export interface TreasurySnapshot {
  config: TreasuryConfig | null;
  positions: TreasuryPosition[];
  totals: {
    liquidBaseUnits: string;
    yieldBaseUnits: string;
    totalBaseUnits: string;
    yieldShareBps: number;
  };
}

export interface RebalanceRequest {
  tenantId: string;
  from: "liquidity" | "defindex_vault" | "blend_pool";
  to: "liquidity" | "defindex_vault" | "blend_pool";
  asset: string;
  amountBaseUnits: string;
  strategyRef: string;
  actorId: string | null;
  actorType: "user" | "agent";
}

/** Dashboard pricing: USDC/BlendUSDC = $1; XLM and EURC priced via the
 *  Reflector on-chain oracle when available, falling back to these reference
 *  rates. EURC (Circle's real EUR-pegged Stellar asset) has no direct fiat
 *  EUR/GBP/CHF feed on Reflector's external oracle, but EURC itself does —
 *  verified live against the real oracle, 2026-08-06, the same query pattern
 *  already used for XLM/USD. */
const XLM_USD = 0.11;
const EURC_USD = 1.08;
function toUsdBase(assetCode: string, amount: number, xlmUsd: number = XLM_USD, eurcUsd: number = EURC_USD): bigint {
  const usd = assetCode === "XLM" ? amount * xlmUsd : assetCode === "EURC" ? amount * eurcUsd : amount;
  return BigInt(Math.max(0, Math.round(usd * 1e7)));
}

/**
 * Treasury domain logic: aggregate balances across liquidity / DeFindex /
 * Blend, and execute rebalances that move value between them. Every rebalance
 * is bound to the tenant's legal context before any external/on-chain effect.
 */
export class TreasuryService {
  constructor(
    private readonly repo: Repository,
    private readonly defindex: DefindexClient,
    private readonly blend: BlendClient,
    private readonly soroban: SorobanGateway,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
    private readonly stellarClient: stellar.StellarClient,
    /** Treasury wallet whose real on-chain balances power the dashboard. */
    private readonly treasuryAddress: string | undefined,
    /** Optional Reflector on-chain price oracle for real XLM/USD valuation. */
    private readonly reflector?: ReflectorClient,
  ) {}

  /** Short-TTL cache of the on-chain read so rapid dashboard loads don't re-hit
   *  Stellar RPC / Blend / DeFindex on every request. */
  private readonly onchainCache = new Map<string, { at: number; positions: TreasuryPosition[] }>();
  private static readonly ONCHAIN_TTL_MS = 12_000;

  /**
   * Live treasury snapshot. When a treasury wallet is configured, positions are
   * read from REAL on-chain state — the wallet's classic balances (liquid) plus
   * the real Blend and DeFindex positions (yield) — not from seeded DB rows.
   * Falls back to the DB positions if the wallet isn't set or every source fails.
   */
  async snapshot(tenantId: string): Promise<TreasurySnapshot> {
    const [config, positions] = await Promise.all([
      this.repo.getTreasuryConfig(tenantId),
      this.treasuryAddress ? this.onchainPositions(tenantId) : this.repo.listPositions(tenantId),
    ]);

    let liquid = 0n;
    let yieldUnits = 0n;
    for (const p of positions) {
      const amt = BigInt(p.amountBaseUnits);
      if (p.strategy === "liquidity") liquid += amt;
      else yieldUnits += amt;
    }
    const total = liquid + yieldUnits;
    const yieldShareBps = total === 0n ? 0 : Number((yieldUnits * 10_000n) / total);

    return {
      config,
      positions,
      totals: {
        liquidBaseUnits: liquid.toString(),
        yieldBaseUnits: yieldUnits.toString(),
        totalBaseUnits: total.toString(),
        yieldShareBps,
      },
    };
  }

  async saveConfig(
    config: Omit<TreasuryConfig, "id" | "updatedAt"> & { id?: string },
    actorId: string | null,
  ): Promise<TreasuryConfig> {
    const existing = await this.repo.getTreasuryConfig(config.tenantId);
    const saved = await this.repo.upsertTreasuryConfig({
      ...config,
      id: existing?.id ?? config.id ?? randomUUID(),
      updatedAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: config.tenantId,
      actorId,
      actorType: "user",
      action: "treasury.configured",
      detail: { maxYieldBps: saved.maxYieldBps, minLiquidity: saved.minLiquidityBaseUnits },
    });
    return saved;
  }

  /** Build treasury positions from real on-chain state (wallet + Blend + DeFindex). */
  private async onchainPositions(tenantId: string): Promise<TreasuryPosition[]> {
    const cached = this.onchainCache.get(tenantId);
    if (cached && Date.now() - cached.at < TreasuryService.ONCHAIN_TTL_MS) {
      return cached.positions;
    }
    const addr = this.treasuryAddress as string;
    const positions: TreasuryPosition[] = [];
    // Real XLM/USD and EURC/USD from the Reflector on-chain oracle; falls back
    // to the reference rates. EURC is the real Circle-issued EUR-pegged asset
    // Contextio's EMEA reach (see BlindPay's Stellar-SEPA rail) settles in.
    const [xlmUsd, eurcUsd] = await Promise.all([
      (this.reflector ? this.reflector.getUsdPrice("XLM") : Promise.resolve(null)).then((v) => v ?? XLM_USD),
      (this.reflector ? this.reflector.getUsdPrice("EURC") : Promise.resolve(null)).then((v) => v ?? EURC_USD),
    ]);
    const mk = (
      asset: string,
      strategy: TreasuryPosition["strategy"],
      usdBaseUnits: bigint,
      apyBps: number | null,
    ): TreasuryPosition => ({
      id: `onchain-${strategy}-${asset}`,
      tenantId,
      asset: asset as TreasuryPosition["asset"],
      strategy,
      strategyRef: strategy === "liquidity" ? null : strategy,
      amountBaseUnits: usdBaseUnits.toString(),
      apyBps,
      updatedAt: new Date().toISOString(),
    });

    const [bal, blend, dfx] = await Promise.allSettled([
      this.stellarClient.getBalances(addr),
      this.blend.getVaultData(),
      this.defindex.getVaultData(),
    ]);

    if (bal.status === "fulfilled") {
      let usdc = 0;
      let xlm = 0;
      let eurc = 0;
      for (const b of bal.value) {
        const amt = Number(b.balance) || 0;
        if (b.assetType === "native") xlm += amt;
        else if (b.assetCode === "USDC") usdc += amt; // Circle + BlendUSDC share the code
        else if (b.assetCode === "EURC") eurc += amt; // Circle's EUR-pegged asset — the EMEA leg
      }
      if (usdc > 0) positions.push(mk("USDC", "liquidity", toUsdBase("USDC", usdc, xlmUsd, eurcUsd), null));
      if (xlm > 0) positions.push(mk("XLM", "liquidity", toUsdBase("XLM", xlm, xlmUsd, eurcUsd), null));
      if (eurc > 0) positions.push(mk("EURC", "liquidity", toUsdBase("EURC", eurc, xlmUsd, eurcUsd), null));
    } else {
      this.logger.warn({ err: String(bal.reason) }, "Treasury balances read failed");
    }

    if (blend.status === "fulfilled" && blend.value.ok) {
      const v = blend.value.value;
      const amt = Number(v.positionBaseUnits) / 1e7;
      if (amt > 0) positions.push(mk(v.asset, "blend_pool", toUsdBase(v.asset, amt, xlmUsd), v.supplyApyBps));
    }

    if (dfx.status === "fulfilled" && dfx.value.ok) {
      const v = dfx.value.value;
      const amt = Number(v.positionBaseUnits) / 1e7;
      if (amt > 0) positions.push(mk(v.asset, "defindex_vault", toUsdBase(v.asset, amt, xlmUsd), v.apyBps));
    }

    // If every on-chain source failed, fall back to the DB so the page isn't empty.
    const result = positions.length > 0 ? positions : await this.repo.listPositions(tenantId);
    this.onchainCache.set(tenantId, { at: Date.now(), positions: result });
    return result;
  }

  /**
   * Toggle the autonomous agent on/off for a tenant (dashboard switch). Persists
   * `agentEnabled` on the treasury config, creating a default config if none
   * exists yet. Manual agent runs are unaffected by this flag.
   */
  async setAgentEnabled(tenantId: string, enabled: boolean, actorId: string | null): Promise<TreasuryConfig> {
    const existing = await this.repo.getTreasuryConfig(tenantId);
    const saved = await this.saveConfig(
      {
        id: existing?.id,
        tenantId,
        minLiquidityBaseUnits: existing?.minLiquidityBaseUnits ?? "0",
        maxYieldBps: existing?.maxYieldBps ?? 0,
        countryLimitsBps: existing?.countryLimitsBps ?? {},
        volatilitySensitivity: existing?.volatilitySensitivity ?? 50,
        agentEnabled: enabled,
      },
      actorId,
    );
    this.logger.info({ tenantId, enabled }, "Agent autonomy toggled");
    return saved;
  }

  /**
   * Execute a rebalance: move `amount` from one strategy bucket to another.
   * Enforces the legal-context binding, performs the integration call
   * (DeFindex/Blend), records the on-chain treasury event, and updates positions.
   */
  async rebalance(req: RebalanceRequest): Promise<{ txHash: string; legalContextHash: string }> {
    const binding = await this.legal.bindForAction(req.tenantId, [
      "treasury-management",
    ]);

    // Guard BEFORE any on-chain side-effect: never settle a move the source
    // bucket can't cover, or DB bookkeeping and chain drift (and the caller
    // would see a 500 after a tx already fired). Surfaces as a clean message.
    await this.assertCanDebit(req.tenantId, req.from, req.asset, req.strategyRef, BigInt(req.amountBaseUnits));

    // 1. Integration side-effects. The agent's treasury band is denominated in
    // the tenant's accounting asset (USD), so we only drive the demo DeFindex
    // mock from here. Real DeFindex deposits (XLM-denominated, on its own vault)
    // are executed via the dedicated /integrations/defindex/deposit path so the
    // 24/7 band-rebalance loop never fires wrong-denomination on-chain writes.
    if (!this.defindex.live) {
      if (req.to === "defindex_vault") {
        const r = await this.defindex.deposit(req.strategyRef, req.amountBaseUnits);
        if (!r.ok) throw r.error;
      } else if (req.from === "defindex_vault") {
        const r = await this.defindex.withdraw(req.strategyRef, req.amountBaseUnits);
        if (!r.ok) throw r.error;
      }
    }
    if (req.to === "blend_pool") {
      const r = await this.blend.supply(req.asset, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    } else if (req.from === "blend_pool") {
      const r = await this.blend.withdraw(req.asset, req.amountBaseUnits);
      if (!r.ok) throw r.error;
    }

    // 2. On-chain record with the LCP hash bound into the event.
    const direction = req.to === "liquidity" ? "withdraw" : "deposit";
    const onchain = await this.soroban.recordTreasuryFlow(direction, {
      tenantId: req.tenantId,
      asset: req.asset,
      amountBaseUnits: req.amountBaseUnits,
      strategyRef: req.strategyRef,
      binding,
    });
    if (!onchain.ok) throw onchain.error;

    // 3. Persist new position balances.
    await this.applyPositionDelta(req.tenantId, req.from, req.asset, req.strategyRef, -BigInt(req.amountBaseUnits));
    await this.applyPositionDelta(req.tenantId, req.to, req.asset, req.strategyRef, BigInt(req.amountBaseUnits));

    await this.audit.record({
      tenantId: req.tenantId,
      actorId: req.actorId,
      actorType: req.actorType,
      action: "treasury.rebalanced",
      detail: {
        from: req.from,
        to: req.to,
        asset: req.asset,
        amount: fromBaseUnits(BigInt(req.amountBaseUnits)),
        txHash: onchain.value.txHash,
      },
      legalContextId: binding.contextId,
    });

    this.logger.info(
      { tenantId: req.tenantId, txHash: onchain.value.txHash, from: req.from, to: req.to },
      "Treasury rebalanced",
    );
    return { txHash: onchain.value.txHash, legalContextHash: binding.hash };
  }

  /** Assert the source bucket holds at least `amount` before a debit. */
  private async assertCanDebit(
    tenantId: string,
    strategy: TreasuryPosition["strategy"],
    asset: string,
    strategyRef: string,
    amount: bigint,
  ): Promise<void> {
    const positions = await this.repo.listPositions(tenantId);
    const match = positions.find(
      (p) => p.strategy === strategy && p.asset === asset && (p.strategyRef ?? "") === (strategy === "liquidity" ? "" : strategyRef),
    );
    const current = match ? BigInt(match.amountBaseUnits) : 0n;
    if (current - amount < 0n) {
      throw new Error(
        `Not enough ${asset} in ${strategy} to move: have ${fromBaseUnits(current)}, need ${fromBaseUnits(amount)}`,
      );
    }
  }

  private async applyPositionDelta(
    tenantId: string,
    strategy: TreasuryPosition["strategy"],
    asset: string,
    strategyRef: string,
    delta: bigint,
  ): Promise<void> {
    const positions = await this.repo.listPositions(tenantId);
    const match = positions.find(
      (p) => p.strategy === strategy && p.asset === asset && (p.strategyRef ?? "") === (strategy === "liquidity" ? "" : strategyRef),
    );
    const current = match ? BigInt(match.amountBaseUnits) : 0n;
    const next = current + delta;
    if (next < 0n) throw new Error(`Rebalance would make ${strategy} balance negative`);
    await this.repo.upsertPosition({
      id: match?.id ?? randomUUID(),
      tenantId,
      asset: asset as TreasuryPosition["asset"],
      strategy,
      strategyRef: strategy === "liquidity" ? null : strategyRef,
      amountBaseUnits: next.toString(),
      apyBps: match?.apyBps ?? null,
      updatedAt: new Date().toISOString(),
    });
  }
}
