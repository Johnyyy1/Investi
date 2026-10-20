import type { AuthoredLesson } from "../types";
import { diversificationLessons } from "./manifest";

const lesson = diversificationLessons[3];

export const correlationAndRiskLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "diversification",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Diverzifikace",
  position: 4,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "cancel", label: "Výkyvy se vyruší" },
    { id: "formula", label: "Volatilita portfolia" },
    { id: "explorer", label: "Měň korelaci" },
    { id: "practice", label: "Spočítej ji" },
    { id: "crisis", label: "Když korelace roste" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/diversification/${diversificationLessons[2].slug}`, label: diversificationLessons[2].title }, next: { href: `/learn/diversification/${diversificationLessons[4].slug}`, label: diversificationLessons[4].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: dvě investice mají každá volatilitu 20 % ročně. Rozdělíš peníze napůl a korelace jejich výnosů je 0. Jakou volatilitu bude mít portfolio?",
      options: [{ id: "twenty", label: "20 %. Průměr dvou dvacítek je dvacet." }, { id: "lower", label: "Asi 14 %. Výkyvy obou investic se částečně vyruší." }, { id: "zero", label: "0 %. Nekorelované investice se vyruší úplně." }],
      correctOptionId: "lower",
      correctExplanation: "Při nulové korelaci se výkyvy jen částečně vyruší: √(0,25 × 400 + 0,25 × 400) = √200 ≈ 14,14 %. Nula by vyšla jen při korelaci −1.",
      incorrectExplanation: "Volatilita portfolia není prostý průměr. Když se investice nepohybují spolu, jejich výkyvy se částečně vyruší: √(0,25 × 400 + 0,25 × 400) ≈ 14,14 %. Úplně se vyruší jen při korelaci −1.",
    },
    { id: "cancel", type: "explanation", title: "Proč rozložení snižuje kolísání", content: "Výnos portfolia je vážený průměr výnosů jeho částí. Kdyby se části pohybovaly vždy spolu (korelace +1), byla by volatilita portfolia vážený průměr jejich volatilit. Čím nižší korelace, tím častěji jedna část roste, když druhá klesá, a výkyvy se navzájem tlumí." },
    { id: "formula", type: "formula", expression: "σp² = w²σA² + (1 − w)²σB² + 2w(1 − w)ρσAσB", latex: String.raw`\begin{aligned} & \sigma_p^2 = w^2\sigma_A^2 \\ & \quad + (1-w)^2\sigma_B^2 \\ & \quad + 2w(1-w) \\ & \qquad \cdot \rho\,\sigma_A\sigma_B \end{aligned}`, variables: [{ symbol: "w", description: "váha investice A; zbytek 1 − w je v B" }, { symbol: "σ_A, σ_B", description: "volatility obou investic" }, { symbol: "ρ", description: "korelace jejich výnosů" }, { symbol: "σ_p", description: "volatilita portfolia: odmocnina z rozptylu σ_p²" }] },
    { id: "worked", type: "workedExample", title: "Dvě dvacítky, korelace 0", steps: [{ label: "w²σA²", value: "0,25 × 400 = 100" }, { label: "(1 − w)²σB²", value: "0,25 × 400 = 100" }, { label: "2w(1 − w)ρσAσB", value: "2 × 0,25 × 0 × 400 = 0" }, { label: "σp", value: "√200 ≈ 14,14 %", emphasis: true }], conclusion: "Volatility dosazuj v procentech, pak vyjde rozptyl v „procentech na druhou“ a jeho odmocnina zase v procentech." },
    { id: "explorer", type: "interactiveFigure", figure: "portfolio-correlation-explorer", title: "Dvě investice, jedna volatilita", description: "Investice A má volatilitu 20 %, B 10 %. Měň korelaci a váhu A a sleduj volatilitu portfolia vedle váženého průměru. Ukázková čísla." },
    { id: "practice", type: "numericQuestion", prompt: "A má volatilitu 20 %, B 10 %. Portfolio je půl napůl a korelace je 0,5. Jakou volatilitu má portfolio? Zaokrouhli na dvě desetinná místa.", answer: 13.23, tolerance: 0.05, unit: "%", correctExplanation: "0,25 × 400 + 0,25 × 100 + 2 × 0,25 × 0,5 × 20 × 10 = 100 + 25 + 50 = 175. √175 ≈ 13,23 %. Vážený průměr by byl 15 %.", incorrectExplanation: "Dosaď do vzorce: 0,25 × 20² + 0,25 × 10² + 2 × 0,5 × 0,5 × 0,5 × 20 × 10. Součet 175 odmocni. 15 % by vyšlo jen při korelaci +1." },
    { id: "one-check", type: "multipleChoiceQuestion", prompt: "Stejné investice A (20 %) a B (10 %), půl napůl, ale korelace je +1. Jaká je volatilita portfolia?", options: [{ id: "avg", label: "15 %, vážený průměr. Při korelaci +1 se nic nevyruší." }, { id: "lower", label: "Méně než 15 %, rozložení snižuje kolísání vždy." }, { id: "sum", label: "30 %, volatility se sčítají." }], correctOptionId: "avg", correctExplanation: "Při korelaci +1 se části pohybují vždy spolu a vzorec se zjednoduší na vážený průměr: 0,5 × 20 % + 0,5 × 10 % = 15 %.", incorrectExplanation: "Výkyvy se tlumí jen tehdy, když se části nepohybují dokonale spolu. Při korelaci +1 vyjde vážený průměr 15 %." },
    { id: "crisis", type: "explanation", title: "Výhoda, která v krizi slábne", content: "Vzorec platí pro korelaci, kterou do něj dosadíš. Z modulu Korelace víš, že v prudkých propadech trhu korelace obvykle roste. S ní roste i volatilita portfolia a výhoda rozložení se zmenšuje právě tehdy, kdy je nejvíc potřeba." },
    { id: "pair-check", type: "multipleChoiceQuestion", prompt: "Máš fond s volatilitou 18 % a chceš k němu přidat druhou investici se stejnou volatilitou 18 %, půl napůl. Která volba sníží volatilitu portfolia nejvíc?", options: [{ id: "high", label: "Investice s korelací 0,9 k fondu." }, { id: "mid", label: "Investice s korelací 0,5 k fondu." }, { id: "low", label: "Investice s korelací 0,1 k fondu." }], correctOptionId: "low", correctExplanation: "Při stejných volatilitách a vahách rozhoduje korelace: čím nižší, tím víc se výkyvy vyruší. Korelace 0,1 dává asi 13,4 %, 0,9 asi 17,5 %.", incorrectExplanation: "Ve vzorci se mění jen člen s korelací. Nejnižší korelace dá nejnižší volatilitu portfolia." },
    { id: "lab-bridge", type: "labBridge", title: "Korelace dvojice v Labu", content: "Než do portfolia přidáš další investici, porovnej ji v Labu s tím, co už držíš. Korelace A ↔ B napoví, jestli se výkyvy budou tlumit, nebo sčítat.", metric: "correlation" },
    { id: "summary", type: "lessonSummary", title: "Korelace rozhoduje o přínosu", content: "Volatilita portfolia ze dvou investic závisí na jejich volatilitách, vahách a korelaci. Při korelaci +1 je rovna váženému průměru, čím nižší korelace, tím je menší. Přínos rozložení proto stojí na korelaci, a ta v krizích obvykle roste." },
    { id: "takeaway", type: "takeaway", title: "15 % proti 13,23 %", content: "Investice s volatilitou 20 % a 10 % půl napůl: při korelaci +1 kolísá portfolio o 15 %, při korelaci 0,5 o 13,23 %, při korelaci 0 o 11,18 %." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Víš, jak korelace snižuje kolísání portfolia. V poslední lekci modulu sestavíš celé portfolio ve scénáři a ověříš ho pravidly." },
  ],
};
