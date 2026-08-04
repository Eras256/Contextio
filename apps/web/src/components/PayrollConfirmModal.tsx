"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n";
import { usd } from "@/lib/format";

/**
 * Replaces window.confirm() for the custodial "Pay now" action — the same
 * treatment NetworkConfirmModal already gives the testnet→mainnet switch
 * (real funds move here too, on-chain, immediately). Same modal shell for
 * visual consistency (portal, overlay, amber "real action" accent,
 * max-h-[90vh] + flex-col-reverse buttons — fully responsive down to the
 * smallest phone width).
 */
export function PayrollConfirmModal({
  employeeCount,
  grossAmount,
  scaledAmount,
  asset,
  onConfirm,
  onCancel,
}: {
  employeeCount: number;
  grossAmount: number;
  scaledAmount: number;
  asset: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
      aria-labelledby="payroll-confirm-title"
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
              <CoinsIcon />
            </span>
            <h2 id="payroll-confirm-title" className="text-sm font-semibold text-white">
              {t("pages.payroll.runModalTitle")}
            </h2>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-3 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-300 break-words">{t("pages.payroll.runConfirm")}</p>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-slate-500">{employeeCount} {t("pages.payroll.runsPaid")}</span>
              <span className="font-semibold text-white">{usd(grossAmount)} {asset}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/5 pt-1.5">
              <span className="text-slate-500">{t("pages.payroll.runsScaledNote")}</span>
              <span className="font-mono font-semibold text-amber-300">{usd(scaledAmount)} {asset}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" aria-hidden />
            <span className="break-words">{t("pages.payroll.runModalSafe")}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 bg-black/20 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="btn-ghost w-full px-4 py-2 text-sm sm:w-auto">
            {t("pages.payroll.runModalCancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/25 sm:w-auto"
          >
            {t("pages.payroll.runModalConfirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CoinsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />
    </svg>
  );
}
