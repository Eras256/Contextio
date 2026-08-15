"use client";

import { useT, Locale } from "@/lib/i18n";
import { useState, useEffect } from "react";
import Link from "next/link";

const SECTIONS = {
  en: [
    {
      id: "collection",
      title: "1. Data Collection",
      content: `Contextio is a non-custodial technology platform (and not a financial services provider, fintech, bank, credit institution, or custodian). We collect public and company-related metadata solely to facilitate decentralized treasury and payroll software workflows. We process:
- Stellar public wallet addresses.
- Company details (e.g., registered name, domain, country, and local ID).
- Contact email addresses provided in the Legal Context Protocol (LCP) setup.
- Non-custodial transaction hashes, positions, and active payroll runs.
We do NOT collect, store, or transmit private cryptographic keys, passphrases, or sensitive security credentials.`,
    },
    {
      id: "processing",
      title: "2. Purposes of Processing",
      content: `Your data is processed exclusively to:
- Authenticate and establish wallet-based sessions (via SEP-53 challenge/verify).
- Keep track of company balances, yield positions, and payroll history.
- Run local time conversions and structured console traces for the live audit logs.
- Sync UI panels in real time through Supabase Postgres database changes.
All data is processed under appropriate data protection laws (such as LGPD in Brazil, Ley 25.326 in Argentina, Ley 1581 in Colombia, and the Federal Act on Data Protection (FADP) in Switzerland).`,
    },
    {
      id: "blockchain",
      title: "3. Blockchain Transparency and Irreversibility",
      content: `Please note that all transactions settled on the Stellar network (including payroll runs and treasury rebalances) are public, transparent, and irreversible. Wallet addresses and transaction hashes associated with your operations will be recorded permanently on the ledger. These entries cannot be modified or deleted, even if requested under right-to-be-forgotten claims, due to the decentralized nature of blockchain technology.`,
    },
    {
      id: "sharing",
      title: "4. Third-Party Protocols and Integrations",
      content: `Contextio interacts with Stellar Horizon RPC endpoints and decentralized protocol smart contracts (specifically Blend lending pools and DeFindex index vaults). Your public addresses and transaction payloads are shared with these decentralized networks during rebalances and deposits. We link to an external anchor (testanchor.stellar.org) for SEP-24 interactive off-ramp capabilities, and operate our own self-hosted Anchor Platform for SEP-31/38 institutional settlement discovery and quoting — a separate Contextio-operated system, not a third party, though still a distinct service from the main application. These third-party protocols have their own rules, and we do not assume liability for their data handling.`,
    },
    {
      id: "rights",
      title: "5. Your Rights",
      content: `Depending on your location, you may have rights under LGPD, Ley 25.326, Ley 1581, or the FADP, including:
- Accessing the database entries stored for your company.
- Rectifying inaccurate contact or email metadata.
- Objecting to or requesting deletion of off-chain database logs (excluding public blockchain transactions).
To exercise these rights, please contact our legal email address: legal@contextio.xyz.`,
    },
  ],
  es: [
    {
      id: "collection",
      title: "1. Recolección de Datos",
      content: `Contextio es una plataforma tecnológica sin custodia (y no un proveedor de servicios financieros, fintech, banco, entidad de crédito o custodio). Recopilamos metadatos públicos y relacionados con la empresa únicamente para facilitar los flujos de trabajo descentralizados de software de tesorería y dispersión de pagos. Procesamos:
- Direcciones públicas de Stellar Wallet.
- Detalles de la empresa (nombre legal, dominio, país e ID de registro local).
- Direcciones de correo electrónico de contacto proporcionadas en la configuración del Protocolo de Contexto Legal (LCP).
- Hashes de transacciones sin custodia, posiciones líquidas e historial de ejecuciones de dispersión.
NO recopilamos, almacenamos ni transmitimos claves criptográficas privadas, frases semilla ni credenciales de seguridad sensibles.`,
    },
    {
      id: "processing",
      title: "2. Finalidad del Procesamiento",
      content: `Sus datos se procesan exclusivamente para:
- Autenticar y establecer sesiones basadas en wallets (a través del desafío/verificación de SEP-53).
- Realizar un seguimiento de los balances de la empresa, posiciones de rendimiento e historial de dispersión.
- Ejecutar conversiones horarias locales y trazas de consola estructuradas para los registros de auditoría.
- Sincronizar paneles de la interfaz de usuario en tiempo real a través de Supabase Postgres.
Todos los datos se procesan bajo las leyes de protección de datos correspondientes (como la LGPD en Brasil, la Ley 25.326 en Argentina, la Ley 1581 en Colombia, y la Ley Federal de Protección de Datos (FADP) en Suiza).`,
    },
    {
      id: "blockchain",
      title: "3. Transparencia e Irreversibilidad de Blockchain",
      content: `Tenga en cuenta que todas las transacciones liquidadas en la red Stellar (incluidas las ejecuciones de dispersión y los rebalanceos de tesorería) son públicas, transparentes e irreversibles. Las direcciones de billetera y los hashes de transacción asociados con sus operaciones se registrarán de forma permanente en el ledger. Estas entradas no se pueden modificar ni eliminar debido a la naturaleza descentralizada de la tecnología blockchain.`,
    },
    {
      id: "sharing",
      title: "4. Protocolos e Integraciones de Terceros",
      content: `Contextio interactúa con endpoints de Stellar Horizon RPC y contratos inteligentes de protocolos descentralizados (específicamente pools de préstamos Blend y bóvedas de índices DeFindex). Sus direcciones públicas y payloads de transacciones se comparten con estas redes descentralizadas durante los rebalanceos y depósitos. Nos vinculamos a un anchor externo (testanchor.stellar.org) para las capacidades de retiro interactivo SEP-24, y operamos nuestro propio Anchor Platform self-hosted para el descubrimiento y cotización institucional SEP-31/38 — un sistema operado por Contextio, no un tercero, aunque sigue siendo un servicio distinto de la aplicación principal. Estos protocolos de terceros tienen sus propias reglas, y no asumimos responsabilidad por su manejo de datos.`,
    },
    {
      id: "rights",
      title: "5. Sus Derechos",
      content: `Dependiendo de su ubicación, puede tener derechos bajo la LGPD, la Ley 25.326, la Ley 1581 o la FADP, que incluyen:
- Acceder a los registros de la base de datos almacenados para su empresa.
- Rectificar metadatos de contacto o correos electrónicos inexactos.
- Oponerse o solicitar la eliminación de registros en la base de datos off-chain (excluyendo transacciones públicas en blockchain).
Para ejercer estos derechos, comuníquese con nuestro correo electrónico legal: legal@contextio.xyz.`,
    },
  ],
  pt: [
    {
      id: "collection",
      title: "1. Coleta de Dados",
      content: `A Contextio é uma plataforma tecnológica sem custódia (e não uma provedora de serviços financeiros, fintech, banco, instituição de crédito ou custodiante). Coletamos metadados públicos e relacionados a empresas unicamente para facilitar fluxos de trabalho descentralizados de software de tesouraria e folha de pagamento. Processamos:
- Endereços públicos de carteiras Stellar.
- Detalhes da empresa (por exemplo, razão social, domínio, país e ID de registro local).
- Endereços de e-mail de contato fornecidos na configuração do Protocolo de Contexto Legal (LCP).
- Hashes de transações sem custódia, posições de rendimento e histórico de folhas executadas.
Nós NÃO coletamos, armazenamos ou transmitimos chaves criptográficas privadas, frases secretas ou credenciais de segurança confidenciais.`,
    },
    {
      id: "processing",
      title: "2. Finalidade do Processamento",
      content: `Seus dados são processados exclusivamente para:
- Autenticar e estabelecer sessões baseadas em carteira (via desafio/verificação SEP-53).
- Acompanhar os saldos da empresa, posições de rendimento e histórico de pagamento.
- Executar conversões de horário local e logs estruturados de auditoria na tela.
- Sincronizar painéis da interface em tempo real através do Supabase Postgres.
Todos os dados são processados sob as leis de proteção de dados apropriadas (como a LGPD no Brasil, a Lei 25.326 na Argentina, a Lei 1581 na Colômbia, e a Lei Federal de Proteção de Dados (FADP) na Suíça).`,
    },
    {
      id: "blockchain",
      title: "3. Transparência e Irreversibilidade da Blockchain",
      content: `Observe que todas as transações liquidadas na rede Stellar (incluindo folhas de pagamento e rebalanceamentos de tesouraria) são públicas, transparentes e irreversíveis. Endereços de carteiras e hashes de transações associados às suas operações serão gravados permanentemente no ledger. Essas organizações não podem ser modificadas ou excluídas devido à natureza descentralizada da tecnologia blockchain.`,
    },
    {
      id: "sharing",
      title: "4. Protocolos e Integrações de Terceiros",
      content: `A Contextio interage com endpoints Stellar Horizon RPC e contratos inteligentes de locais descentralizados (especificamente pools de empréstimos Blend e index vaults DeFindex). Seus endereços públicos e payloads de transação são compartilhados com essas redes descentralizadas durante rebalanceamentos e depósitos. Conectamos a um anchor externo (testanchor.stellar.org) para os recursos de retirada interativa SEP-24, e operamos nosso próprio Anchor Platform self-hosted para descoberta e cotação institucional SEP-31/38 — um sistema operado pela Contextio, não um terceiro, embora ainda seja um serviço distinto da aplicação principal. Esses protocolos terceiros têm regras próprias e não assumimos responsabilidade por seu manuseio de dados.`,
    },
    {
      id: "rights",
      title: "5. Seus Direitos",
      content: `Dependendo de sua localização, você pode ter direitos sob a LGPD, Lei 25.326, Lei 1581 ou a FADP, incluindo:
- Acessar as entradas do banco de dados armazenadas para sua empresa.
- Retificar metadatos de contato ou e-mail imprecisos.
- Opor-se ou solicitar a exclusão de registros do banco de dados off-chain (excluindo transações públicas em blockchain).
Para exercer esses direitos, entre em contato com nosso e-mail jurídico: legal@contextio.xyz.`,
    },
  ],
};

export default function PrivacyPage() {
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
                  href="/legal/terms"
                  className="text-accent hover:underline text-xs flex items-center gap-1"
                >
                  {t("legal.termsOfService")} ➔
                </a>
              </div>
            </nav>
          </div>
        </aside>

        {/* Right Side Content */}
        <div className="flex-1 space-y-10 lg:w-3/4">
          <div className="space-y-4 border-b border-white/10 pb-6">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t("legal.privacyPolicy")}
            </h1>
            <div className="flex items-center gap-2.5 text-xs text-slate-500">
              <span>{t("legal.lastUpdated")}: August 6, 2026</span>
              <span>•</span>
              <span className="font-mono uppercase text-brand">Corporate Compliance</span>
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
