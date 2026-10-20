import type { AuthoredLesson } from "../types";
import { correlationLessons } from "./manifest";

const lesson = correlationLessons[3];

export const correlationRealDataLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "correlation",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Korelace",
  position: 4,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "intro", label: "Jedno číslo, jedna věta" },
    { id: "real-history", label: "Reálná historie" },
    { id: "calc-check", label: "Spočítej korelaci" },
    { id: "causation-check", label: "Příčina, nebo společný pohyb" },
    { id: "crisis-check", label: "Když přijde krize" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/correlation/${correlationLessons[2].slug}`, label: correlationLessons[2].title } },
  blocks: [
    { id: "intro", type: "heading", title: "Celý modul na skutečných datech.", body: "Nejdřív si ověříš, jak korelaci číst. Pak ji uvidíš na skutečné historii dvou instrumentů a nakonec projdeš výpočet, příčiny a krize. U každé úlohy můžeš odpověď opravit, dokud nesedí." },
    { id: "scenario-check", type: "multipleChoiceQuestion", prompt: "Korelace denních výnosů dvou instrumentů za rok je 0,9. Která věta je pravdivá?", options: [{ id: "direction", label: "Ve většině dní se pohybovaly stejným směrem. O velikosti pohybů to nic neříká." }, { id: "share", label: "Druhý instrument vydělá 90 % toho, co první." }, { id: "cause", label: "Jeden instrument způsobuje pohyby druhého." }], correctOptionId: "direction", correctExplanation: "Korelace 0,9 popisuje těsný společný směr v minulém roce. Velikost pohybů měří volatilita a příčinu korelace neukáže.", incorrectExplanation: "Korelace není podíl výnosu ani důkaz příčiny. Říká, jak spolehlivě se výnosy pohybovaly stejným směrem." },
    { id: "real-history", type: "heading", title: "Teď na skutečné historii.", body: "Dva instrumenty, každý obchodní den roku 2022. Odhadni, jak silně spolu korelovaly jejich denní výnosy, a pak se podívej na body i na číslo." },
    { id: "real-history-figure", type: "interactiveFigure", figure: "historical-correlation", title: "Korelace z historických cen", description: "Předpověz sílu vztahu a odhal korelaci. Spočítá ji stejná funkce jako porovnání v Labu, ze dnů, kdy se obchodovaly oba instrumenty." },
    { id: "calc-check", type: "numericQuestion", prompt: "Výnosy A jsou +4, −2, 0 a −2 %, výnosy B +2, 0, −2 a 0 %. Průměr obou řad je 0. Spočítej korelaci. Zaokrouhli na dvě desetinná místa.", answer: 0.58, tolerance: 0.01, unit: "", correctExplanation: "Součiny: 8 + 0 + 0 + 0 = 8. Druhé mocniny A: 16 + 4 + 0 + 4 = 24, B: 4 + 0 + 4 + 0 = 8. 8 ÷ √(24 × 8) = 8 ÷ √192 ≈ 0,58.", incorrectExplanation: "Vynásob výnosy stejného měsíce a sečti: 4·2 + (−2)·0 + 0·(−2) + (−2)·0. Pak vyděl odmocninou ze součinu součtů druhých mocnin: √(24 × 8)." },
    { id: "causation-check", type: "multipleChoiceQuestion", prompt: "Akcie banky a akcie pojišťovny mají vysokou korelaci denních výnosů. Jaké vysvětlení je nejpravděpodobnější?", options: [{ id: "bank", label: "Banka řídí cenu akcií pojišťovny." }, { id: "factor", label: "Obě reagují na stejné věci, třeba na úrokové sazby a na celý trh." }, { id: "random", label: "Vysoká korelace je vždy náhoda." }], correctOptionId: "factor", correctExplanation: "Banky i pojišťovny citlivě reagují na úrokové sazby a obě jsou součástí trhu. Společný faktor je nejčastější zdroj korelace.", incorrectExplanation: "Korelace neukazuje příčinu. U dvou finančních firem je nejpravděpodobnější, že obě táhne stejná věc, například sazby a celý trh." },
    { id: "crisis-check", type: "multipleChoiceQuestion", prompt: "Portfolio drží dvě akcie, které měly za posledních pět let korelaci 0,3. Co čekat v prudkém propadu celého trhu?", options: [{ id: "protect", label: "Korelace 0,3 zaručuje, že jedna akcie ztrátu druhé vyrovná." }, { id: "rise", label: "Korelace může vzrůst a rozložení pak pomůže méně, než ukazují klidná léta." }, { id: "zero", label: "Korelace klesne na nulu a portfolio bude v bezpečí." }], correctOptionId: "rise", correctExplanation: "V propadu trhu převáží společný pohyb a korelace obvykle roste. Ochrana z rozložení slábne právě tehdy, kdy by byla nejcennější.", incorrectExplanation: "Korelace z klidných let nic nezaručuje. V krizi bývá vyšší, protože trh klesá jako celek." },
    { id: "lab-bridge", type: "labBridge", title: "Pokračuj v Labu", content: "V porovnání v Labu vyber dvě akcie z různých odvětví, nebo akcii a ETF. Zkus delší i kratší období a sleduj, jak se korelace mění.", metric: "correlation" },
    { id: "summary", type: "lessonSummary", title: "Korelace v kostce", content: "Korelace měří, jak těsně se výnosy dvou investic pohybovaly spolu, od −1 do +1. Počítá se z výnosů za stejná období, ne z cen. Neukazuje příčinu ani velikost pohybů. Platí jen pro období, ze kterého je spočítaná, a v krizích obvykle roste." },
    { id: "takeaway", type: "takeaway", title: "Korelace je stavební kámen diverzifikace", content: "Čím méně se investice pohybují spolu, tím víc se jejich výkyvy v portfoliu vyruší. Jak přesně, uvidíš v modulu Diverzifikace." },
    { id: "checkpoint", type: "checkpoint", label: "Modul dokončen", content: "Umíš korelaci spočítat, přečíst i zpochybnit. Stejný výpočet najdeš v porovnání dvou instrumentů v Labu." },
  ],
};
