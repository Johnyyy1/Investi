import type { AuthoredLesson } from "../types";
import { diversificationLessons } from "./manifest";

const lesson = diversificationLessons[1];

export const sectorsAndCountriesLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "diversification",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Diverzifikace",
  position: 2,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "sectors", label: "Sektory" },
    { id: "explorer", label: "Dvě portfolia" },
    { id: "countries", label: "Země a měna" },
    { id: "mastery", label: "Co ještě chybí" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/diversification/${diversificationLessons[0].slug}`, label: diversificationLessons[0].title }, next: { href: `/learn/diversification/${diversificationLessons[2].slug}`, label: diversificationLessons[2].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: portfolio drží pět amerických technologických firem, každou za 18 %, a 10 % hotovosti. Žádná pozice nepřesahuje 25 %. Je portfolio dobře rozložené?",
      options: [{ id: "yes", label: "Ano. Každá firma je pod 25 %." }, { id: "no", label: "Ne. Všech pět firem je ze stejného odvětví i ze stejné země, takže na nich visí 90 % hodnoty." }, { id: "unknown", label: "Nedá se říct bez aktuálních cen." }],
      correctOptionId: "no",
      correctExplanation: "Pravidlo pro jednotlivé firmy je splněné, ale technologie i USA tvoří 90 % portfolia. Když se odvětví nebo americkému trhu přestane dařit, klesne skoro všechno najednou.",
      incorrectExplanation: "Podívej se nejen na firmy, ale i na to, co mají společné. Pět technologických firem z USA tvoří 90 % hodnoty v jednom sektoru a jedné zemi.",
    },
    { id: "sectors", type: "explanation", title: "Firmy jednoho odvětví sdílejí rizika", content: "Sektor je odvětví, ve kterém firma podniká: technologie, finance, zdravotnictví, energie. Firmy jednoho sektoru často reagují na stejné věci, třeba na regulaci, poptávku nebo úrokové sazby. Proto jejich výnosy spolu obvykle korelují víc než výnosy firem z různých sektorů." },
    { id: "explorer", type: "interactiveFigure", figure: "exposure-explorer", title: "Pět firem, dva pohledy", description: "Přepínej mezi dvěma portfolii a mezi rozložením podle sektoru a podle země. Ukázková data, ne skutečné firmy." },
    { id: "sector-practice", type: "numericQuestion", prompt: "Portfolio má hodnotu 200 000 Kč. Tři technologické firmy mají 60 000, 30 000 a 20 000 Kč, banka 40 000 Kč a zbytek je hotovost. Jaký podíl portfolia tvoří sektor Technologie?", answer: 55, tolerance: 0.05, unit: "%", correctExplanation: "Technologie mají 60 000 + 30 000 + 20 000 = 110 000 Kč. 110 000 ÷ 200 000 = 55 %. Největší jednotlivá firma má přitom jen 30 %.", incorrectExplanation: "Sečti hodnotu všech technologických firem a vyděl ji hodnotou celého portfolia: 110 000 ÷ 200 000." },
    { id: "countries", type: "explanation", title: "Jedna ekonomika, jedna měna", content: "Země ukazuje, na které ekonomice a politice portfolio závisí. Pro investora, který počítá v korunách, přináší zahraniční akcie i měnové riziko: když koruna posílí vůči dolaru, americká akcie v korunách klesne, i když se její cena v dolarech nezměnila." },
    { id: "currency-check", type: "multipleChoiceQuestion", prompt: "Koupíš za koruny akcii americké firmy. Cena v dolarech se za rok nezmění, ale koruna vůči dolaru posílí. Co se stane s hodnotou pozice v korunách?", options: [{ id: "same", label: "Zůstane stejná, cena se nezměnila." }, { id: "down", label: "Klesne. Za stejný počet dolarů dostaneš méně korun." }, { id: "up", label: "Vzroste, silná koruna je pro investora vždy dobrá." }], correctOptionId: "down", correctExplanation: "Hodnota v korunách je cena v dolarech krát kurz. Když koruna posílí, kurz koruny za dolar klesne, a s ním i hodnota pozice v korunách.", incorrectExplanation: "Hodnotu pozice v korunách určuje cena i kurz. Posílení koruny znamená méně korun za každý dolar, takže hodnota v korunách klesne." },
    { id: "mastery", type: "explanation", title: "Tři pohledy na jedno portfolio", content: "Rozložení má několik vrstev: jednotlivé firmy, sektory a země. Portfolio může splnit jednu a selhat v jiné. Pět firem z pěti sektorů je pořád koncentrované, pokud jsou všechny z jedné země." },
    { id: "mastery-check", type: "multipleChoiceQuestion", prompt: "Portfolio má pět firem z pěti různých sektorů, každou za 20 %. Všechny jsou z USA. Co mu ještě chybí?", options: [{ id: "nothing", label: "Nic, sektory jsou rozložené." }, { id: "country", label: "Rozložení podle země: celých 100 % závisí na jedné ekonomice a jedné měně." }, { id: "more", label: "Víc firem ze stejných sektorů." }], correctOptionId: "country", correctExplanation: "Sektory jsou rozložené, ale země ne. Americká recese nebo pohyb dolaru by zasáhly celé portfolio.", incorrectExplanation: "Zkontroluj všechny tři vrstvy: firmy (20 %), sektory (20 %) a země (100 % USA). Koncentrace zbyla v zemi." },
    { id: "lab-bridge", type: "labBridge", title: "Sektory a země v Portfolio Labu", content: "V Portfolio Labu přepni kartu Rozložení na Sektor nebo Zemi. Akcie jedné firmy tam patří celá do svého sektoru a země. Jak se počítají ETF, uvidíš v další lekci." },
    { id: "summary", type: "lessonSummary", title: "Koncentrace má víc vrstev", content: "Firmy jednoho sektoru a jedné země sdílejí rizika, takže se jejich výnosy pohybují spolu. Portfolio může mít malé váhy jednotlivých firem, a přesto stát skoro celé na jednom odvětví nebo jedné ekonomice. Zahraniční akcie navíc nesou měnové riziko." },
    { id: "takeaway", type: "takeaway", title: "Pět firem, jeden sektor", content: "Pět technologických firem po 18 % splní pravidlo pro jednotlivé firmy, ale technologie i USA tvoří 90 % portfolia." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš spočítat podíl sektoru a země. Další lekce ukáže, co se skrývá uvnitř ETF a jak se fondy sčítají s akciemi." },
  ],
};
