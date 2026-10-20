import type { AuthoredLesson } from "../types";
import { volatilityLessons } from "./manifest";

const lesson = volatilityLessons[3];

export const maxDrawdownLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "volatility",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Volatilita",
  position: 4,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "drawdown-definition", label: "Propad od vrcholu" },
    { id: "drawdown-explorer", label: "Projdi cestu" },
    { id: "recovery", label: "Cesta zpět" },
    { id: "order-matters", label: "Na pořadí záleží" },
    { id: "real-history", label: "Reálná historie" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/volatility/${volatilityLessons[2].slug}`, label: volatilityLessons[2].title }, next: { href: `/learn/volatility/${volatilityLessons[4].slug}`, label: volatilityLessons[4].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: hodnota investice jde 100 → 120 → 90 → 110 → 80 → 130 Kč. Jaký byl největší propad?",
      options: [{ id: "start", label: "−20 %, ze 100 na 80 Kč." }, { id: "peak", label: "−33,3 %, ze 120 na 80 Kč." }, { id: "first", label: "−25 %, ze 120 na 90 Kč." }],
      correctOptionId: "peak",
      correctExplanation: "Propad se měří od nejvyššího předchozího vrcholu, ne od začátku. Vrchol 120 Kč platil až do konce poklesu na 80 Kč: 80 ÷ 120 − 1 ≈ −33,3 %. Pokles na 90 Kč byl jen jeho první část.",
      incorrectExplanation: "Najdi nejvyšší hodnotu před nejnižším bodem. Do poklesu na 80 Kč to bylo 120 Kč, protože 110 Kč starý vrchol nepřekonalo. 80 ÷ 120 − 1 ≈ −33,3 %.",
    },
    { id: "drawdown-definition", type: "explanation", title: "Měř od dosavadního vrcholu", content: "Propad (drawdown) v každém okamžiku porovná aktuální hodnotu s nejvyšší hodnotou, které investice do té chvíle dosáhla. Na novém vrcholu je propad 0 %. Největší propad (max. drawdown) je nejhlubší z nich: nejhorší ztráta, kterou by zažil investor, který koupil na vrcholu a prodal na dně." },
    { id: "drawdown-formula", type: "formula", expression: "DD_t = P_t / max(P_0 … P_t) − 1", latex: String.raw`DD_t = \frac{P_t}{\max\left(P_0, \ldots, P_t\right)} - 1`, variables: [{ symbol: "P_t", description: "hodnota v čase t" }, { symbol: "max", description: "nejvyšší hodnota od začátku do času t, tedy dosavadní vrchol" }, { symbol: "DD_t", description: "propad v čase t; největší propad je jeho nejnižší hodnota" }] },
    { id: "running-peak", type: "workedExample", title: "Krok za krokem s dosavadním vrcholem", steps: [{ label: "100 Kč · vrchol 100", value: "0 %" }, { label: "120 Kč · nový vrchol 120", value: "0 %" }, { label: "90 Kč · vrchol 120", value: "−25 %" }, { label: "110 Kč · vrchol 120", value: "−8,33 %" }, { label: "80 Kč · vrchol 120", value: "−33,33 %", emphasis: true }, { label: "130 Kč · nový vrchol 130", value: "0 %" }], conclusion: "Vrchol se posune jen tehdy, když ho hodnota překoná. Největší propad je −33,33 %. Investice se z něj zotavila v posledním kroku, kdy překonala 120 Kč." },
    { id: "drawdown-explorer", type: "interactiveFigure", figure: "max-drawdown-explorer", title: "Projdi rok měsíc po měsíci", description: "Posouvej se v ukázkové řadě a sleduj dosavadní vrchol a propad. Potom odhal největší propad. Ukázková data, ne skutečný trh." },
    { id: "depth-practice", type: "numericQuestion", prompt: "Fond vystoupal na vrchol 250 Kč a pak klesl na 175 Kč. Jaký byl jeho propad od vrcholu?", answer: -30, tolerance: 0.05, unit: "%", correctExplanation: "175 ÷ 250 − 1 = −0,30, tedy −30 %.", incorrectExplanation: "Vyděl nejnižší hodnotu vrcholem a odečti 1: 175 ÷ 250 − 1. Výsledek je záporný, protože jde o pokles." },
    { id: "recovery", type: "explanation", title: "Cesta zpět je delší než cesta dolů", content: "Po propadu se růst počítá z nižší hodnoty. Ze 175 Kč zpět na 250 Kč je to 75 Kč, ale vůči 175 Kč jde o víc než 30 %. Potřebný zisk je 1 ÷ (1 + propad) − 1. Čím hlubší propad, tím rychleji potřebný zisk roste." },
    { id: "recovery-explorer", type: "interactiveFigure", figure: "recovery-explorer", title: "Kolik stojí návrat na vrchol", description: "Zadej velikost propadu a zjisti, jaký zisk je potřeba k návratu na předchozí vrchol." },
    { id: "recovery-practice", type: "numericQuestion", prompt: "Po propadu o 30 % má fond hodnotu 175 Kč. Jaký zisk potřebuje, aby se vrátil na vrchol 250 Kč? Zaokrouhli na dvě desetinná místa.", answer: 42.86, tolerance: 0.05, unit: "%", correctExplanation: "250 ÷ 175 − 1 ≈ 0,4286, tedy +42,86 %. Stejně vyjde 1 ÷ (1 − 0,30) − 1.", incorrectExplanation: "Zisk se počítá z nižší hodnoty 175 Kč: 250 ÷ 175 − 1. Odpověď 30 % by platila jen tehdy, kdyby se počítalo z vrcholu." },
    { id: "order-matters", type: "explanation", title: "Volatilita a propad měří různé věci", content: "Volatilita se dívá na velikost výnosů, ale ne na jejich pořadí. Propad na pořadí závisí: několik poklesů za sebou vytvoří hlubší propad než stejné poklesy proložené růsty. Proto Lab ukazuje obě čísla vedle sebe." },
    { id: "order-check", type: "multipleChoiceQuestion", prompt: "Řada 1 má výnosy +10 %, −10 %, +10 %, −10 %. Řada 2 má stejné výnosy v pořadí +10 %, +10 %, −10 %, −10 %. Obě začínají na 100 Kč. Co mají stejné?", options: [{ id: "all", label: "Volatilitu, konečnou hodnotu i největší propad." }, { id: "vol-end", label: "Volatilitu a konečnou hodnotu 98,01 Kč, ale ne největší propad." }, { id: "nothing", label: "Nic. Pořadí změní všechno." }], correctOptionId: "vol-end", correctExplanation: "Stejné výnosy dávají stejnou směrodatnou odchylku i stejný součin růstových faktorů, tedy 98,01 Kč. Řada 1 ale klesne nejvýš o 10,9 % (ze 110 na 98,01 Kč), řada 2 o 19 % (ze 121 na 98,01 Kč).", incorrectExplanation: "Směrodatná odchylka i konečná hodnota nezávisí na pořadí výnosů. Propad ano: řada 2 nejdřív vystoupá na 121 Kč a pak dvakrát po sobě klesne, takže propadne o 19 %, kdežto řada 1 jen o 10,9 %." },
    { id: "real-history", type: "heading", title: "Teď na skutečné historii.", body: "Stejná dvojice instrumentů za rok 2022. Odhadni, který propadl hlouběji, a pak propad spočítej z vrcholu a dna." },
    { id: "real-history-figure", type: "interactiveFigure", figure: "historical-drawdown", title: "Největší propad z historických cen", description: "Předpověz, odhal vrchol a dno a spočítej největší propad. Výsledek spočítá stejná funkce jako Lab." },
    { id: "lab-bridge", type: "labBridge", title: "Největší propad v Labu", content: "Na detailu instrumentu se největší propad počítá z denních zavíracích cen zvoleného období a ukazuje i datum vrcholu, dna a případného návratu. Backtest měří propad z hodnot na konci měsíce, takže propad uvnitř měsíce může vypadat mělčí.", metric: "max-drawdown" },
    { id: "summary", type: "lessonSummary", title: "Hloubka a návrat", content: "Propad porovnává hodnotu s dosavadním vrcholem. Největší propad je nejhlubší z nich. K návratu je potřeba zisk 1 ÷ (1 + propad) − 1, který roste rychleji než samotný propad. Na rozdíl od volatility záleží na pořadí výnosů." },
    { id: "takeaway", type: "takeaway", title: "Propad o 30 % chce zisk 42,86 %", content: "Ze 100 % na 70 % je to ztráta 30 %, ale zpět ze 70 % na 100 % je potřeba zisk 42,86 %. Proto investor sleduje i největší propad, nejen volatilitu." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš najít největší propad, spočítat zisk potřebný k návratu a vysvětlit, proč se liší od volatility. Zbývá kontrolní lekce celého modulu." },
  ],
};
