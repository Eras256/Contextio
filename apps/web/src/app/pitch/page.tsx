"use client";

import { useState } from "react";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";

const LCP_HASH = "0x579eeabf5f640d9cbb274824287fa7d1ef540ae9cc773e79f6d2cec913b4237e";
const LCP_VERSION = 8;

const VERIFY_CMD = `# 1. Fetch the live discovery document and read the declared hash + version
curl -s "https://contextio-api.fly.dev/.well-known/contextio-legal-context.json?domain=contextio.xyz" \\
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["atrHash"], "v"+str(d["version"]))'

# 2. Fetch the terms document it points to, independently
curl -s "https://contextio-api.fly.dev/.well-known/contextio-terms.md" -o terms.md

# 3. Hash it yourself and compare to the atrHash from step 1
sha256sum terms.md`;

/* ── Card-deck primitives, one slide is one card, stacked and scrolled normally. ── */

function SlideHead({ eyebrow, n }: { eyebrow: string; n: number }) {
  return (
    <div className="mb-7 flex items-baseline justify-between gap-4">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
        {eyebrow}
      </span>
      <span className="font-mono text-[11px] text-slate-500">{String(n).padStart(2, "0")} / 12</span>
    </div>
  );
}

function Slide({
  n,
  eyebrow,
  children,
}: {
  n: number;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-7 transition hover:border-white/20 sm:p-12">
      <SlideHead eyebrow={eyebrow} n={n} />
      {children}
    </section>
  );
}

function Badge({ tone, children }: { tone: "live" | "warn" | "brand"; children: React.ReactNode }) {
  const tones: Record<string, string> = {
    live: "text-emerald-400 bg-emerald-400/10",
    warn: "text-amber-400 bg-amber-400/10",
    brand: "text-brand bg-brand/10",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function Cell({ kpi, label, body }: { kpi?: string; label?: string; body?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-850/60 p-5">
      {kpi ? (
        <>
          <div className="font-display text-3xl font-extrabold tracking-[-0.02em] text-white">{kpi}</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-500">{label}</div>
        </>
      ) : (
        <p className="text-sm text-slate-300">{body}</p>
      )}
    </div>
  );
}

function FlowStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex-1 min-w-[150px] rounded-xl border border-white/10 bg-ink-850/60 p-4">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-brand">{n}</div>
      <h3 className="mt-1 text-sm font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm text-slate-300">
      {children}
    </div>
  );
}

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable, ignore */
    }
  };
  return (
    <div className="relative mt-6 overflow-hidden rounded-xl border border-white/10 bg-ink-950/80">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2">
        <span className="font-mono text-[11px] text-slate-500">verify.sh</span>
        <button onClick={() => void copy()} className="btn-ghost px-2.5 py-1 text-[11px]">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[12.5px] leading-relaxed text-slate-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FounderCell({ initials, name, role }: { initials: string; name: string; role: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-ink-850 font-display text-sm font-bold text-brand">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-white">{name}</p>
        <p className="text-sm text-slate-400">{role}</p>
      </div>
    </div>
  );
}

function FooterLinks({ links }: { links: { label: string; href: string }[] }) {
  return (
    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[13px]">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target={l.href.startsWith("http") ? "_blank" : undefined}
          rel={l.href.startsWith("http") ? "noreferrer" : undefined}
          className="text-brand underline decoration-transparent underline-offset-4 transition hover:decoration-brand"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

export default function PitchPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-2">
      {/* 1. Cover */}
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-8 sm:p-16">
        <div className="mb-8 font-display text-sm font-extrabold uppercase tracking-[0.22em] text-white">
          CONTEXTIO<span className="text-brand">.</span>
        </div>
        <h1 className="text-balance font-display text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-6xl">
          Agentic treasury and payroll for Latin America, built on Stellar
        </h1>
        <p className="mt-6 max-w-xl text-pretty text-xl font-medium text-slate-200 sm:text-2xl">
          {'"Software moves your money. Prove it was allowed to."'}
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <Badge tone="live">Live: testnet + mainnet</Badge>
          <Badge tone="warn">Post-launch, pre-revenue</Badge>
        </div>
      </section>

      {/* 2. The problem */}
      <Slide n={2} eyebrow="The problem">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Nobody can prove it was allowed
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Software is starting to move company money on its own. Once it does, nobody can prove afterward
          that a specific payment was authorized under specific terms. That gap is what keeps a finance
          team from letting an agent near its treasury.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          It is most acute where the friction is already highest: companies paying distributed teams
          across Latin America. Volatile local currencies, slow and expensive cross-border rails, idle
          treasury cash earning nothing, compliance living in PDFs nobody can check.
        </p>
      </Slide>

      {/* 3. Why now */}
      <Slide n={3} eyebrow="Why now">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Agents can sign. Nothing binds them yet
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Agents are starting to hold real spending authority. Nothing today binds that authority to
          enforceable terms at the moment the agent signs.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          The Legal Context Protocol launched in 2026: the American Arbitration Association and Integra
          Ledger, with the Stellar Development Foundation as a founding contributor. We did not invent it.
          We built the part that makes it enforceable at the signing path of an autonomous agent, the part
          nobody had built.
        </p>
      </Slide>

      {/* 4. What we built */}
      <Slide n={4} eyebrow="What we built">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          A signed manifest on every action
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Contextio is an autonomous treasury and payroll agent. Every action that changes state is
          cryptographically bound to a signed Legal Context Protocol manifest, and the manifest hash goes
          on-chain with the transaction.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          We are a Level 4 conformant implementation, self-assessed against the published criteria. The{" "}
          <a href="/legal-context" className="text-brand underline hover:no-underline">
            conformance report
          </a>{" "}
          and the hash recomputation are public. Check it yourself:
        </p>
        <CopyBlock code={VERIFY_CMD} />
        <p className="mt-3 font-mono text-[11px] text-slate-500">
          atrHash: {LCP_HASH} (document version {LCP_VERSION})
        </p>
      </Slide>

      {/* 5. How the money moves */}
      <Slide n={5} eyebrow="How the money moves">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          The company wallet signs. Not us
        </h2>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <FlowStep n="01" title="Company wallet signs" body="Freighter or Stellar Wallets Kit" />
          <FlowStep n="02" title="Contextio proposes" body="Unsigned XDR, deterministic" />
          <FlowStep n="03" title="Soroban executes" body="Blend, DeFindex, or classic ops" />
          <FlowStep n="04" title="LCP binds it" body="Manifest hash goes on-chain" />
        </div>
        <div className="mt-6">
          <ArchitectureDiagram locale="en" />
        </div>
        <p className="mt-6 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Funds stay in the company&apos;s own USDC wallet. Contextio holds no key that can move that money.
          On mainnet, a signing key cannot exist on the process: it refuses to boot if one is present.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          The decision engine is deterministic and auditable. An LLM, any provider, bring your own key,
          only writes the plain-language explanation. It never makes a financial decision.
        </p>
      </Slide>

      {/* 6. Live today */}
      <Slide n={6} eyebrow="Live today">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Live today, not a deck
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Testnet runs the full autonomous stack, live 24/7: real Blend v2 lending, real DeFindex vaults,
          a real payroll contract, no human in the loop.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Mainnet is live and deliberately narrow: a real price oracle, self-custody actions, zero
          custodial surface, invitation-only while the contracts wait for external audit.
        </p>
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <div className="aspect-video w-full">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/JI7KpNQMo0A"
              title="Contextio demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        <FooterLinks
          links={[
            { label: "www.contextio.xyz", href: "https://www.contextio.xyz" },
            { label: "mainnet /readyz", href: "https://contextio-api-mainnet.fly.dev/readyz" },
            { label: "npm: contextio-sdk", href: "https://www.npmjs.com/package/contextio-sdk" },
          ]}
        />
      </Slide>

      {/* 7. The cost today */}
      <Slide n={7} eyebrow="The cost today">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          What it costs today, without Contextio
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          A LATAM company paying 25 distributed contractors around $2,000 a month each runs $50,000 of
          monthly payroll. Today it pays roughly $1,225 a month in platform fees, loses 2 to 4 percent to
          FX spread on cross-border settlement, and earns nothing on the one to two months of payroll it
          holds as a buffer.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4 text-slate-400">Platform fees (25 contractors, $49/mo each)</td>
                <td className="py-3 text-right font-mono text-white">$1,225 / mo</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4 text-slate-400">FX spread on $50,000 settled cross-border</td>
                <td className="py-3 text-right font-mono text-white">$1,000 to $2,000 / mo</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-3 pr-4 text-slate-400">Yield foregone on a 1 to 2 month buffer</td>
                <td className="py-3 text-right font-mono text-white">not zero, not tracked</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold text-white">Close to</td>
                <td className="py-3 text-right font-mono font-semibold text-brand">$2,800 / mo</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-5 max-w-[62ch] text-base leading-relaxed text-slate-300">
          None of it shows up on a single invoice. Contextio starts at a fraction of that per month, and
          is the only one of the three costs above that also leaves a provable audit trail.
        </p>
        <Note>
          Platform fee is Deel&apos;s public contractor management rate, verified live. FX spread and yield
          figures are market ranges, not a quote from a specific provider.
        </Note>
      </Slide>

      {/* 8. Business model */}
      <Slide n={8} eyebrow="Business model">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          One subscription, priced by headcount
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cell body="One revenue stream: a SaaS subscription, priced by how many people a company pays. Access to the software, nothing else." />
          <Cell body="No percentage of assets under management. No fee per transaction. No spread on the amount moved. No cut of principal." />
          <Cell body="That is also the compliance argument: it keeps us a software company, not an asset manager or a payment institution, in every jurisdiction we looked at." />
        </div>
      </Slide>

      {/* 9. What's different */}
      <Slide n={9} eyebrow="What's different">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          A standard, not a moat
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Payroll and treasury automation exist elsewhere, including on Stellar. None of them can prove
          to an auditor that a specific payment was authorized under specific legal terms. That layer is
          a standard, not a moat, which makes several of these projects possible integrators rather than
          rivals.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Off-chain, Deel, Remote, Ontop, and Payoneer have real distribution. Settlement is slow,
          expensive, and impossible to verify independently. Request Finance, Utopia Labs, Rise, and
          Superfluid do not combine autonomous treasury yield with payroll settlement, and none has an
          on-chain compliance layer.
        </p>
      </Slide>

      {/* 10. Team */}
      <Slide n={10} eyebrow="Team">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Team
        </h2>
        <div className="mt-6 space-y-6">
          <FounderCell
            initials="GA"
            name="Giovanny Amador"
            role="CEO and lead architect, Stellar México Ambassador. Built the protocol: Soroban contracts, the autonomous agent, the SDK."
          />
          <FounderCell
            initials="MM"
            name="Monserrat Mendoza"
            role="COO, product and UX, Stellar México Ambassador."
          />
          <FounderCell initials="GC" name="Gonzalo Chacón" role="CCO, commercial strategy and go-to-market." />
        </div>
        <p className="mt-6 text-sm text-slate-500">Gio and Monse are SDF SCALE and Impacta graduates.</p>
      </Slide>

      {/* 11. Where we are */}
      <Slide n={11} eyebrow="Where we are">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          Where we are, what&apos;s next
        </h2>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Post-launch, pre-revenue, one internal tenant today.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Next: external audit of the Soroban contracts, a licensed anchor relationship for real
          local-rail settlement in Brazil, Argentina, and Colombia, and the first external pilot customer.
        </p>
        <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-slate-300">
          Building this out through the Stellar Community Fund Integration Track.
        </p>
      </Slide>

      {/* 12. CTA */}
      <section className="rounded-2xl border border-white/10 bg-ink-900/50 p-8 sm:p-14">
        <SlideHead eyebrow="Talk to us" n={12} />
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">
          For finance teams and for partners
        </h2>
        <p className="mt-4 text-base text-slate-300">For finance teams: request pilot access.</p>
        <p className="mt-1 text-base text-slate-300">For investors and partners: talk to us.</p>
        <div className="mt-7 flex flex-wrap gap-3 text-sm">
          <a href="/treasury" className="btn-primary">
            Product
          </a>
          <a href="/docs" className="btn-ghost">
            Docs
          </a>
          <a href="https://github.com/contextio/Contextio" target="_blank" rel="noreferrer" className="btn-ghost">
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/contextio-sdk"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
          >
            SDK
          </a>
          <a href="https://youtu.be/JI7KpNQMo0A" target="_blank" rel="noreferrer" className="btn-ghost">
            Demo video
          </a>
        </div>
        <p className="mt-8 max-w-[72ch] text-[11px] leading-relaxed text-slate-600">
          Contextio is a non-custodial technology platform, not a fintech or financial services provider.
          Testnet is a free demo with test assets. Mainnet is invitation-only while the Soroban contracts
          await external audit.
        </p>
      </section>
    </div>
  );
}
