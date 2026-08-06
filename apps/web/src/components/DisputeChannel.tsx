"use client";

import { useEffect, useState } from "react";
import { useT, Locale } from "@/lib/i18n";
import { Card } from "@/components/ui";
import Link from "next/link";

type CountryCode = "br" | "ar" | "co" | "ch";

interface DisputeContent {
  title: string;
  governingLaw: string;
  governingLawDesc: string;
  venue: string;
  venueDesc: string;
  procedureTitle: string;
  procedureSteps: string[];
  arbitrationRules: string;
  arbitrationRulesDesc: string;
}

const CONTENT: Record<Locale, Record<CountryCode, DisputeContent>> = {
  en: {
    br: {
      title: "Dispute Resolution Channel & Arbitration Forum — Brazil",
      governingLaw: "Governing Law",
      governingLawDesc: "Federative Republic of Brazil. Transactions are governed by and construed in accordance with the laws of Brazil, including the Civil Code and the Legal Context Protocol (LCP) binding.",
      venue: "Arbitration Forum & Venue",
      venueDesc: "CAM-CCBC (Centro de Arbitragem e Mediação da Câmara de Comércio Brasil-Canadá) in São Paulo, SP, Brazil. The arbitration tribunal will resolve all claims in accordance with its rules.",
      procedureTitle: "Arbitration Procedure & Scope",
      procedureSteps: [
        "Filing of the Notice of Arbitration in Portuguese to the CAM-CCBC secretariat.",
        "Appointment of a sole (1) arbitrator in accordance with CAM-CCBC fast-track rules.",
        "The language of the proceedings shall be Portuguese, with English translations provided at the requesting party's cost.",
        "The arbitral award shall be final, binding, and constitutes res judicata (coisa julgada) under Brazilian Arbitration Act (Lei nº 9.307/96)."
      ],
      arbitrationRules: "Arbitration Rules",
      arbitrationRulesDesc: "Subject to CAM-CCBC fast-track procedures. All parties agree to settle dispute solely via individual binding arbitration, waiving any rights to class action lawsuits or court trials."
    },
    ar: {
      title: "Dispute Resolution Channel & Arbitration Forum — Argentina",
      governingLaw: "Governing Law",
      governingLawDesc: "Argentine Republic. Transactions and LCP commitments are governed by and construed in accordance with the commercial and civil laws of Argentina (Ley 27.449).",
      venue: "Arbitration Forum & Venue",
      venueDesc: "Tribunal de Arbitraje General de la Bolsa de Comercio de Buenos Aires, Argentina. Any conflict arising from Stellar settlements or LCP bindings will be submitted to this tribunal.",
      procedureTitle: "Arbitration Procedure & Scope",
      procedureSteps: [
        "Filing of the demand before the Arbitration Bureau of the Buenos Aires Stock Exchange.",
        "Selection of a sole (1) arbitrator under the simplified rules of the Stock Exchange.",
        "The language of the arbitration shall be Spanish.",
        "The arbitral award is final and unappealable, enforceable in any court of competent jurisdiction in Argentina."
      ],
      arbitrationRules: "Arbitration Rules",
      arbitrationRulesDesc: "Subject to the Arbitration Rules of the General Arbitration Court of Buenos Aires. Standard judicial court venues are waived by all active on-chain entities."
    },
    co: {
      title: "Dispute Resolution Channel & Arbitration Forum — Colombia",
      governingLaw: "Governing Law",
      governingLawDesc: "Republic of Colombia. In accordance with the Legal Context Protocol, disputes are governed by Colombian commercial code and Ley 1563 de 2012.",
      venue: "Arbitration Forum & Venue",
      venueDesc: "Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá (CCB), Colombia. Legal claims will be submitted and managed by CCB arbitrators.",
      procedureTitle: "Arbitration Procedure & Scope",
      procedureSteps: [
        "Filing of the arbitration request (Solicitud de Arbitraje) to the CCB Center in Bogotá.",
        "Appointment of a sole (1) arbitrator from the official CCB lists of commercial specialists.",
        "The language of the proceedings shall be Spanish.",
        "The arbitral award shall be final, binding, and constitutes res judicata (cosa juzgada) under Colombian Ley 1563 de 2012."
      ],
      arbitrationRules: "Arbitration Rules",
      arbitrationRulesDesc: "Subject to the Arbitration Rules of the Bogota Chamber of Commerce. Voluntary submission to arbitration is legally binding for both payroll and treasury actions."
    },
    ch: {
      title: "Dispute Resolution Channel & Arbitration Forum — Switzerland (EMEA)",
      governingLaw: "Governing Law",
      governingLawDesc: "Swiss Confederation. Transactions and LCP commitments involving tenants operating in the Europe, Middle East & Africa (EMEA) region are governed by and construed in accordance with Swiss substantive law and, for international matters, the Swiss Federal Act on Private International Law (PILA), Chapter 12.",
      venue: "Arbitration Forum & Venue",
      venueDesc: "Swiss Arbitration Centre (formerly SCAI — Swiss Chambers' Arbitration Institution, renamed 1 June 2021), applying the Swiss Rules of International Arbitration. Seat of arbitration: Switzerland.",
      procedureTitle: "Arbitration Procedure & Scope",
      procedureSteps: [
        "Filing of the Notice of Arbitration with the Swiss Arbitration Centre's secretariat (Geneva, Lugano, or Zurich).",
        "Appointment of a sole (1) arbitrator in accordance with the Swiss Rules of International Arbitration.",
        "The language of the proceedings shall be English.",
        "The arbitral award shall be final and binding, enforceable under PILA Chapter 12 and, where applicable, the New York Convention."
      ],
      arbitrationRules: "Arbitration Rules",
      arbitrationRulesDesc: "Subject to the Swiss Rules of International Arbitration. All parties agree to settle disputes solely via individual binding arbitration, waiving any rights to class action lawsuits or ordinary court trials."
    }
  },
  es: {
    br: {
      title: "Canal de Resolución de Disputas y Foro de Arbitraje — Brasil",
      governingLaw: "Ley Aplicable",
      governingLawDesc: "República Federativa de Brasil. Las transacciones se rigen e interpretan de acuerdo con las leyes de Brasil, incluyendo el Código Civil y el Legal Context Protocol (LCP).",
      venue: "Foro y Sede de Arbitraje",
      venueDesc: "CAM-CCBC (Centro de Arbitragem e Mediação da Câmara de Comércio Brasil-Canadá) en São Paulo, SP, Brasil. El tribunal de arbitraje resolverá los reclamos de acuerdo con sus reglamentos.",
      procedureTitle: "Procedimiento de Arbitraje y Alcance",
      procedureSteps: [
        "Presentación de la notificación de arbitraje en portugués ante la secretaría de la CAM-CCBC.",
        "Designación de un árbitro único (1) de acuerdo con los reglamentos de vía rápida de la CAM-CCBC.",
        "El idioma de los procedimientos será el portugués, facilitando traducción al inglés si es solicitada por costo de la parte solicitante.",
        "El laudo arbitral será final, vinculante y constituirá cosa juzgada (coisa julgada) bajo la Ley de Arbitraje de Brasil (Lei nº 9.307/96)."
      ],
      arbitrationRules: "Reglamento de Arbitraje",
      arbitrationRulesDesc: "Sujeto a los procedimientos de vía rápida del CAM-CCBC. Ambas partes acuerdan resolver disputas únicamente mediante arbitraje individual vinculante, renunciando a juicios ordinarios."
    },
    ar: {
      title: "Canal de Resolución de Disputas y Foro de Arbitraje — Argentina",
      governingLaw: "Ley Aplicable",
      governingLawDesc: "República Argentina. Las transacciones y compromisos LCP se rigen e interpretan de acuerdo con las leyes civiles y comerciales de Argentina (Ley 27.449).",
      venue: "Foro y Sede de Arbitraje",
      venueDesc: "Tribunal de Arbitraje General de la Bolsa de Comercio de Buenos Aires, Argentina. Cualquier conflicto surgido de liquidaciones en Stellar o compromisos LCP se someterá a este tribunal.",
      procedureTitle: "Procedimiento de Arbitraje y Alcance",
      procedureSteps: [
        "Presentación de la demanda ante la Dirección de Arbitraje de la Bolsa de Comercio de Buenos Aires.",
        "Selección de un árbitro único (1) bajo las reglas simplificadas de la Bolsa de Comercio.",
        "El idioma del arbitraje será el español.",
        "El laudo arbitral es final e inapelable, ejecutable en cualquier tribunal competente de Argentina."
      ],
      arbitrationRules: "Reglamento de Arbitraje",
      arbitrationRulesDesc: "Sujeto al Reglamento de Arbitraje del Tribunal General de Arbitraje de Buenos Aires. Se renuncia de forma expresa a los fueros judiciales ordinarios."
    },
    co: {
      title: "Canal de Resolución de Disputas y Foro de Arbitraje — Colombia",
      governingLaw: "Ley Aplicable",
      governingLawDesc: "República de Colombia. En conformidad con el Protocolo de Contexto Legal, las disputas se rigen por el código de comercio colombiano y la Ley 1563 de 2012.",
      venue: "Foro y Sede de Arbitraje",
      venueDesc: "Centro de Arbitraje y Conciliación de la Cámara de Comercio de Bogotá (CCB), Colombia. Las reclamaciones legales serán sometidas e instruidas por árbitros de la CCB.",
      procedureTitle: "Procedimiento de Arbitraje y Alcance",
      procedureSteps: [
        "Radicación de la solicitud de arbitraje ante el Centro de la CCB en Bogotá.",
        "Nombramiento de un árbitro único (1) de las listas oficiales de especialistas comerciales de la CCB.",
        "El idioma del procedimiento será el español.",
        "El laudo arbitral será definitivo, vinculante y hará tránsito a cosa juzgada bajo la Ley 1563 de 2012 de Colombia."
      ],
      arbitrationRules: "Reglamento de Arbitraje",
      arbitrationRulesDesc: "Sujeto al Reglamento de Arbitraje de la Cámara de Comercio de Bogotá. El sometimiento voluntario al arbitraje es legalmente vinculante para operaciones de nómina y tesorería."
    },
    ch: {
      title: "Canal de Resolución de Disputas y Foro de Arbitraje — Suiza (EMEA)",
      governingLaw: "Ley Aplicable",
      governingLawDesc: "Confederación Suiza. Las transacciones y compromisos LCP de inquilinos que operan en la región de Europa, Medio Oriente y África (EMEA) se rigen por el derecho sustantivo suizo y, para asuntos internacionales, por la Ley Federal Suiza de Derecho Internacional Privado (PILA), Capítulo 12.",
      venue: "Foro y Sede de Arbitraje",
      venueDesc: "Swiss Arbitration Centre (antes SCAI — Swiss Chambers' Arbitration Institution, renombrado el 1 de junio de 2021), bajo las Swiss Rules of International Arbitration. Sede del arbitraje: Suiza.",
      procedureTitle: "Procedimiento de Arbitraje y Alcance",
      procedureSteps: [
        "Presentación de la notificación de arbitraje ante la secretaría del Swiss Arbitration Centre (Ginebra, Lugano o Zúrich).",
        "Designación de un árbitro único (1) de acuerdo con las Swiss Rules of International Arbitration.",
        "El idioma de los procedimientos será el inglés.",
        "El laudo arbitral será final y vinculante, ejecutable bajo el Capítulo 12 de la PILA y, cuando aplique, la Convención de Nueva York."
      ],
      arbitrationRules: "Reglamento de Arbitraje",
      arbitrationRulesDesc: "Sujeto a las Swiss Rules of International Arbitration. Ambas partes acuerdan resolver disputas únicamente mediante arbitraje individual vinculante, renunciando a juicios ordinarios."
    }
  },
  pt: {
    br: {
      title: "Canal de Resolução de Disputas e Fórum de Arbitragem — Brasil",
      governingLaw: "Lei Aplicável",
      governingLawDesc: "República Federativa do Brasil. As transações são regidas e interpretadas de acordo com as leis do Brasil, incluindo o Código Civil e o vínculo do Legal Context Protocol (LCP).",
      venue: "Fórum e Sede de Arbitragem",
      venueDesc: "CAM-CCBC (Centro de Arbitragem e Mediação da Câmara de Comércio Brasil-Canadá) em São Paulo, SP, Brasil. O tribunal arbitral resolverá todas as reivindicações de acordo com suas regras.",
      procedureTitle: "Procedimento Arbitral e Escopo",
      procedureSteps: [
        "Apresentação da Notificação de Arbitragem em português à secretaria do CAM-CCBC.",
        "Nomeação de um árbitro único (1) de acordo com o regulamento de procedimento rápido do CAM-CCBC.",
        "O idioma dos procedimentos será o português, com traduções fornecidas a custo da parte requerente.",
        "A sentença arbitral será final, vinculante e constitui coisa julgada sob a Lei de Arbitragem Brasileira (Lei nº 9.307/96)."
      ],
      arbitrationRules: "Regras de Arbitragem",
      arbitrationRulesDesc: "Sujeito aos procedimentos rápidos do CAM-CCBC. Todas as partes concordam em resolver disputas apenas por arbitragem vinculante individual, renunciando a processos judiciais."
    },
    ar: {
      title: "Canal de Resolução de Disputas e Fórum de Arbitragem — Argentina",
      governingLaw: "Lei Aplicável",
      governingLawDesc: "República Argentina. Transações e compromissos LCP são regidos e interpretados pelas leis comerciais e civis da Argentina (Lei 27.449).",
      venue: "Fórum e Sede de Arbitragem",
      venueDesc: "Tribunal de Arbitragem Geral da Bolsa de Comércio de Buenos Aires, Argentina. Qualquer disputa decorrente de liquidações no Stellar ou do LCP será submetida a este tribunal.",
      procedureTitle: "Procedimento Arbitral e Escopo",
      procedureSteps: [
        "Apresentação da demanda perante o Departamento de Arbitragem da Bolsa de Comércio de Buenos Aires.",
        "Seleção de um árbitro único (1) sob as regras simplificadas da Bolsa de Comércio.",
        "O idioma da arbitragem será o espanhol.",
        "A decisão arbitral é final e irrecorrível, executável em qualquer tribunal competente na Argentina."
      ],
      arbitrationRules: "Regras de Arbitragem",
      arbitrationRulesDesc: "Sujeito às Regras de Arbitragem do Tribunal Geral de Arbitragem de Buenos Aires. Os tribunais judiciais padrão são dispensados."
    },
    co: {
      title: "Canal de Resolução de Disputas e Fórum de Arbitragem — Colômbia",
      governingLaw: "Lei Aplicável",
      governingLawDesc: "República da Colômbia. De acordo com o LCP, as disputas são regidas pelo código comercial colombiano e pela Lei 1563 de 2012.",
      venue: "Fórum e Sede de Arbitragem",
      venueDesc: "Centro de Arbitragem e Conciliabilidade da Câmara de Comércio de Bogotá (CCB), Colômbia. Reivindicações legais serão submetidas e gerenciadas por árbitros da CCB.",
      procedureTitle: "Procedimento Arbitral e Escopo",
      procedureSteps: [
        "Apresentação da solicitação de arbitragem ao Centro da CCB em Bogotá.",
        "Nomeação de um árbitro único (1) das listas oficiais de especialistas comerciais da CCB.",
        "O idioma dos procedimentos será o espanhol.",
        "A decisão arbitral será final, vinculante e constitui coisa julgada sob a Lei 1563 de 2012 da Colômbia."
      ],
      arbitrationRules: "Regras de Arbitragem",
      arbitrationRulesDesc: "Sujeito às Regras de Arbitragem da Câmara de Comércio de Bogotá. A submissão voluntária é juridicamente vinculante para ações de folha e tesouraria."
    },
    ch: {
      title: "Canal de Resolução de Disputas e Fórum de Arbitragem — Suíça (EMEA)",
      governingLaw: "Lei Aplicável",
      governingLawDesc: "Confederação Suíça. Transações e compromissos LCP de locatários que operam na região da Europa, Oriente Médio e África (EMEA) são regidos pelo direito substantivo suíço e, para questões internacionais, pela Lei Federal Suíça de Direito Internacional Privado (PILA), Capítulo 12.",
      venue: "Fórum e Sede de Arbitragem",
      venueDesc: "Swiss Arbitration Centre (antigo SCAI — Swiss Chambers' Arbitration Institution, renomeado em 1º de junho de 2021), sob as Swiss Rules of International Arbitration. Sede da arbitragem: Suíça.",
      procedureTitle: "Procedimento Arbitral e Escopo",
      procedureSteps: [
        "Apresentação da notificação de arbitragem à secretaria do Swiss Arbitration Centre (Genebra, Lugano ou Zurique).",
        "Nomeação de um árbitro único (1) de acordo com as Swiss Rules of International Arbitration.",
        "O idioma dos procedimentos será o inglês.",
        "A sentença arbitral será final e vinculante, executável sob o Capítulo 12 da PILA e, quando aplicável, a Convenção de Nova York."
      ],
      arbitrationRules: "Regras de Arbitragem",
      arbitrationRulesDesc: "Sujeito às Swiss Rules of International Arbitration. Ambas as partes concordam em resolver disputas apenas por arbitragem vinculante individual, renunciando a processos judiciais ordinários."
    }
  }
};

export default function DisputeChannel({ country }: { country: CountryCode }) {
  const t = useT();
  const [activeLocale, setActiveLocale] = useState<Locale>("en");

  useEffect(() => {
    const currentLang = document.documentElement.lang as Locale;
    if (currentLang && (currentLang === "en" || currentLang === "es" || currentLang === "pt")) {
      setActiveLocale(currentLang);
    }
  }, [t]);

  const currentSections = CONTENT[activeLocale]?.[country] || CONTENT.en[country];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="space-y-4 border-b border-white/10 pb-6 mb-8">
        <div className="flex items-center gap-2 text-xs">
          <Link href="/legal-context" className="text-brand hover:underline">
            Legal Context Protocol
          </Link>
          <span className="text-slate-500">/</span>
          <span className="text-slate-400 uppercase tracking-wider font-mono">Disputes {country}</span>
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {currentSections.title}
        </h1>
        <div className="flex items-center gap-2.5 text-xs text-slate-500">
          <span>{t("legal.lastUpdated")}: June 30, 2026</span>
          <span>•</span>
          <span className="font-mono uppercase text-brand">LCP Binding Forum</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Core Specs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Governing Law Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-brand" />
              {currentSections.governingLaw}
            </h3>
            <p className="text-sm leading-relaxed text-slate-300">
              {currentSections.governingLawDesc}
            </p>
          </Card>

          {/* Venue Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {currentSections.venue}
            </h3>
            <p className="text-sm leading-relaxed text-slate-300">
              {currentSections.venueDesc}
            </p>
          </Card>

          {/* Procedure Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              {currentSections.procedureTitle}
            </h3>
            <ul className="space-y-3.5 text-sm">
              {currentSections.procedureSteps.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-slate-300">
                  <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] text-white">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Side Info */}
        <div className="space-y-6">
          <Card className="p-6 space-y-4 bg-ink-900/40 backdrop-blur border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand">
              {currentSections.arbitrationRules}
            </h4>
            <p className="text-xs leading-relaxed text-slate-400">
              {currentSections.arbitrationRulesDesc}
            </p>
            <div className="border-t border-white/5 pt-4 flex flex-col gap-2.5 text-xs">
              <Link href="/legal/terms" className="text-accent hover:underline">
                ➔ Terms of Service
              </Link>
              <Link href="/legal/privacy" className="text-accent hover:underline">
                ➔ Privacy Policy
              </Link>
              <Link href="/legal-context" className="text-accent hover:underline">
                ➔ Legal Context Manifest
              </Link>
            </div>
          </Card>

          <Card className="p-6 space-y-4 border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Jurisdiction Quick Check
            </h4>
            <div className="divide-y divide-white/5 text-xs">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">ISO Code</span>
                <span className="font-mono text-white uppercase">{country}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Stellar Settlement</span>
                <span className="text-brand">Active</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Escrow Support</span>
                <span className="text-white">Multi-Sig / LCP</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
