"use client";

import { useT } from "@/lib/i18n";

/**
 * "How the money moves" architecture diagram — terminal/audit aesthetic that
 * matches the LiveAgentFeed (macOS window chrome, grid background, neon nodes,
 * monospace). Pure SVG, no deps. All labels are localized and public-safe:
 * your money → smart assistant + Contextio engine → Stellar contracts, DeFindex
 * (XLM yield), Blend (USDC lending) and local payouts, with LCP-signed rules.
 */
export function ArchitectureDiagram() {
  const t = useT();

  const Box = ({
    x,
    y,
    w,
    h,
    title,
    subtitle,
    accent = "#2dd4bf",
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    subtitle?: string;
    accent?: string;
  }) => (
    <g filter="url(#nodeShadow)">
      <rect x={x} y={y} width={w} height={h} rx={12} fill="#0a1120" stroke={accent} strokeOpacity={0.6} />
      {/* accent top edge for a console-card feel */}
      <rect x={x} y={y} width={w} height={3} rx={1.5} fill={accent} fillOpacity={0.55} />
      <text x={x + w / 2} y={y + (subtitle ? h / 2 + 1 : h / 2 + 5)} textAnchor="middle" fill="#f1f5f9" fontSize="13.5" fontWeight="700">
        {title}
      </text>
      {subtitle ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 17}
          textAnchor="middle"
          fill={accent}
          fillOpacity={0.85}
          fontSize="10"
          fontFamily="ui-monospace, monospace"
        >
          {subtitle}
        </text>
      ) : null}
    </g>
  );

  const Lane = ({ y, label }: { y: number; label: string }) => (
    <>
      <rect x={14} y={y} width={952} height={120} rx={14} fill="#ffffff" fillOpacity={0.012} stroke="#2dd4bf" strokeOpacity={0.06} />
      <text x={28} y={y + 22} fill="#5eead4" fillOpacity={0.65} fontSize="10.5" fontWeight="600" letterSpacing="1.5" fontFamily="ui-monospace, monospace">
        {label.toUpperCase()}
      </text>
    </>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-ink-950/80 shadow-[0_0_50px_-20px_rgba(45,212,191,0.4)] backdrop-blur-md relative before:absolute before:inset-0 before:bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] before:bg-[length:100%_4px] before:pointer-events-none before:z-10">
      {/* Terminal header */}
      <div className="flex items-center justify-between gap-3 border-b border-brand/15 bg-brand/[0.03] px-4 py-3 relative z-20">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border border-rose-600/30 bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full border border-amber-600/30 bg-amber-500/80" />
            <span className="h-3 w-3 rounded-full border border-emerald-600/30 bg-emerald-500/80" />
          </div>
          <div className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-semibold tracking-wide">
            <span className="font-bold text-brand/50">{">_"}</span>
            <span className="truncate uppercase text-slate-300">
              {t("diagram.header")} <span className="font-normal text-slate-500">{"// CONTEXTIO"}</span>
            </span>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand/25 bg-brand/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand shadow-[0_0_6px_#2dd4bf]" /> {t("feed.online")}
        </span>
      </div>

      {/* Diagram body on grid */}
      <div className="audit-grid audit-scroll relative z-20 overflow-x-auto px-3 py-4">
        <svg viewBox="0 0 980 470" className="w-full min-w-[820px]" role="img" aria-label="Contextio architecture flow">
          <defs>
            <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="#2dd4bf" fillOpacity={0.7} />
            </marker>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Lanes */}
          <Lane y={30} label={t("diagram.laneCompany")} />
          <Lane y={168} label={t("diagram.lanePlatform")} />
          <Lane y={318} label={t("diagram.laneStellar")} />

          {/* Edges (drawn under nodes) */}
          <g stroke="#2dd4bf" strokeOpacity={0.32} strokeWidth="1.6" fill="none" markerEnd="url(#arrow)">
            <path d="M520,112 C430,148 340,150 296,178" />
            <path d="M570,112 L570,176" />
            <path d="M670,210 L757,210" />
            <path d="M280,242 L110,348" />
            <path d="M490,242 L250,348" />
            <path d="M500,242 L400,348" />
            <path d="M550,242 L560,348" />
            <path d="M710,348 L590,242" />
            <path d="M640,242 L860,348" />
          </g>

          {/* Company */}
          <Box x={470} y={52} w={200} h={60} title={t("diagram.treasuryTitle")} subtitle={t("diagram.treasurySub")} accent="#38bdf8" />

          {/* Platform */}
          <Box x={180} y={178} w={200} h={64} title={t("diagram.agentTitle")} subtitle={t("diagram.agentSub")} accent="#a78bfa" />
          <Box x={470} y={178} w={200} h={64} title={t("diagram.engineTitle")} subtitle={t("diagram.engineSub")} accent="#2dd4bf" />
          <Box x={760} y={178} w={200} h={64} title={t("diagram.recordsTitle")} subtitle={t("diagram.recordsSub")} accent="#34d399" />

          {/* Stellar — six nodes, 145px wide with 10px gaps, fits the same lane width as before */}
          <Box x={30} y={348} w={145} h={64} title={t("diagram.contractsTitle")} subtitle={t("diagram.contractsSub")} accent="#2dd4bf" />
          <Box x={185} y={348} w={145} h={64} title={t("diagram.smartAccountTitle")} subtitle={t("diagram.smartAccountSub")} accent="#34d399" />
          <Box x={340} y={348} w={145} h={64} title={t("diagram.savingsTitle")} subtitle={t("diagram.savingsSub")} accent="#f5b54a" />
          <Box x={495} y={348} w={145} h={64} title={t("diagram.lendingTitle")} subtitle={t("diagram.lendingSub")} accent="#fb923c" />
          <Box x={650} y={348} w={145} h={64} title={t("diagram.oracleTitle")} subtitle={t("diagram.oracleSub")} accent="#a78bfa" />
          <Box x={805} y={348} w={145} h={64} title={t("diagram.payoutsTitle")} subtitle={t("diagram.payoutsSub")} accent="#38bdf8" />

          {/* LCP binding chip (cross-cutting) */}
          <rect x={420} y={280} width={300} height={30} rx={15} fill="#a78bfa" fillOpacity={0.12} stroke="#a78bfa" strokeOpacity={0.5} />
          <text x={570} y={299} textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
            {t("diagram.binding")}
          </text>
        </svg>
      </div>
    </div>
  );
}
