import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, legalOperator, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Zásady ochrany osobních údajů",
  description: "Jaké osobní údaje Investník ukládá, proč, jak dlouho a jak si je stáhneš nebo smažeš.",
  alternates: { canonical: "/privacy" },
};

const sections: readonly LegalSection[] = [
  { id: "spravce", title: "Kdo tvoje údaje zpracovává", body: <>
    <p>Správcem osobních údajů je {legalOperator.identity}.</p>
    <p>S dotazy k osobním údajům nebo k uplatnění práv nám napiš na {legalOperator.contactEmail}.</p>
  </> },
  { id: "udaje", title: "Jaké údaje ukládáme", body: <dl>
    <div><dt>Účet</dt><dd>Jméno, e-mail, zda je e-mail ověřený, datum založení a poslední změny. Heslo ukládáme jen jako jednosměrný otisk (hash), nikdy v čitelné podobě.</dd></div>
    <div><dt>Přihlášení přes Google nebo Facebook</dt><dd>Identifikátor tvého účtu u poskytovatele, přístupové tokeny, které nám poskytovatel předá, a případně profilový obrázek.</dd></div>
    <div><dt>Relace</dt><dd>Pro každé přihlášení IP adresu, identifikaci prohlížeče (user agent), čas vytvoření a vypršení.</dd></div>
    <div><dt>Učení</dt><dd>Odpovědi z úvodního nastavení a diagnostiky (zkušenost, cíle, zájmy, délka lekcí), časové pásmo, pokrok v lekcích, XP a záznamy o odměnách cvičného kapitálu.</dd></div>
    <div><dt>Výstupy z lekcí</dt><dd>Jen s tvým potvrzením ukládáme mapu cílů, shrnutí finančního check-upu, profil poplatků, checklisty, investiční plán, pojistky, mapu byznysu, tezi a deník včetně předchozích verzí. Check-up ukládá kategorie a další krok, bez částek příjmů a dluhů. Host bez účtu tyto výstupy neukládá.</dd></div>
    <div><dt>Portfolio Lab</dt><dd>Cvičná portfolia, provedené cvičné obchody a uložené mixy. Jde o cvičný kapitál, ne o skutečné investice.</dd></div>
    <div><dt>Doručování e-mailů</dt><dd>Typ zprávy, poskytovatele, identifikátor zprávy, stav doručení, bezpečný kód chyby a časy změn. V těchto záznamech neukládáme adresu, obsah zprávy, odkazy ani tokeny. Odmítnutí doručení a označení za spam používáme k omezení dalších ověřovacích zpráv.</dd></div>
    <div><dt>Ochrana proti zneužití</dt><dd>Počítadla požadavků, která brání hádání hesel a přetěžování služby. Místo IP adresy nebo e-mailu v nich ukládáme jen jednosměrný otisk.</dd></div>
    <div><dt>Host a demo</dt><dd>Když se učíš bez účtu, vytvoříme anonymní profil bez e-mailu. Ukládáme k němu stejná data o učení a relacích jako k účtu.</dd></div>
  </dl> },
  { id: "neukladame", title: "Co nezpracováváme", body: <ul>
    <li>Platební údaje, bankovní účty ani skutečné investice. Investník není obchodník s cennými papíry a nepracuje se skutečnými penězi.</li>
    <li>Reklamní ani analytické sledování a profilování pro marketing. Údaje neprodáváme.</li>
  </ul> },
  { id: "ucely", title: "Proč údaje zpracováváme", body: <ul>
    <li><strong>Provoz účtu a služby</strong>: přihlášení, uložení pokroku, odměn a cvičného portfolia a doporučení dalšího kroku v učení. Právním základem je plnění smlouvy podle <Link href="/terms">podmínek použití</Link> (čl. 6 odst. 1 písm. b) GDPR).</li>
    <li><strong>Bezpečnost</strong>: údaje o relacích a počítadla požadavků slouží k ochraně účtů a služby. Právním základem je náš oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR).</li>
  </ul> },
  { id: "prijemci", title: "Komu údaje předáváme", body: <>
    <p>Údaje zpracovávají jen poskytovatelé, bez kterých služba nefunguje, a to podle našich pokynů:</p>
    <ul>
      <li><strong>Vercel</strong>: hosting aplikace.</li>
      <li><strong>Resend</strong>: odesílání zpráv k účtu. Při odeslání dostává adresu příjemce a obsah zprávy. Podepsaná oznámení o doručení, odmítnutí nebo označení za spam používáme k ochraně doručování; nesledujeme otevírání ani klikání.</li>
      <li><strong>Neon</strong>: databáze.</li>
      <li><strong>Google a Facebook</strong>: jen když přihlášení přes ně zvolíš.</li>
    </ul>
    <p>Poskytovatelům tržních dat posíláme jen dotazy na finanční nástroje, nikdy údaje o tobě. Pokud poskytovatel zpracovává údaje mimo Evropský hospodářský prostor, děje se tak na základě rozhodnutí Evropské komise o odpovídající ochraně nebo standardních smluvních doložek.</p>
  </> },
  { id: "doba", title: "Jak dlouho údaje uchováváme", body: <ul>
    <li><strong>Účet a všechna data k němu</strong>: dokud účet nesmažeš. Smazání je okamžité a trvalé.</li>
    <li><strong>Výstupy z lekcí</strong>: do smazání výstupu nebo účtu. V Nastavení → Moje data smažeš jednotlivý výstup i se všemi předchozími verzemi.</li>
    <li><strong>Relace</strong> s IP adresou a identifikací prohlížeče: 30 dní po vypršení, pak je automaticky smaže denní úloha.</li>
    <li><strong>Profil hosta a demo</strong>: automaticky ho smažeme den poté, co vyprší jeho poslední relace.</li>
    <li><strong>Záznamy doručování e-mailů</strong>: 90 dní, potom je smaže denní úloha. Smazání účtu je odstraní hned.</li>
    <li><strong>Počítadla požadavků</strong>: jen po dobu svého časového okna, nejdéle 24 hodin.</li>
    <li>Smazané údaje mohou krátce přetrvat v zálohách databáze, dokud se v běžném cyklu nepřepíší.</li>
  </ul> },
  { id: "cookies", title: "Cookies a úložiště v prohlížeči", body: <>
    <p>Používáme jen cookies nezbytné pro přihlášení, proto nepotřebujeme tvůj souhlas:</p>
    <ul>
      <li><strong>Přihlašovací cookie</strong> (začíná na <code>better-auth.</code>): udržuje tvé přihlášení, platí po dobu relace.</li>
      <li><strong>Dočasné cookies přihlášení přes Google nebo Facebook</strong>: chrání přihlášení před podvržením a po návratu z poskytovatele zaniknou.</li>
    </ul>
    <p>Do úložiště prohlížeče si ukládáme rozepsané odpovědi z úvodního nastavení (do zavření karty) a skrytí nabídky přizpůsobení. Adresu z přihlášení a obnovy hesla si pamatujeme jen v úložišti dané karty prohlížeče (sessionStorage), aby nebylo potřeba ji zadávat znovu. Nepoužíváme analytické, reklamní ani sledovací cookies třetích stran.</p>
  </> },
  { id: "prava", title: "Tvoje práva", body: <>
    <ul>
      <li><strong>Přístup a přenositelnost</strong>: v <Link href="/settings?section=data">Nastavení → Moje data</Link> si stáhneš všechna data o sobě ve formátu JSON.</li>
      <li><strong>Výmaz</strong>: tamtéž účet smažeš. Smažeme ho se vším, co k němu patří.</li>
      <li><strong>Oprava</strong>: jméno i e-mail změníš v Nastavení.</li>
      <li><strong>Omezení zpracování a námitka</strong> proti zpracování na základě oprávněného zájmu: napiš nám.</li>
      <li><strong>Stížnost</strong>: můžeš ji podat u Úřadu pro ochranu osobních údajů (<a href="https://uoou.gov.cz" rel="noopener noreferrer">uoou.gov.cz</a>).</li>
    </ul>
    <p>Na žádosti odpovíme bez zbytečného odkladu, nejpozději do jednoho měsíce.</p>
  </> },
  { id: "zmeny", title: "Změny těchto zásad", body: <p>Když zásady podstatně změníme, upozorníme tě v aplikaci. Datum poslední změny je uvedené nahoře.</p> },
];

export default function PrivacyPage() {
  return <LegalPage title="Zásady ochrany osobních údajů" sections={sections} updatedAt="22. října 2026"
    intro={<p>Investník je vzdělávací služba, ve které se učíš investovat s cvičným kapitálem. Ukládáme jen to, co k tomu potřebujeme, a všechno si můžeš kdykoli stáhnout nebo smazat.</p>} />;
}
