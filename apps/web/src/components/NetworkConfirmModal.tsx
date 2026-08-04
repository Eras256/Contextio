"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";

/**
 * Replaces window.confirm() for the testnet → mainnet switch — the one
 * network transition worth pausing for (real funds). Same modal shell as
 * AiSelector for visual consistency (overlay, max-h-[88vh], ink-950 panel).
 */
export function NetworkConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const t = useT();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-confirm-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={onCancel}
    >
      <div
        className="my-auto flex w-full max-w-sm max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-amber-400/30 bg-ink-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-amber-400/15 bg-amber-400/[0.04] px-5 py-4">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl" />
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <WarnIcon />
            </span>
            <h2 id="network-confirm-title" className="text-sm font-semibold text-white">
              {t("network.modalTitle")}
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-300 break-words">{t("network.modalBody")}</p>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" aria-hidden />
            <span className="break-words">{t("network.modalTestnetSafe")}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost w-full px-4 py-2 text-sm sm:w-auto"
          >
            {t("network.modalCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/25 sm:w-auto"
          >
            {t("network.modalConfirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
