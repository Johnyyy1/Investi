import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalOperator, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Podmínky použití",
  description: "Pravidla používání Investníku: vzdělávací služba s cvičným kapitálem, ne investiční doporučení.",
  alternates: { canonical: "/terms" },
};

const sections: readonly LegalSection[] = [
  { id: "sluzba", title: "Co je Investník", body: <>
    <p>Investník je vzdělávací služba, kterou provozuje {legalOperator.identity}. Učí základy investování pomocí lekcí, cvičení, cvičného portfolia a historických simulací.</p>
    <p>Investník není obchodník s cennými papíry, investiční zprostředkovatel ani banka. Nepracuje se skutečnými penězi a neprovádí skutečné obchody.</p>
  </> },
  { id: "doporuceni", title: "Nejde o investiční doporučení", body: <>
    <p>Veškerý obsah slouží jen ke vzdělávání. Nejde o investiční doporučení, investiční poradenství ani nabídku nákupu či prodeje jakéhokoli finančního nástroje. Lekce a příklady neberou ohled na tvou finanční situaci, cíle ani vztah k riziku.</p>
    <p>Minulé výsledky ani výsledky simulací nezaručují budoucí výnosy. O skutečných investicích rozhoduješ vždy ty, a to na vlastní odpovědnost. Před skutečnou investicí zvaž poradu s licencovaným odborníkem.</p>
  </> },
  { id: "cvicny-kapital", title: "Cvičný kapitál a Portfolio Lab", body: <ul>
    <li>Cvičný kapitál je odměna za učení v rámci aplikace. Nemá žádnou peněžní hodnotu, nelze ho vybrat, převést, prodat ani směnit.</li>
    <li>Obchody v Portfolio Lab jsou simulované. Ceny a kurzy mohou být zpožděné, neúplné nebo pocházet z ukázkových dat a vždy jsou tak označené.</li>
    <li>Pravidla odměn můžeme do budoucna měnit. Odměny, které už máš připsané, zůstávají.</li>
  </ul> },
  { id: "ucet", title: "Účet a pravidla používání", body: <ul>
    <li>Uváděj pravdivé údaje a chraň své heslo. Za aktivitu ve svém účtu odpovídáš.</li>
    <li>Nezkoušej obcházet zabezpečení nebo omezení počtu požadavků, hromadně stahovat obsah automatizovanými nástroji ani službu přetěžovat.</li>
    <li>Při závažném nebo opakovaném porušení můžeme přístup k účtu omezit nebo ho zrušit.</li>
  </ul> },
  { id: "ukonceni", title: "Smazání účtu", body: <p>Účet můžeš kdykoli smazat v <Link href="/settings?section=data">Nastavení → Moje data</Link>. Smažeme ho se vším, co k němu patří. Jak zacházíme s údaji, popisují <Link href="/privacy">zásady ochrany osobních údajů</Link>.</p> },
  { id: "odpovednost", title: "Dostupnost a odpovědnost", body: <p>Službu poskytujeme bezplatně a tak, jak je. Snažíme se, aby obsah byl správný a služba dostupná, ale nemůžeme zaručit, že bude bez chyb a přerušení. V rozsahu, který zákon dovoluje, neodpovídáme za škody vzniklé rozhodnutími učiněnými na základě obsahu Investníku.</p> },
  { id: "zmeny", title: "Změny podmínek a rozhodné právo", body: <>
    <p>Když podmínky podstatně změníme, upozorníme tě v aplikaci. Pokud se změnou nesouhlasíš, můžeš účet smazat.</p>
    <p>Podmínky se řídí právem České republiky. S dotazy nám napiš na {legalOperator.contactEmail}.</p>
  </> },
];

export default function TermsPage() {
  return <LegalPage title="Podmínky použití" sections={sections}
    intro={<p>Tyto podmínky platí pro používání Investníku, s účtem i bez něj. Vytvořením účtu s nimi souhlasíš.</p>} />;
}
