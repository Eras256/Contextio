"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

const DISMISS_KEY = "contextio.disclaimer.dismissed.v1";

/**
 * Persistent legal disclaimer strip, same spirit as nirium.xyz/disclaimers —
 * declared plainly instead of buried in a footer link. Dismissible per browser
 * (not per session) so it doesn't nag returning visitors, but reappears if the
 * text ever changes (bump DISMISS_KEY's version suffix when it does).
 */
export function DisclaimerBanner() {
  const t = useT();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="relative border-b border-rose-500/25 bg-rose-500/[0.06] px-4 py-2.5 text-[12px] leading-relaxed text-rose-200 sm:px-6 max-w-full overflow-hidden">
      <div className="mx-auto flex max-w-7xl flex-col gap-1.5 pr-8 sm:flex-row sm:items-center sm:gap-2.5">
        <WarnIcon />
        <p className="min-w-0 flex-1 break-words">
          {t("disclaimer.banner")}{" "}
          <a href="/disclaimers" className="font-semibold text-rose-100 underline underline-offset-2 hover:text-white">
            {t("disclaimer.readMore")}
          </a>
          {" · "}
          <a
            href="https://stellar.org/community/code-of-conduct"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-rose-100 underline underline-offset-2 hover:text-white inline-block"
          >
            {t("disclaimer.stellarCoc")} ↗
          </a>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("disclaimer.dismiss")}
        className="absolute right-2.5 top-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-rose-300/70 transition hover:bg-rose-500/15 hover:text-rose-100 sm:right-5"
      >
        ×
      </button>
    </div>
  );
}

function WarnIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0 sm:mt-0"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
