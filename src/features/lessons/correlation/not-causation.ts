import type { AuthoredLesson } from "../types";
import { correlationLessons } from "./manifest";

const lesson = correlationLessons[1];

export const notCausationLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "correlation",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Korelace",
  position: 2,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "prediction", label: "Předpověz výsledek" },
    { id: "three-reasons", label: "Tři cesty ke korelaci" },
    { id: "factor-explorer", label: "Společný pohyb trhu" },
    { id: "chance-callout", label: "Krátké období klame" },
    { id: "prices-callout", label: "Výnosy, ne ceny" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/correlation/${correlationLessons[0].slug}`, label: correlationLessons[0].title }, next: { href: `/learn/correlation/${correlationLessons[2].slug}`, label: correlationLessons[2].title } },
  blocks: [
    {
      id: "prediction", type: "multipleChoiceQuestion",
      prompt: "Pevný výukový příklad: akcie výrobce zmrzliny a akcie výrobce opalovacích krémů měly za pět let korelaci měsíčních výnosů 0,8. Co z toho plyne?",
      options: [{ id: "cause", label: "Prodej zmrzliny zvedá cenu akcií výrobce krémů." }, { id: "factor", label: "Obě firmy může táhnout stejná věc, třeba teplé léto. Korelace sama příčinu neukáže." }, { id: "impossible", label: "Je to chyba výpočtu. Firmy z různých odvětví korelovat nemohou." }],
      correctOptionId: "factor",
      correctExplanation: "Korelace říká jen to, že se výnosy pohybovaly spolu. Proč, to z čísla nevyčteš. Tady je nejpravděpodobnější společný faktor: v teplém létě se daří oběma firmám zároveň.",
      incorrectExplanation: "Z korelace nepoznáš, co co způsobuje. Obě firmy mohou reagovat na stejnou věc, třeba na počasí, a přitom se vzájemně vůbec neovlivňují.",
    },
    { id: "three-reasons", type: "explanation", title: "Přímý vliv, společný faktor, náhoda", content: "Výnosy dvou investic mohou korelovat ze tří důvodů. Přímý vliv: dodavatel prodává většinu výroby jednomu odběrateli. Společný faktor: obě firmy reagují na stejnou věc, například na celý trh, úrokové sazby nebo cenu ropy. Náhoda: v krátkém období se čísla sejdou, aniž by mezi nimi byl vztah. U akcií je nejčastější společný faktor." },
    { id: "factor-explorer", type: "interactiveFigure", figure: "common-factor-explorer", title: "Dvě firmy, jeden trh", description: "Výnos každé firmy je část společného pohybu trhu plus její vlastní pohyb. Firmy se navzájem neovlivňují. Měň podíl společného pohybu a sleduj korelaci. Ukázková data." },
    { id: "factor-check", type: "multipleChoiceQuestion", prompt: "Firmy A a B se vzájemně nijak neovlivňují, ale polovina pohybu každé z nich pochází z pohybu celého trhu. Proč spolu jejich výnosy korelují?", options: [{ id: "influence", label: "Protože A ovlivňuje B." }, { id: "market", label: "Protože obě reagují na stejný pohyb trhu. Čím větší jeho podíl, tím vyšší korelace." }, { id: "error", label: "Nekorelují. Bez přímého vztahu je korelace vždy 0." }], correctOptionId: "market", correctExplanation: "Korelaci tu vytváří jen společný faktor. Při podílu 50 % vyjde v průzkumníku 0,72, při 100 % je to +1, i když se firmy vůbec neznají.", incorrectExplanation: "Podívej se do průzkumníku: firmy se neovlivňují, a přesto korelace roste s podílem společného pohybu trhu. Korelace bez přímého vztahu vznikne, když obě firmy táhne stejná věc." },
    { id: "chance-callout", type: "conceptCallout", title: "Pět dní nestačí", content: "Z několika málo pozorování může vyjít vysoká korelace i čistou náhodou. Proto Lab korelaci nespočítá z méně než 20 společných výnosů a u kratšího období napíše, že je nedostupná. I z 20 výnosů je ale odhad hrubý." },
    { id: "chance-check", type: "multipleChoiceQuestion", prompt: "Dvě akcie měly za pět obchodních dní korelaci denních výnosů 0,95. Co o jejich vztahu víš?", options: [{ id: "strong", label: "Že se pohybují silně spolu a vydrží to." }, { id: "little", label: "Skoro nic. Pět pozorování je málo a vysoké číslo může být náhoda." }, { id: "cause", label: "Že jedna akcie řídí druhou." }], correctOptionId: "little", correctExplanation: "Z pěti výnosů je korelace velmi nespolehlivá. Lab ji pro tak krátké období vůbec nespočítá a chce aspoň 20 společných výnosů.", incorrectExplanation: "Krátké období klame: náhodné shody dají snadno vysoké číslo. Ani dlouhé období ale neříká, co co způsobuje." },
    { id: "prices-callout", type: "conceptCallout", title: "Dvě rostoucí ceny vypadají spolu vždy", content: "Když dvě akcie za deset let rostly, jejich cenové grafy jdou obě nahoru a vypadají podobně, i kdyby jejich denní pohyby spolu vůbec nesouvisely. Proto se korelace počítá z výnosů: z toho, jestli se v jednotlivých obdobích pohybovaly spolu." },
    { id: "prices-check", type: "multipleChoiceQuestion", prompt: "Dvě akcie za deset let zdvojnásobily cenu a jejich grafy vypadají skoro stejně. Kamarád říká, že jsou silně korelované. Co ověříš?", options: [{ id: "chart", label: "Nic, podobný graf cen je důkaz." }, { id: "returns", label: "Korelaci jejich výnosů za stejná období, třeba denních nebo měsíčních." }, { id: "end", label: "Jestli skončily na stejné ceně." }], correctOptionId: "returns", correctExplanation: "Korelace cen zachytí hlavně společný dlouhodobý růst. To, jestli se akcie pohybují spolu, ukáže až korelace výnosů. Lab proto koreluje denní výnosy.", incorrectExplanation: "Rostoucí ceny vypadají podobně skoro vždy. O společném pohybu rozhodují výnosy za jednotlivá období: spočítej korelaci výnosů, ne cen." },
    { id: "lab-bridge", type: "labBridge", title: "Korelace v Labu", content: "Porovnání v Labu koreluje denní výnosy a u burz, které zavírají v různý čas, na to upozorní. Vysoké číslo ber jako otázku „co je táhne spolu?“, ne jako odpověď.", metric: "correlation" },
    { id: "summary", type: "lessonSummary", title: "Spolu neznamená kvůli sobě", content: "Korelace ukáže, že se výnosy pohybovaly spolu, ale ne proč. Za vysokou korelací bývá u akcií nejčastěji společný faktor, jako je celý trh. Z krátkého období může vyjít náhodou. A počítá se z výnosů, protože podobné cenové grafy klamou." },
    { id: "takeaway", type: "takeaway", title: "Zmrzlina nezvedá krémy", content: "Firmy, které se vůbec neovlivňují, mohou mít korelaci 0,72, když polovina jejich pohybu pochází ze stejného trhu. Korelace popisuje společný pohyb, ne příčinu." },
    { id: "checkpoint", type: "checkpoint", label: "Než budeš pokračovat", content: "Víš, odkud se korelace bere a proč není příčinou. V další lekci uvidíš, jak se mění v čase a co se s ní děje v krizích." },
  ],
};
