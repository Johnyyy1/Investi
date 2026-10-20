import type { AuthoredLesson } from "../types";
import { correlationLessons } from "./manifest";

const lesson = correlationLessons[2];

export const correlationInCrisesLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "correlation",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Korelace",
  position: 3,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "changes", label: "Korelace se mění" },
    { id: "crisis-explorer", label: "Klid a krize" },
    { id: "protection", label: "Ochrana slábne" },
    { id: "lab-period", label: "Které období platí" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/correlation/${correlationLessons[1].slug}`, label: correlationLessons[1].title }, next: { href: `/learn/correlation/${correlationLessons[3].slug}`, label: correlationLessons[3].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: dvě akcie z různých odvětví měly v klidném roce korelaci měsíčních výnosů kolem 0,2. Pak přišel prudký propad celého trhu. Co se s jejich korelací obvykle stane?",
      options: [{ id: "same", label: "Zůstane kolem 0,2. Firmy jsou pořád stejné." }, { id: "up", label: "Vzroste. V panice se prodává skoro všechno a společný pohyb trhu přehluší vše ostatní." }, { id: "down", label: "Klesne pod nulu. Jedna z akcií začne růst." }],
      correctOptionId: "up",
      correctExplanation: "V klidu rozhodují hlavně zprávy o jednotlivých firmách, takže se akcie pohybují dost nezávisle. V prudkém propadu převáží společný faktor: trh klesá jako celek a korelace roste.",
      incorrectExplanation: "Vzpomeň si na společný faktor z minulé lekce. V propadu trhu jeho podíl na pohybu každé akcie prudce vzroste, a s ním i korelace.",
    },
    { id: "changes", type: "explanation", title: "Korelace není konstanta", content: "Korelace se počítá z výnosů za konkrétní období a popisuje jen to období. Když se změní, co investice táhne, změní se i korelace. Číslo za klidný rok proto nemusí platit pro rok, kdy trh padá." },
    { id: "crisis-explorer", type: "interactiveFigure", figure: "crisis-correlation-explorer", title: "Dvanáct klidných měsíců, šest krizových", description: "Přepínej období a sleduj korelaci a nejhorší měsíc obou akcií i portfolia půl napůl. Ukázková data, ne skutečný trh." },
    { id: "explorer-check", type: "numericQuestion", prompt: "V nejhorším krizovém měsíci akcie A klesla o 12 % a akcie B o 10 %. Jaký výnos měla v tom měsíci investice rozdělená napůl mezi A a B?", answer: -11, tolerance: 0.05, unit: "%", correctExplanation: "0,5 × (−12 %) + 0,5 × (−10 %) = −11 %. Rozdělení skoro nepomohlo, protože obě akcie klesly zároveň.", incorrectExplanation: "Výnos portfolia je vážený průměr výnosů: 0,5 × (−12) + 0,5 × (−10). Výsledek je záporný, protože obě akcie klesly." },
    { id: "protection", type: "explanation", title: "Když je ochrana nejvíc potřeba", content: "V klidných měsících byl nejhorší měsíc portfolia půl napůl −1,5 %, mírnější než u obou akcií (−2 %). Akcie se pohybovaly dost nezávisle, a tak se jejich výkyvy částečně vyrušily. V krizi měly korelaci skoro 1 a portfolio kleslo o 11 %, mezi −12 % a −10 %. Rozložení pomáhá nejméně právě tehdy, kdy je nejvíc potřeba." },
    { id: "bonds", type: "explanation", title: "Ani akcie a dluhopisy nejsou jistota", content: "Dlouhá léta platilo, že když akcie padaly, kvalitní státní dluhopisy často rostly. V roce 2022 ale klesaly obojí zároveň, protože je zasáhl rychlý růst úrokových sazeb. Ani vztah mezi celými třídami aktiv není zaručený." },
    { id: "bonds-check", type: "multipleChoiceQuestion", prompt: "Akciový a dluhopisový fond měly za posledních deset let korelaci −0,3. Co z toho plyne pro příští krizi?", options: [{ id: "safe", label: "Dluhopisový fond v krizi poroste." }, { id: "nothing", label: "Nic jistého. Korelace popisuje minulé období a v krizi se může změnit." }, { id: "average", label: "Oba fondy klesnou přesně o 30 %." }], correctOptionId: "nothing", correctExplanation: "Záporná korelace v minulosti je užitečná informace, ne záruka. V roce 2022 klesaly akcie i dluhopisy zároveň.", incorrectExplanation: "Korelace je spočítaná z minulých výnosů. Nepředpovídá, co se stane v příští krizi, a ta může vztah změnit." },
    { id: "lab-period", type: "explanation", title: "Každé období, jiné číslo", content: "V porovnání v Labu si vybíráš období. Korelace za poslední rok a za pět let se může výrazně lišit. To není chyba: obě čísla jsou správně spočítaná, jen popisují jiný úsek historie." },
    { id: "lab-check", type: "multipleChoiceQuestion", prompt: "V Labu vyjde korelace dvou akcií za pět let 0,4 a za poslední rok 0,8. Které číslo je správné?", options: [{ id: "five", label: "Jen 0,4. Delší období je vždy pravdivější." }, { id: "both", label: "Obě. Každé popisuje jiné období a rozdíl ukazuje, že se vztah mění." }, { id: "year", label: "Jen 0,8. Novější data přepisují starší." }], correctOptionId: "both", correctExplanation: "Obě čísla jsou správná pro svá období. Rozdíl je sám o sobě informace: v posledním roce se akcie pohybovaly spolu víc než dřív.", incorrectExplanation: "Korelace patří ke svému období. Delší období neznamená pravdivější a kratší nepřepisuje delší. Rozdíl ukazuje, že vztah není stálý." },
    { id: "lab-bridge", type: "labBridge", title: "Vyzkoušej to v Labu", content: "Otevři v Labu porovnání dvou instrumentů a přepni období. Sleduj, jak se korelace mění mezi jedním rokem a delší historií.", metric: "correlation" },
    { id: "summary", type: "lessonSummary", title: "Vztah, který se mění", content: "Korelace popisuje jen období, ze kterého je spočítaná. V prudkých propadech trhu obvykle roste, protože převáží společný pohyb. Rozložení mezi investice pak pomáhá méně, než slibovala klidná léta. Ani vztah akcií a dluhopisů není zaručený." },
    { id: "takeaway", type: "takeaway", title: "Z 0,24 na 0,99", content: "Ukázkové akcie měly v klidných měsících korelaci 0,24 a v krizi 0,99. Portfolio půl napůl v krizi kleslo o 11 %, skoro jako každá akcie zvlášť." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Víš, že korelace se mění a v krizích roste. V poslední lekci modulu ji spočítáš na skutečné historii dvou instrumentů." },
  ],
};
