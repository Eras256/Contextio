"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthControls } from "@/components/AuthControls";
import { LanguageSelector } from "@/components/LanguageSelector";
import { AiSelector } from "@/components/AiSelector";
import { NetworkToggle } from "@/components/NetworkToggle";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";

const SECTIONS = [
  { href: "/", key: "nav.home" },
  { href: "/treasury", key: "nav.treasury" },
  { href: "/payroll", key: "nav.payroll" },
  { href: "/agent", key: "nav.agent" },
  { href: "/integrations", key: "nav.integrations" },
  { href: "/security", key: "nav.security" },
  { href: "/docs", key: "nav.docs" },
] as const;

/**
 * The full row (7 nav links + language + AI + wallet + CTA) only ever fits
 * comfortably at genuine desktop widths. `lg` (1024px) is also iPad landscape
 * — too tight for all of that — so everything below `xl` (1280px) collapses
 * behind a hamburger panel instead of fighting for space in one row. Nothing
 * in the always-visible row is allowed to shrink below its content, so it
 * can never silently clip.
 */
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { address, connecting, connect } = useAuth();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const [mobileOpen, setMobileOpen] = useState(false);
  // Client-side nav doesn't remount this component — close the panel
  // ourselves once the route actually changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const workspaceArrow = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );

  /**
   * Connected: same as a plain nav link to /treasury. Signed out: this is
   * the one control that actually opens the wallet connect flow (same
   * modal as "Conectar wallet") instead of just navigating to a page that
   * looks the same as browsing there — otherwise it's indistinguishable
   * from the "Tesorería" nav link, which confused testers.
   */
  const WorkspaceLink = ({ className }: { className: string }) =>
    address ? (
      <Link href="/treasury" className={className}>
        {t("nav.workspace")}
        {workspaceArrow}
      </Link>
    ) : (
      <button
        type="button"
        className={className}
        disabled={connecting}
        onClick={async () => {
          await connect();
          router.push("/treasury");
        }}
      >
        {connecting ? t("auth.connecting") : t("nav.workspace")}
        {workspaceArrow}
      </button>
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/80 backdrop-blur max-w-full overflow-x-hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-1.5 px-3 sm:gap-3 sm:px-6">
        {/* Brand + network */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo-icon.png" className="h-7 w-7 sm:h-8 sm:w-8" alt="Contextio" />
            <span className="hidden text-base font-semibold tracking-tight text-white min-[380px]:inline">Contextio</span>
          </Link>
          <NetworkToggle />
        </div>

        {/* Center nav — desktop only, same threshold as the rest of the row */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 xl:flex" aria-label="Primary">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`nav-link whitespace-nowrap ${isActive(s.href) ? "nav-link-active" : ""}`}
            >
              {t(s.key)}
            </Link>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 xl:flex sm:gap-2">
            <LanguageSelector />
            <AiSelector />
          </div>
          <AuthControls />
          <WorkspaceLink className="btn-primary hidden px-4 py-2 text-sm xl:inline-flex" />

          {/* Hamburger — everything below xl lives here instead */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="inline-flex items-center justify-center rounded-lg border border-white/15 p-2 text-slate-200 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20 xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-panel"
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.menu")}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile/tablet panel: replaces both the old right cluster and the old
          horizontal-scroll link bar — a vertical list can never overflow
          horizontally, unlike a row of 7 links ever could. */}
      {mobileOpen && (
        <div id="mobile-nav-panel" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/5 px-3 py-3 xl:hidden">
          <nav className="flex flex-col gap-1" aria-label="Primary">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`nav-link ${isActive(s.href) ? "nav-link-active" : ""}`}
              >
                {t(s.key)}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
            <LanguageSelector />
            <AiSelector />
          </div>
          <WorkspaceLink className="btn-primary mt-3 w-full justify-center px-4 py-2.5 text-sm" />
        </div>
      )}
    </header>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
