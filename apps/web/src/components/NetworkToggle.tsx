"use client";

import { useState } from "react";
import { useNetwork, setClientNetwork, type StellarNetwork } from "@/lib/network";
import { useT } from "@/lib/i18n";
import { NetworkConfirmModal } from "@/components/NetworkConfirmModal";

/**
 * Replaces the old static "TESTNET" badge with a real switch — one deployment,
 * one site, aware of both networks (see lib/network.ts). Switching to mainnet
 * opens a confirmation modal: unlike testnet, actions there can move real
 * funds. Visible at every breakpoint — this is safety-relevant, not decoration.
 */
export function NetworkToggle() {
  const network = useNetwork();
  const t = useT();
  const isMainnet = network === "mainnet";
  const [confirming, setConfirming] = useState(false);

  const switchTo = (next: StellarNetwork) => {
    if (next === network) return;
    if (next === "mainnet") {
      setConfirming(true);
      return;
    }
    setClientNetwork(next);
  };

  return (
    <>
      <div
        role="group"
        aria-label={t("network.toggleLabel")}
        className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]"
      >
        <button
          type="button"
          onClick={() => switchTo("testnet")}
          aria-pressed={!isMainnet}
          className={`flex items-center gap-1 rounded-full px-1.5 py-1 transition sm:gap-1.5 sm:px-2 ${
            !isMainnet ? "bg-brand/15 text-brand" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${!isMainnet ? "bg-brand shadow-[0_0_6px_#22d3a5]" : "bg-slate-600"}`}
            aria-hidden
          />
          <span className="hidden sm:inline">Testnet</span>
          <span className="sm:hidden">Test</span>
        </button>
        <button
          type="button"
          onClick={() => switchTo("mainnet")}
          aria-pressed={isMainnet}
          className={`flex items-center gap-1 rounded-full px-1.5 py-1 transition sm:gap-1.5 sm:px-2 ${
            isMainnet ? "bg-amber-400/15 text-amber-300" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isMainnet ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]" : "bg-slate-600"}`}
            aria-hidden
          />
          <span className="hidden sm:inline">Mainnet</span>
          <span className="sm:hidden">Main</span>
        </button>
      </div>

      {confirming && (
        <NetworkConfirmModal
          onConfirm={() => {
            setConfirming(false);
            setClientNetwork("mainnet");
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
