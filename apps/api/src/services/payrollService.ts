import { randomUUID } from "node:crypto";
import { type Logger, toBaseUnits, fromBaseUnits } from "@contextio/shared";
import type {
  PayrollEmployee,
  PayrollRun,
  PayrollRunLine,
  PayrollSchedule,
  ScheduleCadence,
} from "@contextio/shared";
import type { Repository } from "../db/repository.js";
import type { SorobanGateway } from "../integrations/soroban.js";
import type { LegalContextService } from "./legalContextService.js";
import type { AuditService } from "./auditService.js";

/**
 * A failed run must NOT leave `nextRunAt` in the past — the scheduled-payroll
 * worker job treats any schedule with `nextRunAt <= now` as due and retries
 * it on every tick (every few minutes). Without ever rescheduling, a single
 * genuine failure (e.g. insufficient treasury liquidity) turns into an
 * unbounded retry storm — confirmed live: the same obligation was retried
 * and failed every ~5 minutes for 8+ hours straight. On failure, push the
 * retry out by a short backoff instead of the full cadence period, so it
 * tries again soon but stops hammering.
 */
const FAILURE_BACKOFF_MS = 60 * 60 * 1000; // 1 hour

function advanceCadence(from: string, cadence: ScheduleCadence): Date {
  const next = new Date(from);
  switch (cadence) {
    case "weekly":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case "biweekly":
      next.setUTCDate(next.getUTCDate() + 14);
      break;
    case "monthly":
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case "one_off":
      // Doesn't recur — the caller deactivates instead of rescheduling.
      break;
  }
  return next;
}

export interface UpcomingObligation {
  scheduleId: string;
  scheduleName: string;
  nextRunAt: string;
  asset: string;
  requiredBaseUnits: string;
  employeeCount: number;
}

/**
 * Payroll domain logic: employees, schedules, obligation forecasting, and
 * legally-bound run execution. Runs settle on-chain via the payroll Soroban
 * contract; fiat off-ramps (PIX / Transferencias 3.0 / Bre-B) are represented
 * per line and would be fulfilled by SEP-24/31 anchors in production.
 */
export class PayrollService {
  constructor(
    private readonly repo: Repository,
    private readonly soroban: SorobanGateway,
    private readonly legal: LegalContextService,
    private readonly audit: AuditService,
    private readonly logger: Logger,
  ) {}

  listEmployees(tenantId: string): Promise<PayrollEmployee[]> {
    return this.repo.listEmployees(tenantId);
  }

  async saveEmployee(
    e: Omit<PayrollEmployee, "id" | "createdAt"> & { id?: string },
    actorId: string | null,
  ): Promise<PayrollEmployee> {
    const saved = await this.repo.upsertEmployee({
      ...e,
      id: e.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: e.tenantId,
      actorId,
      actorType: "user",
      action: "payroll.employee.created",
      detail: { employeeId: saved.id, country: saved.country },
    });
    return saved;
  }

  deleteEmployee(tenantId: string, id: string): Promise<void> {
    return this.repo.deleteEmployee(tenantId, id);
  }

  listSchedules(tenantId: string): Promise<PayrollSchedule[]> {
    return this.repo.listSchedules(tenantId);
  }

  async saveSchedule(
    s: Omit<PayrollSchedule, "id" | "createdAt"> & { id?: string },
    actorId: string | null,
  ): Promise<PayrollSchedule> {
    const saved = await this.repo.upsertSchedule({
      ...s,
      id: s.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
    });
    await this.audit.record({
      tenantId: s.tenantId,
      actorId,
      actorType: "user",
      action: "payroll.schedule.created",
      detail: { scheduleId: saved.id, cadence: saved.cadence },
    });
    return saved;
  }

  /**
   * Forecast upcoming obligations and the liquidity they require, normalizing
   * every employee's salary into the schedule's settlement asset base units.
   */
  async upcomingObligations(tenantId: string): Promise<UpcomingObligation[]> {
    const [schedules, employees] = await Promise.all([
      this.repo.listSchedules(tenantId),
      this.repo.listEmployees(tenantId),
    ]);
    const byId = new Map(employees.map((e) => [e.id, e]));

    const result: UpcomingObligation[] = [];
    for (const s of schedules.filter((x) => x.active)) {
      let total = 0n;
      let count = 0;
      for (const id of s.employeeIds) {
        const emp = byId.get(id);
        if (!emp || !emp.active) continue;
        total += toBaseUnits(emp.salaryAmount);
        count += 1;
      }
      result.push({
        scheduleId: s.id,
        scheduleName: s.name,
        nextRunAt: s.nextRunAt,
        asset: s.asset,
        requiredBaseUnits: total.toString(),
        employeeCount: count,
      });
    }
    return result.sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));
  }

  /** Build the per-employee lines for a schedule without executing. */
  async buildRunLines(tenantId: string, schedule: PayrollSchedule): Promise<PayrollRunLine[]> {
    const employees = await this.repo.listEmployees(tenantId);
    const byId = new Map(employees.map((e) => [e.id, e]));
    const lines: PayrollRunLine[] = [];
    for (const id of schedule.employeeIds) {
      const emp = byId.get(id);
      if (!emp || !emp.active) continue;
      lines.push({
        employeeId: emp.id,
        amount: emp.salaryAmount,
        asset: schedule.asset,
        rail: emp.preferredRail,
        destination: emp.walletAddress ?? emp.bankReference ?? "unspecified",
      });
    }
    return lines;
  }

  /**
   * Execute a payroll run. Binds the legal context (payroll-execution consent),
   * settles on-chain via the payroll contract, and records the run + audit log.
   * `dryRun` produces a simulated run for the UI's simulation view.
   */
  async executeRun(input: {
    tenantId: string;
    scheduleId: string;
    actorId: string | null;
    actorType: "user" | "agent";
    dryRun?: boolean;
  }): Promise<PayrollRun> {
    const schedule = await this.repo.getSchedule(input.tenantId, input.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const lines = await this.buildRunLines(input.tenantId, schedule);
    const totalBaseUnits = lines.reduce((acc, l) => acc + toBaseUnits(l.amount), 0n);

    const binding = await this.legal.bindForAction(input.tenantId, [
      "treasury-management",
      "payroll-execution",
    ]);

    const run: PayrollRun = {
      id: randomUUID(),
      tenantId: input.tenantId,
      scheduleId: schedule.id,
      status: input.dryRun ? "simulated" : "executing",
      totalAmount: fromBaseUnits(totalBaseUnits),
      asset: schedule.asset,
      lines,
      legalContextId: binding.contextId,
      legalContextHash: binding.hash,
      stellarTxHash: null,
      executedAt: null,
      createdAt: new Date().toISOString(),
    };
    await this.repo.insertPayrollRun(run);

    if (input.dryRun) return run;

    // Real per-employee USDC payouts: settle salaries on-chain to each employee's
    // Stellar wallet (testnet demo-scaled 1:100 to stay within faucet funds).
    const isStellar = (a: string) => /^G[A-Z2-7]{55}$/.test(a);
    const payouts = lines
      .filter((l) => isStellar(l.destination))
      .map((l) => ({ destination: l.destination, amount: (Number(l.amount) / 100).toFixed(2) }));

    const onchain = await this.soroban.executePayrollRun({
      tenantId: input.tenantId,
      runId: run.id,
      totalBaseUnits: totalBaseUnits.toString(),
      asset: schedule.asset,
      employeeCount: lines.length,
      binding,
      payouts,
    });
    if (!onchain.ok) {
      await this.repo.updatePayrollRun(run.id, { status: "failed" });
      await this.repo.upsertSchedule({
        ...schedule,
        nextRunAt: new Date(Date.now() + FAILURE_BACKOFF_MS).toISOString(),
      });
      this.logger.warn(
        { tenantId: input.tenantId, scheduleId: schedule.id, runId: run.id, err: String(onchain.error) },
        "Payroll run failed — backed off 1h instead of retrying immediately",
      );
      throw onchain.error;
    }

    // The real-money tx (USDC payout) is the most meaningful for the feed; fall
    // back to the contract execute_run tx when there were no Stellar-wallet lines.
    const settledTxHash = onchain.value.payoutTxHash ?? onchain.value.txHash;
    const executedAt = new Date().toISOString();
    await this.repo.updatePayrollRun(run.id, {
      status: "completed",
      stellarTxHash: settledTxHash,
      executedAt,
    });
    // Move the schedule to its next natural occurrence — a one-off run never
    // recurs, everything else advances by cadence from the date it was
    // *scheduled* for (not "now"), so the rhythm doesn't drift.
    if (schedule.cadence === "one_off") {
      await this.repo.upsertSchedule({ ...schedule, active: false });
    } else {
      await this.repo.upsertSchedule({
        ...schedule,
        nextRunAt: advanceCadence(schedule.nextRunAt, schedule.cadence).toISOString(),
      });
    }
    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "payroll.run.executed",
      detail: {
        runId: run.id,
        total: run.totalAmount,
        payoutTxHash: onchain.value.payoutTxHash ?? null,
        recordTxHash: onchain.value.txHash,
        paid: payouts.length,
      },
      legalContextId: binding.contextId,
    });

    this.logger.info(
      { tenantId: input.tenantId, runId: run.id, payoutTxHash: onchain.value.payoutTxHash, recordTxHash: onchain.value.txHash, paid: payouts.length },
      "Payroll run executed",
    );
    return { ...run, status: "completed", stellarTxHash: settledTxHash, executedAt };
  }

  listRuns(tenantId: string): Promise<PayrollRun[]> {
    return this.repo.listRuns(tenantId);
  }

  /**
   * Self-custody counterpart to `executeRun`: builds unsigned XDRs for the
   * company's own treasury wallet to sign (via Freighter) instead of paying
   * from a platform-held key. Nothing is persisted yet — `submitRun` writes
   * the run once the client has actually signed and broadcast it, so an
   * abandoned prepare (user closes the tab) never leaves an orphaned record.
   *
   * Recipients here are contractors/freelancers under a commercial contract,
   * never subordinate employees: Mexican labor law (LFT Art. 101) requires
   * salary to be paid in legal-tender currency, so paying an actual "empleado"
   * in USDC would be illegal for the client. The caller must explicitly
   * attest to this per run (enforced at the schema layer).
   */
  async prepareRun(input: {
    tenantId: string;
    scheduleId: string;
    /** The company treasury wallet that will sign and pay — never a platform key. */
    address: string;
  }): Promise<{
    runId: string;
    paymentXdr: string | null;
    /** null when our payroll contract isn't deployed on this network (mainnet, pre-audit). */
    executeRunXdr: string | null;
    totalAmount: string;
    asset: PayrollSchedule["asset"];
    legalContextId: string;
    legalContextHash: string;
  }> {
    const schedule = await this.repo.getSchedule(input.tenantId, input.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const lines = await this.buildRunLines(input.tenantId, schedule);
    const totalBaseUnits = lines.reduce((acc, l) => acc + toBaseUnits(l.amount), 0n);
    if (totalBaseUnits <= 0n) throw new Error("Schedule has no active employees to pay");

    const binding = await this.legal.bindForAction(input.tenantId, [
      "payroll-execution",
      "payroll-payout-contractors-only",
    ]);

    // One-time, non-fund-moving allowlist write (see SorobanGateway.ensureOperator).
    // On a mainnet deployment (no service secret, per the boot guard) this is a
    // no-op that returns `added: false` without erroring — the wallet must have
    // been provisioned as an operator out-of-band beforehand.
    const ensured = await this.soroban.ensureOperator(input.address);
    if (!ensured.ok) throw ensured.error;

    const isStellar = (a: string) => /^G[A-Z2-7]{55}$/.test(a);
    const payouts = lines
      .filter((l) => isStellar(l.destination))
      .map((l) => ({ destination: l.destination, amount: (Number(l.amount) / 100).toFixed(2) }));

    const runId = randomUUID();
    const { paymentXdr, executeRunXdr } = await this.soroban.buildPayrollRunXdrs({
      tenantId: input.tenantId,
      runId,
      totalBaseUnits: totalBaseUnits.toString(),
      asset: schedule.asset,
      employeeCount: lines.length,
      binding,
      payouts,
      sourcePublicKey: input.address,
    });

    return {
      runId,
      paymentXdr,
      executeRunXdr,
      totalAmount: fromBaseUnits(totalBaseUnits),
      asset: schedule.asset,
      legalContextId: binding.contextId,
      legalContextHash: binding.hash,
    };
  }

  /**
   * Submit the client-signed envelope(s) from `prepareRun` and record the
   * run. `signedExecuteRunXdr` is null whenever our payroll contract isn't
   * deployed on this network (mainnet, pre-audit) — the payment is still a
   * real on-chain settlement, just recorded here in Supabase instead of via
   * our contract, so it stays fully auditable without needing our unaudited
   * contract in the mainnet path at all.
   */
  async submitRun(input: {
    tenantId: string;
    runId: string;
    scheduleId: string;
    actorId: string | null;
    legalContextId: string;
    legalContextHash: string;
    signedExecuteRunXdr: string | null;
    signedPaymentXdr: string | null;
  }): Promise<PayrollRun> {
    if (!input.signedPaymentXdr && !input.signedExecuteRunXdr) {
      throw new Error("Nothing to submit: both signedPaymentXdr and signedExecuteRunXdr are empty");
    }
    const schedule = await this.repo.getSchedule(input.tenantId, input.scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const lines = await this.buildRunLines(input.tenantId, schedule);
    const totalBaseUnits = lines.reduce((acc, l) => acc + toBaseUnits(l.amount), 0n);

    let payoutTxHash: string | undefined;
    if (input.signedPaymentXdr) {
      const paid = await this.soroban.submitSignedXdr(input.signedPaymentXdr);
      payoutTxHash = paid.txHash;
    }
    let recordTxHash: string | undefined;
    if (input.signedExecuteRunXdr) {
      const recorded = await this.soroban.submitSignedXdr(input.signedExecuteRunXdr);
      recordTxHash = recorded.txHash;
    }
    const settledTxHash = payoutTxHash ?? recordTxHash;
    if (!settledTxHash) throw new Error("No transaction settled");

    const executedAt = new Date().toISOString();
    const run: PayrollRun = {
      id: input.runId,
      tenantId: input.tenantId,
      scheduleId: schedule.id,
      status: "completed",
      totalAmount: fromBaseUnits(totalBaseUnits),
      asset: schedule.asset,
      lines,
      legalContextId: input.legalContextId,
      legalContextHash: input.legalContextHash,
      stellarTxHash: settledTxHash,
      executedAt,
      createdAt: executedAt,
    };
    await this.repo.insertPayrollRun(run);

    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: "user",
      action: "payroll.run.executed",
      detail: {
        runId: run.id,
        total: run.totalAmount,
        payoutTxHash: payoutTxHash ?? null,
        recordTxHash: recordTxHash ?? null,
        onChainContractRecord: Boolean(recordTxHash),
        selfCustody: true,
      },
      legalContextId: input.legalContextId,
    });

    this.logger.info(
      { tenantId: input.tenantId, runId: run.id, payoutTxHash, recordTxHash, selfCustody: true },
      "Payroll run executed (self-custody)",
    );
    return run;
  }
}
