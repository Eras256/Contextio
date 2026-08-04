"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { apiBaseUrl } from "@/lib/api";
import { resolveApiUrl } from "@/lib/network";
import { useT } from "@/lib/i18n";

const API = resolveApiUrl();

interface Info {
  network: string;
  agentAddress: string | null;
  contracts: { treasury: string | null; payroll: string | null };
}

/**
 * "Don't trust, verify" — the real, live contract IDs + agent wallet from the
 * public `/public/activity` endpoint, each linked to the Stellar explorer, plus
 * the live LCP terms document. Turns claims into verifiable on-chain artifacts.
 */
export function OnchainProof() {
  const t = useT();
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API}/api/v1/public/activity`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j) {
          setInfo({
            network: j.network,
            agentAddress: j.agentAddress ?? null,
            contracts: j.contracts ?? { treasury: null, payroll: null },
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const net = (info?.network ?? "testnet").toLowerCase();
  const isMain = net === "public" || net === "mainnet";
  const explorer = (kind: "contract" | "account", id: string) =>
    `https://stellar.expert/explorer/${isMain ? "public" : "testnet"}/${kind}/${id}`;

  const rows: { k: string; id: string | null; kind: "contract" | "account" }[] = [
    { k: t("onchain.treasury"), id: info?.contracts.treasury ?? null, kind: "contract" },
    { k: t("onchain.payroll"), id: info?.contracts.payroll ?? null, kind: "contract" },
    { k: t("onchain.agent"), id: info?.agentAddress ?? null, kind: "account" },
  ];

  return (
    <Card>
      <h3 className="text-sm font-semibold text-white">{t("onchain.title")}</h3>
      <p className="mt-1 text-xs text-slate-400">{t("onchain.body")}</p>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">{t("onchain.network")}</span>
          <span className="font-mono text-slate-300">{info?.network ?? "—"}</span>
        </div>
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{r.k}</span>
            {r.id ? (
              <a href={explorer(r.kind, r.id)} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">
                {r.id.slice(0, 6)}…{r.id.slice(-4)} ↗
              </a>
            ) : (
              <span className="font-mono text-slate-600">—</span>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-2">
          <span className="text-slate-500">{t("onchain.terms")}</span>
          <a
            href={`${apiBaseUrl()}/.well-known/legal-context.json?domain=contextio.xyz`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-accent hover:underline"
          >
            {t("onchain.view")} ↗
          </a>
        </div>
      </div>
    </Card>
  );
}
