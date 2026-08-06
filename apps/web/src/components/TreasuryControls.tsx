"use client";

import { useEffect, useState } from "react";
import { Card, Info } from "@/components/ui";
import { api, type ApiAuth, type TreasurySnapshot } from "@/lib/api";
import { signWalletMessage, signWalletTransaction } from "@/lib/wallet";
import { getVaults, addVault, removeVault, type DeployedVault } from "@/lib/vaults";
import { useT } from "@/lib/i18n";
import { useNetwork } from "@/lib/network";

/**
 * Manual treasury controls for the dashboard — everything the autonomous agent
 * does, available by hand: activate/deactivate the agent, move capital between
 * liquidity and a yield venue (real on-chain rebalance), tune the risk rules,
 * and register a yield vault. All of it hits the same audited, LCP-bound API
 * the agent uses.
 */
export function TreasuryControls({
  auth,
  address,
  config,
}: {
  auth: ApiAuth;
  address: string | null;
  config: TreasurySnapshot["config"];
}) {
  const [agentEnabled, setAgentEnabled] = useState(config?.agentEnabled ?? true);
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState<string | null>(null);

  // useState seeds from `config` on first render — but the snapshot is still
  // null then, so re-sync once the server value arrives (otherwise the toggle
  // shows the default "on" forever, even when the DB says off).
  const cfgEnabled = config?.agentEnabled;
  useEffect(() => {
    if (cfgEnabled !== undefined) setAgentEnabled(cfgEnabled);
  }, [cfgEnabled]);

  // Locally-tracked list of the user's deployed vaults (real on-chain).
  const [vaults, setVaults] = useState<DeployedVault[]>([]);
  useEffect(() => setVaults(getVaults()), []);

  // Remove a vault from this list. The on-chain vault is a Soroban contract — it
  // can't be deleted, and it has no power over your wallet (self-custody), so
  // there's nothing to revoke. DeFindex also rejects a null manager address, so
  // a true on-chain "renounce" isn't available; we just drop it from the list.
  const onRemoveVault = (v: DeployedVault) => {
    if (!window.confirm("Remove this vault from your list? The on-chain vault stays; it has no control over your wallet.")) return;
    setVaults(removeVault(v.txHash));
  };

  const toggleAgent = async () => {
    if (toggling) return;
    if (!address) return setToggleMsg("Connect a wallet first.");
    setToggling(true);
    setToggleMsg(null);
    try {
      const next = !agentEnabled;
      // SEP-53 consent: you sign the authorization with your own wallet.
      const message = [
        "Contextio — Agent authorization",
        `Action: ${next ? "enable" : "disable"}`,
        `Address: ${address}`,
        `Issued: ${new Date().toISOString()}`,
        "This authorizes Contextio's agent to manage your treasury within your risk rules. It does not move funds.",
      ].join("\n");
      setToggleMsg("Approve in your wallet…");
      const signedMessage = await signWalletMessage(message, address);
      const r = await api.toggleAgent(auth, next, { address, message, signedMessage });
      setAgentEnabled(r.agentEnabled);
      setToggleMsg(r.agentEnabled ? "Agent activated — signed by you." : "Agent paused — signed by you.");
    } catch (e) {
      setToggleMsg(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Manual controls</h3>
          <p className="text-xs text-slate-400">Run the treasury by hand — same audited, on-chain API as the agent.</p>
        </div>
      </div>

      {/* Agent activate / deactivate */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-ink-900/50 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <span className={`inline-block h-2 w-2 rounded-full ${agentEnabled ? "bg-brand shadow-[0_0_8px_#22d3a5]" : "bg-slate-600"}`} />
            Autonomous agent
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {agentEnabled ? "Active — rebalances & lends 24/7 on its own." : "Paused — only manual actions run."}
          </p>
          {toggleMsg && <p className="mt-1 text-[11px] text-slate-400">{toggleMsg}</p>}
        </div>
        <button
          onClick={() => void toggleAgent()}
          disabled={toggling}
          role="switch"
          aria-checked={agentEnabled}
          aria-label="Toggle autonomous agent"
          className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${agentEnabled ? "bg-brand" : "bg-slate-700"}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${agentEnabled ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <RebalancePanel auth={auth} address={address} />
        <RiskPanel auth={auth} config={config} agentEnabled={agentEnabled} />
      </div>

      <div className="mt-4">
        <CreateVaultPanel auth={auth} address={address} onCreated={(v) => setVaults(addVault(v))} />
      </div>

      <DeployedVaults vaults={vaults} onRemove={onRemoveVault} />
    </Card>
  );
}

const toBase = (usd: string) => {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return null;
  return BigInt(Math.round(n * 1e7)).toString();
};

const txUrl = (hash: string, network: string) =>
  `https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/tx/${hash}`;

function TxLink({ hash }: { hash: string }) {
  const network = useNetwork();
  return (
    <a href={txUrl(hash, network)} target="_blank" rel="noreferrer" className="font-mono text-brand hover:underline">
      tx {hash.slice(0, 8)}…{hash.slice(-6)} ↗
    </a>
  );
}

/** Turn raw on-chain / API error strings into one readable line. */
function friendlyError(m: string): string {
  const s = m.toLowerCase();
  if (/declin|reject|cancel/.test(s)) return "Signature cancelled in your wallet.";
  if (/txbadseq|bad.?seq/.test(s)) return "Network busy — a previous tx is still settling. Wait a few seconds and retry.";
  if (/insufficientbalance|insufficient balance/.test(s)) return "Amount exceeds your position here. Try a smaller amount (e.g. withdraw a bit less than you supplied).";
  if (/trustline/.test(s)) return "Your wallet needs a trustline for this asset first.";
  if (/underfunded|txinsufficient/.test(s)) return "Your wallet doesn't have enough balance for this amount plus fees.";
  return m.length > 180 ? `${m.slice(0, 180)}…` : m;
}

const contractUrl = (a: string, network: string) =>
  `https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/contract/${a}`;

/** The vaults the user has deployed (real on-chain), tracked client-side. */
function DeployedVaults({
  vaults,
  onRemove,
}: {
  vaults: DeployedVault[];
  onRemove: (v: DeployedVault) => void;
}) {
  const network = useNetwork();
  if (vaults.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <span className="text-brand">◆</span> Deployed vaults ({vaults.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {vaults.map((v) => (
          <div key={v.txHash} className="rounded-xl border border-brand/25 bg-ink-900/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{v.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-brand">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_6px_#22d3a5]" />
                  DeFindex · {v.asset} · Blend
                </p>
              </div>
              <button
                onClick={() => onRemove(v)}
                className="shrink-0 rounded px-1 text-slate-500 hover:text-white"
                aria-label="Remove from list"
                title="Remove from this list (the on-chain vault stays — it has no control over your wallet)"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[11px]">
              {v.address && (
                <a href={contractUrl(v.address, network)} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">
                  vault {v.address.slice(0, 6)}…{v.address.slice(-4)} ↗
                </a>
              )}
              <TxLink hash={v.txHash} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RebalancePanel({ auth, address }: { auth: ApiAuth; address: string | null }) {
  const t = useT();
  const network = useNetwork();
  const [amount, setAmount] = useState("1");
  const [venue, setVenue] = useState<"blend" | "defindex">("blend");
  const [asset, setAsset] = useState<"XLM" | "USDC">("XLM");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [termsOk, setTermsOk] = useState(false);
  const [jurisdictionOk, setJurisdictionOk] = useState(false);

  const selectCls =
    "mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand";
  const effectiveAsset: "XLM" | "USDC" = venue === "defindex" ? "XLM" : asset;

  const move = async (direction: "in" | "out") => {
    const amountBaseUnits = toBase(amount);
    if (!amountBaseUnits) return setMsg("Enter a positive amount.");
    if (!address) return setMsg("Connect a wallet first.");
    if (!termsOk || !jurisdictionOk) return setMsg("Check both boxes below first.");
    if (busy) return;
    setBusy(true);
    setMsg(null);
    setTx(null);

    // One self-custody attempt: build → user signs in Freighter → submit.
    const attempt = async (): Promise<string> => {
      const { xdr } = await api.prepareMove(auth, {
        venue,
        direction: direction === "in" ? "supply" : "withdraw",
        asset: effectiveAsset,
        amountBaseUnits,
        address,
        acknowledgeTerms: true,
        jurisdictionAttestation: true,
      });
      setMsg("Approve in your wallet…");
      const signed = await signWalletTransaction(xdr, address);
      setMsg("Submitting…");
      const r = await api.submitMove(auth, signed);
      return r.txHash;
    };

    try {
      setMsg("Preparing transaction…");
      let txHash: string;
      try {
        txHash = await attempt();
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        // Sequence race with a still-settling tx → re-prepare with a fresh seq (one retry).
        if (/txbadseq|bad.?seq/i.test(m)) {
          setMsg("A previous tx is still settling — retrying with a fresh sequence…");
          txHash = await attempt();
        } else {
          throw e;
        }
      }
      setTx(txHash);
      setMsg("Signed by you — settled on-chain:");
    } catch (e) {
      setMsg(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-sm font-medium text-white">Move capital</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
        You sign with your own wallet — self-custody.
        <Info text={t("glossary.selfCustody")} />
      </p>

      <label className="mt-3 block text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          Venue
          <Info text={venue === "defindex" ? t("glossary.defindex") : t("glossary.blend")} />
        </span>
        <select value={venue} onChange={(e) => setVenue(e.target.value as typeof venue)} className={selectCls}>
          <option value="blend">Blend · lending</option>
          <option value="defindex">DeFindex · XLM vault</option>
        </select>
      </label>

      {venue === "blend" && (
        <label className="mt-2 block text-[11px] text-slate-400">
          Asset
          <select value={asset} onChange={(e) => setAsset(e.target.value as typeof asset)} className={selectCls}>
            <option value="XLM">XLM — works with your {network} balance</option>
            <option value="USDC">USDC — needs trustline + balance</option>
          </select>
        </label>
      )}

      <label className="mt-2 block text-[11px] text-slate-400">
        Amount ({effectiveAsset})
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-[11px] text-slate-400">
        <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} className="mt-0.5" />
        {t("pages.treasury.moveTermsLabel")}
      </label>
      <label className="mt-2 flex items-start gap-2 text-[11px] text-slate-400">
        <input type="checkbox" checked={jurisdictionOk} onChange={(e) => setJurisdictionOk(e.target.checked)} className="mt-0.5" />
        {t("pages.treasury.moveJurisdictionLabel")}
      </label>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          onClick={() => void move("in")}
          disabled={busy || !termsOk || !jurisdictionOk}
          className="btn-primary justify-center px-3 py-2 text-xs disabled:opacity-40"
        >
          {busy ? "…" : "Aportar liquidez"}
        </button>
        <button
          onClick={() => void move("out")}
          disabled={busy || !termsOk || !jurisdictionOk}
          className="btn-ghost justify-center px-3 py-2 text-xs disabled:opacity-40"
        >
          {busy ? "…" : "Retirar capital"}
        </button>
      </div>
      {(msg || tx) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 break-words text-[11px] text-slate-400">
          <span>{msg}</span>
          {tx && <TxLink hash={tx} />}
        </p>
      )}
    </div>
  );
}

function RiskPanel({
  auth,
  config,
  agentEnabled,
}: {
  auth: ApiAuth;
  config: TreasurySnapshot["config"];
  agentEnabled: boolean;
}) {
  const [minLiq, setMinLiq] = useState(config ? (Number(config.minLiquidityBaseUnits) / 1e7).toString() : "0");
  const [maxYieldPct, setMaxYieldPct] = useState(config ? config.maxYieldBps / 100 : 60);
  const [sensitivity, setSensitivity] = useState(config?.volatilitySensitivity ?? 50);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Re-seed the sliders once the real config loads (same null-on-first-render
  // issue as the toggle) so they reflect saved values, not the defaults.
  const cfgMin = config?.minLiquidityBaseUnits;
  const cfgMax = config?.maxYieldBps;
  const cfgSens = config?.volatilitySensitivity;
  useEffect(() => {
    if (cfgMin === undefined || cfgMax === undefined || cfgSens === undefined) return;
    setMinLiq((Number(cfgMin) / 1e7).toString());
    setMaxYieldPct(cfgMax / 100);
    setSensitivity(cfgSens);
  }, [cfgMin, cfgMax, cfgSens]);

  const save = async () => {
    if (busy) return;
    const base = toBase(minLiq) ?? "0";
    setBusy(true);
    setMsg(null);
    try {
      await api.saveConfig(auth, {
        minLiquidityBaseUnits: base,
        maxYieldBps: Math.round(maxYieldPct * 100),
        volatilitySensitivity: Math.round(sensitivity),
        countryLimitsBps: config?.countryLimitsBps ?? {},
        agentEnabled,
      });
      setMsg("Risk rules saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message.replace(/^API[^:]*:\s*/, "") : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-sm font-medium text-white">Risk rules</p>
      <p className="mt-0.5 text-xs text-slate-500">The guardrails the agent must respect.</p>

      <div className="mt-3 space-y-3">
        <div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Max in yield</span>
            <span className="font-mono text-brand">{maxYieldPct.toFixed(0)}%</span>
          </div>
          <input type="range" min={0} max={100} value={maxYieldPct} onChange={(e) => setMaxYieldPct(Number(e.target.value))} className="mt-1 w-full accent-[#22d3a5]" />
        </div>
        <div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>FX sensitivity</span>
            <span className="font-mono text-brand">{sensitivity} / 100</span>
          </div>
          <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="mt-1 w-full accent-[#22d3a5]" />
        </div>
        <label className="block text-[11px] text-slate-400">
          Min liquidity buffer (USDC)
          <input
            value={minLiq}
            onChange={(e) => setMinLiq(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 font-mono text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </label>
      </div>

      <button onClick={() => void save()} disabled={busy} className="btn-primary mt-3 w-full justify-center px-3 py-2 text-xs disabled:opacity-40">
        {busy ? "Saving…" : "Save risk rules"}
      </button>
      {msg && <p className="mt-2 break-words text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}

function CreateVaultPanel({
  auth,
  address,
  onCreated,
}: {
  auth: ApiAuth;
  address: string | null;
  onCreated: (v: DeployedVault) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Corporate Vault");
  const [asset, setAsset] = useState<"XLM" | "USDC">("XLM");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const network = useNetwork();
  const selectCls =
    "rounded-lg border border-white/15 bg-ink-900 px-2.5 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand";

  const create = async () => {
    if (busy) return;
    if (!address) return setMsg("Connect a wallet first.");
    setBusy(true);
    setMsg(null);
    setTx(null);
    try {
      // Real factory deploy: build → sign in Freighter → submit. You own the vault.
      setMsg("Preparing deploy…");
      const { xdr } = await api.prepareCreateVault(auth, { asset, name, address });
      setMsg("Approve in your wallet…");
      const signed = await signWalletTransaction(xdr, address);
      setMsg("Deploying vault on-chain…");
      const r = await api.submitMove(auth, signed);
      const vaultAddr = typeof r.returnValue === "string" ? r.returnValue : undefined;
      setTx(r.txHash);
      onCreated({ name, asset, address: vaultAddr, txHash: r.txHash, createdAt: new Date().toISOString() });
      setMsg("Vault deployed — signed by you:");
    } catch (e) {
      setMsg(friendlyError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">Vaults</p>
          <p className="mt-0.5 text-xs text-slate-500">Deploy your own DeFindex vault (Blend yield strategy) — real factory deploy, signed by your wallet.</p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost px-3 py-1.5 text-xs">
          {open ? "Cancel" : "New vault"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            maxLength={32}
            className={selectCls}
          />
          <select value={asset} onChange={(e) => setAsset(e.target.value as "XLM" | "USDC")} className={selectCls}>
            <option value="XLM">XLM · Blend strategy</option>
            <option value="USDC">USDC (no {network} strategy yet)</option>
          </select>
          <button onClick={() => void create()} disabled={busy} className="btn-primary justify-center px-3 py-2 text-xs disabled:opacity-40 sm:col-span-2">
            {busy ? "…" : "Create vault"}
          </button>
        </div>
      )}
      {(msg || tx) && (
        <p className="mt-2 flex flex-wrap items-center gap-1.5 break-words text-[11px] text-slate-400">
          <span>{msg}</span>
          {tx && <TxLink hash={tx} />}
        </p>
      )}
    </div>
  );
}
