import type { AuthoredLesson } from "../types";
import { diversificationLessons } from "./manifest";

const lesson = diversificationLessons[2];

export const etfLookThroughLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "diversification",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Diverzifikace",
  position: 3,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "look-through", label: "Pohled dovnitř fondu" },
    { id: "explorer", label: "Fondy a akcie dohromady" },
    { id: "overlap", label: "Překryv fondů" },
    { id: "world", label: "Jeden fond, tisíce firem" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/diversification/${diversificationLessons[1].slug}`, label: diversificationLessons[1].title }, next: { href: `/learn/diversification/${diversificationLessons[3].slug}`, label: diversificationLessons[3].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: máš 50 % ve Fondu Svět, 30 % ve Fondu Technologie a 20 % přímo v akcii Čip. Fond Svět drží ve firmě Čip 4 % svých peněz, Fond Technologie 12 %. Kolik máš ve firmě Čip celkem?",
      options: [{ id: "direct", label: "20 %. Ve fondech přece nevlastním akcie přímo." }, { id: "look", label: "Asi 26 %. K přímým 20 % se přičte Čip uvnitř obou fondů." }, { id: "sum", label: "36 %. Sečtu 20 %, 4 % a 12 %." }],
      correctOptionId: "look",
      correctExplanation: "0,5 × 4 % = 2 % přes Fond Svět, 0,3 × 12 % = 3,6 % přes Fond Technologie a 20 % napřímo. Dohromady 25,6 %, víc než pravidlo 25 % pro jednu firmu.",
      incorrectExplanation: "Podíl firmy uvnitř fondu se násobí váhou fondu v portfoliu: 0,5 × 4 % + 0,3 × 12 % + 20 % = 25,6 %. Prosté sčítání by přehlédlo, že fondy tvoří jen část portfolia.",
    },
    { id: "look-through", type: "explanation", title: "Nahlédni do fondu", content: "ETF je koš mnoha akcií. Pohled dovnitř (look-through) rozloží každý fond podle jeho vlastních vah a přičte jejich části k přímým pozicím. Teprve tak uvidíš, kolik máš doopravdy v jedné firmě, sektoru nebo zemi." },
    { id: "formula", type: "formula", expression: "E = Σ w_i × v_i", latex: String.raw`E_X = \sum_i w_i \, v_{i,X}`, variables: [{ symbol: "w_i", description: "váha položky i v portfoliu" }, { symbol: "v_(i,X)", description: "podíl X uvnitř položky i; u akcie firmy X je to 100 %" }, { symbol: "E_X", description: "celková expozice portfolia vůči X" }] },
    { id: "worked", type: "workedExample", title: "Kolik je ve firmě Čip", steps: [{ label: "Fond Svět · 50 % × 4 %", value: "2 %" }, { label: "Fond Technologie · 30 % × 12 %", value: "3,6 %" }, { label: "Akcie Čip · 20 % × 100 %", value: "20 %" }, { label: "Celkem ve firmě Čip", value: "25,6 %", emphasis: true }], conclusion: "Přímá pozice vypadala pod 25 %, s pohledem do fondů je to víc. Fondy koncentraci nezakryjí, jen ji schovají." },
    { id: "explorer", type: "interactiveFigure", figure: "look-through-explorer", title: "Fondy a akcie dohromady", description: "Vyber portfolio a pohled podle firmy, sektoru nebo země. Výpočet používá stejnou funkci jako Portfolio Lab. Ukázková data, ne skutečné fondy." },
    { id: "sector-practice", type: "numericQuestion", prompt: "Stejné portfolio: 50 % Fond Svět (technologie v něm tvoří 25 %), 30 % Fond Technologie (100 % technologie) a 20 % akcie Čip (technologická firma). Kolik procent portfolia tvoří sektor Technologie?", answer: 62.5, tolerance: 0.05, unit: "%", correctExplanation: "0,5 × 25 % + 0,3 × 100 % + 0,2 × 100 % = 12,5 % + 30 % + 20 % = 62,5 %.", incorrectExplanation: "Pro každou položku vynásob její váhu podílem technologií uvnitř a výsledky sečti: 0,5 × 25 % + 0,3 × 100 % + 0,2 × 100 %." },
    { id: "overlap", type: "conceptCallout", title: "Dva fondy, stejné firmy", content: "Dva fondy od různých správců, které sledují stejný nebo podobný index, drží skoro stejné firmy ve skoro stejných vahách. Druhý fond pak rozložení nepřidá, jen zdvojí stejné expozice." },
    { id: "overlap-check", type: "multipleChoiceQuestion", prompt: "Portfolio drží půl napůl dva fondy na index S&P 500 od dvou různých správců. Jak moc je rozložené ve srovnání s jedním z nich?", options: [{ id: "double", label: "Dvakrát víc, protože má dva fondy." }, { id: "same", label: "Skoro stejně. Oba fondy drží stejné firmy ve stejných vahách." }, { id: "less", label: "Méně, protože dva fondy se navzájem ruší." }], correctOptionId: "same", correctExplanation: "Po pohledu dovnitř dávají oba fondy stejné firmy, sektory a země. Rozložení se nezmění, mění se jen počet položek.", incorrectExplanation: "Počet fondů není rozložení. Rozhoduje, co je uvnitř, a dva fondy na stejný index drží totéž." },
    { id: "world", type: "explanation", title: "Jeden fond, tisíce firem", content: "Jediný široký fond může být rozloženější než deset akcií. Fond Svět v ukázce drží asi 1 500 firem, největší z nich má 4 %, technologie 25 % a USA 62 %. Počet položek v portfoliu o rozložení nerozhoduje, rozhoduje to, co je uvnitř." },
    { id: "world-check", type: "multipleChoiceQuestion", prompt: "Které portfolio má po pohledu dovnitř menší podíl jedné firmy?", options: [{ id: "world", label: "100 % ve Fondu Svět: největší firma má 4 %." }, { id: "ten", label: "Deset akcií, z nichž největší má 15 %." }, { id: "tech", label: "100 % ve Fondu Technologie: největší firma má 12 %." }], correctOptionId: "world", correctExplanation: "Široký fond rozloží peníze do tisícovek firem, takže největší z nich má jen 4 %. Deset akcií ani úzký technologický fond na to nestačí.", incorrectExplanation: "Porovnej největší firmu po pohledu dovnitř: 4 % ve Fondu Svět, 12 % ve Fondu Technologie a 15 % v portfoliu deseti akcií." },
    { id: "lab-bridge", type: "labBridge", title: "Pohled dovnitř v Portfolio Labu", content: "Karta Rozložení v Portfolio Labu rozkládá ETF stejně: podle sektorů a zemí, které fond uvádí. Co zdroj dat nerozepíše, najdeš v kategorii Neznámé, nikdy se to neztratí." },
    { id: "summary", type: "lessonSummary", title: "Co je uvnitř, to platí", content: "Pohled dovnitř rozloží každý fond podle jeho vah a sečte části s přímými pozicemi: expozice = Σ váha položky × podíl uvnitř. Fondy tak mohou koncentraci schovat, nebo ji naopak opravdu rozložit. Dva fondy na stejný index rozložení nepřidají." },
    { id: "takeaway", type: "takeaway", title: "20 % napřímo, 25,6 % doopravdy", content: "Akcie Čip vypadala jako 20 % portfolia. Po přičtení Čipu uvnitř dvou fondů je to 25,6 %." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Umíš nahlédnout do ETF a sečíst skutečnou expozici. V další lekci spojíš rozložení s korelací a spočítáš volatilitu portfolia." },
  ],
};
