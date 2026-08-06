/**
 * Domain types. These mirror the Supabase schema (supabase/migrations) and are
 * the canonical shapes passed between api, worker, and web.
 */

export type Country = "BR" | "AR" | "CO";
export type AssetSymbol = "USDC" | "XLM" | "CETES" | "BRL" | "ARS" | "COP" | "EURC";

/** On/off-ramp rails per country. */
export type Rail = "PIX" | "TRANSFERENCIAS_3" | "BRE_B" | "STELLAR" | "SEP24" | "SEP31";

export const RAIL_BY_COUNTRY: Record<Country, Rail[]> = {
  BR: ["PIX", "SEP24", "SEP31", "STELLAR"],
  AR: ["TRANSFERENCIAS_3", "SEP24", "SEP31", "STELLAR"],
  CO: ["BRE_B", "SEP24", "SEP31", "STELLAR"],
};

export type Role = "owner" | "admin" | "member" | "viewer";

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  country: Country;
  legalContextId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
}

export interface TenantUser {
  tenantId: string;
  userId: string;
  role: Role;
  createdAt: string;
}

/** Strategy a treasury position is allocated to. */
export type StrategyKind = "liquidity" | "defindex_vault" | "blend_pool";

export interface TreasuryConfig {
  id: string;
  tenantId: string;
  /** Minimum liquid buffer (in USDC base units) the agent must keep available. */
  minLiquidityBaseUnits: string;
  /** Max share of treasury allocatable to yield, in basis points (0–10000). */
  maxYieldBps: number;
  /** Per-country exposure caps in basis points. */
  countryLimitsBps: Partial<Record<Country, number>>;
  /** Agent sensitivity to FX volatility (0–100). Higher = more conservative. */
  volatilitySensitivity: number;
  /** Whether the autonomous agent is allowed to act for this tenant (the
   *  dashboard activate/deactivate toggle). Manual runs are unaffected. */
  agentEnabled: boolean;
  updatedAt: string;
}

export interface TreasuryPosition {
  id: string;
  tenantId: string;
  asset: AssetSymbol;
  strategy: StrategyKind;
  /** Off-chain strategy reference: DeFindex vault id or Blend pool id. */
  strategyRef: string | null;
  amountBaseUnits: string;
  /** Estimated APY in basis points, when the position earns yield. */
  apyBps: number | null;
  updatedAt: string;
}

export interface PayrollEmployee {
  id: string;
  tenantId: string;
  fullName: string;
  email: string | null;
  country: Country;
  /** Stellar address (G... or contract C...) for on-chain payout, if any. */
  walletAddress: string | null;
  /** Local bank reference (PIX key, CBU/alias, Bre-B id) for fiat off-ramp. */
  bankReference: string | null;
  payoutAsset: AssetSymbol;
  preferredRail: Rail;
  /** Gross pay per period, human decimal string. */
  salaryAmount: string;
  active: boolean;
  createdAt: string;
}

export type ScheduleCadence = "weekly" | "biweekly" | "monthly" | "one_off";

export interface PayrollSchedule {
  id: string;
  tenantId: string;
  name: string;
  cadence: ScheduleCadence;
  /** Next run timestamp (ISO). For one_off this is the only run. */
  nextRunAt: string;
  asset: AssetSymbol;
  rail: Rail;
  employeeIds: string[];
  active: boolean;
  createdAt: string;
}

export type PayrollRunStatus = "scheduled" | "simulated" | "executing" | "completed" | "failed";

export interface PayrollRunLine {
  employeeId: string;
  amount: string;
  asset: AssetSymbol;
  rail: Rail;
  destination: string;
  txHash?: string;
}

export interface PayrollRun {
  id: string;
  tenantId: string;
  scheduleId: string | null;
  status: PayrollRunStatus;
  totalAmount: string;
  asset: AssetSymbol;
  lines: PayrollRunLine[];
  legalContextId: string | null;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  executedAt: string | null;
  createdAt: string;
}

export type AgentActionKind =
  | "rebalance"
  | "deposit_vault"
  | "withdraw_vault"
  | "blend_supply"
  | "blend_withdraw"
  | "fund_payroll"
  | "noop";

export type AgentDecisionStatus = "proposed" | "approved" | "rejected" | "executed" | "failed";

export interface AgentDecision {
  id: string;
  tenantId: string;
  action: AgentActionKind;
  /** Human-readable rationale produced by the orchestration layer. */
  rationale: string;
  /** Structured proposal payload (amounts, source/target strategy, etc.). */
  payload: Record<string, unknown>;
  status: AgentDecisionStatus;
  legalContextId: string | null;
  legalContextHash: string | null;
  stellarTxHash: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export type AuditAction =
  | "tenant.created"
  | "treasury.configured"
  | "treasury.rebalanced"
  | "payroll.employee.created"
  | "payroll.schedule.created"
  | "payroll.run.executed"
  | "agent.decision.proposed"
  | "agent.decision.approved"
  | "legal.context.published"
  | "integration.defindex.deposit"
  | "integration.blend.supply";

export interface AuditLog {
  id: string;
  tenantId: string;
  actorId: string | null;
  actorType: "user" | "agent" | "system";
  action: AuditAction;
  detail: Record<string, unknown>;
  legalContextId: string | null;
  createdAt: string;
}
