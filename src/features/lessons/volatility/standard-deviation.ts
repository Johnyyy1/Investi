import type { AuthoredLesson } from "../types";
import { volatilityLessons } from "./manifest";

const lesson = volatilityLessons[1];

export const standardDeviationLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "volatility",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Volatilita",
  position: 2,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "mean", label: "Průměrný výnos" },
    { id: "deviations", label: "Odchylky od průměru" },
    { id: "sd-formula", label: "Směrodatná odchylka" },
    { id: "sd-explorer", label: "Prozkoumej výpočet" },
    { id: "units", label: "Jednotky a období" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/volatility/${volatilityLessons[0].slug}`, label: volatilityLessons[0].title }, next: { href: `/learn/volatility/${volatilityLessons[2].slug}`, label: volatilityLessons[2].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: řada X má měsíční výnosy +1 %, +1 %, +1 %, +1 %. Řada Y má +4 %, −2 %, +3 %, −1 %. Obě mají průměrný měsíční výnos 1 %. Čím se liší?",
      options: [{ id: "mean", label: "Průměrem. Y má vyšší průměr, protože obsahuje +4 %." }, { id: "spread", label: "Tím, jak daleko jsou jednotlivé výnosy od průměru." }, { id: "sum", label: "Součtem výnosů." }],
      correctOptionId: "spread",
      correctExplanation: "Průměr i součet (4 %) jsou stejné. Výnosy X leží přesně na průměru, výnosy Y jsou od něj až 3 procentní body daleko. Právě tuto vzdálenost změří směrodatná odchylka.",
      incorrectExplanation: "Sečti obě řady: 1 + 1 + 1 + 1 = 4 a 4 − 2 + 3 − 1 = 4. Průměr je tedy u obou 1 %. Liší se rozptyl: jak daleko od průměru jednotlivé výnosy leží.",
    },
    { id: "mean", type: "explanation", title: "Průměr je střed řady", content: "Rozptyl se vždy měří od nějakého středu. Tím středem je aritmetický průměr výnosů za období: všechny výnosy sečteš a vydělíš jejich počtem. Pro řadu Y: (4 − 2 + 3 − 1) ÷ 4 = 1 %." },
    { id: "mean-formula", type: "formula", expression: "R̄ = (R_1 + R_2 + … + R_n) / n", latex: String.raw`\bar{R} = \frac{1}{n}\sum_{t=1}^{n} R_t`, variables: [{ symbol: "R_t", description: "výnos za období t jako desetinné číslo" }, { symbol: "n", description: "počet výnosů" }, { symbol: "R̄", description: "průměrný výnos za období" }] },
    { id: "deviations", type: "workedExample", title: "Odchylky řady Y od průměru", introduction: "Od každého výnosu odečti průměr 1 %.", steps: [{ label: "+4 % − 1 %", value: "+3 p. b." }, { label: "−2 % − 1 %", value: "−3 p. b." }, { label: "+3 % − 1 %", value: "+2 p. b." }, { label: "−1 % − 1 %", value: "−2 p. b." }, { label: "Součet odchylek", value: "0", emphasis: true }], conclusion: "Odchylky od průměru se vždy sečtou na nulu. Kladné a záporné se vyruší, takže jejich součet o rozptylu nic neřekne." },
    { id: "why-square", type: "multipleChoiceQuestion", prompt: "Proč nestačí odchylky od průměru prostě sečíst?", options: [{ id: "cancel", label: "Kladné a záporné odchylky se vyruší a součet vyjde vždy 0." }, { id: "large", label: "Součet by vyšel příliš velký." }, { id: "sign", label: "Záporné odchylky se do rizika nepočítají." }], correctOptionId: "cancel", correctExplanation: "Průměr leží přesně uprostřed, takže součet odchylek je nula u každé řady. Proto se odchylky nejdřív umocní na druhou: všechny jsou pak kladné a velké odchylky váží víc.", incorrectExplanation: "Sečti odchylky řady Y: 3 − 3 + 2 − 2 = 0. Tak to vyjde u každé řady, protože průměr je její střed. Řešením je umocnit odchylky na druhou." },
    { id: "sd-formula", type: "formula", expression: "s = √( Σ (R_t − R̄)² / (n − 1) )", latex: String.raw`s = \sqrt{\frac{\sum_{t=1}^{n} \left(R_t - \bar{R}\right)^2}{n - 1}}`, variables: [{ symbol: "R_t − R̄", description: "odchylka výnosu od průměru" }, { symbol: "n − 1", description: "výběrová směrodatná odchylka dělí počtem výnosů minus jedna" }, { symbol: "s", description: "směrodatná odchylka výnosů za jedno období" }] },
    { id: "n-minus-one", type: "explanation", title: "Proč n − 1", content: "Průměr jsme odhadli ze stejných dat, takže odchylky od něj vycházejí o kousek menší než od skutečného, neznámého středu. Dělení n − 1 místo n to vyrovnává. Říká se tomu výběrová směrodatná odchylka a stejně ji počítá Lab i backtest." },
    { id: "sd-example", type: "workedExample", title: "Směrodatná odchylka řady Y", introduction: "Odchylky +3, −3, +2, −2 procentního bodu umocni, sečti, vyděl n − 1 a odmocni.", steps: [{ label: "Druhé mocniny odchylek", value: "9 + 9 + 4 + 4 = 26" }, { label: "Děleno n − 1 = 3", value: "26 ÷ 3 ≈ 8,667" }, { label: "Odmocnina", value: "√8,667 ≈ 2,94 %", emphasis: true }], conclusion: "Výnosy Y se od průměru typicky liší zhruba o 2,94 procentního bodu. U řady X jsou všechny odchylky nulové, takže její směrodatná odchylka je 0 %." },
    { id: "sd-explorer", type: "interactiveFigure", figure: "standard-deviation-explorer", title: "Od výnosů ke směrodatné odchylce", description: "Uprav výnosy nebo vyber připravenou řadu. Tabulka ukáže každý krok výpočtu." },
    { id: "sd-practice", type: "multiNumericQuestion", prompt: "Měsíční výnosy jsou +2 %, −1 %, +3 % a 0 %. Spočítej průměr a výběrovou směrodatnou odchylku (dělíš n − 1). Zaokrouhli na dvě desetinná místa.", answers: [{ id: "mean", label: "Průměrný výnos", answer: 1, tolerance: 0.01, unit: "%" }, { id: "deviation", label: "Směrodatná odchylka", answer: 1.83, tolerance: 0.01, unit: "%" }], correctExplanation: "Průměr je (2 − 1 + 3 + 0) ÷ 4 = 1 %. Odchylky +1, −2, +2, −1 dávají druhé mocniny 1 + 4 + 4 + 1 = 10. 10 ÷ 3 ≈ 3,333 a √3,333 ≈ 1,83 %.", incorrectExplanation: "Nejdřív průměr: součet 4 děleno 4 výnosy. Pak odchylky od průměru umocni, sečti, vyděl n − 1 = 3 a odmocni. Výsledek 1,58 % vznikne dělením n místo n − 1." },
    { id: "units", type: "explanation", title: "Směrodatná odchylka platí pro své období", content: "Směrodatná odchylka má stejnou jednotku jako výnosy, ze kterých vznikla. Z měsíčních výnosů vyjde měsíční směrodatná odchylka, z denních denní. Čísla z různých období proto nelze porovnávat napřímo, nejdřív je převedeš na rok. To je téma další lekce." },
    { id: "units-check", type: "multipleChoiceQuestion", prompt: "Denní směrodatná odchylka výnosů akcie je 1,2 %. Co to znamená?", options: [{ id: "typical", label: "Denní výnosy se od svého průměru typicky liší zhruba o 1,2 procentního bodu." }, { id: "exact", label: "Cena se každý den změní přesně o 1,2 %." }, { id: "annual", label: "Roční volatilita akcie je 1,2 %." }], correctOptionId: "typical", correctExplanation: "Směrodatná odchylka popisuje typickou vzdálenost od průměru. Některé dny jsou klidnější, jiné prudší. A protože vznikla z denních výnosů, je to denní údaj, ne roční.", incorrectExplanation: "Jde o typickou velikost odchylky, ne přesný denní pohyb. Jednotka odpovídá období výnosů: denní výnosy dávají denní směrodatnou odchylku." },
    { id: "summary", type: "lessonSummary", title: "Čtyři kroky ke směrodatné odchylce", content: "Spočítej průměrný výnos. Od každého výnosu ho odečti. Odchylky umocni na druhou a sečti. Součet vyděl n − 1 a odmocni. Výsledek má jednotku výnosů a platí pro stejné období jako ony." },
    { id: "takeaway", type: "takeaway", title: "Stejný průměr, jiný rozptyl", content: "Řady X a Y mají průměr 1 %. Směrodatná odchylka X je 0 %, u Y zhruba 2,94 %. Právě tohle číslo, přepočtené na rok, Lab ukazuje jako volatilitu." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš spočítat výběrovou směrodatnou odchylku a víš, že platí pro období svých výnosů. Dál ji převedeš na rok." },
  ],
};
