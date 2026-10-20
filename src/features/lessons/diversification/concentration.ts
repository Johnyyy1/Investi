import type { AuthoredLesson } from "../types";
import { diversificationLessons } from "./manifest";

const lesson = diversificationLessons[0];

export const concentrationLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "diversification",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Diverzifikace",
  position: 1,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "weights", label: "Váha pozice" },
    { id: "explorer", label: "Největší pozice" },
    { id: "impact", label: "Dopad na portfolio" },
    { id: "count", label: "Počet nestačí" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { next: { href: `/learn/diversification/${diversificationLessons[1].slug}`, label: diversificationLessons[1].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: portfolio X drží deset firem, ale jedna z nich tvoří 55 % hodnoty a zbylých devět po 5 %. Portfolio Y drží čtyři firmy, každou za 25 %. Které víc závisí na osudu jediné firmy?",
      options: [{ id: "x", label: "X. Jedna firma rozhoduje o více než polovině hodnoty." }, { id: "y", label: "Y. Má jen čtyři firmy." }, { id: "same", label: "Obě stejně. Obě drží akcie." }],
      correctOptionId: "x",
      correctExplanation: "O závislosti rozhodují váhy, ne počet. Když největší firma X klesne o 40 %, portfolio X ztratí 22 %. U Y by stejný pokles jedné firmy znamenal −10 %.",
      incorrectExplanation: "Podívej se na největší váhu, ne na počet firem. V X tvoří jedna firma 55 % hodnoty, v Y žádná nepřesahuje 25 %.",
    },
    { id: "weights", type: "explanation", title: "Váha je podíl na celku", content: "Váha pozice je její hodnota dělená hodnotou celého portfolia, hotovost včetně. Koncentrace znamená, že velká část hodnoty leží v jedné pozici. Čím větší váha, tím víc se výsledek celého portfolia řídí touto jednou pozicí." },
    { id: "weight-formula", type: "formula", expression: "w = hodnota pozice / hodnota portfolia", latex: String.raw`w_i = \frac{V_i}{V_{\text{portfolio}}}`, variables: [{ symbol: "V_i", description: "tržní hodnota pozice i" }, { symbol: "V_portfolio", description: "hodnota celého portfolia včetně hotovosti" }, { symbol: "w_i", description: "váha pozice; váhy všech položek dávají dohromady 100 %" }] },
    { id: "weight-practice", type: "numericQuestion", prompt: "Pozice ve firmě A má hodnotu 30 000 Kč. Ostatní pozice mají dohromady 75 000 Kč a hotovost je 15 000 Kč. Jakou váhu má pozice A?", answer: 25, tolerance: 0.05, unit: "%", correctExplanation: "Celé portfolio má 30 000 + 75 000 + 15 000 = 120 000 Kč. 30 000 ÷ 120 000 = 25 %.", incorrectExplanation: "Hodnotu pozice vyděl hodnotou celého portfolia, hotovost včetně: 30 000 ÷ (30 000 + 75 000 + 15 000). Výsledek 28,57 % vznikne, když hotovost vynecháš." },
    { id: "explorer", type: "interactiveFigure", figure: "concentration-explorer", title: "Pět pozic, jedna příliš velká", description: "Měň hodnoty pozic a sleduj váhy, největší pozici a dopad jejího poklesu na celé portfolio. Ukázková data, ne skutečné firmy." },
    { id: "rule", type: "conceptCallout", title: "Pravidlo místo dojmu", content: "V těchto cvičeních platí jednoduché pravidlo: žádná jednotlivá firma nemá mít víc než 25 % portfolia. Výsledek pak zní třeba „Největší pozice: 40 % · Cíl: ≤ 25 % · Nesplněno“. Je to výukový práh, ne investiční doporučení, ale dá se vždy ověřit a vysvětlit." },
    { id: "impact", type: "explanation", title: "Váha krát pohyb", content: "Když se pohne jen jedna pozice, celé portfolio se pohne o její váhu krát její výnos. Pozice s váhou 40 %, která klesne o 30 %, stáhne celé portfolio o 12 %. Pozice s váhou 5 % by při stejném poklesu ubrala jen 1,5 %." },
    { id: "impact-practice", type: "numericQuestion", prompt: "Největší pozice má váhu 40 % a klesne o 30 %. Ostatní pozice ani hotovost se nezmění. Jaký výnos má celé portfolio?", answer: -12, tolerance: 0.05, unit: "%", correctExplanation: "0,40 × (−30 %) = −12 %. Ostatní položky výnos 0 %, takže nic nepřidají ani neuberou.", incorrectExplanation: "Vynásob váhu pozice jejím výnosem: 0,40 × (−30 %). Výsledek je záporný a menší než −30 %, protože pozice tvoří jen část portfolia." },
    { id: "count", type: "explanation", title: "Víc pozic neznamená menší koncentraci", content: "Deset pozic s jednou obří vahou je koncentrovanější než čtyři stejně velké. Rozhoduje, jak velká je největší váha a jak podobné pozice jsou. O podobnosti v odvětví a zemi bude další lekce." },
    { id: "count-check", type: "multipleChoiceQuestion", prompt: "Které portfolio splní pravidlo „žádná firma nad 25 %“?", options: [{ id: "many", label: "Dvanáct firem, největší má 31 %." }, { id: "five", label: "Pět firem po 18 % a 10 % hotovosti." }, { id: "two", label: "Dvě firmy po 50 %." }], correctOptionId: "five", correctExplanation: "Největší pozice má 18 %, tedy méně než 25 %. Dvanáct firem pravidlo nesplní, protože jedna má 31 %.", incorrectExplanation: "Pravidlo se dívá na největší váhu, ne na počet firem. Splní ho jen portfolio, kde největší pozice nepřesahuje 25 %." },
    { id: "lab-bridge", type: "labBridge", title: "Váhy v Portfolio Labu", content: "V Portfolio Labu ukazuje karta Rozložení podíl každé položky na celé hodnotě, hotovost včetně. Váhy se mění s cenami i s každým nákupem." },
    { id: "summary", type: "lessonSummary", title: "Váhy, ne počet", content: "Váha pozice je její hodnota dělená hodnotou celého portfolia. Koncentrace znamená, že velkou část hodnoty drží jedna pozice. Její pohyb se do portfolia promítne jako váha krát výnos. Počet pozic sám o sobě koncentraci neodstraní." },
    { id: "takeaway", type: "takeaway", title: "40 % váhy, −12 % portfolia", content: "Pozice s váhou 40 %, která klesne o 30 %, stáhne celé portfolio o 12 %. Proto se vyplatí sledovat největší pozici." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš spočítat váhu pozice a její dopad na portfolio. V další lekci uvidíš koncentraci, kterou váhy jednotlivých firem neukážou: v jednom odvětví nebo zemi." },
  ],
};
