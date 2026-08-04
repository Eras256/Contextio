"use client";

import { Card, SectionHeader } from "@/components/ui";
import { OnchainProof } from "@/components/OnchainProof";
import { useT } from "@/lib/i18n";
import { useNetwork } from "@/lib/network";

export default function SecurityPage() {
  const t = useT();
  const network = useNetwork();

  const pillars = [
    { title: t("pages.security.p1Title"), body: t("pages.security.p1Body") },
    { title: t("pages.security.p2Title"), body: t("pages.security.p2Body") },
    { title: t("pages.security.p3Title"), body: t("pages.security.p3Body") },
    { title: t("pages.security.p4Title"), body: t("pages.security.p4Body") },
  ];

  const layers = [
    { n: "01", title: t("pages.security.l1Title"), body: t("pages.security.l1Body") },
    { n: "02", title: t("pages.security.l2Title"), body: t("pages.security.l2Body") },
    { n: "03", title: t("pages.security.l3Title"), body: t("pages.security.l3Body") },
    { n: "04", title: t("pages.security.l4Title"), body: t("pages.security.l4Body") },
  ];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow={t("pages.security.eyebrow")}
        title={t("pages.security.title")}
        description={t("pages.security.desc")}
      />

      {/* Pillars */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((p) => (
          <Card key={p.title}>
            <h3 className="text-sm font-semibold text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{p.body}</p>
          </Card>
        ))}
      </div>

      {/* Defense-in-depth layers */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{t("pages.security.layersTitle")}</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{t("pages.security.layersBody")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {layers.map((l) => (
            <div key={l.n} className="flex gap-4 rounded-2xl border border-white/10 bg-ink-900/60 p-5">
              <span className="font-mono text-2xl font-bold text-brand/60">{l.n}</span>
              <div>
                <h4 className="text-sm font-semibold text-white">{l.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{l.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Verifiable on-chain proof of the guarantees above */}
      <OnchainProof />

      <div className="rounded-2xl border border-brand/20 bg-brand/5 p-5">
        <h4 className="text-sm font-semibold text-white">
          {network === "mainnet" ? t("pages.security.noteTitleMainnet") : t("pages.security.noteTitle")}
        </h4>
        <p className="mt-1 text-sm text-slate-300">
          {network === "mainnet" ? t("pages.security.noteBodyMainnet") : t("pages.security.noteBody")}
        </p>
      </div>
    </div>
  );
}
