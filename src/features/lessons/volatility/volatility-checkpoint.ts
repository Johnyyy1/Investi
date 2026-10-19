import type { AuthoredLesson } from "../types";
import { volatilityLessons } from "./manifest";

const lesson = volatilityLessons[4];

export const volatilityCheckpointLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "volatility",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Volatilita",
  position: 5,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "intro", label: "Dva fondy, čtyři čísla" },
    { id: "sd-check", label: "Směrodatná odchylka" },
    { id: "annualise-check", label: "Anualizace" },
    { id: "drawdown-check", label: "Největší propad" },
    { id: "recovery-check", label: "Návrat na vrchol" },
    { id: "past-check", label: "Co čísla neřeknou" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/volatility/${volatilityLessons[3].slug}`, label: volatilityLessons[3].title } },
  blocks: [
    { id: "intro", type: "heading", title: "Jedno ověření, čtyři nástroje.", body: "Projdeš směrodatnou odchylku, anualizaci, největší propad a návrat na vrchol. U každé úlohy můžeš odpověď opravit, dokud nesedí." },
    { id: "scenario", type: "workedExample", title: "Dva ukázkové fondy", introduction: "Vymyšlené fondy za stejných deset let, ne skutečné produkty.", steps: [{ label: "Fond Klid · volatilita", value: "8 % ročně" }, { label: "Fond Klid · největší propad", value: "−12 %" }, { label: "Fond Vlna · volatilita", value: "22 % ročně" }, { label: "Fond Vlna · největší propad", value: "−35 %" }, { label: "Oba · průměrný roční výnos", value: "≈ 6 %" }], conclusion: "Podobný průměrný výnos, velmi odlišná cesta. Každé číslo odpovídá na jinou otázku." },
    { id: "scenario-check", type: "multipleChoiceQuestion", prompt: "Který údaj nejlépe ukazuje, o kolik hodnota Fondu Vlna v nejhorší chvíli dočasně klesla od předchozího vrcholu?", options: [{ id: "volatility", label: "Volatilita 22 % ročně." }, { id: "depth", label: "Největší propad −35 %." }, { id: "average", label: "Průměrný roční výnos 6 %." }], correctOptionId: "depth", correctExplanation: "Největší propad měří přesně tohle: nejhlubší pokles od vrcholu ke dnu. Volatilita popisuje typickou velikost výkyvů, ne nejhorší okamžik.", incorrectExplanation: "Volatilita je typický výkyv kolem průměru a průměrný výnos popisuje celé období. Nejhorší pokles od vrcholu ukazuje největší propad." },
    { id: "sd-check", type: "multiNumericQuestion", prompt: "Čtvrtletní výnosy jsou +3 %, −1 %, +1 % a +1 %. Spočítej průměr a výběrovou směrodatnou odchylku (dělíš n − 1). Zaokrouhli na dvě desetinná místa.", answers: [{ id: "mean", label: "Průměrný výnos", answer: 1, tolerance: 0.01, unit: "%" }, { id: "deviation", label: "Směrodatná odchylka", answer: 1.63, tolerance: 0.01, unit: "%" }], correctExplanation: "Průměr je 4 ÷ 4 = 1 %. Odchylky +2, −2, 0, 0 dávají druhé mocniny 4 + 4 + 0 + 0 = 8. 8 ÷ 3 ≈ 2,667 a √2,667 ≈ 1,63 %.", incorrectExplanation: "Průměr: součet 4 ÷ 4. Odchylky od průměru umocni, sečti, vyděl n − 1 = 3 a odmocni. Výsledek 1,41 % vznikne dělením n místo n − 1." },
    { id: "annualise-check", type: "numericQuestion", prompt: "Týdenní směrodatná odchylka výnosů je 2 %. Rok má 52 týdnů. Jaká je anualizovaná volatilita? Zaokrouhli na dvě desetinná místa.", answer: 14.42, tolerance: 0.05, unit: "%", correctExplanation: "2 % × √52 ≈ 2 % × 7,211 ≈ 14,42 %.", incorrectExplanation: "Vynásob odmocninou počtu týdnů v roce: 2 % × √52. Výsledek 104 % by vznikl prostým násobením." },
    { id: "drawdown-check", type: "numericQuestion", prompt: "Hodnota investice jde 50 → 60 → 45 → 70 → 56 Kč. Jaký byl největší propad?", answer: -25, tolerance: 0.05, unit: "%", correctExplanation: "Z vrcholu 60 Kč na 45 Kč je to 45 ÷ 60 − 1 = −25 %. Druhý pokles ze 70 na 56 Kč je jen −20 %.", incorrectExplanation: "Spočítej propad od dosavadního vrcholu pro oba poklesy: 45 ÷ 60 − 1 a 56 ÷ 70 − 1. Největší propad je ten hlubší." },
    { id: "recovery-check", type: "numericQuestion", prompt: "Po propadu o 25 % má investice hodnotu 45 Kč. Jaký zisk potřebuje k návratu na vrchol 60 Kč? Zaokrouhli na dvě desetinná místa.", answer: 33.33, tolerance: 0.05, unit: "%", correctExplanation: "60 ÷ 45 − 1 ≈ 0,3333, tedy +33,33 %. Stejně vyjde 1 ÷ (1 − 0,25) − 1.", incorrectExplanation: "Zisk se počítá z nižší hodnoty 45 Kč: 60 ÷ 45 − 1. Odpověď 25 % přehlíží, že se základ zmenšil." },
    { id: "past-check", type: "multipleChoiceQuestion", prompt: "Fond měl za posledních pět let nízkou volatilitu i malý největší propad. Co z toho plyne?", options: [{ id: "safe", label: "Velký propad mu v budoucnu nehrozí." }, { id: "past", label: "Čísla popisují minulé kolísání. Budoucí propad může být hlubší a volatilita neříká směr." }, { id: "return", label: "Fond bude mít vysoký výnos." }], correctOptionId: "past", correctExplanation: "Volatilita i největší propad jsou spočítané z historie. Jsou užitečné pro srovnání, ale nejsou zárukou ani předpovědí.", incorrectExplanation: "Obě čísla vznikla z minulých cen. Nic neslibují o budoucích propadech ani výnosech." },
    { id: "lab-bridge", type: "labBridge", title: "Vyzkoušej to v Labu", content: "Otevři v Labu porovnání dvou instrumentů. Volatilitu i největší propad tam uvidíš vedle sebe za stejné období a teď víš, jak vznikly." },
    { id: "summary", type: "lessonSummary", title: "Čtyři nástroje pro kolísání", content: "Směrodatná odchylka měří rozptyl výnosů kolem průměru za jedno období. Anualizace ji převede na rok násobením √N. Největší propad ukáže nejhlubší pokles od vrcholu. Zisk potřebný k návratu je 1 ÷ (1 + propad) − 1. Všechna čísla popisují minulost." },
    { id: "takeaway", type: "takeaway", title: "Dvě čísla, dvě otázky", content: "Volatilita odpovídá na otázku, jak moc výnosy typicky kolísají. Největší propad odpovídá na otázku, o kolik hodnota v nejhorší chvíli klesla. Ke srovnání investic potřebuješ obě." },
    { id: "checkpoint", type: "checkpoint", label: "Modul dokončen", content: "Ovládáš základní měřítka kolísání. Stejné výpočty najdeš na detailu instrumentu, v porovnání i v backtestu." },
  ],
};
