"use client";

import { AllocationBar, Badge, Card, DataBadge, DemoDataNotice, Info, SectionHeader, Skeleton, Stat } from "@/components/ui";
import { bps, shortHash, usdBase, localDateTime } from "@/lib/format";
import { api, publicApi, type Decision, type TreasurySnapshot } from "@/lib/api";
import { TreasuryControls } from "@/components/TreasuryControls";
import { useLiveData } from "@/lib/useLiveData";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNetwork } from "@/lib/network";

const EMPTY: TreasurySnapshot = {
  config: null,
  positions: [],
  totals: { liquidBaseUnits: "0", yieldBaseUnits: "0", totalBaseUnits: "0", yieldShareBps: 0 },
};

const PLACE_KEY: Record<string, string> = {
  liquidity: "pages.treasury.placeLiquidity",
  defindex_vault: "pages.treasury.placeVault",
  blend_pool: "pages.treasury.placeBlend",
};

export default function TreasuryPage() {
  const tr = useT();
  const network = useNetwork();
  const { accessToken, tenantId, address, connect, connecting } = useAuth();
  const { data: snap, live, loading } = useLiveData(api.treasury, EMPTY, {
    realtimeTable: "treasury_positions",
    publicFetcher: publicApi.treasury,
  });
  const activity = useLiveData<Decision[]>(api.decisions, [], {
    realtimeTable: "agent_decisions",
    publicFetcher: publicApi.decisions,
  });

  const t = snap.totals;
  const cfg = snap.config;
  const weightedApy =
    snap.positions
      .filter((p) => p.apyBps)
      .reduce((acc, p) => acc + (p.apyBps ?? 0) * Number(BigInt(p.amountBaseUnits)), 0) /
    Math.max(1, Number(BigInt(t.yieldBaseUnits)));
  const recent = activity.data.slice(0, 6);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={tr("pages.treasury.eyebrow")}
        title={tr("pages.treasury.title")}
        description={tr("pages.treasury.desc")}
        action={<DataBadge live={live} loading={loading} />}
      />

      {!accessToken && (
        <DemoDataNotice
          message={tr("pages.treasury.demoBanner")}
          connect={connect}
          connecting={connecting}
          connectLabel={tr("auth.connect")}
          connectingLabel={tr("auth.connecting")}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-brand/25 bg-gradient-to-br from-brand/[0.08] via-transparent to-transparent transition hover:border-brand/40">
          <div className="animate-glow pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand/20 blur-2xl" />
          <Stat accent label={tr("pages.treasury.statTotal")} value={loading ? <Skeleton className="mt-1 h-9 w-32" /> : usdBase(t.totalBaseUnits)} sub={tr("pages.treasury.statTotalSub")} />
        </Card>
        <Card className="transition hover:border-white/20"><Stat label={<>{tr("pages.treasury.statReady")} <Info text={tr("glossary.liquidity")} /></>} value={loading ? <Skeleton className="mt-1 h-7 w-24" /> : usdBase(t.liquidBaseUnits)} sub={tr("pages.treasury.statReadySub")} /></Card>
        <Card className="transition hover:border-white/20"><Stat label={<>{tr("pages.treasury.statEarning")} <Info text={tr("glossary.yield")} /></>} value={loading ? <Skeleton className="mt-1 h-7 w-24" /> : usdBase(t.yieldBaseUnits)} sub={loading ? "" : `${bps(weightedApy)} APY`} /></Card>
        <Card className="transition hover:border-white/20"><Stat label={tr("pages.treasury.statShare")} value={loading ? <Skeleton className="mt-1 h-7 w-16" /> : bps(t.yieldShareBps)} sub={tr("pages.treasury.statShareSub")} /></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h3 className="mb-4 text-sm font-semibold text-white">{tr("pages.treasury.allocTitle")}</h3>
          <AllocationBar yieldShareBps={t.yieldShareBps} />
          <div className="mt-3 flex justify-between text-xs text-slate-400">
            <span>{tr("pages.treasury.liquid")}</span>
            <span>{tr("pages.treasury.earning")}</span>
          </div>
          <p className="mt-4 text-xs text-slate-400">{tr("pages.treasury.allocBody")}</p>
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-white">{tr("pages.treasury.posTitle")}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2">{tr("pages.treasury.colAsset")}</th>
                  <th className="pb-2">{tr("pages.treasury.colWhere")}</th>
                  <th className="pb-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {tr("pages.treasury.colYield")} <Info text={tr("glossary.apy")} />
                    </span>
                  </th>
                  <th className="pb-2 text-right">{tr("pages.treasury.colAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {snap.positions.map((p, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2 font-medium text-white">{p.asset}</td>
                    <td className="py-2 text-slate-300">{tr(PLACE_KEY[p.strategy] ?? "pages.treasury.placeLiquidity")}</td>
                    <td className="py-2 text-right text-slate-300">{p.apyBps ? bps(p.apyBps) : "-"}</td>
                    <td className="py-2 text-right font-medium text-white">{usdBase(p.amountBaseUnits)}</td>
                  </tr>
                ))}
                {snap.positions.length === 0 &&
                  loading &&
                  [0, 1, 2].map((i) => (
                    <tr key={`sk-${i}`} className="table-row">
                      <td className="py-2.5"><Skeleton className="h-4 w-10" /></td>
                      <td className="py-2.5"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-2.5"><div className="flex justify-end"><Skeleton className="h-4 w-12" /></div></td>
                      <td className="py-2.5"><div className="flex justify-end"><Skeleton className="h-4 w-16" /></div></td>
                    </tr>
                  ))}
                {snap.positions.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      {tr("pages.treasury.posEmpty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {accessToken && tenantId ? (
        <TreasuryControls auth={{ accessToken, tenantId }} address={address} config={snap.config} />
      ) : (
        <ConnectGate connect={connect} connecting={connecting} tr={tr} />
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">{tr("pages.treasury.rulesTitle")}</h3>
          <p className="mb-4 text-xs text-slate-400">{tr("pages.treasury.rulesBody")}</p>
          <Rule k={tr("pages.treasury.ruleFloor")} v={cfg ? usdBase(cfg.minLiquidityBaseUnits) : "-"} />
          <Rule k={tr("pages.treasury.ruleMaxYield")} v={cfg ? bps(cfg.maxYieldBps) : "-"} />
          <Rule k={tr("pages.treasury.ruleSensitivity")} v={cfg ? `${cfg.volatilitySensitivity} / 100` : "-"} />
          {/* Plain text codes, no flag emoji: relies on OS-level flag-glyph
              support that's inconsistent across platforms (esp. Windows
              without certain font packages). Was rendering as a
              visually-duplicated "BR BR" when the glyph fell back to its
              literal regional-indicator letters instead of a flag icon. */}
          <Rule k="BR" v={cfg ? bps(cfg.countryLimitsBps.BR ?? 0) : "-"} />
          <Rule k="AR" v={cfg ? bps(cfg.countryLimitsBps.AR ?? 0) : "-"} />
          <Rule k="CO" v={cfg ? bps(cfg.countryLimitsBps.CO ?? 0) : "-"} />
        </Card>

        <Card className="lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-white">{tr("pages.treasury.activityTitle")}</h3>
          <p className="mb-4 text-xs text-slate-400">{tr("pages.treasury.activityBody")}</p>
          <div className="space-y-3">
            {recent.map((d) => (
              <div key={d.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone={d.status === "executed" ? "success" : d.status === "proposed" ? "warn" : "default"}>
                    {d.status}
                  </Badge>
                  <span className="font-mono text-xs text-slate-500">
                    {localDateTime(d.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-300">{d.rationale}</p>
                {d.stellarTxHash && !d.stellarTxHash.startsWith("sim:") ? (
                  <a
                    href={`https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/tx/${d.stellarTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-mono text-xs text-brand hover:underline"
                  >
                    tx {shortHash(d.stellarTxHash, 10, 6)}
                  </a>
                ) : d.stellarTxHash ? (
                  <p className="mt-1 font-mono text-xs text-slate-500 break-all">{d.stellarTxHash}</p>
                ) : null}
              </div>
            ))}
            {recent.length === 0 &&
              activity.loading &&
              [0, 1, 2].map((i) => (
                <div key={`ask-${i}`} className="rounded-lg border border-white/10 bg-ink-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-32" />
                </div>
              ))}
            {recent.length === 0 && !activity.loading && (
              <p className="py-4 text-center text-sm text-slate-500">{tr("pages.treasury.activityEmpty")}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Rule({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 table-row">
      <span className="text-sm text-slate-400">{k}</span>
      <span className="text-sm font-medium text-slate-100">{v}</span>
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
            <rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="17" cy="14" r="1" />
          </svg>
        </span>
        <h3 className="mt-5 text-xl font-semibold text-white">{tr("pages.treasury.connectTitle")}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">{tr("pages.treasury.connectBody")}</p>
        <button className="btn-primary mt-6 px-5 py-2.5" onClick={() => void connect()} disabled={connecting}>
          {connecting ? tr("auth.connecting") : tr("auth.connect")}
        </button>
      </div>
    </div>
  );
}
