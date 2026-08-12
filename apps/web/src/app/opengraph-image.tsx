import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Contextio: agentic treasury and payroll for Latin America, built on Stellar";

/**
 * Site-wide social preview card. Every page inherits this unless it defines
 * its own opengraph-image, so a link dropped in WhatsApp, X, Slack, or
 * anywhere else that unfurls Open Graph tags gets a real card instead of a
 * bare URL: logo, one-line description, and what actually runs on each
 * network, not marketing copy that outruns the product.
 */
export default async function OgImage() {
  const icon = await readFile(join(process.cwd(), "public/logo-icon.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#080b14",
          backgroundImage:
            "radial-gradient(circle at 78% 8%, rgba(45,212,191,0.16), transparent 55%), radial-gradient(circle at 8% 92%, rgba(167,139,250,0.14), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} width={72} height={72} alt="" />
            <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1, color: "#f8fafc" }}>
              Contextio
            </span>
          </div>
          <div style={{ display: "flex", marginTop: 34, maxWidth: 880 }}>
            <span style={{ fontSize: 32, color: "#cbd5e1", lineHeight: 1.35 }}>
              Agentic treasury and payroll for Latin America, built on Stellar
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: "#34d399" }} />
            <span style={{ fontSize: 22, fontFamily: "monospace", color: "#34d399", letterSpacing: 1 }}>
              MAINNET: SELF-CUSTODY PAYOUTS, REAL PRICE ORACLE
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: "#f5b54a" }} />
            <span style={{ fontSize: 22, fontFamily: "monospace", color: "#f5b54a", letterSpacing: 1 }}>
              TESTNET: AUTONOMOUS TREASURY AND PAYROLL, 24/7
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 20,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span style={{ fontSize: 24, fontFamily: "monospace", color: "#2dd4bf" }}>contextio.xyz</span>
          <span style={{ fontSize: 20, fontFamily: "monospace", color: "#64748b" }}>npm i contextio-sdk</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
