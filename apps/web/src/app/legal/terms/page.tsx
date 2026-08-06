"use client";

import { useT, Locale } from "@/lib/i18n";
import { useState, useEffect } from "react";
import Link from "next/link";

const SECTIONS = {
  en: [
    {
      id: "scope",
      title: "1. Scope of Services & Technology Provider Status",
      content: `Contextio is a non-custodial technology platform (and not a financial services provider, fintech, bank, credit institution, or custodian) operating on the Stellar network. We provide purely technical software tools allowing businesses to configure automated treasury allocations (e.g., through Blend and DeFindex protocols) and execute localized payroll flows in Latin America (including Brazil, Argentina, and Colombia). The platform acts as an agentic assistant that proposes moves based on tenant-configured parameters; however, the ultimate execution and cryptographic authorization always remain with the tenant's operator keys.`,
    },
    {
      id: "self-custody",
      title: "2. Self-Custody and Security",
      content: `You retain sole ownership and control of your private cryptographic keys and credentials (such as Freighter or other Stellar-compatible wallets). Contextio does not store, hold, or have access to your private keys. All blockchain-state modifications, including DeFi deposits, yields, and transfers, must be explicitly signed by you. You are entirely responsible for safeguarding your credentials and verifying all transaction parameters before signing.`,
    },
    {
      id: "lcp",
      title: "3. Legal Context Protocol (LCP)",
      content: `Contextio implements the Legal Context Protocol (LCP). Every state-changing transaction executed through the platform embeds a cryptographic binding (SHA-256 hash) linking directly to this Terms of Service document. By initiating and signing any agentic or manual transaction on-chain, you cryptographically bind your business to the terms, consent requirements, and dispute resolutions set forth herein at the time of execution.`,
    },
    {
      id: "risk",
      title: "4. Risk Disclosure",
      content: `Blockchain transactions are public, irreversible, and inherit smart-contract risks. Interacting with third-party decentralized applications like Blend (lending pools) and DeFindex (index vaults) involves risks of protocol exploits, smart contract vulnerabilities, stablecoin peg failures, and extreme market volatility. Contextio is a technology provider, not a financial advisor or a custodian. All assets deployed on-chain are at your own risk.`,
    },
    {
      id: "disputes",
      title: "5. Governing Law and Dispute Resolution",
      content: `These Terms shall be governed by and construed in accordance with the laws of Brazil, Argentina, Colombia, or Switzerland, depending on the jurisdiction of your tenant's registration or the applicable dispute venue. Any conflict, claim, or dispute arising out of these terms or our services shall be submitted to the matching arbitration channel defined in the LCP manifest, governed by the laws and languages specified in the contextio-legal-context.json metadata.`,
      link: { href: "/legal-context", label: "See the current, authoritative list of jurisdictions and dispute channels ➔" },
    },
  ],
  es: [
    {
      id: "scope",
      title: "1. Alcance de los Servicios y Estado de Proveedor de Tecnología",
      content: `Contextio es una plataforma tecnológica sin custodia (y no un proveedor de servicios financieros, fintech, banco, entidad de crédito o custodio) que opera en la red Stellar. Proporcionamos herramientas de software puramente técnicas que permiten a las empresas configurar asignaciones de tesorería automatizadas (por ejemplo, a través de los protocolos Blend y DeFindex) y ejecutar flujos de nómina localizados en América Latina (incluyendo Brasil, Argentina y Colombia). La plataforma actúa como un asistente inteligente que propone movimientos basados en parámetros de configuración; sin embargo, la ejecución final y la autorización criptográfica siempre permanecen con las claves del operador del inquilino.`,
    },
    {
      id: "self-custody",
      title: "2. Autocustodia y Seguridad",
      content: `Usted conserva la propiedad y el control exclusivos de sus claves criptográficas privadas y credenciales (como Freighter u otras billeteras compatibles con Stellar). Contextio no almacena, retiene ni tiene acceso a sus claves privadas. Todas las modificaciones de estado en la cadena de bloques, incluidos los depósitos DeFi, rendimientos y transferencias, deben ser firmadas explícitamente por usted. Usted es el único responsable de salvaguardar sus credenciales y verificar todos los parámetros de las transacciones antes de firmar.`,
    },
    {
      id: "lcp",
      title: "3. Protocolo de Contexto Legal (LCP)",
      content: `Contextio implementa el Protocolo de Contexto Legal (LCP). Cada transacción de cambio de estado ejecutada a través de la plataforma incorpora un enlace criptográfico (hash SHA-256) que vincula directamente a este documento de Términos de Servicio. Al iniciar y firmar cualquier transacción on-chain, ya sea manual o a través del agente, usted vincula criptográficamente a su empresa con los términos, requisitos de consentimiento y resolución de disputas establecidos en este documento al momento de la ejecución.`,
    },
    {
      id: "risk",
      title: "4. Divulgación de Riesgos",
      content: `Las transacciones en blockchain son públicas, irreversibles y heredan los riesgos de los contratos inteligentes. La interacción con aplicaciones descentralizadas de terceros como Blend (pools de préstamos) y DeFindex (bóvedas de índices) implica riesgos de exploits de protocolos, vulnerabilidades de contratos inteligentes, fallas de paridad de monedas estables y volatilidad extrema del mercado. Contextio es un proveedor de tecnología, no un asesor financiero ni un custodio. Todos los activos desplegados on-chain corren por su propia cuenta y riesgo.`,
    },
    {
      id: "disputes",
      title: "5. Ley Aplicable y Resolución de Disputas",
      content: `Estos Términos se regirán e interpretarán de acuerdo con las leyes de Brasil, Argentina, Colombia o Suiza, según la jurisdicción de registro de su empresa o el canal de disputa correspondiente. Cualquier conflicto, reclamo o disputa que surja de estos términos o de nuestros servicios se someterá al canal de arbitraje correspondiente definido en el manifiesto LCP, regulado por las leyes e idiomas especificados en la metadata de contextio-legal-context.json.`,
      link: { href: "/legal-context", label: "Ver la lista vigente y autoritativa de jurisdicciones y canales de disputa ➔" },
    },
  ],
  pt: [
    {
      id: "scope",
      title: "1. Escopo dos Serviços e Status de Provedor de Tecnologia",
      content: `A Contextio é uma plataforma tecnológica sem custódia (e não uma provedora de serviços financeiros, fintech, banco, instituição de crédito ou custodiante) que opera na rede Stellar. Fornecemos ferramentas de software puramente técnicas que permitem às empresas configurar alocações automatizadas de tesouraria (por exemplo, por meio dos protocolos Blend e DeFindex) e executar fluxos de folha de pagamento localizados na América Latina (incluindo Brasil, Argentina e Colômbia). A plataforma atua como um assistente inteligente que propõe movimentações com base em parâmetros configurados; no entanto, a execução final e a autorização criptográfica sempre permanecem com as chaves do operador do inquilino.`,
    },
    {
      id: "self-custody",
      title: "2. Autocustódia e Segurança",
      content: `Você mantém a propriedade e o controle exclusivos de suas chaves criptográficas privadas e credenciais (como a Freighter ou outras carteiras compatíveis com a Stellar). A Contextio não armazena, retém ou tem acesso às suas chaves privadas. Todas as modificações de estado na blockchain, incluindo depósitos DeFi, rendimentos e transferências, devem ser explicitamente assinadas por você. Você é inteiramente responsável por proteger suas credenciais e verificar todos os parâmetros da transação antes de assinar.`,
    },
    {
      id: "lcp",
      title: "3. Protocolo de Contexto Legal (LCP)",
      content: `A Contextio implementa o Protocolo de Contexto Legal (LCP). Cada transação de alteração de estado executada por meio da plataforma incorpora uma vinculação criptográfica (hash SHA-256) que se conecta diretamente a este documento de Termos de Serviço. Ao iniciar e assinar qualquer transação na blockchain, seja manual ou orientada pelo agente, você vincula criptograficamente sua empresa aos termos, requisitos de consentimento e resoluções de disputas aqui estabelecidos no momento da execução.`,
    },
    {
      id: "risk",
      title: "4. Divulgação de Riscos",
      content: `As transações em blockchain são públicas, irreversíveis e herdam riscos de contratos inteligentes. A interação com aplicativos descentralizados de terceiros, como a Blend (pools de empréstimos) e a DeFindex (index vaults), envolve riscos de explorações de protocolo, vulnerabilidades de contratos inteligentes, falhas de pareamento de stablecoins e extrema volatilidade do mercado. A Contextio é uma provedora de tecnologia, não uma assessoria financeira ou custodiante. Todos os ativos implantados na rede correm por sua conta e risco.`,
    },
    {
      id: "disputes",
      title: "5. Lei Regente e Resolução de Disputas",
      content: `Estes Termos serão regidos e interpretados de acordo com as leis do Brasil, Argentina, Colômbia ou Suíça, dependendo da jurisdição de registro de sua empresa ou do canal de disputa correspondente. Qualquer conflito, reivindicação ou disputa decorrente destes termos ou de nossos serviços será submetido ao canal de arbitragem correspondente definido no manifesto LCP, regido pelas leis e idiomas especificados nos metadados do contextio-legal-context.json.`,
      link: { href: "/legal-context", label: "Ver a lista vigente e autoritativa de jurisdições e canais de disputa ➔" },
    },
  ],
};

export default function TermsPage() {
  const t = useT();
  const [activeLocale, setActiveLocale] = useState<Locale>("en");

  useEffect(() => {
    const currentLang = document.documentElement.lang as Locale;
    if (currentLang && (currentLang === "en" || currentLang === "es" || currentLang === "pt")) {
      setActiveLocale(currentLang);
    }
  }, [t]);

  const currentSections = SECTIONS[activeLocale] || SECTIONS.en;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Left Side Navigation */}
        <aside className="lg:w-1/4">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-white/5 bg-ink-900/40 p-5 backdrop-blur">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
              {t("legal.tableOfContents")}
            </h4>
            <nav className="flex flex-col gap-2.5 text-sm">
              {currentSections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {sec.title.split(".")[1] || sec.title}
                </a>
              ))}
              <div className="border-t border-white/5 pt-3 mt-1">
                <a
                  href="/legal/privacy"
                  className="text-accent hover:underline text-xs flex items-center gap-1"
                >
                  {t("legal.privacyPolicy")} ➔
                </a>
              </div>
            </nav>
          </div>
        </aside>

        {/* Right Side Content */}
        <div className="flex-1 space-y-10 lg:w-3/4">
          <div className="space-y-4 border-b border-white/10 pb-6">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t("legal.termsOfService")}
            </h1>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <span>{t("legal.lastUpdated")}: August 6, 2026</span>
              <span>•</span>
              <span className="font-mono uppercase text-brand">LCP-Bound Document</span>
            </div>
          </div>

          <div className="prose prose-invert max-w-none space-y-8 text-slate-300">
            {currentSections.map((sec) => (
              <section key={sec.id} id={sec.id} className="scroll-mt-24 space-y-3">
                <h2 className="text-xl font-semibold text-white border-l-2 border-brand/50 pl-3">
                  {sec.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
                  {sec.content}
                </p>
                {"link" in sec && sec.link && (
                  <Link href="/legal-context" className="inline-block text-xs text-accent hover:underline">
                    {sec.link.label}
                  </Link>
                )}
              </section>
            ))}
          </div>

          {/* Bottom links */}
          <div className="flex justify-between border-t border-white/5 pt-6 text-xs text-slate-500">
            <a href="#top" className="hover:text-slate-300 transition-colors">
              ▲ {t("legal.backToTop")}
            </a>
            <Link href="/" className="hover:text-slate-300 transition-colors">
              Contextio Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
