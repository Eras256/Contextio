import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { GeoBlockNotice } from "@/components/GeoBlockNotice";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Contextio — Smart Treasury & Payroll for LATAM on Stellar",
  description:
    "A smart money assistant for Latin American businesses: keep payday covered, earn yield on idle cash, and pay your team in Brazil, Argentina, and Colombia — non-custodial, on Stellar.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} max-w-full overflow-x-hidden`}>
      <body className="min-h-screen max-w-full overflow-x-hidden">
        <div className="aurora-bg" aria-hidden />
        <I18nProvider>
          <AuthProvider>
            <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden">
              <DisclaimerBanner />
              <GeoBlockNotice />
              <Navbar />
              <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
              <Footer />
            </div>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
