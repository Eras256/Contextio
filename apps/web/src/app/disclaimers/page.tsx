"use client";

import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import { useT } from "@/lib/i18n";

export default function DisclaimersPage() {
  const t = useT();
  const points = [1, 2, 3, 4, 5] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionHeader
        eyebrow={t("pages.disclaimers.eyebrow")}
        title={t("pages.disclaimers.title")}
        description={t("pages.disclaimers.intro")}
      />

      <Card className="space-y-5">
        {points.map((n) => (
          <div key={n} className="border-b border-white/5 pb-5 last:border-0 last:pb-0">
            <h3 className="text-sm font-semibold text-white">{t(`pages.disclaimers.p${n}Title`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t(`pages.disclaimers.p${n}Body`)}</p>
          </div>
        ))}
      </Card>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
        <Link href="/legal/terms" className="text-brand hover:underline">
          {t("legal.termsOfService")} ↗
        </Link>
        <Link href="/legal/privacy" className="text-brand hover:underline">
          {t("legal.privacyPolicy")} ↗
        </Link>
        <a
          href="https://stellar.org/community/code-of-conduct"
          target="_blank"
          rel="noreferrer"
          className="text-brand hover:underline"
        >
          {t("disclaimer.stellarCoc")} ↗
        </a>
      </div>
    </div>
  );
}
