import type { AuthoredLesson } from "../types";
import { correlationLessons } from "./manifest";

const lesson = correlationLessons[0];

export const whatIsCorrelationLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "correlation",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Korelace",
  position: 1,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "meaning", label: "Pohyb spolu" },
    { id: "explorer", label: "Čtyři dvojice" },
    { id: "formula", label: "Výpočet korelace" },
    { id: "practice", label: "Spočítej ji" },
    { id: "size-callout", label: "Směr, ne velikost" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { next: { href: `/learn/correlation/${correlationLessons[1].slug}`, label: correlationLessons[1].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: akcie A měla za osm měsíců výnosy +3, −2, +4, −1, +2, −3, +1 a −4 %. Akcie B udělala každý měsíc přesně polovinu pohybu A: +1,5, −1, +2, −0,5 % a tak dál. Jak silně spolu korelují jejich výnosy?",
      options: [{ id: "one", label: "+1. Pohybují se vždy stejným směrem a ve stejném poměru." }, { id: "half", label: "+0,5. B se pohne jen o polovinu." }, { id: "zero", label: "0. Pohyby nejsou stejně velké." }],
      correctOptionId: "one",
      correctExplanation: "Korelace +1 znamená dokonalý lineární vztah: když A roste, B roste vždy ve stejném poměru. Že je B poloviční, korelaci nemění. Velikost pohybů popisuje volatilita, ne korelace.",
      incorrectExplanation: "Korelace neměří velikost pohybů, ale jak spolehlivě se pohybují spolu. B je každý měsíc přesně polovina A, takže vztah je dokonalý: korelace je +1.",
    },
    { id: "meaning", type: "heading", title: "Korelace měří, jak se výnosy pohybují spolu.", body: "Když jedna investice vydělává, co dělá druhá? Roste také, klesá, nebo se chová po svém? Korelace tuhle otázku shrne do jednoho čísla, spočítaného z výnosů za stejná období." },
    { id: "range", type: "explanation", title: "Od −1 přes 0 do +1", content: "Korelace +1: výnosy se vždy pohybují stejným směrem a ve stálém poměru. −1: vždy opačným směrem. 0: mezi nimi není žádný lineární vztah. Čísla mezi tím popisují, jak často a jak těsně se pohybují spolu. Korelace se vždy počítá z výnosů, nikdy z cen." },
    { id: "explorer", type: "interactiveFigure", figure: "correlation-explorer", title: "Čtyři dvojice výnosů", description: "Přepínej dvojice a sleduj, kde leží body: každý bod je jeden měsíc, vodorovně výnos A, svisle výnos B. Ukázková data, ne skutečné akcie." },
    { id: "read-check", type: "multipleChoiceQuestion", prompt: "Korelace měsíčních výnosů dvou fondů je −0,9. Co to znamená?", options: [{ id: "loss", label: "Oba fondy budou ve ztrátě." }, { id: "opposite", label: "V minulém období se většinou pohybovaly opačně: když jeden rostl, druhý obvykle klesal." }, { id: "weak", label: "Mezi fondy skoro není vztah, protože číslo je záporné." }], correctOptionId: "opposite", correctExplanation: "Záporné znaménko znamená opačný směr a hodnota blízko −1 silný vztah. Nejde o ztrátu ani o předpověď, korelace popisuje minulé období.", incorrectExplanation: "Znaménko říká směr vztahu, absolutní hodnota jeho sílu. −0,9 je silný vztah s opačným směrem. O zisku ani ztrátě korelace nic neříká." },
    { id: "formula", type: "formula", expression: "r = cov(A, B) / (σ_A × σ_B)", latex: String.raw`r = \frac{\operatorname{cov}(r_A, r_B)}{\sigma_A \, \sigma_B}`, variables: [{ symbol: "cov", description: "kovariance: průměrný součin odchylek obou výnosů od jejich průměrů" }, { symbol: "σ_A, σ_B", description: "směrodatné odchylky výnosů A a B" }, { symbol: "r", description: "korelace, vždy mezi −1 a +1" }] },
    { id: "steps", type: "explanation", title: "Krok za krokem", content: "Od každého výnosu odečti průměr jeho řady. Pro každé období vynásob odchylku A odchylkou B a součiny sečti. Součet vyděl odmocninou ze součinu dvou součtů druhých mocnin odchylek. Dělení n − 1 v kovarianci i v obou odchylkách se vzájemně zkrátí, takže ho můžeš vynechat." },
    { id: "worked", type: "workedExample", title: "Čtyři měsíce, jedna korelace", introduction: "Výnosy A: +1, −1, +2, −2 %. Výnosy B: +2, −2, +1, −1 %. Průměr obou řad je 0, takže odchylky jsou rovnou výnosy.", steps: [{ label: "Součiny odchylek", value: "2 + 2 + 2 + 2 = 8" }, { label: "Součet druhých mocnin A", value: "1 + 1 + 4 + 4 = 10" }, { label: "Součet druhých mocnin B", value: "4 + 4 + 1 + 1 = 10" }, { label: "Korelace", value: "8 ÷ √(10 × 10) = 0,8", emphasis: true }], conclusion: "Ve všech čtyřech měsících šly A i B stejným směrem, ale ne ve stejném poměru. Proto korelace vyšla vysoká, ale ne +1." },
    { id: "practice", type: "numericQuestion", prompt: "Výnosy A jsou +3, +1, −1 a −3 %, výnosy B +1, +3, −3 a −1 %. Průměr obou řad je 0. Spočítej korelaci. Zaokrouhli na dvě desetinná místa.", answer: 0.6, tolerance: 0.01, unit: "", correctExplanation: "Součiny odchylek: 3 + 3 + 3 + 3 = 12. Součty druhých mocnin: 9 + 1 + 1 + 9 = 20 u obou řad. 12 ÷ √(20 × 20) = 12 ÷ 20 = 0,6.", incorrectExplanation: "Vynásob výnosy stejného měsíce (průměr je 0) a součiny sečti: 3·1 + 1·3 + (−1)·(−3) + (−3)·(−1). Pak vyděl odmocninou ze součinu součtů druhých mocnin obou řad." },
    { id: "size-callout", type: "conceptCallout", title: "Korelace neříká, jak velké pohyby jsou", content: "Dvojice „Spolu, ale menší“ má korelaci +1, i když B kolísá o polovinu méně než A. Korelace popisuje směr a těsnost společného pohybu. Jak velké výkyvy jsou, měří volatilita. Pro představu o riziku dvojice potřebuješ obě čísla." },
    { id: "size-check", type: "multipleChoiceQuestion", prompt: "Fondy X a Y mají korelaci výnosů 0,95. Fond X má volatilitu 30 % ročně, fond Y 10 % ročně. Co platí?", options: [{ id: "same", label: "Kolísají stejně, protože korelace je skoro 1." }, { id: "direction", label: "Většinou se pohybovaly stejným směrem, ale X kolísal zhruba třikrát víc." }, { id: "y", label: "Y bude růst rychleji, protože má nižší volatilitu." }], correctOptionId: "direction", correctExplanation: "Vysoká korelace říká, že směr pohybů se většinou shodoval. Velikost výkyvů ukazuje volatilita: 30 % proti 10 %.", incorrectExplanation: "Korelace a volatilita odpovídají na různé otázky. Korelace 0,95 je o společném směru, volatilita o velikosti výkyvů. Žádné z čísel nepředpovídá výnos." },
    { id: "lab-bridge", type: "labBridge", title: "Kde ji najdeš v Labu", content: "V Labu otevři porovnání dvou instrumentů. Korelace A ↔ B se tam počítá stejně: Pearsonova korelace denních výnosů ve dnech, kdy se obchodovaly oba.", metric: "correlation" },
    { id: "summary", type: "lessonSummary", title: "Směr a těsnost společného pohybu", content: "Korelace shrne, jak se výnosy dvou investic pohybovaly spolu: od −1 (vždy opačně) přes 0 (bez lineárního vztahu) po +1 (vždy stejně). Počítá se z výnosů za stejná období jako kovariance dělená oběma směrodatnými odchylkami. O velikosti pohybů nic neříká." },
    { id: "takeaway", type: "takeaway", title: "Poloviční pohyb, korelace +1", content: "Akcie B, která dělá vždy polovinu pohybu A, má s A korelaci +1. Korelace je o společném směru, velikost výkyvů měří volatilita." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš korelaci přečíst i spočítat. V další lekci zjistíš, proč vysoká korelace ještě neznamená, že jedna investice ovlivňuje druhou." },
  ],
};
