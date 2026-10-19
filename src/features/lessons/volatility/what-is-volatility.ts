import type { AuthoredLesson } from "../types";
import { volatilityLessons } from "./manifest";

const lesson = volatilityLessons[0];

export const whatIsVolatilityLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "volatility",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Volatilita",
  position: 1,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "risk-meaning", label: "Riziko a volatilita" },
    { id: "paths-figure", label: "Dvě cesty k jednomu cíli" },
    { id: "spread-callout", label: "Kolísání oběma směry" },
    { id: "limits", label: "Co volatilita neřekne" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { next: { href: `/learn/volatility/${volatilityLessons[1].slug}`, label: volatilityLessons[1].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: Fond Klid jde po čtvrtletích 100 → 103 → 106 → 109 → 112 Kč, Fond Vlna 100 → 115 → 95 → 120 → 112 Kč. Oba za rok vydělaly 12 %. Který nesl větší riziko pro investora, který může peníze potřebovat už během roku?",
      options: [{ id: "same", label: "Stejné riziko. Oba skončily na 112 Kč." }, { id: "swing", label: "Fond Vlna. Jeho hodnota se cestou houpala, takže v nevhodnou chvíli mohla být pod 100 Kč." }, { id: "calm", label: "Fond Klid. Rostl pomaleji." }],
      correctOptionId: "swing",
      correctExplanation: "Konečný výsledek je stejný, cesta ne. Kdo by Fond Vlna prodával po druhém čtvrtletí, dostal by 95 Kč a byl by ve ztrátě. Fond Klid by ve stejné chvíli měl hodnotu 106 Kč.",
      incorrectExplanation: "Podívej se na hodnoty uprostřed roku, ne jen na konec. Fond Vlna byl po druhém čtvrtletí na 95 Kč, Fond Klid na 106 Kč. Riziko je i o tom, kde můžeš skončit, když musíš prodat dřív.",
    },
    { id: "risk-meaning", type: "heading", title: "Riziko je nejistota výsledku.", body: "Investiční riziko znamená, že výsledek může dopadnout jinak, než čekáš, a to i ztrátou ve chvíli, kdy peníze potřebuješ. Riziko má mnoho podob: kolísání ceny, krach firmy, nízkou likviditu nebo měnové pohyby." },
    { id: "risk-vs-volatility", type: "explanation", title: "Volatilita je měřitelná část rizika", content: "Volatilita popisuje, jak moc se výnosy rozptylují kolem svého průměru. Čím víc a čím prudčeji se výnosy mezi obdobími liší, tím vyšší je volatilita. Dá se spočítat z historických cen, proto ji najdeš v Labu. Celé riziko ale nepopisuje." },
    { id: "paths-figure", type: "interactiveFigure", figure: "volatility-paths", title: "Dvě cesty k jednomu cíli", description: "Přepínej mezi fondy a sleduj výnosy jednotlivých čtvrtletí. Ukázková data, ne skutečné fondy." },
    { id: "swing-return", type: "numericQuestion", prompt: "Fond Vlna koupený na začátku roku za 100 Kč se prodá hned po druhém čtvrtletí za 95 Kč. Jaký je výnos této investice?", answer: -5, tolerance: 0.05, unit: "%", correctExplanation: "95 ÷ 100 − 1 = −5 %. Fond Klid by ve stejné chvíli přinesl 106 ÷ 100 − 1 = +6 %. Za celý rok vydělaly oba 12 %, ale kdo musel prodat dřív, dopadl úplně jinak.", incorrectExplanation: "Porovnej prodejní hodnotu po druhém čtvrtletí s nákupní cenou: 95 ÷ 100 − 1. Výnos je záporný, protože prodejní hodnota je pod nákupní." },
    { id: "spread-callout", type: "conceptCallout", title: "Volatilita měří rozptyl, ne směr", content: "Do volatility se počítají prudké růsty stejně jako prudké poklesy. Investice, která jednou vyskočí o 10 % a jindy stoupne jen o 1 %, kolísá víc než investice, která se drží kolem nuly, přestože nikdy neklesla." },
    { id: "both-directions", type: "multipleChoiceQuestion", prompt: "Investice C rostla každý měsíc o 0 až 8 %. Investice D se každý měsíc pohnula jen mezi −1 % a +1 %. Která měla vyšší volatilitu?", options: [{ id: "c", label: "C. Její výnosy se rozptylovaly víc, i když byly všechny kladné." }, { id: "d", label: "D. Občas klesala, a pokles je riziko." }, { id: "none", label: "Žádná. Volatilita se počítá jen z poklesů." }], correctOptionId: "c", correctExplanation: "Rozptyl výnosů C je až 8 procentních bodů, u D jen 2. Volatilita se dívá na velikost výkyvů kolem průměru, ne na to, zda byly výnosy kladné.", incorrectExplanation: "Volatilita nerozlišuje směr. Porovnej šíři pásma: C se pohybuje v rozmezí 8 procentních bodů, D jen ve 2. Širší rozptyl znamená vyšší volatilitu." },
    { id: "limits", type: "explanation", title: "Směr, budoucnost a skrytá rizika", content: "Volatilita je spočítaná z minulých výnosů. Neříká, kterým směrem se cena pohne, a nezaručuje, že budoucí kolísání bude stejné. Nevidí ani rizika, která se v historii zatím neprojevila, třeba krach firmy nebo náhlou ztrátu likvidity." },
    { id: "meaning-check", type: "multipleChoiceQuestion", prompt: "U fondu je uvedena volatilita 15 % ročně. Co z toho plyne?", options: [{ id: "loss", label: "Fond za rok ztratí 15 %." }, { id: "spread", label: "Roční výnosy fondu se od svého průměru typicky odchylovaly zhruba o 15 procentních bodů. Směr ani budoucnost to neurčuje." }, { id: "gain", label: "Fond za rok vydělá 15 %." }], correctOptionId: "spread", correctExplanation: "Volatilita je velikost typického výkyvu kolem průměru. Nejde o předpověď zisku ani ztráty a vychází z minulých dat.", incorrectExplanation: "Volatilita nemá znaménko a neříká, kam se cena pohne. Popisuje, jak široce se výnosy rozptylovaly kolem průměru." },
    { id: "lab-bridge", type: "labBridge", title: "Kde ji najdeš v Labu", content: "Na detailu instrumentu v Labu je ukazatel Volatilita. V dalších lekcích zjistíš, jak se počítá: ze směrodatné odchylky denních výnosů, přepočtené na rok." },
    { id: "summary", type: "lessonSummary", title: "Riziko, kolísání a směr", content: "Riziko je nejistota výsledku. Volatilita je jeho měřitelná část: jak moc se výnosy rozptylují kolem průměru, v obou směrech. Dvě investice se stejným výsledkem mohou mít úplně jinou cestu, a právě cestu zažiješ, když musíš prodat dřív." },
    { id: "takeaway", type: "takeaway", title: "Stejný výsledek neznamená stejné riziko", content: "Fond Klid i Fond Vlna vydělaly 12 %. Výnosy Vlny ale skákaly od −17,39 % do +26,32 % za čtvrtletí, takže v nevhodnou chvíli mohla být pod vloženou částkou." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Víš, že volatilita měří rozptyl výnosů, ne jejich směr. V další lekci ji spočítáš jako směrodatnou odchylku." },
  ],
};
