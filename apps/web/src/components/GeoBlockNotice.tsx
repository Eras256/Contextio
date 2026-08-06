"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const MARKER_COOKIE = "cxnet_geo_blocked";

/**
 * One-shot notice for when middleware.ts silently reverted a mainnet
 * selection back to testnet because the visitor's country isn't on the
 * reviewed list (see middleware.ts for the allowlist + why). Reads the
 * short-lived marker cookie the middleware sets, shows a single dismissible
 * banner, then clears it — so it never reappears on its own, only the next
 * time someone actually retries switching to mainnet from a blocked region.
 */
export function GeoBlockNotice() {
  const t = useT();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${MARKER_COOKIE}=([^;]+)`));
    if (match) {
      setBlocked(true);
      document.cookie = `${MARKER_COOKIE}=; path=/; max-age=0`;
    }
  }, []);

  if (!blocked) return null;

  return (
    <div className="relative border-b border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5 text-[12px] leading-relaxed text-amber-200 sm:px-6 max-w-full overflow-hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-2.5 pr-8">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" aria-hidden />
        <p className="min-w-0 flex-1 break-words">{t("network.geoBlocked")}</p>
      </div>
      <button
        type="button"
        onClick={() => setBlocked(false)}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-amber-300/70 transition hover:bg-amber-400/15 hover:text-amber-100 sm:right-5"
      >
        ×
      </button>
    </div>
  );
}
