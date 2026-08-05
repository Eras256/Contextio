"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { resolveApiUrl } from "@/lib/network";

const API = resolveApiUrl();

// Shape + graceful fallback; the real, published LCP (with the real terms hash)
// is fetched on mount from the canonical .well-known endpoint.
const FALLBACK = {
  specVersion: "0.1.0",
  contextId: "11111111-1111-4111-8111-111111111111",
  version: 1,
  tenantDomain: "contextio.xyz",
  provider: {
    legalName: "Acme Treasury Ltda",
    jurisdiction: "BR, AR, CO",
    contactEmail: "legal@contextio.xyz",
  },
  terms: {
    url: "https://contextio.xyz/legal/terms",
    sha256: "0000000000000000000000000000000000000000000000000000000000000000",
    effectiveDate: "2026-01-01",
  },
  jurisdictions: ["BR", "AR", "CO"],
  consentRequirements: [
    {
      id: "treasury-management",
      description: "Authorize agents to allocate idle treasury.",
      required: true,
      scope: ["treasury", "yield"],
    },
    {
      id: "payroll-execution",
      description: "Authorize scheduled payroll settlement.",
      required: true,
      scope: ["payroll", "offramp"],
    },
  ],
  disputeChannels: [
    {
      type: "arbitration",
      provider: "Contextio default arbitration",
      venue: "https://contextio.xyz/legal/disputes",
      governingLaw: "BR",
      language: "en",
    },
  ],
  settlement: {
    networks: ["stellar:testnet", "stellar:pubnet"],
    assets: ["USDC", "XLM"],
  },
  publishedAt: "2026-01-04T10:02:00.000Z",
};

export default function LegalContextPage() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [doc, setDoc] = useState(FALLBACK);

  // Load the REAL published LCP (with the real terms hash) from the canonical endpoint.
  useEffect(() => {
    let alive = true;
    fetch(`${API}/.well-known/contextio-legal-context.json?domain=contextio.xyz`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setDoc({
          ...FALLBACK,
          ...d,
          terms: { ...FALLBACK.terms, ...(d.terms ?? {}) },
          provider: { ...FALLBACK.provider, ...(d.provider ?? {}) },
          settlement: { ...FALLBACK.settlement, ...(d.settlement ?? {}) },
        } as typeof FALLBACK);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // ignore clipboard errors
    }
  };

  const downloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(doc, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "contextio-legal-context.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-6">
      {/* Draft notice — this document is not lawyer-reviewed yet; see
          contextio-mainnet-launch-plan. Keep this above the fold and don't
          remove it until a licensed attorney has actually signed off. */}
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm text-amber-200">
        <span className="font-semibold uppercase tracking-wide">{t("legal.draftNotice")}</span>
      </div>

      {/* Header section */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-950 to-accent/5 p-8 shadow-2xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-60 w-60 rounded-full bg-brand/15 blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 p-2 shadow-[0_0_12px_rgba(34,211,165,0.1)]">
              <img src="/logo-icon.png" alt="Contextio Logo" className="h-full w-full object-contain" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand">Legal Context Protocol</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {t("legal.title")}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
            {t("legal.subtitle")}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-slate-400">
            <div>
              <span className="text-slate-500">{t("legal.specVersion")}: </span>
              <span className="font-mono text-white">v{doc.specVersion}</span>
            </div>
            <div className="hidden sm:inline text-slate-600">|</div>
            <div>
              <span className="text-slate-500">{t("legal.version")}: </span>
              <span className="font-mono text-white">{doc.version}</span>
            </div>
            <div className="hidden sm:inline text-slate-600">|</div>
            <div>
              <span className="text-slate-500">{t("legal.publishedAt")}: </span>
              <span className="font-mono text-white">{new Date(doc.publishedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Provider details */}
        <Card className="flex flex-col justify-between p-6">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              {t("legal.provider")}
            </h3>
            <div className="divide-y divide-white/5 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">{t("legal.legalName")}</span>
                <span className="font-medium text-white">{doc.provider.legalName}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">{t("legal.jurisdiction")}</span>
                <span className="font-mono font-medium text-white">
                  {doc.provider.jurisdiction === "BR" ? "BR, AR, CO" : doc.provider.jurisdiction}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">{t("legal.operatingJurisdictions")}</span>
                <span className="font-mono font-medium text-white">
                  {doc.jurisdictions ? doc.jurisdictions.join(", ") : "BR, AR, CO"}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">{t("legal.contactEmail")}</span>
                <a href={`mailto:${doc.provider.contactEmail}`} className="text-accent hover:underline">
                  {doc.provider.contactEmail}
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Canonical Terms */}
        <Card className="flex flex-col justify-between p-6">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {t("legal.terms")}
            </h3>
            <div className="divide-y divide-white/5 text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-slate-400">{t("legal.effectiveDate")}</span>
                <span className="font-mono text-white">{doc.terms.effectiveDate}</span>
              </div>
              <div className="flex flex-col gap-1.5 py-2.5">
                <span className="text-slate-400">{t("legal.termsUrl")}</span>
                <a href={doc.terms.url} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all text-xs">
                  {doc.terms.url} ↗
                </a>
              </div>
              <div className="flex flex-col gap-1.5 py-2.5">
                <span className="text-slate-400">{t("legal.termsHash")}</span>
                <span className="font-mono text-[10px] text-slate-400 break-all select-all">
                  {doc.terms.sha256}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Rules / Scopes Card */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          {t("legal.consentRequirements")}
        </h3>
        <p className="text-xs text-slate-400 mb-6">{t("legal.consentDesc")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {doc.consentRequirements.map((cr) => {
            const descKey = cr.id === "treasury-management" ? "legal.consentTreasuryDesc" : "legal.consentPayrollDesc";
            return (
              <div key={cr.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-white">{cr.id}</span>
                  {cr.required && (
                    <span className="rounded-full bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-bold text-brand uppercase tracking-wider">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {t(descKey)}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cr.scope.map((sc) => (
                    <span key={sc} className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                      {sc}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Settlement & Disputes details */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Settlement rules */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            {t("legal.settlementRules")}
          </h3>
          <div className="space-y-4 text-xs">
            <div className="space-y-2">
              <div className="text-slate-400">{t("legal.allowedNetworks")}</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.settlement.networks.map((n) => (
                  <span key={n} className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-slate-300">
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-slate-400">{t("legal.allowedAssets")}</div>
              <div className="flex flex-wrap gap-1.5">
                {doc.settlement.assets.map((a) => (
                  <span key={a} className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono font-semibold text-brand">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Dispute Resolution */}
        <Card className="p-6 space-y-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            {t("legal.disputeResolution")}
          </h3>
          <div className="divide-y divide-white/5 text-xs">
            {doc.disputeChannels.map((dc, idx) => (
              <div key={idx} className="space-y-2.5 pb-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("legal.disputeType")}</span>
                  <span className="font-semibold text-white uppercase">{t(`legal.type${dc.type.charAt(0).toUpperCase() + dc.type.slice(1)}`)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("legal.disputeProvider")}</span>
                  <span className="text-slate-200">{dc.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t("legal.disputeLaw")}</span>
                  <span className="font-mono text-white">{dc.governingLaw}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400">{t("legal.disputeVenue")}</span>
                  <a href={dc.venue} target="_blank" rel="noreferrer" className="text-accent hover:underline break-all">
                    {dc.venue} ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Raw JSON viewer */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">{t("legal.rawJson")}</h3>
            <p className="text-xs text-slate-400">Verifiable context signature metadata document</p>
          </div>
          <div className="flex gap-2">
            <button onClick={copyToClipboard} className="btn-ghost px-3 py-1.5 text-xs">
              {copied ? t("legal.copied") : t("legal.copyJson")}
            </button>
            <button onClick={downloadJson} className="btn-primary px-3 py-1.5 text-xs">
              {t("legal.downloadJson")}
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-[10px] sm:text-xs text-slate-300 overflow-x-auto shadow-inner select-all">
          <pre>{JSON.stringify(doc, null, 2)}</pre>
        </div>
      </Card>
    </div>
  );
}
