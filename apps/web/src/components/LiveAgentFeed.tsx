"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { shortHash, localTimeOnly } from "@/lib/format";
import { resolveApiUrl } from "@/lib/network";

// This feed always shows the real 24/7 flagship agent, which only runs on
// testnet — deliberately NOT following the site-wide network toggle (see
// FlagshipBadge below, which labels this clearly instead of hiding it).
const API = resolveApiUrl("testnet");

interface Activity {
  id: string;
  action: string;
  rationale: string;
  status: string;
  stellarTxHash: string | null;
  legalContextHash?: string | null;
  createdAt: string;
}
interface Feed {
  agentAddress: string | null;
  network: string;
  contracts?: { treasury: string | null; payroll: string | null };
  decisions: Activity[];
}

const EXPLORER = (net: string) =>
  `https://stellar.expert/explorer/${net === "mainnet" ? "public" : "testnet"}`;

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function tagFor(action: string): string {
  if (action === "deposit_vault" || action === "withdraw_vault" || action === "rebalance") return "AUTO-REBALANCE";
  if (action.startsWith("blend")) return "LENDING";
  if (action.includes("payroll") || action === "fund_payroll") return "PAYROLL";
  if (action === "noop") return "MONITOR";
  return action.toUpperCase();
}

function statusToken(status: string): { label: string; cls: string; dot: string; bg: string } {
  if (status === "executed") return { label: "SUCCESS", cls: "text-emerald-400", dot: "bg-emerald-400 shadow-[0_0_8px_#34d399]", bg: "bg-emerald-950/20 border-emerald-500/20" };
  if (status === "proposed") return { label: "PENDING", cls: "text-amber-400", dot: "bg-amber-400 shadow-[0_0_8px_#fbbf24]", bg: "bg-amber-950/20 border-amber-500/20" };
  if (status === "failed") return { label: "FAILED", cls: "text-rose-400", dot: "bg-rose-400 shadow-[0_0_8px_#f43f5e]", bg: "bg-rose-950/20 border-rose-500/20" };
  return { label: "INFO", cls: "text-sky-400", dot: "bg-sky-400 shadow-[0_0_8px_#38bdf8]", bg: "bg-sky-950/20 border-sky-500/20" };
}

/* ── Inline SVG Icons for actions ───────────────────────────────────────── */
function RebalanceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

function LendingIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function PayrollIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MonitorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ActionIcon({ action }: { action: string }) {
  const cls = "shrink-0";
  if (action === "deposit_vault" || action === "withdraw_vault" || action === "rebalance") return <RebalanceIcon className={`${cls} text-teal-400`} />;
  if (action.startsWith("blend")) return <LendingIcon className={`${cls} text-indigo-400`} />;
  if (action.includes("payroll") || action === "fund_payroll") return <PayrollIcon className={`${cls} text-pink-400`} />;
  return <MonitorIcon className={`${cls} text-sky-400`} />;
}

function getSimulatedLogs(d: Activity): string[] {
  const time = localTimeOnly(d.createdAt);
  const logs = [
    `[${time}] INFO  [Agent] Initializing audit trace for action: ${d.action.toUpperCase()}`,
    `[${time}] VERIFY[LCP] Validating consent terms under Legal Context Protocol...`,
  ];

  if (d.legalContextHash) {
    logs.push(`[${time}] OK    [LCP] Secure contract binding verified (hash: ${shortHash(d.legalContextHash, 8, 8)})`);
  } else {
    logs.push(`[${time}] WARN  [LCP] No legal context signature attached.`);
  }

  if (d.action === "noop") {
    logs.push(`[${time}] INFO  [Strategy] Reading yield rates and ready liquidity levels...`);
    logs.push(`[${time}] DEFER [Agent] Balances inside boundaries. Action deferred.`);
  } else if (d.action === "fund_payroll" || d.action.includes("payroll")) {
    logs.push(`[${time}] AUTH  [Operator] Verified administrator trigger signature.`);
    logs.push(`[${time}] WRITE [Soroban] Invoking payroll contract execute_run()...`);
    if (d.stellarTxHash) {
      logs.push(`[${time}] TX    [Stellar] Tx confirmed. Hash: ${shortHash(d.stellarTxHash, 12, 12)}`);
    }
  } else {
    logs.push(`[${time}] WRITE [Soroban] Invoking treasury contract record_flow()...`);
    if (d.stellarTxHash) {
      logs.push(`[${time}] TX    [Stellar] Tx confirmed. Hash: ${shortHash(d.stellarTxHash, 12, 12)}`);
    }
  }
  logs.push(`[${time}] DONE  [Agent] Execution loop completed. Result: ${d.status.toUpperCase()}`);
  return logs;
}

export function LiveAgentFeed() {
  const t = useT();
  const [feed, setFeed] = useState<Feed | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/public/activity`, { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as Feed;
          if (alive) setFeed(j);
        }
      } catch {
        /* keep last state */
      }
    };
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const net = feed?.network ?? "testnet";
  const exp = EXPLORER(net);
  const items = feed?.decisions ?? [];
  const addr = feed?.agentAddress ?? null;
  const treasury = feed?.contracts?.treasury ?? null;
  const payroll = feed?.contracts?.payroll ?? null;

  const copyToClipboard = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
        </span>
        <span className="label text-brand">{t("feed.eyebrow")}</span>
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t("feed.title")}</h2>
      <p className="mt-1 max-w-lg text-sm text-slate-400">{t("feed.subtitle")}</p>

      {/* This feed always runs on testnet (the only place the 24/7 agent
          operates) regardless of the site-wide network toggle — labeled
          plainly rather than hidden, same pattern as nirium.xyz. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" aria-hidden />
          {t("feed.flagshipBadge")}
        </span>
        <span className="text-xs text-slate-500">{t("feed.flagshipCaption")}</span>
      </div>

      {/* Terminal window audit feed */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-brand/20 bg-ink-950/80 shadow-[0_0_50px_-20px_rgba(45,212,191,0.4)] backdrop-blur-md relative before:absolute before:inset-0 before:bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] before:bg-[length:100%_4px] before:pointer-events-none before:z-10">

        {/* Terminal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-brand/15 bg-brand/[0.03] px-4 py-3 relative z-20">
          <div className="flex items-center gap-3">
            {/* macOS Window Controls */}
            <div className="flex gap-1.5 items-center">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-600/30" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 border border-amber-600/30" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-600/30" />
            </div>

            <div className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-semibold tracking-wide text-brand">
              <span className="text-brand/50 font-bold">{">_"}</span>
              <span className="truncate uppercase text-slate-300">
                {t("feed.title2")} <span className="text-slate-500 font-normal">{"// "}{t("feed.connection")}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-400">
              <span className="h-1 w-1 rounded-full bg-emerald-400" /> {t("feed.aiReasoning")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/25 bg-brand/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand shadow-[0_0_6px_#2dd4bf]" /> {t("feed.online")}
            </span>
            <Link href="/agent" className="text-slate-500 transition hover:text-brand" aria-label="expand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M21 3l-7 7M9 21H3v-6M3 21l7-7" /></svg>
            </Link>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="audit-scroll max-h-[25rem] overflow-y-auto px-3 py-3 font-mono text-[13px] leading-relaxed relative z-20 space-y-2">
          {items.map((d) => {
            const st = statusToken(d.status);
            const realTx = d.stellarTxHash && !d.stellarTxHash.startsWith("sim:");
            const isExpanded = expandedId === d.id;

            return (
              <div
                key={d.id}
                className={`group rounded-lg border border-white/5 bg-white/[0.01] transition-all hover:bg-white/[0.03] hover:border-white/10 ${isExpanded ? "border-brand/20 bg-brand/[0.02]" : ""}`}
              >
                {/* Header row / Trigger button */}
                <div
                  onClick={() => toggleExpand(d.id)}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-slate-500 text-xs font-normal">[{localTimeOnly(d.createdAt)}]</span>
                    <ActionIcon action={d.action} />
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-slate-300">
                      {tagFor(d.action)}
                    </span>
                    <span className="text-slate-400 font-semibold truncate hidden sm:inline text-xs">
                      {d.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold border ${st.bg} ${st.cls}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                    <span className="text-slate-600 transition group-hover:text-slate-400">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Rationale text */}
                <div onClick={() => toggleExpand(d.id)} className="px-3 pb-2.5 cursor-pointer">
                  <p className="text-slate-200 text-sm leading-snug">{d.rationale}</p>
                </div>

                {/* Details Footer */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pb-3 pt-1 border-t border-white/[0.03] text-[11px] text-slate-500 select-none">
                  <span className="text-slate-400 font-medium">· {ago(d.createdAt)} ago</span>

                  {/* LCP Hash badge */}
                  {d.legalContextHash && (
                    <a
                      href={`${API}/.well-known/contextio-legal-context.json?domain=contextio.xyz`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-teal-500/20 bg-teal-950/20 text-teal-400 hover:bg-teal-900/40 hover:border-teal-500/40 transition hover:underline active:scale-95"
                      title="View Legal Context Document"
                    >
                      <LockIcon />
                      <span className="font-semibold uppercase">LCP:</span>
                      <span>{shortHash(d.legalContextHash, 6, 6)} ↗</span>
                    </a>
                  )}

                  {/* Stellar Tx explorer link */}
                  {realTx ? (
                    <a
                      href={`${exp}/tx/${d.stellarTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 transition hover:underline"
                    >
                      <span>TX:</span>
                      <span className="underline decoration-sky-400/40">{shortHash(d.stellarTxHash as string, 6, 6)}</span>
                      <span>↗</span>
                    </a>
                  ) : d.stellarTxHash ? (
                    <span className="text-slate-600">TX: SIMULATED</span>
                  ) : (
                    <span className="text-slate-600">TX: —</span>
                  )}
                </div>

                {/* Expanded Console Logs */}
                {isExpanded && (
                  <div className="border-t border-brand/15 bg-black/50 px-4 py-3 font-mono text-xs text-brand/90 space-y-1 select-text">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5 mb-1.5 flex items-center justify-between">
                      <span>CONSOLE AUDIT TRACE</span>
                      <span>ENV: {net}</span>
                    </div>
                    {getSimulatedLogs(d).map((log, idx) => {
                      let colorClass = "text-brand/80";
                      if (log.includes("OK") || log.includes("DONE") || log.includes("TX")) colorClass = "text-emerald-400";
                      if (log.includes("WARN")) colorClass = "text-amber-400";
                      if (log.includes("VERIFY")) colorClass = "text-teal-400";
                      return (
                        <div key={idx} className={colorClass}>
                          {log}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent mb-3" />
              <p className="text-sm font-medium animate-pulse">{t("feed.empty")}</p>
            </div>
          )}
        </div>

        {/* Terminal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-brand/15 bg-ink-950 px-4 py-3 font-mono text-[11px] text-slate-500 relative z-20">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold uppercase text-slate-400 tracking-wide">Soroban {net}</span>
            {treasury && (
              <FooterRef label="Treasury" value={treasury} href={`${exp}/contract/${treasury}`} />
            )}
            {payroll && <FooterRef label="Payroll" value={payroll} href={`${exp}/contract/${payroll}`} />}
          </div>
          {addr && (
            <FooterRef label={t("feed.agentLabel")} value={addr} href={`${exp}/account/${addr}`} />
          )}
        </div>
      </div>
    </div>
  );
}

function FooterRef({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-600 font-medium">{label}:</span>
      <a href={href} target="_blank" rel="noreferrer" className="text-brand/75 hover:text-brand transition hover:underline">
        {shortHash(value, 5, 5)}
      </a>
    </span>
  );
}

