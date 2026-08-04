"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LOCALES, useI18n } from "@/lib/i18n";

/**
 * Compact language switcher (EN/ES/PT) for the navbar. Changes all content.
 * The menu renders via a portal to document.body (position: fixed, anchored
 * to the trigger button's live coordinates) instead of a plain `absolute`
 * child — any scrollable/overflow-clipped ancestor (the mobile nav panel's
 * `overflow-y-auto`, in particular) would otherwise clip it, the same class
 * of bug the header's own overflow setting caused before. Matches the
 * pattern AiSelector already uses for its modal.
 */
export function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    // Close rather than try to follow — the button can move under a fixed-
    // position menu on scroll (e.g. scrolled from the top before the sticky
    // header engages, or inside the mobile panel's own scroll container).
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((o) => !o);
  };

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
      >
        <GlobeIcon />
        <span>{current.short}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" className="opacity-60" aria-hidden>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {mounted &&
        open &&
        createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-[200] w-40 overflow-hidden rounded-xl border border-white/10 bg-ink-950/95 p-1 shadow-xl backdrop-blur"
          >
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  role="option"
                  aria-selected={l.code === locale}
                  onClick={() => {
                    setLocale(l.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                    l.code === locale ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span>{l.label}</span>
                  <span className="text-xs text-slate-500">{l.short}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="text-brand">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  );
}
