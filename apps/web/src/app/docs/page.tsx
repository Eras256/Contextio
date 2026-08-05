"use client";

import { useState } from "react";
import { Card, SectionHeader } from "@/components/ui";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { OnchainProof } from "@/components/OnchainProof";
import { apiBaseUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";

const REPO_URL = "https://github.com/Eras256/Contextio";
const NPM_URL = "https://www.npmjs.com/package/contextio-sdk";
const STACK = ["Stellar · Soroban", "Rust", "TypeScript", "Next.js", "Supabase", "Fly.io"];

type TabId = "architecture" | "api" | "sdk" | "lcp";

export default function DocsPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<TabId>("architecture");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "architecture", label: "Overview & Architecture" },
    { id: "api", label: "API Reference" },
    { id: "sdk", label: "SDK & Code Samples" },
    { id: "lcp", label: "Legal Context (LCP)" },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Page Header */}
      <SectionHeader
        eyebrow={t("pages.docs.eyebrow")}
        title={t("pages.docs.title")}
        description={t("pages.docs.desc")}
      />

      {/* Tabs navigation */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-px">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap pb-3.5 px-4 text-sm font-semibold transition-all border-b-2 ${
              activeTab === tab.id
                ? "border-brand text-brand"
                : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-8 animate-fade-up">
        {/* Tab 1: Architecture */}
        {activeTab === "architecture" && (
          <div className="space-y-10">
            <section className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.archTitle")}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  {t("pages.docs.archBody")}
                </p>
                <div className="mt-4 p-4 rounded-xl border border-brand/20 bg-brand/5 text-xs text-brand max-w-3xl leading-relaxed">
                  <strong>Non-Custodial Technology Platform Notice:</strong> {"Contextio is a software infrastructure provider, not a fintech, bank, credit institution, or custodian. Operator private keys remain under the user's Freighter or compatible wallet, and any automated agent rebalancing acts as a proposal layer that the tenant explicitly authorizes through cryptographic signatures."}
                </div>
              </div>
              <ArchitectureDiagram />
            </section>

            {/* Verification card */}
            <OnchainProof />

            {/* Oracle & Job Polish */}
            <section className="grid gap-6 md:grid-cols-2">
              <Card className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Reflector Oracle Integration (SEP-40)</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  {"Valuations are driven by the Reflector oracle on-chain. Contextio queries Reflector's smart contract via Soroban ledger simulations to resolve the real-time value of XLM relative to USD. This guarantees that all agentic planning decisions rely on verified, decentralized feeds directly from the network."}
                </p>
              </Card>

              <Card className="p-5 space-y-3">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Staggered Task Scheduling</h4>
                <p className="text-xs leading-relaxed text-slate-400">
                  To prevent sequence number collisions on Stellar nodes, background rebalancing and yield harvesting jobs are stagger-scheduled. The agent scheduler offsets each task (e.g. Blend USDC lending, DeFindex deposits, and treasury evaluations) to stream smoothly over each polling cycle.
                </p>
              </Card>
            </section>

            {/* Stack list */}
            <section className="space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.stackTitle")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("pages.docs.stackBody")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {STACK.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-white/10 bg-ink-900/60 px-3.5 py-1.5 font-mono text-xs text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* Tab 2: API Reference */}
        {activeTab === "api" && (
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-white">API Reference</h3>
              <p className="mt-1 text-sm text-slate-400">Core HTTP endpoints served by the Contextio API gateway (hosted at fly.dev or locally on port 8080).</p>
            </div>

            <div className="space-y-6">
              {/* Endpoint block 1 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/auth/wallet/challenge</span>
                </div>
                <p className="text-xs text-slate-400">Initiates the wallet authentication challenge. Returns an ed25519 payload challenge string designed for Freighter signature to satisfy SEP-53 verification.</p>
              </div>

              {/* Endpoint block 2 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/auth/wallet/verify</span>
                </div>
                <p className="text-xs text-slate-400">Verifies the signed challenge and issues a HS256 JWT, authorizing company-level read/writes aligned with Postgres Row Level Security.</p>
              </div>

              {/* Endpoint block 3 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/treasury/positions</span>
                </div>
                <p className="text-xs text-slate-400">Aggregates company balances on-chain. Returns active vaults, APY, holdings, and allocations on Blend and DeFindex. Cached with a 12s TTL to prevent rate limit throttling.</p>
              </div>

              {/* Endpoint block 4 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/payroll/runs</span>
                </div>
                <p className="text-xs text-slate-400">
                  Executes the scheduled payroll batch payments. Payments are executed directly on-chain.
                  <span className="block mt-1 text-[11px] text-accent font-semibold">Note: Testnet demo operates on a 1:100 scaling ($11,500 gross resolves to 115 USDC transfer) due to testnet asset faucet thresholds.</span>
                </p>
              </div>

              {/* Self-custody prepare/submit pair — treasury */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/treasury/prepare</span>
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/treasury/submit</span>
                </div>
                <p className="text-xs text-slate-400">
                  Self-custody rebalance: <code className="font-mono text-slate-300">/prepare</code> returns an unsigned XDR built server-side for either venue (<code className="font-mono text-slate-300">venue: &quot;blend&quot; | &quot;defindex&quot;</code>); the tenant&apos;s own wallet (Freighter) signs it client-side; <code className="font-mono text-slate-300">/submit</code> broadcasts the already-signed envelope. The server never holds a key capable of moving these funds.
                </p>
              </div>

              {/* Self-custody prepare/submit pair — payroll */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/payroll/runs/prepare</span>
                  <span className="rounded bg-brand/10 border border-brand/30 px-2 py-0.5 font-mono text-xs font-bold text-brand uppercase">POST</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/payroll/runs/submit</span>
                </div>
                <p className="text-xs text-slate-400">
                  Same self-custody pattern for Payouts: unsigned payment XDR out, signed envelope in. Requires an explicit contractor attestation (LFT-safe framing — this settles a contractor invoice in USDC, not a salary payment) before <code className="font-mono text-slate-300">/prepare</code> will build the transaction.
                </p>
              </div>

              {/* SEP-38/31 institutional rails */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/public/anchor/sep38</span>
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/public/anchor/sep31</span>
                </div>
                <p className="text-xs text-slate-400">Real, read-only discovery against Contextio&apos;s own self-hosted Anchor Platform (SEP-38 quote server for indicative FX prices, SEP-31 direct-payment server for accepted institutional settlement assets — XLM against USD/BRL/ARS/COP) — the mechanism a licensed anchor would use to settle payroll cross-border. No funds move on either call.</p>
              </div>

              {/* Relayer */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white break-all">/api/v1/public/relayer</span>
                </div>
                <p className="text-xs text-slate-400">Reports whether OpenZeppelin Channels fee-sponsorship is configured. When enabled, self-custody Payouts submission is fee-sponsored by OpenZeppelin&apos;s own fund account — no platform key involved at any point, which is what makes it safe to run on mainnet under the no-hot-key boot guard.</p>
              </div>

              {/* Endpoint block 5 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 font-mono text-xs font-bold text-sky-400 uppercase">GET</span>
                  <span className="font-mono text-sm text-white break-all">/.well-known/contextio-legal-context.json</span>
                </div>
                <p className="text-xs text-slate-400">Serves the public machine-readable Legal Context Protocol (LCP) manifest containing signed terms hash, provider email, allowed scopes, and dispute forums.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: SDK & Code Samples */}
        {activeTab === "sdk" && (
          <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{t("pages.docs.sdkTitle")}</h3>
                <p className="mt-1 text-sm text-slate-400">{t("pages.docs.sdkBody")}</p>
              </div>
              <a className="btn-primary shrink-0 px-5 py-2.5 text-sm" href={NPM_URL} target="_blank" rel="noreferrer">
                {t("pages.docs.sdkLink")} ↗
              </a>
            </div>

            <div className="space-y-6">
              {/* Code block 1 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Initialize SDK Client & Fetch Treasury</span>
                  <button
                    onClick={() => copyToClipboard(
                      `import { ContextioClient } from "contextio-sdk";\n\n// 1. Unauthenticated handshake: prove control of the tenant's Stellar wallet\nconst anon = new ContextioClient({ baseUrl: "https://contextio-api.fly.dev" });\nconst { message, hmac } = await anon.challenge(walletAddress);\nconst { signedMessage } = await window.stellarWalletsKit.signMessage(message, { address: walletAddress });\nconst session = await anon.verify({ address: walletAddress, message, hmac, signedMessage });\n\n// 2. Authenticated client for tenant-scoped reads\nconst client = anon.withSession(session);\nconst snapshot = await client.treasury();\nconsole.log("Blend + DeFindex positions:", snapshot);`,
                      "sdk-init"
                    )}
                    className="text-brand hover:underline font-mono"
                  >
                    {copiedText === "sdk-init" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`import { ContextioClient } from "contextio-sdk";

// 1. Unauthenticated handshake: prove control of the tenant's Stellar wallet
const anon = new ContextioClient({ baseUrl: "https://contextio-api.fly.dev" });
const { message, hmac } = await anon.challenge(walletAddress);
const { signedMessage } = await window.stellarWalletsKit.signMessage(message, { address: walletAddress });
const session = await anon.verify({ address: walletAddress, message, hmac, signedMessage });

// 2. Authenticated client for tenant-scoped reads
const client = anon.withSession(session);
const snapshot = await client.treasury();
console.log("Blend + DeFindex positions:", snapshot);`}</pre>
                </div>
              </div>

              {/* Code block 2 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Self-Custody Rebalance (unsigned XDR out, signed envelope in)</span>
                  <button
                    onClick={() => copyToClipboard(
                      `// prepare/submit aren't wrapped in the SDK yet — call the API directly,\n// reusing the same session from client.withSession() above.\nconst prep = await fetch("https://contextio-api.fly.dev/api/v1/treasury/prepare", {\n  method: "POST",\n  headers: { "content-type": "application/json", authorization: \`Bearer \${session.token}\`, "x-tenant-id": session.tenantId },\n  body: JSON.stringify({ venue: "blend", action: "deposit", asset: "USDC", amount: "500.0000000" }),\n}).then((r) => r.json());\n\n// Sign the unsigned XDR locally with the tenant's own wallet\nconst signedXdr = await window.stellarWalletsKit.signTransaction(prep.xdr);\n\nconst result = await fetch("https://contextio-api.fly.dev/api/v1/treasury/submit", {\n  method: "POST",\n  headers: { "content-type": "application/json", authorization: \`Bearer \${session.token}\`, "x-tenant-id": session.tenantId },\n  body: JSON.stringify({ signedXdr }),\n}).then((r) => r.json());\nconsole.log("Onchain tx hash:", result.txHash);`,
                      "sdk-rebalance"
                    )}
                    className="text-brand hover:underline font-mono"
                  >
                    {copiedText === "sdk-rebalance" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`// prepare/submit aren't wrapped in the SDK yet — call the API directly,
// reusing the same session from client.withSession() above.
const prep = await fetch("https://contextio-api.fly.dev/api/v1/treasury/prepare", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: \`Bearer \${session.token}\`, "x-tenant-id": session.tenantId },
  body: JSON.stringify({ venue: "blend", action: "deposit", asset: "USDC", amount: "500.0000000" }),
}).then((r) => r.json());

// Sign the unsigned XDR locally with the tenant's own wallet
const signedXdr = await window.stellarWalletsKit.signTransaction(prep.xdr);

const result = await fetch("https://contextio-api.fly.dev/api/v1/treasury/submit", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: \`Bearer \${session.token}\`, "x-tenant-id": session.tenantId },
  body: JSON.stringify({ signedXdr }),
}).then((r) => r.json());
console.log("Onchain tx hash:", result.txHash);`}</pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Legal Context (LCP) */}
        {activeTab === "lcp" && (
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                {t("pages.docs.lcpTitle")}
              </h3>
              <p className="text-sm leading-relaxed text-slate-300">
                {t("pages.docs.lcpBody")}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  className="btn-primary text-xs px-4 py-2"
                  href="/legal-context"
                >
                  View Live LCP Manifest ➔
                </a>
                <a
                  className="btn-ghost text-xs px-4 py-2"
                  href="/.well-known/contextio-legal-context.json"
                  target="_blank"
                  rel="noreferrer"
                >
                  Raw contextio-legal-context.json ↗
                </a>
              </div>
            </Card>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Verifying LCP Binding event topic (Soroban SDK verification guide)</span>
                <button
                  onClick={() => copyToClipboard(
                    `import { hashLegalContext, verifyBinding } from "@contextio/shared/lcp";\nimport { fetchLcpManifest } from "@/lib/api";\n\n// 1. Fetch the canonical legal manifest from tenant's domain\nconst manifest = await fetchLcpManifest("contextio.xyz");\n\n// 2. Hash the manifest locally using deterministic canonicalization\nconst manifestHash = hashLegalContext(manifest);\n\n// 3. Verify that the onchain event binding matches the manifest hash\nconst isValid = verifyBinding({\n  onchainBinding: event.topics[2].toString(),\n  manifestHash\n});\n\nconsole.log("LCP Binding status:", isValid ? "VALID & COMPLIANT" : "FAIL");`,
                    "sdk-lcp"
                  )}
                  className="text-brand hover:underline font-mono"
                >
                  {copiedText === "sdk-lcp" ? "Copied!" : "Copy"}
                </button>
              </div>
              <div className="rounded-xl border border-white/5 bg-ink-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{`import { hashLegalContext, verifyBinding } from "@contextio/shared/lcp";
import { fetchLcpManifest } from "@/lib/api";

// 1. Fetch the canonical legal manifest from tenant's domain
const manifest = await fetchLcpManifest("contextio.xyz");

// 2. Hash the manifest locally using deterministic canonicalization
const manifestHash = hashLegalContext(manifest);

// 3. Verify that the onchain event binding matches the manifest hash
const isValid = verifyBinding({
  onchainBinding: event.topics[2].toString(),
  manifestHash
});

console.log("LCP Binding status:", isValid ? "VALID & COMPLIANT" : "FAIL");`}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
