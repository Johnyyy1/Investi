import type { AuthoredLesson } from "../types";
import { volatilityLessons } from "./manifest";

const lesson = volatilityLessons[2];

export const annualisingVolatilityLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "volatility",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Volatilita",
  position: 3,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "why-not-times", label: "Proč ne krát 252" },
    { id: "frequencies", label: "Denní, týdenní a měsíční data" },
    { id: "annualisation-explorer", label: "Vyzkoušej anualizaci" },
    { id: "lab-conventions", label: "Stejně jako v Labu" },
    { id: "real-history", label: "Reálná historie" },
    { id: "compare-check", label: "Ověř si porozumění" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/volatility/${volatilityLessons[1].slug}`, label: volatilityLessons[1].title }, next: { href: `/learn/volatility/${volatilityLessons[3].slug}`, label: volatilityLessons[3].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Denní směrodatná odchylka výnosů je 1 %. Rok má zhruba 252 obchodních dní. Jaká je přibližně roční volatilita?",
      options: [{ id: "times", label: "252 %, protože 1 % × 252." }, { id: "sqrt", label: "Zhruba 15,9 %." }, { id: "same", label: "Pořád 1 %. Kolísání se s časem nemění." }],
      correctOptionId: "sqrt",
      correctExplanation: "Roční volatilita je 1 % × √252 ≈ 15,87 %. Dny nahoru a dny dolů se během roku částečně vyruší, proto kolísání neroste s počtem dní, ale s jeho odmocninou.",
      incorrectExplanation: "Za rok se nasčítá víc pohybů, takže kolísání roste. Ne ale lineárně: růsty a poklesy se částečně vyruší. Roste s odmocninou počtu dní: 1 % × √252 ≈ 15,87 %.",
    },
    { id: "why-not-times", type: "explanation", title: "Růsty a poklesy se částečně vyruší", content: "Kdyby se výnosy každý den pohnuly stejným směrem, kolísání by rostlo s počtem dní. Jenže se střídají růsty a poklesy a ty se částečně vyruší. Pokud výnosy jednotlivých dní na sobě nezávisejí, sčítá se rozptyl, tedy druhá mocnina směrodatné odchylky. Směrodatná odchylka pak roste s odmocninou počtu období." },
    { id: "annual-formula", type: "formula", expression: "σ_rok = s × √N", latex: String.raw`\sigma_{\text{rok}} = s \times \sqrt{N}`, variables: [{ symbol: "s", description: "směrodatná odchylka výnosů za jedno období" }, { symbol: "N", description: "počet období v roce: 252 obchodních dní, 52 týdnů nebo 12 měsíců" }, { symbol: "σ_rok", description: "anualizovaná volatilita" }] },
    { id: "frequencies", type: "workedExample", title: "Odmocnina pro každou frekvenci", steps: [{ label: "Denní data: √252", value: "≈ 15,87" }, { label: "Týdenní data: √52", value: "≈ 7,21" }, { label: "Měsíční data: √12", value: "≈ 3,46" }, { label: "Denní 1 % na rok", value: "1 % × 15,87 ≈ 15,87 %", emphasis: true }], conclusion: "Násobitel závisí na tom, z jakých výnosů směrodatná odchylka vznikla. Vždy použij počet těchto období v roce." },
    { id: "assumption", type: "conceptCallout", title: "Odmocnina času je zjednodušení", content: "Pravidlo √N předpokládá, že výnosy po sobě jdoucích období na sobě nezávisejí. Na trzích se ale klidné a bouřlivé období shlukují. Anualizovaná volatilita je proto užitečné srovnávací číslo, ne přesný popis jednoho konkrétního roku." },
    { id: "annualisation-explorer", type: "interactiveFigure", figure: "annualisation-explorer", title: "Z období na rok", description: "Zvol frekvenci dat a směrodatnou odchylku za období. Uvidíš roční volatilitu i chybu, kterou by způsobilo prosté násobení." },
    { id: "monthly-practice", type: "numericQuestion", prompt: "Měsíční směrodatná odchylka výnosů fondu je 5 %. Jaká je jeho anualizovaná volatilita? Zaokrouhli na dvě desetinná místa.", answer: 17.32, tolerance: 0.05, unit: "%", correctExplanation: "Měsíc má 12 období v roce: 5 % × √12 ≈ 5 % × 3,464 ≈ 17,32 %.", incorrectExplanation: "Použij odmocninu z počtu měsíců v roce, ne samotný počet: 5 % × √12. Výsledek 60 % by vznikl prostým násobením dvanácti." },
    { id: "lab-conventions", type: "labBridge", title: "Stejná pravidla jako v Labu", content: "Detail instrumentu v Labu bere denní jednoduché výnosy ze zavíracích cen, spočítá výběrovou směrodatnou odchylku (n − 1) a vynásobí ji √252. Backtest vychází z výnosů na konci měsíce a násobí √12. Obě čísla jsou roční, ale z jiné frekvence dat, takže se mohou mírně lišit." },
    { id: "real-history", type: "heading", title: "Teď na skutečné historii.", body: "Akcie jedné firmy a široký fond za celý rok 2022, kdy trhy výrazně kolísaly. Nejdřív odhadni, který z nich kolísal víc. Pak denní směrodatnou odchylku převeď na rok stejně, jako to dělá Lab." },
    { id: "real-history-figure", type: "interactiveFigure", figure: "historical-volatility", title: "Volatilita z historických cen", description: "Předpověz, odhal denní směrodatnou odchylku a anualizuj ji. Výsledek spočítá stejná funkce jako Lab." },
    { id: "compare-check", type: "multipleChoiceQuestion", prompt: "Fond A má denní směrodatnou odchylku 0,8 %, fond B měsíční 4 %. Který z nich kolísal víc v ročním vyjádření?", options: [{ id: "a", label: "A. Denní pohyby jsou častější, takže je riziko vyšší." }, { id: "b", label: "B. Po anualizaci má zhruba 13,9 % proti 12,7 % u A." }, { id: "none", label: "Nelze je porovnat vůbec." }], correctOptionId: "b", correctExplanation: "A: 0,8 % × √252 ≈ 12,70 %. B: 4 % × √12 ≈ 13,86 %. Teprve po převodu na stejné období je vidět, že víc kolísal fond B.", incorrectExplanation: "Čísla z různých období převeď na rok: 0,8 % × √252 ≈ 12,70 % a 4 % × √12 ≈ 13,86 %. Porovnat je lze, ale až po anualizaci." },
    { id: "summary", type: "lessonSummary", title: "Z období na rok", content: "Směrodatnou odchylku výnosů za období vynásob odmocninou počtu období v roce: √252 pro denní data, √52 pro týdenní, √12 pro měsíční. Kolísání roste s odmocninou času, protože se růsty a poklesy částečně vyruší. Výsledek je anualizovaná volatilita." },
    { id: "takeaway", type: "takeaway", title: "Porovnávej až po anualizaci", content: "Denní 0,8 % a měsíční 4 % nejsou srovnatelná čísla. Po převodu na rok vychází 12,70 % a 13,86 %. Lab ukazuje volatilitu vždy v ročním vyjádření." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš převést volatilitu z libovolné frekvence na rok a víš, jak ji počítá Lab. Další lekce se podívá na jiný druh rizika: hloubku propadu." },
  ],
};
