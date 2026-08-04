"use client";

import { useT } from "@/lib/i18n";
import { useNetwork } from "@/lib/network";

export function Footer() {
  const t = useT();
  const network = useNetwork();
  return (
    <footer className="border-t border-white/10 bg-ink-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" className="h-6 w-6 opacity-80 hover:opacity-100 transition-opacity" alt="Contextio" />
            <span className="text-sm font-semibold tracking-tight text-white">Contextio</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/.well-known/legal-context.json">
              legal-context.json
            </a>
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/legal-context">
              {t("footer.legalContext")}
            </a>
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/legal/terms">
              {t("legal.termsOfService")}
            </a>
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/legal/privacy">
              {t("legal.privacyPolicy")}
            </a>
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/security">
              {t("footer.security")}
            </a>
            <a className="text-slate-500 hover:text-slate-300 transition-colors" href="/docs">
              {t("footer.docs")}
            </a>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 text-[11px] text-slate-600">
          <p>
            {t("footer.tagline")} {network === "mainnet" ? t("footer.taglineMainnet") : t("footer.taglineTestnet")}
          </p>
        </div>
      </div>
    </footer>
  );
}
