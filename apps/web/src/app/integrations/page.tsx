"use client";

import { useEffect, useState } from "react";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { bps } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { resolveApiUrl, useNetwork } from "@/lib/network";

type Status = "live" | "mock" | "ready" | "prod" | "pending";

/** Loading → the fetch hasn't resolved yet. Off → the API answered but said
 *  `live:false` (not configured / not offered on this network) — distinct
 *  from "still connecting" so the badge never lies by omission. */
type Fetched<T> = { s: "loading" } | { s: "off"; reason?: string } | { s: "live"; v: T };

const API = resolveApiUrl();

interface LiveVault {
  vaultId: string;
  name: string;
  asset: string;
  strategy: string;
  apyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

interface BlendVault {
  poolId: string;
  asset: string;
  supplyApyBps: number;
  tvlBaseUnits: string;
  positionBaseUnits: string;
  network: string;
}

const xlm = (stroops: string) =>
  `${(Number(stroops) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

interface AnchorInfo {
  anchor: string;
  withdraw: string[];
  deposit: string[];
  protocols: string[];
  transferServer: string | null;
}

interface Sep38Info {
  sellAsset: string;
  prices: { buy_assets?: { asset: string; price: string; decimals: number }[] };
}

interface Sep31Info {
  info: { receive?: Record<string, unknown> };
}

const SMART_ACCOUNT_ID = "CAMEOVPRT3PISVDQ5R6JY6NFUFQDR25AR6UV4IS5HXPNMHLDFN46DCID";
const SPENDING_LIMIT_POLICY_ID = "CDDF3B2SPJFZVSAYWXJ3ROHJDKDW667HIRTP34CROWHZHEUEWK7K45AL";

export default function IntegrationsPage() {
  const t = useT();
  const network = useNetwork();
  const [vault, setVault] = useState<Fetched<LiveVault>>({ s: "loading" });
  const [blend, setBlend] = useState<Fetched<BlendVault>>({ s: "loading" });
  const [anchor, setAnchor] = useState<Fetched<AnchorInfo>>({ s: "loading" });
  const [sep38, setSep38] = useState<Fetched<Sep38Info>>({ s: "loading" });
  const [sep31, setSep31] = useState<Fetched<Sep31Info>>({ s: "loading" });
  const [relayer, setRelayer] = useState<Fetched<{ provider: string }>>({ s: "loading" });
  const [offramp, setOfframp] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [health, setHealth] = useState<{ api: boolean; supabase: boolean; stellar: boolean; agent: boolean } | null>(null);
  const [oracle, setOracle] = useState<{ live: boolean; source: string; network: string; xlm: number | null } | null>(null);

  useEffect(() => {
    let alive = true;
    // Real infra health: /readyz reports Supabase + Stellar RPC; recent agent
    // activity (a decision in the last ~20 min) proves the 24/7 agent is alive.
    void Promise.all([
      fetch(`${API}/readyz`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`${API}/api/v1/public/activity`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([ready, activity]) => {
      if (!alive) return;
      const checks = (ready?.checks ?? {}) as Record<string, { ok?: boolean }>;
      const last = activity?.decisions?.[0]?.createdAt as string | undefined;
      const agentLive = last ? Date.now() - new Date(last).getTime() < 20 * 60_000 : false;
      setHealth({
        api: Boolean(ready),
        supabase: Boolean(checks.supabase?.ok),
        stellar: Boolean(checks.stellar?.ok),
        agent: agentLive,
      });
    });
    // Generic tri-state fetch: distinguishes "still loading" from an explicit
    // `live:false` from the API (not configured on this network) — the badge
    // must never keep showing "Ready" forever when the answer was really "no".
    function grab<T>(path: string, extract: (j: Record<string, unknown>) => T | null, set: (v: Fetched<T>) => void) {
      fetch(`${API}/api/v1/public/${path}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: Record<string, unknown> | null) => {
          if (!alive) return;
          if (!j || !j.live) {
            set({ s: "off", reason: typeof j?.reason === "string" ? j.reason : undefined });
            return;
          }
          const v = extract(j);
          if (v) set({ s: "live", v });
          else set({ s: "off" });
        })
        .catch(() => {
          if (alive) set({ s: "off" });
        });
    }
    grab("defindex", (j) => (j.vault as LiveVault) ?? null, setVault);
    grab("blend", (j) => (j.vault as BlendVault) ?? null, setBlend);
    grab("anchor", (j) => j as unknown as AnchorInfo, setAnchor);
    grab("anchor/sep38", (j) => ({ sellAsset: j.sellAsset as string, prices: j.prices as Sep38Info["prices"] }), setSep38);
    grab("anchor/sep31", (j) => ({ info: j.info as Sep31Info["info"] }), setSep31);
    grab("relayer", (j) => ({ provider: j.provider as string }), setRelayer);
    fetch(`${API}/api/v1/public/oracle`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) setOracle({ live: j.live, source: j.source, network: j.network, xlm: j.prices?.XLM ?? null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Combined status for the SEP-31/38 card: "live" if either protocol answered,
  // "loading" while both are still in flight, "off" (with whichever reason is
  // available) only once both have definitively answered no.
  const sep3138: Fetched<null> =
    sep38.s === "live" || sep31.s === "live"
      ? { s: "live", v: null }
      : sep38.s === "loading" || sep31.s === "loading"
        ? { s: "loading" }
        : { s: "off", reason: (sep38.s === "off" && sep38.reason) || (sep31.s === "off" && sep31.reason) || undefined };

  const explorer = (id: string, net: string) =>
    `https://stellar.expert/explorer/${net === "mainnet" ? "public" : "testnet"}/contract/${id}`;

  // Real SEP-24 off-ramp: the API does SEP-10 auth + interactive withdraw and
  // returns the anchor's hosted page, which we open in a new tab.
  const startOfframp = async () => {
    setOfframp({ loading: true, error: null });
    try {
      const r = (await fetch(`${API}/api/v1/public/anchor/withdraw?asset=USDC`, { cache: "no-store" }).then((x) =>
        x.json(),
      )) as { ok?: boolean; url?: string; error?: string };
      if (r?.ok && r.url) {
        window.open(r.url, "_blank", "noopener");
        setOfframp({ loading: false, error: null });
      } else {
        setOfframp({ loading: false, error: r?.error ?? "Off-ramp failed" });
      }
    } catch (e) {
      setOfframp({ loading: false, error: e instanceof Error ? e.message : "Network error" });
    }
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow={t("pages.integrations.eyebrow")}
        title={t("pages.integrations.title")}
        description={t("pages.integrations.desc")}
      />

      {/* Where spare cash earns */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.yieldTitle")} body={t("pages.integrations.yieldBody")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Real DeFindex vault */}
          <Card className="flex flex-col sm:col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.defindexName")}</span>
              <FetchedBadge t={t} f={vault} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {t("pages.integrations.defindexBody")}
            </p>
            {vault.s === "live" ? (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row k={t("pages.integrations.dfxApy")} v={<span className="font-semibold text-brand">{bps(vault.v.apyBps)}</span>} />
                <Row k={t("pages.integrations.dfxTvl")} v={<span className="font-mono text-slate-300">{xlm(vault.v.tvlBaseUnits)} {vault.v.asset}</span>} />
                <Row k={t("pages.integrations.dfxPosition")} v={<span className="font-mono text-slate-300">{xlm(vault.v.positionBaseUnits)} {vault.v.asset}</span>} />
                <Row k="Strategy" v={<span className="text-slate-300">{vault.v.strategy}</span>} />
                <a
                  className="mt-2 inline-flex font-mono text-accent hover:underline"
                  href={explorer(vault.v.vaultId, vault.v.network)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pages.integrations.dfxView")} ↗
                </a>
              </div>
            ) : (
              <FetchedFooter t={t} f={vault} />
            )}
          </Card>

          {/* Real Blend pool */}
          <Card className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.blendName")}</span>
              <FetchedBadge t={t} f={blend} />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.blendBody")}</p>
            {blend.s === "live" ? (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row k={t("pages.integrations.dfxApy")} v={<span className="font-semibold text-brand">{bps(blend.v.supplyApyBps)}</span>} />
                <Row k={t("pages.integrations.dfxTvl")} v={<span className="font-mono text-slate-300">{xlm(blend.v.tvlBaseUnits)} {blend.v.asset}</span>} />
                <Row k={t("pages.integrations.dfxPosition")} v={<span className="font-mono text-slate-300">{xlm(blend.v.positionBaseUnits)} {blend.v.asset}</span>} />
                <a
                  className="mt-2 inline-flex font-mono text-accent hover:underline"
                  href={explorer(blend.v.poolId, blend.v.network)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pages.integrations.dfxView")} ↗
                </a>
              </div>
            ) : (
              <FetchedFooter t={t} f={blend} />
            )}
          </Card>

          {/* Reflector on-chain price oracle */}
          <Card className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.reflectorName")}</span>
              <Badge tone={oracle?.live ? "success" : "warn"}>
                {t(oracle?.live ? "pages.integrations.statusLive" : "pages.integrations.statusReady")}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.reflectorBody")}</p>
            {oracle?.live ? (
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row k="XLM / USD" v={<span className="font-mono font-semibold text-brand">${oracle.xlm?.toFixed(4)}</span>} />
                <a
                  className="mt-2 inline-flex font-mono text-accent hover:underline"
                  href={explorer(oracle.source, oracle.network)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("pages.integrations.oracleView")} ↗
                </a>
              </div>
            ) : (
              <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">{t("auth.connecting")}</div>
            )}
          </Card>
        </div>
      </section>

      {/* How your team gets paid */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.railsTitle")} body={t("pages.integrations.railsBody")} />

        {/* Real SEP-24 off-ramp anchor */}
        <Card className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-white">{t("pages.integrations.anchorName")}</span>
            <FetchedBadge t={t} f={anchor} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.anchorBody")}</p>
          {anchor.s === "live" ? (
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
              <Row k="Anchor" v={<span className="font-mono text-slate-300">{anchor.v.anchor}</span>} />
              <Row k="Off-ramp" v={<span className="font-mono text-slate-300">{anchor.v.withdraw.join(" · ")}</span>} />
              <Row k="Protocols" v={<span className="font-mono text-slate-300">{anchor.v.protocols.join(" · ")}</span>} />
            </div>
          ) : (
            <FetchedFooter t={t} f={anchor} />
          )}
          <button
            onClick={() => void startOfframp()}
            disabled={offramp.loading}
            className="btn-primary mt-3 self-start px-4 py-2 text-xs disabled:opacity-40"
          >
            {offramp.loading ? t("auth.connecting") : t("pages.integrations.offrampCta")}
          </button>
          {offramp.error && <p className="mt-2 break-words text-[11px] text-red-400">{offramp.error}</p>}
        </Card>

        {/* Real SEP-31/38 institutional settlement discovery */}
        <Card className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <span className="font-medium text-white">{t("pages.integrations.sep3138Name")}</span>
            <FetchedBadge t={t} f={sep3138} />
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.sep3138Body")}</p>
          {sep38.s === "live" || sep31.s === "live" ? (
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
              {sep38.s === "live" &&
                (sep38.v.prices.buy_assets ?? []).map((p) => (
                  <Row
                    key={p.asset}
                    k={`${sep38.v.sellAsset.replace("stellar:", "")} → ${p.asset.replace("iso4217:", "")}`}
                    v={<span className="font-mono font-semibold text-brand">{Number(p.price).toFixed(4)}</span>}
                  />
                ))}
              {sep31.s === "live" && (
                <Row
                  k={t("pages.integrations.sep31AssetsLabel")}
                  v={
                    <span className="font-mono text-slate-300">
                      {Object.keys(sep31.v.info.receive ?? {}).join(" · ") || t("pages.integrations.sep31Empty")}
                    </span>
                  }
                />
              )}
            </div>
          ) : (
            <FetchedFooter t={t} f={sep3138} />
          )}
        </Card>

        <div className="grid gap-4 sm:grid-cols-3">
          <IntegrationCard t={t} name={t("pages.integrations.pixName")} body={t("pages.integrations.pixBody")} status="pending" />
          <IntegrationCard t={t} name={t("pages.integrations.transfersName")} body={t("pages.integrations.transfersBody")} status="pending" />
          <IntegrationCard t={t} name={t("pages.integrations.brebName")} body={t("pages.integrations.brebBody")} status="pending" />
        </div>
      </section>

      {/* Security & custody — how the agent operates without a hot key */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.custodyTitle")} body={t("pages.integrations.custodyBody")} />
        <div className="grid gap-4 sm:grid-cols-2">
          {network === "testnet" && (
            <Card className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-white">{t("pages.integrations.smartAccountName")}</span>
                <Badge tone="success">{t("pages.integrations.statusLive")}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.smartAccountBody")}</p>
              <div className="mt-3 space-y-1.5 border-t border-white/5 pt-3 text-xs">
                <Row
                  k={t("pages.integrations.smartAccountSigner")}
                  v={
                    <a className="font-mono text-accent hover:underline" href={explorer(SMART_ACCOUNT_ID, "testnet")} target="_blank" rel="noreferrer">
                      {SMART_ACCOUNT_ID.slice(0, 8)}…{SMART_ACCOUNT_ID.slice(-4)} ↗
                    </a>
                  }
                />
                <Row
                  k={t("pages.integrations.smartAccountPolicy")}
                  v={
                    <a className="font-mono text-accent hover:underline" href={explorer(SPENDING_LIMIT_POLICY_ID, "testnet")} target="_blank" rel="noreferrer">
                      {SPENDING_LIMIT_POLICY_ID.slice(0, 8)}…{SPENDING_LIMIT_POLICY_ID.slice(-4)} ↗
                    </a>
                  }
                />
                <Row k={t("pages.integrations.smartAccountCap")} v={<span className="font-mono font-semibold text-brand">100 USDC / day</span>} />
              </div>
            </Card>
          )}

          {/* Real OpenZeppelin Channels fee-sponsorship status */}
          <Card className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-white">{t("pages.integrations.relayerName")}</span>
              <Badge tone={relayer.s === "live" ? "success" : "info"}>
                {relayer.s === "live" ? t("pages.integrations.statusLive") : t("pages.integrations.statusNotConfigured")}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">{t("pages.integrations.relayerBody")}</p>
          </Card>
        </div>
      </section>

      {/* Under the hood — these are genuinely live */}
      <section className="space-y-4">
        <Header title={t("pages.integrations.infraTitle")} body={t("pages.integrations.infraBody")} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HealthTile name="Stellar · Soroban" detail={network} live={health ? health.stellar : null} t={t} />
          <HealthTile name="Supabase" detail="Postgres · Auth · Realtime" live={health ? health.supabase : null} t={t} />
          <HealthTile
            name="Fly.io · API"
            detail={network === "mainnet" ? "gru · contextio-api-mainnet" : "gru · contextio-api"}
            live={health ? health.api : null}
            t={t}
          />
          {network === "testnet" && (
            <HealthTile name="Fly.io · Agent" detail="gru · contextio-agent" live={health ? health.agent : null} t={t} />
          )}
        </div>
      </section>

      <p className="rounded-2xl border border-white/10 bg-ink-900/40 p-4 text-xs leading-relaxed text-slate-400">
        {t("pages.integrations.note")}
      </p>
    </div>
  );
}

function Header({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm text-slate-400">{body}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <div className="text-right">{v}</div>
    </div>
  );
}

/** Badge for a `Fetched<T>` value: loading = info dot, live = success,
 *  off = warn — never stuck showing "Ready" once the API has actually said no. */
function FetchedBadge({ t, f }: { t: (k: string) => string; f: { s: "loading" | "off" | "live" } }) {
  if (f.s === "live") return <Badge tone="success">{t("pages.integrations.statusLive")}</Badge>;
  if (f.s === "off") return <Badge tone="warn">{t("pages.integrations.statusUnavailable")}</Badge>;
  return <Badge tone="info">{t("auth.connecting")}</Badge>;
}

/** Footer text under a not-yet-live card: shows the API's own reason on mainnet
 *  gates, otherwise a generic connecting/unavailable message. */
function FetchedFooter({ t, f }: { t: (k: string) => string; f: { s: "loading" | "off" | "live"; reason?: string } }) {
  return (
    <div className="mt-3 border-t border-white/5 pt-3 text-xs text-slate-500">
      {f.s === "loading" ? t("auth.connecting") : f.reason ?? t("pages.integrations.statusUnavailable")}
    </div>
  );
}

const STATUS_TONE: Record<Status, "success" | "warn" | "info"> = { live: "success", mock: "warn", ready: "info", prod: "info", pending: "warn" };
const STATUS_KEY: Record<Status, string> = {
  live: "pages.integrations.statusLive",
  mock: "pages.integrations.statusMock",
  ready: "pages.integrations.statusReady",
  prod: "pages.integrations.statusProd",
  pending: "pages.integrations.statusPending",
};

function IntegrationCard({
  t,
  name,
  body,
  status,
  metric,
  sub,
}: {
  t: (k: string) => string;
  name: string;
  body: string;
  status: Status;
  metric?: string;
  sub?: string;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-white">{name}</span>
        <Badge tone={STATUS_TONE[status]}>{t(STATUS_KEY[status])}</Badge>
      </div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-400">{body}</p>
      {(metric || sub) && (
        <div className="mt-3 flex items-baseline justify-between border-t border-white/5 pt-3">
          {metric && <span className="text-sm font-semibold text-brand">{metric}</span>}
          {sub && <span className="font-mono text-xs text-slate-500">{sub}</span>}
        </div>
      )}
    </Card>
  );
}

function HealthTile({
  name,
  detail,
  live,
  t,
}: {
  name: string;
  detail: string;
  /** true = up, false = down, null = still checking. */
  live: boolean | null;
  t: (k: string) => string;
}) {
  const label =
    live === null ? t("auth.connecting") : live ? t("pages.integrations.statusLive") : t("pages.integrations.statusDown");
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-white">{name}</span>
        <span className="relative flex h-2.5 w-2.5">
          {live !== false && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${live ? "bg-brand/70" : "bg-slate-400/50"}`} />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${live === false ? "bg-slate-600" : live === null ? "bg-slate-400" : "bg-brand"}`} />
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
      <p className={`mt-2 text-xs font-medium ${live === false ? "text-slate-500" : "text-brand"}`}>{label}</p>
    </div>
  );
}
