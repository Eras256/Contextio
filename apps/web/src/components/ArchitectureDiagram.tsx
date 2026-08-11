"use client";

import { useNetwork } from "@/lib/network";
import { useT } from "@/lib/i18n";

/**
 * "How the money moves" architecture diagram, terminal/audit aesthetic that
 * matches the LiveAgentFeed (macOS window chrome, grid background, neon nodes,
 * monospace). Pure SVG, no deps. All labels are localized and public-safe.
 *
 * The flow is deliberately drawn so that nothing reaches Stellar without a
 * signing gate: the autonomous agent proposes, then signs through the
 * policy-gated Smart Account; a human-initiated action proposes, then the
 * caller's own wallet signs. Money never passes through Contextio. Reacts to
 * the network pill (testnet/mainnet) so it stays honest about what actually
 * runs where: the agent, the Smart Account, and Contextio's own Soroban
 * contracts are testnet-only until external audit.
 */
export function ArchitectureDiagram() {
  const t = useT();
  const network = useNetwork();
  const isMainnet = network === "mainnet";

  const Box = ({
    x,
    y,
    w,
    h,
    title,
    subtitle,
    accent = "#2dd4bf",
    dim = false,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    subtitle?: string;
    accent?: string;
    dim?: boolean;
  }) => (
    <g filter="url(#nodeShadow)" opacity={dim ? 0.4 : 1}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill="#0a1120"
        stroke={accent}
        strokeOpacity={dim ? 0.35 : 0.6}
        strokeDasharray={dim ? "4 3" : undefined}
      />
      {/* accent top edge for a console-card feel */}
      <rect x={x} y={y} width={w} height={3} rx={1.5} fill={accent} fillOpacity={dim ? 0.25 : 0.55} />
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
      {dim ? (
        <g>
          <rect x={x + w - 78} y={y - 9} width={78} height={16} rx={8} fill="#0a1120" stroke="#fb923c" strokeOpacity={0.6} />
          <text x={x + w - 39} y={y + 2} textAnchor="middle" fill="#fb923c" fontSize="8.5" fontWeight="700" letterSpacing="0.4">
            {t("diagram.testnetOnly").toUpperCase()}
          </text>
        </g>
      ) : null}
    </g>
  );

  const Lane = ({ y, h, label }: { y: number; h: number; label: string }) => (
    <>
      <rect x={14} y={y} width={952} height={h} rx={14} fill="#ffffff" fillOpacity={0.012} stroke="#2dd4bf" strokeOpacity={0.06} />
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
        <svg viewBox="0 0 980 560" className="w-full min-w-[820px]" role="img" aria-label="Contextio architecture flow">
          <defs>
            <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="#2dd4bf" fillOpacity={0.7} />
            </marker>
            <marker id="arrowGold" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto">
              <path d="M0,0 L7,3 L0,6 Z" fill="#f5b54a" fillOpacity={0.9} />
            </marker>
            <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Lanes */}
          <Lane y={20} h={104} label={t("diagram.laneCompany")} />
          <Lane y={144} h={108} label={t("diagram.lanePlatform")} />
          <Lane y={420} h={130} label={t("diagram.laneStellar")} />

          {/* Edges (drawn under nodes) */}
          <g stroke="#2dd4bf" strokeOpacity={0.32} strokeWidth="1.6" fill="none" markerEnd="url(#arrow)">
            {/* Your money -> Assistant (informational: the planner reads your balance) */}
            <path d="M460,102 C400,128 300,138 190,166" opacity={isMainnet ? 0.35 : 1} strokeDasharray={isMainnet ? "4 3" : undefined} />
            {/* Your money -> Engine (informational, same reason) */}
            <path d="M490,102 L490,166" />
            {/* Engine -> Records */}
            <path d="M590,198 L690,198" />
            {/* Oracle -> Engine (price feed, no funds) */}
            <path d="M722,420 C650,340 560,270 494,230" />
            {/* Assistant -> Smart Account: the autonomous path's signing gate */}
            <path
              d="M190,230 L257,420"
              opacity={isMainnet ? 0.35 : 1}
              strokeDasharray={isMainnet ? "4 3" : undefined}
            />
          </g>

          {/* Engine -> Your wallet: the human-initiated path's signing gate. Gold,
              deliberately the most visually distinct edge in the diagram, because
              this is the one that proves money never passes through Contextio. */}
          <g stroke="#f5b54a" strokeOpacity={0.6} strokeWidth="2" fill="none" markerEnd="url(#arrowGold)">
            <path d="M490,230 L490,282" />
          </g>

          {/* Your wallet -> Stellar lane: only after the signature exists */}
          <g stroke="#f5b54a" strokeOpacity={0.4} strokeWidth="1.6" fill="none" markerEnd="url(#arrowGold)">
            <path d="M420,356 C280,375 180,395 103,420" />
            <path d="M460,356 L413,420" />
            <path d="M520,356 L568,420" />
            <path d="M560,356 C700,375 800,395 878,420" />
          </g>

          {/* Company */}
          <Box x={390} y={46} w={200} h={56} title={t("diagram.treasuryTitle")} subtitle={t("diagram.treasurySub")} accent="#38bdf8" />

          {/* Platform */}
          <Box x={90} y={166} w={200} h={64} title={t("diagram.agentTitle")} subtitle={t("diagram.agentSub")} accent="#a78bfa" dim={isMainnet} />
          <Box x={390} y={166} w={200} h={64} title={t("diagram.engineTitle")} subtitle={t("diagram.engineSub")} accent="#2dd4bf" />
          <Box x={690} y={166} w={200} h={64} title={t("diagram.recordsTitle")} subtitle={t("diagram.recordsSub")} accent="#34d399" />

          {/* Signing gate: the caller's own wallet, never Contextio's key */}
          <text x={512} y={262} textAnchor="start" fill="#f5b54a" fillOpacity={0.8} fontSize="9.5" fontWeight="700" letterSpacing="1.5" fontFamily="ui-monospace, monospace">
            {t("diagram.walletLabel")}
          </text>
          <Box x={390} y={282} w={200} h={54} title={t("diagram.walletTitle")} subtitle={t("diagram.walletSub")} accent="#f5b54a" />

          {/* LCP binding chip (cross-cutting) */}
          <rect x={340} y={356} width={300} height={26} rx={13} fill="#a78bfa" fillOpacity={0.14} stroke="#a78bfa" strokeOpacity={0.55} />
          <text x={490} y={373} textAnchor="middle" fill="#c4b5fd" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">
            {t("diagram.binding")}
          </text>

          {/* Stellar, six nodes, 145px wide with 10px gaps */}
          <Box x={30} y={452} w={145} h={56} title={t("diagram.contractsTitle")} subtitle={t("diagram.contractsSub")} accent="#2dd4bf" dim={isMainnet} />
          <Box x={185} y={452} w={145} h={56} title={t("diagram.smartAccountTitle")} subtitle={t("diagram.smartAccountSub")} accent="#34d399" dim={isMainnet} />
          <Box x={340} y={452} w={145} h={56} title={t("diagram.savingsTitle")} subtitle={t("diagram.savingsSub")} accent="#f5b54a" />
          <Box x={495} y={452} w={145} h={56} title={t("diagram.lendingTitle")} subtitle={t("diagram.lendingSub")} accent="#fb923c" />
          <Box x={650} y={452} w={145} h={56} title={t("diagram.oracleTitle")} subtitle={t("diagram.oracleSub")} accent="#a78bfa" />
          <Box x={805} y={452} w={145} h={56} title={t("diagram.payoutsTitle")} subtitle={t("diagram.payoutsSub")} accent="#38bdf8" />
        </svg>
      </div>
    </div>
  );
}
