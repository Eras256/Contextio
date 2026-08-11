import type { ReactNode } from "react";

/** Small, dependency-free UI primitives shared across feature pages. */

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Emphasize as the primary KPI (larger value). */
  accent?: boolean;
}) {
  return (
    <div>
      <div className="label flex items-center gap-1.5">{label}</div>
      <div className={`mt-1 font-semibold tracking-tight text-white ${accent ? "text-3xl" : "stat-value"}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

/**
 * Inline help: a small "i" that reveals a plain-language explanation on hover
 * or keyboard focus. Built for people who've never touched web3: every piece
 * of jargon on a screen should be one hover away from a human explanation.
 */
export function Info({ text, label }: { text: string; label?: string }) {
  return (
    <span className="group/info relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ?? "More information"}
        className="grid h-4 w-4 place-items-center rounded-full border border-white/20 text-[10px] font-semibold leading-none text-slate-400 transition hover:border-brand/60 hover:text-brand focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 max-w-[70vw] -translate-x-1/2 rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-slate-300 opacity-0 shadow-card backdrop-blur transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Shimmering placeholder shown while real data loads (no jarring zero-flash). */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.07] ${className}`} aria-hidden />;
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warn" | "info" | "agent";
}) {
  const tones: Record<string, string> = {
    default: "border-white/10 bg-white/5 text-slate-300",
    success: "border-brand/30 bg-brand/10 text-brand",
    warn: "border-accent-gold/30 bg-accent-gold/10 text-accent-gold",
    info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    agent: "border-accent/30 bg-accent/10 text-accent",
  };
  return <span className={`pill ${tones[tone]}`}>{children}</span>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="label mb-2 flex items-center gap-2 text-brand">
            <span className="h-px w-6 bg-brand/50" aria-hidden />
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-[-0.01em] text-white sm:text-4xl">{title}</h1>
        {description ? <p className="mt-2.5 max-w-2xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function AllocationBar({ yieldShareBps }: { yieldShareBps: number }) {
  const yieldPct = Math.min(100, Math.max(0, yieldShareBps / 100));
  const liquidPct = 100 - yieldPct;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full border border-white/10">
        <div className="bg-sky-400/80" style={{ width: `${liquidPct}%` }} aria-label="Liquidity" />
        <div className="bg-brand/80" style={{ width: `${yieldPct}%` }} aria-label="Yield" />
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-400">
        <span>Liquidity {liquidPct.toFixed(1)}%</span>
        <span>Yield {yieldPct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

export function DataBadge({ live, loading }: { live: boolean; loading: boolean }) {
  if (loading) return <Badge>Loading...</Badge>;
  return live ? (
    <Badge tone="success">● Live data</Badge>
  ) : (
    <Badge tone="warn">Demo data, sign in</Badge>
  );
}

/**
 * Slim banner shown above a page's real, public demo-tenant data when nobody
 * is signed in. Lets a visitor see the live page without a wallet, while
 * making clear it's the shared demo tenant, not their own account, and that
 * the interactive controls further down need a connected wallet.
 */
export function DemoDataNotice({
  message,
  connect,
  connecting,
  connectLabel,
  connectingLabel,
}: {
  message: string;
  connect: () => void | Promise<void>;
  connecting: boolean;
  connectLabel: string;
  connectingLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-slate-300">
      <span>{message}</span>
      <button className="btn-primary shrink-0 px-4 py-1.5 text-xs" onClick={() => void connect()} disabled={connecting}>
        {connecting ? connectingLabel : connectLabel}
      </button>
    </div>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 table-row">
      <span className="text-sm text-slate-400">{k}</span>
      <span className="text-sm font-medium text-slate-100">{v}</span>
    </div>
  );
}
