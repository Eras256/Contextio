"use client";

import { useState } from "react";
import { Badge, Card, DataBadge, SectionHeader, Skeleton, Stat } from "@/components/ui";
import { COUNTRY_LABEL, RAIL_LABEL, fromBaseUnits, localDateTime, shortHash, usd, usdBase } from "@/lib/format";
import { api, type PayrollEmployee, type TreasurySnapshot } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNetwork } from "@/lib/network";
import { signWalletTransaction } from "@/lib/wallet";

const txUrl = (h: string, network: "testnet" | "mainnet") =>
  `https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/tx/${h}`;

const EMPTY_TREASURY: TreasurySnapshot = {
  config: null,
  positions: [],
  totals: { liquidBaseUnits: "0", yieldBaseUnits: "0", totalBaseUnits: "0", yieldShareBps: 0 },
};

export default function PayrollPage() {
  const tr = useT();
  const network = useNetwork();
  const { accessToken, tenantId, address, connect, connecting } = useAuth();
  const employeesQ = useLiveData<PayrollEmployee[]>(api.employees, []);
  const obligationsQ = useLiveData(api.obligations, []);
  const treasuryQ = useLiveData(api.treasury, EMPTY_TREASURY);
  const runsQ = useLiveData(api.runs, [], { realtimeTable: "payroll_runs" });
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <SectionHeader
          eyebrow={tr("pages.payroll.eyebrow")}
          title={tr("pages.payroll.title")}
          description={tr("pages.payroll.desc")}
        />
        <ConnectGate connect={connect} connecting={connecting} tr={tr} />
      </div>
    );
  }

  const employees = employeesQ.data;
  const active = employees.filter((e) => e.active);
  const monthlyTotal = employees.reduce((acc, e) => acc + Number(e.salaryAmount || 0), 0);
  const next = obligationsQ.data[0];
  const required = next ? fromBaseUnits(next.requiredBaseUnits) : 0;
  // FX cushion sized to the owner's own risk setting (volatility sensitivity 0–100),
  // not a fixed magic number — ties the forecast to real config.
  const sensitivity = treasuryQ.data.config?.volatilitySensitivity ?? 50;
  const buffer = required * (sensitivity / 100) * 0.15;
  const needed = required + buffer;
  const ready = fromBaseUnits(treasuryQ.data.totals.liquidBaseUnits);
  const enough = ready >= needed;
  const nextDate = next
    ? new Date(next.nextRunAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

  // Run a real payroll now: the treasury wallet settles USDC to each employee
  // on-chain (testnet 1:100 scaled). Surfaces the real reason on failure.
  const runPayrollNow = async () => {
    if (running || !accessToken || !tenantId || !next?.scheduleId) return;
    if (!window.confirm(tr("pages.payroll.runConfirm"))) return;
    setRunning(true);
    setRunMsg(null);
    try {
      const run = await api.runPayroll({ accessToken, tenantId }, next.scheduleId);
      setRunMsg(
        `${tr("pages.payroll.runDone")}${run.stellarTxHash ? ` · tx ${shortHash(run.stellarTxHash, 8, 6)}` : ""}`,
      );
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={tr("pages.payroll.eyebrow")}
        title={tr("pages.payroll.title")}
        description={tr("pages.payroll.desc")}
        action={<DataBadge live={employeesQ.live} loading={employeesQ.loading} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><Stat label={tr("pages.payroll.statPeople")} value={active.length} sub={tr("pages.payroll.statPeopleSub")} /></Card>
        <Card><Stat label={tr("pages.payroll.statMonthly")} value={usd(monthlyTotal)} sub={tr("pages.payroll.statMonthlySub")} /></Card>
        <Card><Stat label={tr("pages.payroll.statNext")} value={nextDate} sub={next?.scheduleName ?? tr("pages.payroll.nextNone")} /></Card>
        <Card><Stat label={tr("pages.payroll.statNeeded")} value={next ? usd(needed) : "—"} sub={tr("pages.payroll.statNeededSub")} /></Card>
      </div>

      {/* Team */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-white">{tr("pages.payroll.teamTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2">{tr("pages.payroll.colName")}</th>
                <th className="pb-2">{tr("pages.payroll.colCountry")}</th>
                <th className="pb-2">{tr("pages.payroll.colAsset")}</th>
                <th className="pb-2">{tr("pages.payroll.colRail")}</th>
                <th className="pb-2 text-right">{tr("pages.payroll.colSalary")}</th>
                <th className="pb-2 text-right">{tr("pages.payroll.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="py-2 font-medium text-white">{e.fullName}</td>
                  <td className="py-2 text-slate-300">{COUNTRY_LABEL[e.country] ?? e.country}</td>
                  <td className="py-2 text-slate-300">{e.payoutAsset}</td>
                  <td className="py-2 text-slate-300">{RAIL_LABEL[e.preferredRail] ?? e.preferredRail}</td>
                  <td className="py-2 text-right font-medium text-white">{usd(Number(e.salaryAmount || 0))}</td>
                  <td className="py-2 text-right">
                    <Badge tone={e.active ? "success" : "default"}>
                      {e.active ? tr("pages.payroll.active") : tr("pages.payroll.paused")}
                    </Badge>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    {employeesQ.loading ? "…" : tr("pages.payroll.teamEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent payroll runs (real, on-chain) */}
      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{tr("pages.payroll.runsTitle")}</h3>
          {/* Custodial "Pay now" needs a platform signer key — the mainnet API
              never has one (see mainnet boot guard), so it can only ever work
              on testnet. Payouts below is the mainnet-capable path. */}
          {network === "testnet" && next?.scheduleId && (
            <button
              onClick={() => void runPayrollNow()}
              disabled={running}
              className="btn-ghost text-xs disabled:opacity-40"
            >
              {running ? tr("auth.connecting") : tr("pages.payroll.runNow")}
            </button>
          )}
        </div>
        <p className="mb-4 text-xs text-slate-400">{tr("pages.payroll.runsBody")}</p>
        {runMsg && (
          <p className="mb-3 break-words rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-slate-300">
            {runMsg}
          </p>
        )}
        <div className="space-y-3">
          {runsQ.loading &&
            runsQ.data.length === 0 &&
            [0, 1].map((i) => (
              <div key={`rsk-${i}`} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            ))}
          {runsQ.data.map((run) => (
            <div key={run.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "warn" : "default"}>
                    {tr(`pages.payroll.runStatus.${run.status}`)}
                  </Badge>
                  <span className="text-sm font-medium text-white">
                    {usd(Number(run.totalAmount || 0))} {run.asset}
                  </span>
                  {run.lines && (
                    <span className="text-xs text-slate-500">
                      · {run.lines.length} {tr("pages.payroll.runsPaid")}
                    </span>
                  )}
                </div>
                <span className="font-mono text-xs text-slate-500">
                  {localDateTime(run.executedAt ?? run.createdAt)}
                </span>
              </div>
              {network === "testnet" && run.status === "completed" && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {usd(Number(run.totalAmount || 0) / 100)} {run.asset} · {tr("pages.payroll.runsScaledNote")}
                </p>
              )}
              <div className="mt-2 text-xs">
                {run.stellarTxHash && !run.stellarTxHash.startsWith("sim:") ? (
                  <a href={txUrl(run.stellarTxHash, network)} target="_blank" rel="noreferrer" className="font-mono text-brand hover:underline">
                    tx {shortHash(run.stellarTxHash, 8, 6)} ↗
                  </a>
                ) : (
                  <span className="font-mono text-slate-500 break-all">{run.stellarTxHash ?? "—"}</span>
                )}
              </div>
            </div>
          ))}
          {!runsQ.loading && runsQ.data.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500">{tr("pages.payroll.runsEmpty")}</p>
          )}
        </div>
      </Card>

      {/* Self-custody Payouts — the mainnet-capable path (see boot guard). */}
      {next?.scheduleId && <PayoutsPanel auth={{ accessToken, tenantId: tenantId! }} address={address} scheduleId={next.scheduleId} network={network} />}

      {/* Funding */}
      <Card className="max-w-xl">
        <h3 className="mb-1 text-sm font-semibold text-white">{tr("pages.payroll.fundTitle")}</h3>
        <p className="mb-4 text-xs text-slate-400">{tr("pages.payroll.fundBody")}</p>
        <div className="space-y-3 text-sm">
          <Row k={tr("pages.payroll.fundGross")} v={next ? usd(required) : "—"} />
          <Row k={tr("pages.payroll.fundBuffer")} v={next ? `+ ${usd(buffer)}` : "—"} tone="warn" />
          <Row k={tr("pages.payroll.fundNeeded")} v={next ? usd(needed) : "—"} />
          <div className="my-2 border-t border-white/10" />
          <Row k={tr("pages.payroll.fundReady")} v={usdBase(treasuryQ.data.totals.liquidBaseUnits)} tone="info" />
          {next && (
            <div
              className={`mt-3 rounded-lg border p-3 text-xs ${
                enough ? "border-brand/20 bg-brand/5 text-slate-300" : "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
              }`}
            >
              {enough ? `✓ ${tr("pages.payroll.fundOk")}` : `! ${tr("pages.payroll.fundShort")}`}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Self-custody Payouts: builds unsigned XDR(s) server-side, the caller signs
 * with their own wallet, then submits. Contractor-only by design (LFT Art.
 * 101) — the two checkboxes are required per run, not a one-time setting.
 */
function PayoutsPanel({
  auth,
  address,
  scheduleId,
  network,
}: {
  auth: { accessToken: string; tenantId: string };
  address: string | null;
  scheduleId: string;
  network: "testnet" | "mainnet";
}) {
  const tr = useT();
  const [contractorOk, setContractorOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  const run = async () => {
    if (!address) return setMsg(tr("pages.payroll.payoutsConnectFirst"));
    if (!contractorOk || !termsOk) return setMsg(tr("pages.payroll.payoutsCheckBoxes"));
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setTx(null);
    try {
      setMsg(tr("pages.payroll.payoutsPreparing"));
      const prepared = await api.preparePayout(auth, {
        scheduleId,
        address,
        contractorAttestation: true,
        acknowledgeTerms: true,
      });
      setMsg(tr("pages.payroll.payoutsApprove"));
      const signedExecuteRunXdr = prepared.executeRunXdr ? await signWalletTransaction(prepared.executeRunXdr, address) : null;
      const signedPaymentXdr = prepared.paymentXdr ? await signWalletTransaction(prepared.paymentXdr, address) : null;
      setMsg(tr("pages.payroll.payoutsSubmitting"));
      const settled = await api.submitPayout(auth, {
        runId: prepared.runId,
        scheduleId,
        legalContextId: prepared.legalContextId,
        legalContextHash: prepared.legalContextHash,
        signedExecuteRunXdr,
        signedPaymentXdr,
      });
      setTx(settled.stellarTxHash);
      setMsg(tr("pages.payroll.payoutsDone"));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-white">{tr("pages.payroll.payoutsTitle")}</h3>
      <p className="mt-1 text-xs text-slate-400">{tr("pages.payroll.payoutsBody")}</p>
      {network === "mainnet" && (
        <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
          {tr("pages.payroll.payoutsMainnetNote")}
        </p>
      )}
      <label className="mt-3 flex items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={contractorOk} onChange={(e) => setContractorOk(e.target.checked)} className="mt-0.5" />
        {tr("pages.payroll.payoutsContractorLabel")}
      </label>
      <label className="mt-2 flex items-start gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} className="mt-0.5" />
        {tr("pages.payroll.payoutsTermsLabel")}
      </label>
      <button
        onClick={() => void run()}
        disabled={busy || !contractorOk || !termsOk}
        className="btn-primary mt-3 text-xs disabled:opacity-40"
      >
        {busy ? tr("auth.connecting") : tr("pages.payroll.payoutsRun")}
      </button>
      {msg && (
        <p className="mt-3 break-words rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-slate-300">{msg}</p>
      )}
      {tx && (
        <a href={txUrl(tx, network)} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-xs text-brand hover:underline">
          tx {shortHash(tx, 8, 6)} ↗
        </a>
      )}
    </Card>
  );
}

function Row({ k, v, tone = "default" }: { k: string; v: string; tone?: "default" | "warn" | "info" }) {
  const c: Record<string, string> = { default: "text-slate-200", warn: "text-accent-gold", info: "text-sky-300" };
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{k}</span>
      <span className={`font-medium ${c[tone]}`}>{v}</span>
    </div>
  );
}

function ConnectGate({
  connect,
  connecting,
  tr,
}: {
  connect: () => void | Promise<void>;
  connecting: boolean;
  tr: (k: string) => string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-900/40 to-accent/10 px-6 py-16 text-center">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative mx-auto max-w-md">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-brand/30 bg-brand/10 text-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 11V7a4 4 0 0 0-8 0v4" /><rect x="5" y="11" width="14" height="9" rx="2" />
          </svg>
        </span>
        <h3 className="mt-5 text-xl font-semibold text-white">{tr("pages.payroll.connectTitle")}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">{tr("pages.payroll.connectBody")}</p>
        <button className="btn-primary mt-6 px-5 py-2.5" onClick={() => void connect()} disabled={connecting}>
          {connecting ? tr("auth.connecting") : tr("auth.connect")}
        </button>
      </div>
    </div>
  );
}
