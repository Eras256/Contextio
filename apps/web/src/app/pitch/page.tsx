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

const SLIDES = [
  "Cover",
  "The problem",
  "Why now",
  "What we built",
  "How the money moves",
  "Live today",
  "The cost today",
  "Business model",
  "What's different",
  "Team",
  "Where we are",
  "Talk to us",
];

function Slide({
  n,
  eyebrow,
  wide = false,
  children,
}: {
  n: number;
  eyebrow?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`slide-${n}`}
      className="sm:snap-start flex min-h-[80vh] flex-col justify-center border-b border-white/5 py-16 first:pt-8 last:min-h-[60vh] last:border-0"
    >
      <div className={`mx-auto w-full ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="label mb-4 flex items-center gap-2 text-brand">
          <span className="h-px w-6 bg-brand/50" aria-hidden />
          {String(n).padStart(2, "0")} / 12 {eyebrow ? `: ${eyebrow}` : ""}
        </div>
        {children}
      </div>
    </section>
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

export default function PitchPage() {
  return (
    <div className="relative">
      {/* Dot nav, desktop only */}
      <nav
        aria-label="Slide navigation"
        className="fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 lg:flex"
      >
        {SLIDES.map((label, i) => (
          <a
            key={label}
            href={`#slide-${i + 1}`}
            title={`${i + 1}. ${label}`}
            className="h-2 w-2 rounded-full border border-white/25 bg-white/10 transition hover:bg-brand hover:border-brand"
          />
        ))}
      </nav>

      <div className="sm:snap-y sm:snap-proximity">
        {/* 1. Cover */}
        <Slide n={1}>
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-white sm:text-6xl">Contextio</h1>
          <p className="mt-3 text-lg text-slate-300 sm:text-xl">
            Agentic treasury and payroll for Latin America, built on Stellar
          </p>
          <p className="mt-8 max-w-xl text-2xl font-medium text-white sm:text-3xl">
            {'"Software moves your money. Prove it was allowed to."'}
          </p>
          <p className="mt-8 text-sm text-slate-400">
            Post-launch, pre-revenue. Live on Stellar testnet and mainnet.
          </p>
        </Slide>

        {/* 2. The problem */}
        <Slide n={2} eyebrow="The problem">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Nobody can prove it was allowed</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Software is starting to move company money on its own. Once it does, nobody can prove afterward
            that a specific payment was authorized under specific terms. That gap is what keeps a finance
            team from letting an agent near its treasury.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            It is most acute where the friction is already highest: companies paying distributed teams
            across Latin America. Volatile local currencies, slow and expensive cross-border rails, idle
            treasury cash earning nothing, compliance living in PDFs nobody can check.
          </p>
        </Slide>

        {/* 3. Why now */}
        <Slide n={3} eyebrow="Why now">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Agents can sign. Nothing binds them yet</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Agents are starting to hold real spending authority. Nothing today binds that authority to
            enforceable terms at the moment the agent signs.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            The Legal Context Protocol launched in 2026: the American Arbitration Association and Integra
            Ledger, with the Stellar Development Foundation as a founding contributor. We did not invent it.
            We built the part that makes it enforceable at the signing path of an autonomous agent, the part
            nobody had built.
          </p>
        </Slide>

        {/* 4. What we built */}
        <Slide n={4} eyebrow="What we built">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">A signed manifest on every action</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Contextio is an autonomous treasury and payroll agent. Every action that changes state is
            cryptographically bound to a signed Legal Context Protocol manifest, and the manifest hash goes
            on-chain with the transaction.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            We are a Level 4 conformant implementation, self-assessed against the published criteria. The{" "}
            <a href="/legal-context" className="text-brand underline hover:no-underline">
              conformance report
            </a>{" "}
            and the hash recomputation are public. Check it yourself:
          </p>
          <CopyBlock code={VERIFY_CMD} />
          <p className="mt-3 font-mono text-xs text-slate-500">
            atrHash: {LCP_HASH} (document version {LCP_VERSION})
          </p>
        </Slide>

        {/* 5. How the money moves */}
        <Slide n={5} eyebrow="How the money moves" wide>
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">The company wallet signs. Not us</h2>
          <div className="mt-6">
            <ArchitectureDiagram />
          </div>
          <div className="mx-auto mt-6 max-w-3xl space-y-4">
            <p className="text-base leading-relaxed text-slate-300">
              Company wallet signs. Contextio proposes actions. Soroban contracts execute. The LCP manifest
              hash binds every one of them. Settlement happens on Stellar.
            </p>
            <p className="text-base leading-relaxed text-slate-300">
              Funds stay in the company&apos;s own USDC wallet. Contextio holds no key that can move that money.
              On mainnet, a signing key cannot exist on the process: it refuses to boot if one is present.
            </p>
            <p className="text-base leading-relaxed text-slate-300">
              The decision engine is deterministic and auditable. An LLM, any provider, bring your own key,
              only writes the plain-language explanation. It never makes a financial decision.
            </p>
          </div>
        </Slide>

        {/* 6. Live today */}
        <Slide n={6} eyebrow="Live today">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Live today, not a deck</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Testnet runs the full autonomous stack, live 24/7: real Blend v2 lending, real DeFindex vaults,
            a real payroll contract, no human in the loop.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Mainnet is live and deliberately narrow: a real price oracle, self-custody actions, zero
            custodial surface, invitation-only while the contracts wait for external audit.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Open-source client SDK on npm:{" "}
            <a
              href="https://www.npmjs.com/package/contextio-sdk"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-brand underline hover:no-underline"
            >
              contextio-sdk
            </a>
            .
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

          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <a href="https://www.contextio.xyz" target="_blank" rel="noreferrer" className="btn-ghost">
              Live testnet product
            </a>
            <a
              href="https://contextio-api-mainnet.fly.dev/readyz"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              Mainnet health check
            </a>
            <a
              href="https://www.npmjs.com/package/contextio-sdk"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              npm package
            </a>
          </div>
        </Slide>

        {/* 7. The cost today */}
        <Slide n={7} eyebrow="The cost today">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">What it costs today, without Contextio</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            A LATAM company paying 25 distributed contractors around $2,000 a month each runs $50,000 of
            monthly payroll. Today it pays roughly $1,225 a month in platform fees, loses 2 to 4 percent to
            FX spread on cross-border settlement, and earns nothing on the one to two months of payroll it
            holds as a buffer.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <tbody>
                <tr className="table-row">
                  <td className="px-4 py-3 text-slate-400">Platform fees (25 contractors, $49/mo each)</td>
                  <td className="px-4 py-3 text-right font-mono text-white">$1,225 / mo</td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 text-slate-400">FX spread on $50,000 settled cross-border</td>
                  <td className="px-4 py-3 text-right font-mono text-white">$1,000 to $2,000 / mo</td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 text-slate-400">Yield foregone on a 1 to 2 month buffer</td>
                  <td className="px-4 py-3 text-right font-mono text-white">not zero, not tracked</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-white">Close to</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-brand">$2,800 / mo</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            None of it shows up on a single invoice. Contextio starts at a fraction of that per month, and
            is the only one of the three costs above that also leaves a provable audit trail.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Platform fee is Deel&apos;s public contractor management rate, verified live. FX spread and yield
            figures are market ranges, not a quote from a specific provider.
          </p>
        </Slide>

        {/* 8. Business model */}
        <Slide n={8} eyebrow="Business model">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">One subscription, priced by headcount</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            One revenue stream: a SaaS subscription, priced by how many people a company pays. Access to
            the software, nothing else.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            No percentage of assets under management. No fee per transaction. No spread on the amount
            moved. No cut of principal.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            That is also the compliance argument. It is what keeps us a software company, not an asset
            manager or a payment institution, in every jurisdiction we looked at.
          </p>
        </Slide>

        {/* 9. What's different */}
        <Slide n={9} eyebrow="What's different">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">A standard, not a moat</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Payroll and treasury automation exist elsewhere, including on Stellar. None of them can prove
            to an auditor that a specific payment was authorized under specific legal terms. That layer is
            a standard, not a moat, which makes several of these projects possible integrators rather than
            rivals.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Off-chain, Deel, Remote, Ontop, and Payoneer have real distribution. Settlement is slow,
            expensive, and impossible to verify independently. Request Finance, Utopia Labs, Rise, and
            Superfluid do not combine autonomous treasury yield with payroll settlement, and none has an
            on-chain compliance layer.
          </p>
        </Slide>

        {/* 10. Team */}
        <Slide n={10} eyebrow="Team">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Team</h2>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-base font-semibold text-white">Giovanny Amador</p>
              <p className="text-sm text-slate-400">
                CEO and lead architect, Stellar México Ambassador. Built the protocol: Soroban contracts,
                the autonomous agent, the SDK.
              </p>
            </div>
            <div>
              <p className="text-base font-semibold text-white">Monserrat Mendoza</p>
              <p className="text-sm text-slate-400">COO, product and UX, Stellar México Ambassador.</p>
            </div>
            <div>
              <p className="text-base font-semibold text-white">Gonzalo Chacón</p>
              <p className="text-sm text-slate-400">CCO, commercial strategy and go-to-market.</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-400">Gio and Monse are SDF SCALE and Impacta graduates.</p>
        </Slide>

        {/* 11. Where we are */}
        <Slide n={11} eyebrow="Where we are">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">Where we are, what&apos;s next</h2>
          <p className="mt-5 text-base leading-relaxed text-slate-300">
            Post-launch, pre-revenue, one internal tenant today.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Next: external audit of the Soroban contracts, a licensed anchor relationship for real
            local-rail settlement in Brazil, Argentina, and Colombia, and the first external pilot customer.
          </p>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Building this out through the Stellar Community Fund Integration Track.
          </p>
        </Slide>

        {/* 12. CTA */}
        <Slide n={12} eyebrow="Talk to us">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">For finance teams and for partners</h2>
          <p className="mt-4 text-base text-slate-300">For finance teams: request pilot access.</p>
          <p className="mt-1 text-base text-slate-300">For investors and partners: talk to us.</p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <a href="/treasury" className="btn-primary">
              Product
            </a>
            <a href="/docs" className="btn-ghost">
              Docs
            </a>
            <a
              href="https://github.com/Eras256/Contextio"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
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
        </Slide>
      </div>
    </div>
  );
}
