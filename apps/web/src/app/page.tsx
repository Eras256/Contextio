"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { LiveAgentFeed } from "@/components/LiveAgentFeed";
import { Reveal } from "@/components/Reveal";
import { useT } from "@/lib/i18n";

// 3D hero: client-only, lazy chunk, with a gradient poster while it loads.
const Hero3D = dynamic(() => import("@/components/Hero3D").then((m) => m.Hero3D), {
  ssr: false,
  loading: () => <div className="absolute inset-0 hero-poster" />,
});

export default function HomePage() {
  const t = useT();

  return (
    <div className="space-y-16 sm:space-y-24 lg:space-y-28">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative grid items-center gap-10 pt-4 sm:pt-6 lg:pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <div className="relative z-10">
          <div className="animate-fade-up mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/30 bg-brand/5 p-1.5 shadow-[0_0_12px_rgba(34,211,165,0.06)] animate-float">
              <img src="/logo-icon.png" alt="Contextio Logo" className="h-full w-full object-contain" />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="pill border-brand/30 bg-brand/10 text-brand">● {t("hero.badge1")}</span>
              <span className="pill border-accent/30 bg-accent/10 text-accent">{t("hero.badge2")}</span>
            </div>
          </div>
          <h1
            className="animate-fade-up text-balance text-[34px] leading-[1.05] sm:text-5xl sm:leading-[0.98] lg:text-7xl font-semibold tracking-[-0.02em] text-white"
            style={{ animationDelay: "80ms" }}
          >
            {t("hero.title")}
          </h1>
          <p
            className="animate-fade-up mt-4 sm:mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg"
            style={{ animationDelay: "160ms" }}
          >
            {t("hero.subtitle")}
          </p>
          <div className="animate-fade-up mt-6 sm:mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <Link href="/treasury" className="btn-primary px-5 py-2.5 text-[15px]">
              {t("hero.ctaPrimary")}
            </Link>
            <a href="#how" className="btn-ghost px-5 py-2.5 text-[15px]">
              {t("hero.ctaSecondary")}
            </a>
          </div>
          <p className="animate-fade-up mt-4 sm:mt-5 flex items-center gap-2 text-xs text-slate-400" style={{ animationDelay: "320ms" }}>
            <LockIcon />
            {t("hero.trust")}
          </p>
          <div
            className="animate-fade-up mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400"
            style={{ animationDelay: "360ms" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" aria-hidden />
              {t("hero.networkMainnet")}
            </span>
            <span className="text-slate-600" aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" aria-hidden />
              {t("hero.networkTestnet")}
            </span>
          </div>
        </div>

        {/* 3D panel */}
        <div className="animate-fade-up relative" style={{ animationDelay: "200ms" }}>
          {/* dual nebula glows behind the panel */}
          <div className="animate-glow pointer-events-none absolute left-1/2 top-1/2 -z-10 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/25 blur-[100px]" />
          <div className="pointer-events-none absolute -right-6 top-6 -z-10 h-40 w-40 rounded-full bg-accent/20 blur-[80px]" />
          {/* gradient hairline frame */}
          <div className="mx-auto w-full max-w-md rounded-[30px] bg-gradient-to-br from-brand/50 via-accent/25 to-sky-400/40 p-px shadow-[0_30px_80px_-30px_rgba(45,212,191,0.35)] sm:max-w-lg">
            <div className="relative aspect-square w-full overflow-hidden rounded-[29px] bg-ink-950 lg:aspect-[4/5]">
              <div className="pointer-events-none absolute inset-0 hero-poster" />
              <Hero3D className="absolute inset-0" />
              {/* Floating active node badge with new logo */}
              <div className="absolute left-3 top-3 sm:left-6 sm:top-6 z-10 flex items-center gap-2 sm:gap-2.5 rounded-xl sm:rounded-2xl border border-white/10 bg-ink-950/45 px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-md transition-all duration-300 hover:border-brand/40">
                <div className="relative h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 animate-pulse">
                  <img src="/logo-icon.png" alt="Contextio Node" className="h-full w-full object-contain" />
                </div>
                <div className="text-left">
                  <div className="text-[9px] sm:text-[11px] font-semibold text-white/90">Contextio Engine</div>
                  <div className="text-[8px] sm:text-[9px] font-semibold text-brand tracking-wider uppercase flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand animate-ping" />
                    Active Node
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950/80 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Live agent feed ──────────────────────────────────────────────── */}
      <section>
        <LiveAgentFeed />
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Reveal id="how">
        <SectionEyebrow eyebrow={t("steps.eyebrow")} title={t("steps.title")} />
        <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <StepCard n="1" tone="brand" title={t("steps.s1Title")} body={t("steps.s1Body")} icon={<WalletIcon />} />
          <StepCard n="2" tone="accent" title={t("steps.s2Title")} body={t("steps.s2Body")} icon={<SlidersIcon />} />
          <StepCard n="3" tone="sky" title={t("steps.s3Title")} body={t("steps.s3Body")} icon={<BoltIcon />} />
        </div>
      </Reveal>

      {/* ── Benefits ─────────────────────────────────────────────────────── */}
      <Reveal>
        <SectionEyebrow eyebrow={t("benefits.eyebrow")} title={t("benefits.title")} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BenefitCard icon={<ShieldCheckIcon />} title={t("benefits.b1Title")} body={t("benefits.b1Body")} />
          <BenefitCard icon={<CoinsIcon />} title={t("benefits.b2Title")} body={t("benefits.b2Body")} />
          <BenefitCard icon={<GlobeIcon />} title={t("benefits.b3Title")} body={t("benefits.b3Body")} />
          <BenefitCard icon={<KeyIcon />} title={t("benefits.b4Title")} body={t("benefits.b4Body")} />
        </div>
      </Reveal>

      {/* ── Flow / diagram ───────────────────────────────────────────────── */}
      <Reveal>
        <SectionEyebrow eyebrow={t("flow.eyebrow")} title={t("flow.title")} />
        <p className="mt-2 max-w-2xl text-sm text-slate-400">{t("flow.subtitle")}</p>
        <div className="mt-6">
          <ArchitectureDiagram />
        </div>
      </Reveal>

      {/* ── Why / trust strip ────────────────────────────────────────────── */}
      <Reveal className="grid gap-4 sm:grid-cols-3">
        {[
          { k: t("why.t1"), v: t("why.b1") },
          { k: t("why.t2"), v: t("why.b2") },
          { k: t("why.t3"), v: t("why.b3") },
        ].map((x) => (
          <div key={x.k} className="card">
            <div className="label text-brand">{x.k}</div>
            <p className="mt-2 text-sm text-slate-300">{x.v}</p>
          </div>
        ))}
      </Reveal>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-900/40 to-accent/10 px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        <h2 className="relative mx-auto max-w-2xl text-balance text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {t("cta.title")}
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base">{t("cta.body")}</p>
        <div className="relative mt-7 flex justify-center">
          <Link href="/treasury" className="btn-primary px-6 py-3 text-[15px]">
            {t("cta.button")}
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

function SectionEyebrow({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <div className="label flex items-center gap-2 text-brand">
        <span className="h-px w-6 bg-brand/50" aria-hidden />
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.01em] text-white sm:text-4xl">{title}</h2>
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: "text-brand border-brand/30 bg-brand/10",
  accent: "text-accent border-accent/30 bg-accent/10",
  sky: "text-sky-300 border-sky-400/30 bg-sky-400/10",
};

function StepCard({
  n,
  tone,
  title,
  body,
  icon,
}: {
  n: string;
  tone: keyof typeof TONES;
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative card transition hover:border-white/20 hover:bg-ink-850">
      <div className="flex items-center gap-3">
        <span className={`grid h-10 w-10 place-items-center rounded-xl border ${TONES[tone]}`}>{icon}</span>
        <span className="font-display text-3xl font-semibold text-white/15">{n}</span>
      </div>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

function BenefitCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card flex flex-col transition hover:border-white/20 hover:bg-ink-850">
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand">
        {icon}
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

/* ── Minimal inline icons ───────────────────────────────────────────────── */
const ic = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function WalletIcon() { return <svg {...ic}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0-2 2z" /><path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6" /><circle cx="16.5" cy="13" r="1.2" /></svg>; }
function SlidersIcon() { return <svg {...ic}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="14" cy="18" r="2" /></svg>; }
function BoltIcon() { return <svg {...ic}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>; }
function ShieldCheckIcon() { return <svg {...ic}><path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6z" /><path d="M9.5 12.5 11 14l3.5-3.5" /></svg>; }
function CoinsIcon() { return <svg {...ic}><ellipse cx="9" cy="7" rx="5" ry="2.6" /><path d="M4 7v4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6V7" /><path d="M10 14.4v2.6c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-4c0-1.4-2.2-2.6-5-2.6" /></svg>; }
function GlobeIcon() { return <svg {...ic}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>; }
function KeyIcon() { return <svg {...ic}><circle cx="8" cy="8" r="4" /><path d="M11 11l8 8M16 16l2-2M18 18l2-2" /></svg>; }
function LockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-brand"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>; }
