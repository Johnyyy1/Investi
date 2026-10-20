import type { AuthoredLesson } from "../types";
import { diversificationLessons } from "./manifest";

const lesson = diversificationLessons[4];

export const diversificationScenarioLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "diversification",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Diverzifikace",
  position: 5,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "intro", label: "Zadání scénáře" },
    { id: "rules", label: "Čtyři pravidla" },
    { id: "scenario", label: "Sestav portfolio" },
    { id: "outcome", label: "Výsledek není známka" },
    { id: "look-through-check", label: "Pohled dovnitř" },
    { id: "correlation-check", label: "Co přidat" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/diversification/${diversificationLessons[3].slug}`, label: diversificationLessons[3].title } },
  blocks: [
    { id: "intro", type: "heading", title: "100 000 Kč, šest instrumentů, čtyři pravidla.", body: "Rozdělíš scénářový kapitál mezi vymyšlené fondy a akcie. Je to oddělené cvičení: nic se nenakupuje v tvém Portfolio Labu a tvůj cvičný kapitál zůstává beze změny." },
    { id: "scenario-check", type: "multipleChoiceQuestion", prompt: "Co v tomto scénáři rozhoduje o tom, jestli je portfolio dobře rozložené?", options: [{ id: "rules", label: "Čtyři pravidla o největší firmě, sektoru, zemi a hotovosti. Výsledek scénáře ne." }, { id: "outcome", label: "Jestli portfolio ve scénáři vydělá." }, { id: "count", label: "Jestli drží všech šest instrumentů." }], correctOptionId: "rules", correctExplanation: "Rozložení je vlastnost portfolia, kterou jde ověřit předem: kolik visí na jedné firmě, sektoru a zemi. Výsledek jednoho scénáře záleží i na štěstí.", incorrectExplanation: "Zisk v jednom scénáři může přinést i soustředěná sázka, která vyšla. Hodnotí se pravidla, která se dají ověřit a vysvětlit, ne výsledek." },
    { id: "rules", type: "workedExample", title: "Pravidla scénáře", introduction: "Výukové prahy pro toto cvičení, ne investiční doporučení. Firmy, sektory a země se počítají po pohledu dovnitř fondů.", steps: [{ label: "Největší jednotlivá firma", value: "≤ 10 %" }, { label: "Největší sektor", value: "≤ 40 %" }, { label: "Největší země", value: "≤ 70 %" }, { label: "Hotovost", value: "≤ 20 %" }], conclusion: "Každé pravidlo má jasný důvod a výsledek „splněno, nebo nesplněno“. Žádné skóre ze sta bodů." },
    { id: "scenario", type: "interactiveFigure", figure: "diversification-scenario", title: "Sestav, předpověz, zamkni", description: "Rozděl 100 000 Kč po 10 %, odhadni, jestli portfolio projde pravidly, a zamkni rozhodnutí. Pak uvidíš pravidla po pohledu dovnitř a dva vymyšlené roky. Portfolio můžeš kdykoli upravit a zkusit znovu." },
    { id: "outcome", type: "explanation", title: "Proč výsledek není známka", content: "Portfolio celé ve Fondu Technologie by v technologickém boomu vydělalo 35 % a v propadu ztratilo 30 %. Výsledek záleží na tom, který rok přijde, a to předem nevíš. Pravidla ukazují, jak velkou část výsledku necháváš na jedné firmě, jednom odvětví nebo jedné zemi." },
    { id: "luck-check", type: "multipleChoiceQuestion", prompt: "Portfolio 100 % ve Fondu Technologie vydělalo ve scénáři boomu 35 %. Pravidlo o sektoru ale nesplnilo (technologie 100 %). Bylo dobře rozložené?", options: [{ id: "yes", label: "Ano, vydělalo nejvíc." }, { id: "no", label: "Ne. Vyšla mu soustředěná sázka, ale v propadu by ztratilo 30 %." }, { id: "unknown", label: "To nejde říct, dokud nevíme, který rok přijde." }], correctOptionId: "no", correctExplanation: "Rozložení se dá posoudit bez znalosti budoucnosti: 100 % v jednom sektoru je koncentrace. Zisk v boomu byl výsledek scénáře, ne důkaz rozložení.", incorrectExplanation: "Výsledek scénáře o rozložení nerozhoduje. Sektor technologie tvoří 100 % portfolia, pravidlo ≤ 40 % je nesplněné bez ohledu na to, který rok přijde." },
    { id: "look-through-check", type: "numericQuestion", prompt: "Portfolio má 60 % ve Fondu Svět (firma Čip v něm tvoří 4 %) a 40 % přímo v akcii Čip. Kolik procent portfolia tvoří firma Čip po pohledu dovnitř?", answer: 42.4, tolerance: 0.05, unit: "%", correctExplanation: "0,6 × 4 % + 40 % = 2,4 % + 40 % = 42,4 %. Pravidlo ≤ 10 % pro jednu firmu je daleko překročené.", incorrectExplanation: "Váhu fondu vynásob podílem Čipu uvnitř a přičti přímou pozici: 0,6 × 4 % + 40 %." },
    { id: "correlation-check", type: "multipleChoiceQuestion", prompt: "Portfolio je celé ve Fondu Technologie. Který doplněk za 30 % nejspíš sníží jeho kolísání nejvíc?", options: [{ id: "chip", label: "Akcie Čip. Je to úspěšná technologická firma." }, { id: "pharma", label: "Akcie Léky. Je z jiného sektoru i jiné země, takže její výnosy s fondem nejspíš korelují méně." }, { id: "same", label: "Druhý technologický fond od jiného správce." }], correctOptionId: "pharma", correctExplanation: "Kolísání portfolia snižuje hlavně investice s nízkou korelací k tomu, co už držíš. Firma z jiného odvětví a jiné země je nejlepší kandidát. Čip i druhý technologický fond se pohybují s fondem spolu.", incorrectExplanation: "Vzpomeň si na předchozí lekci: přínos rozložení stojí na korelaci. Technologická akcie i druhý technologický fond se s Fondem Technologie pohybují spolu." },
    { id: "lab-bridge", type: "labBridge", title: "Teď tvoje vlastní portfolio", content: "V Portfolio Labu přepni kartu Rozložení na Sektor a Zemi a podívej se, jak by tvoje portfolio obstálo ve stejných pravidlech. Lab ukazuje největší sektor a zemi, porovnej je s pravidly scénáře." },
    { id: "summary", type: "lessonSummary", title: "Rozložení podle pravidel", content: "Rozložení se dá posoudit předem: po pohledu dovnitř fondů zkontroluj největší firmu, sektor a zemi. Výsledek jednoho scénáře o rozložení nerozhoduje, i koncentrovaná sázka může vyjít. Kolísání nejvíc sníží investice, které s ostatními korelují málo." },
    { id: "takeaway", type: "takeaway", title: "Pravidla předem, výsledek potom", content: "Fond Technologie vydělal v boomu 35 % a v propadu ztratil 30 %. Pravidla o sektoru by to řekla dřív, než přišel kterýkoli z těch roků." },
    { id: "checkpoint", type: "checkpoint", label: "Modul dokončen", content: "Umíš posoudit koncentraci, sektory, země, ETF i korelaci a ověřit portfolio pravidly. Stejné rozložení najdeš v Portfolio Labu." },
  ],
};
