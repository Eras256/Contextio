"use client";

import { useState } from "react";
import { Badge, Card, KeyValue, SectionHeader } from "@/components/ui";
import { shortHash, localDateTime } from "@/lib/format";
import { api, apiBaseUrl, type Decision, type LegalState } from "@/lib/api";
import { getAiConfig } from "@/lib/aiModel";
import { useLiveData } from "@/lib/useLiveData";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useNetwork } from "@/lib/network";

interface LegalDoc {
  tenantDomain?: string;
  jurisdictions?: string[];
  consentRequirements?: { id: string; description: string }[];
  disputeChannels?: { governingLaw: string }[];
}

export default function AgentPage() {
  const { t, locale } = useI18n();
  const network = useNetwork();
  const { accessToken, tenantId, connect, connecting } = useAuth();
  const decisions = useLiveData<Decision[]>(api.decisions, [], { realtimeTable: "agent_decisions" });
  const legal = useLiveData<LegalState>(api.legal, { published: false });
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  // Localized helpers with graceful fallback to the raw value.
  const tf = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const actionLabel = (a: string) => tf(`pages.agent.actions.${a}`, a);
  const statusLabel = (s: string) => tf(`pages.agent.status.${s}`, s);
  const countryLabel = (c: string) => tf(`pages.agent.countries.${c}`, c);

  // Run one real agent cycle now, powered by the AI model chosen in the navbar.
  // The rationale is written by that LLM; the decision settles on-chain and
  // streams back into the feed via Realtime.
  const runAgent = async () => {
    if (!accessToken || !tenantId || running) return;
    setRunning(true);
    setRunMsg(null);
    try {
      const ai = getAiConfig() ?? undefined;
      const d = await api.propose({ accessToken, tenantId }, true, ai, locale);
      if (d.executionError) {
        const e = d.executionError.toLowerCase();
        const reason = /not enough/.test(e)
          ? tf("pages.agent.runInsufficient", "there isn't enough in that bucket to settle right now")
          : /timed out|timeout/.test(e)
            ? tf("pages.agent.runTimeout", "the network is slow — it may still settle and appear in the feed shortly")
            : d.executionError;
        setRunMsg(`${tf("pages.agent.runProposed", "Agent proposed a move, but it couldn't settle this cycle:")} ${reason}`);
      } else {
        setRunMsg(
          d.action === "noop"
            ? tf("pages.agent.runNoop", "Agent evaluated — treasury within band, no move needed.")
            : tf("pages.agent.runOk", "Agent ran — decision settled on-chain."),
        );
      }
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="space-y-8">
        <SectionHeader
          eyebrow={t("pages.agent.eyebrow")}
          title={t("pages.agent.title")}
          description={t("pages.agent.desc")}
        />
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand/10 via-ink-900/40 to-accent/10 px-6 py-16 text-center">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative mx-auto max-w-md">
            <h3 className="text-xl font-semibold text-white">{t("pages.agent.connectTitle")}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">{t("pages.agent.connectBody")}</p>
            <button className="btn-primary mt-6 px-5 py-2.5" onClick={() => void connect()} disabled={connecting}>
              {connecting ? t("auth.connecting") : t("auth.connect")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const doc = (legal.data.document ?? {}) as LegalDoc;
  const consents = doc.consentRequirements ?? [];
  const countries = Array.from(
    new Set([...(doc.disputeChannels ?? []).map((c) => c.governingLaw), ...(doc.jurisdictions ?? [])]),
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={t("pages.agent.eyebrow")}
        title={t("pages.agent.title")}
        description={t("pages.agent.desc")}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* The assistant's rulebook (legal context) */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{t("pages.agent.rulebookTitle")}</h3>
            <Badge tone={legal.data.published ? "agent" : "default"}>
              {legal.data.published ? t("pages.agent.published") : t("pages.agent.unpublished")}
            </Badge>
          </div>
          <p className="mb-4 text-xs text-slate-400">{t("pages.agent.rulebookBody")}</p>
          <KeyValue
            k={t("pages.agent.kDomain")}
            v={<span className="font-mono text-xs">{doc.tenantDomain ?? "—"}</span>}
          />
          <KeyValue
            k={t("pages.agent.kActiveIn")}
            v={countries.length ? countries.map(countryLabel).join(" · ") : "—"}
          />
          <KeyValue
            k={t("pages.agent.kHash")}
            v={
              legal.data.hash ? (
                <a
                  className="font-mono text-xs text-accent hover:underline hover:text-accent/80 transition inline-flex items-center gap-1"
                  href={`${apiBaseUrl()}/.well-known/legal-context.json?domain=${doc.tenantDomain ?? "contextio.xyz"}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortHash(legal.data.hash)} ↗
                </a>
              ) : (
                <span className="font-mono text-xs text-slate-500">—</span>
              )
            }
          />
          {legal.data.published && doc.tenantDomain && (
            <div className="mt-4">
              <a
                className="btn-ghost"
                href={`${apiBaseUrl()}/.well-known/legal-context.json?domain=${doc.tenantDomain}`}
                target="_blank"
                rel="noreferrer"
              >
                {t("pages.agent.viewWellKnown")} ↗
              </a>
            </div>
          )}
        </Card>

        {/* What you've allowed (consents) */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-white">{t("pages.agent.consentsTitle")}</h3>
          <p className="mb-4 text-xs text-slate-400">{t("pages.agent.consentsBody")}</p>
          <div className="space-y-2">
            {consents.map((c) => (
              <div key={c.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-3">
                <Badge>{c.id}</Badge>
                <p className="mt-2 text-xs text-slate-400">{tf(`consents.${c.id}`, c.description)}</p>
              </div>
            ))}
            {consents.length === 0 && (
              <p className="text-sm text-slate-500">{t("pages.agent.consentsEmpty")}</p>
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">{t("pages.agent.consentsNote")}</p>
        </Card>
      </div>

      {/* Agent decisions (real, with on-chain receipts) */}
      <Card>
        <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">{t("pages.agent.activityTitle")}</h3>
          <button className="btn-ghost text-xs" onClick={() => void runAgent()} disabled={running}>
            {running ? tf("pages.agent.running", "Running…") : tf("pages.agent.runNow", "Run agent")}
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">{t("pages.agent.activityBody")}</p>
        {runMsg && (
          <p className="mb-4 rounded-lg border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-slate-300">{runMsg}</p>
        )}
        <div className="space-y-3">
          {decisions.data.map((d) => (
            <div key={d.id} className="rounded-lg border border-white/10 bg-ink-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="agent">{actionLabel(d.action)}</Badge>
                  <Badge tone={d.status === "executed" ? "success" : d.status === "proposed" ? "warn" : "default"}>
                    {statusLabel(d.status)}
                  </Badge>
                </div>
                <span className="font-mono text-xs text-slate-500">{localDateTime(d.createdAt)}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">{d.rationale}</p>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                <span className="text-slate-400">
                  {t("pages.agent.lcpLabel")}:{" "}
                  {d.legalContextHash ? (
                    <a
                      className="font-mono text-accent hover:underline hover:text-accent/80 transition inline-flex items-center gap-1"
                      href={`${apiBaseUrl()}/.well-known/legal-context.json?domain=${doc.tenantDomain ?? "contextio.xyz"}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHash(d.legalContextHash)} ↗
                    </a>
                  ) : (
                    <span className="font-mono text-slate-500">—</span>
                  )}
                </span>
                <span className="text-slate-400">
                  {t("pages.agent.txLabel")}:{" "}
                  {d.stellarTxHash && !d.stellarTxHash.startsWith("sim:") ? (
                    <a
                      className="font-mono text-brand hover:underline"
                      href={`https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/tx/${d.stellarTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortHash(d.stellarTxHash, 10, 6)} ↗
                    </a>
                  ) : (
                    <span className="font-mono text-slate-500 break-all">{d.stellarTxHash ?? "—"}</span>
                  )}
                </span>
              </div>
            </div>
          ))}
          {decisions.data.length === 0 && (
            <p className="text-sm text-slate-500">{t("pages.agent.activityEmpty")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
