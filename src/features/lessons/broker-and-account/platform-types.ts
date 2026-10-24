import type { AuthoredLesson } from "../types";
import { brokerAndAccountLessons } from "./manifest";
const lesson = brokerAndAccountLessons.find((entry) => entry.id === "broker-platform-types")!;

/** Editorial draft: the EU passport step is regulatory content and needs expert approval before publication (#133). */
export const platformTypesLesson: AuthoredLesson = {
  id: lesson.id, moduleSlug: "broker-and-account", slug: lesson.slug, title: lesson.title,
  eyebrow: "Broker a investiční účet", position: 1, estimatedMinutes: lesson.estimatedMinutes,
  factContext: { kind: "regulatory" },
  sections: [{ id: "opening", label: "Ondřejovy nabídky" }, { id: "types", label: "Typy služeb" }, { id: "passport", label: "Broker z jiného státu EU" }, { id: "costs", label: "Náklady a výběr" }, { id: "summary", label: "Co si odneseš" }],
  blocks: [
    { id: "opening", type: "paragraph", content: "Modelový příklad · Ondřej chce každý měsíc investovat 3 000 Kč do celosvětových akcií. V reklamách vidí investiční aplikaci, podílové fondy své banky a „chytré portfolio“, které prý udělá všechno za něj. Všechny nabídky v této lekci jsou smyšlené; nejde o skutečné firmy ani doporučení." },
    { id: "prediction", type: "multipleChoiceQuestion", prompt: "Podle čeho se Ondřejovy nabídky liší nejvíc?", options: [
      { id: "design", label: "Podle toho, jak moderně aplikace vypadá.", misconception: "Aplikace = služba", explanation: "Stejně vypadající aplikace mohou nabízet úplně jinou službu. Vzhled nic neříká o tom, kdo rozhoduje ani kolik zaplatíš." },
      { id: "service", label: "Kdo rozhoduje o nákupech, co vlastníš a kolik za službu celkem zaplatíš." },
      { id: "advert", label: "Podle toho, kdo má větší reklamu.", explanation: "Reklama ukazuje, kdo za marketing utrácí, ne jakou službu dostaneš." },
    ], correctOptionId: "service", correctExplanation: "Přesně tyhle tři otázky odliší typy služeb. Lekce je projde jednu po druhé.", incorrectExplanation: "Vzhled ani reklama službu nepopisují. Ptej se, kdo rozhoduje o nákupech, co vlastníš a co celkem platíš." },

    { id: "types", type: "workedExample", title: "Čtyři typy služeb", introduction: "Třídíme službu, ne značku. Jedna banka může nabízet fondy i makléřský účet; rozhoduje, jakou smlouvu podepíšeš.", steps: [
      { label: "Broker, který jen provádí pokyny (execution-only)", value: "Rozhoduješ ty · akcie a ETF na tvém účtu · poplatek za obchod, směna měny, případně úschova" },
      { label: "Robo-poradce nebo správa portfolia", value: "Rozhoduje algoritmus či správce podle dotazníku · podíly ETF nebo fondů ve spravovaném portfoliu · roční poplatek v % z majetku a náklady fondů" },
      { label: "Banka nebo fondová platforma", value: "Rozhoduješ ty výběrem fondu · podílové listy fondů · vstupní poplatek a průběžné náklady fondu" },
      { label: "Penzijní společnost", value: "Rozhoduješ ty výběrem fondu či strategie · podíl v účastnickém fondu · poplatky podle smlouvy a statutu fondu" },
    ], conclusion: "Dlouhodobý investiční produkt (DIP) není samostatný typ poskytovatele. Je to režim smlouvy, který může nabízet broker, banka, správce i penzijní společnost; jeho podmínky má samostatná lekce." },

    { id: "intermediary", type: "conceptCallout", title: "Kdo je tvoje smluvní strana", content: "Obchodník s cennými papíry (investment firm) má od regulátora povolení provádět pokyny a obvykle vede majetek klientů. Investiční zprostředkovatel smí pokyny jen přijímat a předávat dál a majetek klientů nevede. Aplikace s vlastním logem proto může být jen prodejním kanálem jiné firmy. Ve smlouvě hledej, kdo je tvoje smluvní strana a kdo vede tvůj majetek." },
    { id: "app-check", type: "multipleChoiceQuestion", prompt: "Modelový příklad · Aplikace Nabídky X má vlastní logo. Ve smlouvě je ale uvedeno, že pokyny předává obchodníkovi Firma Y, která vede tvé cenné papíry. Koho budeš prověřovat jako obchodníka s cennými papíry?", options: [
      { id: "app", label: "Aplikaci X, protože ji vidím každý den.", misconception: "Aplikace = broker", explanation: "Aplikace je tady jen prodejní kanál. Majetek vede a pokyny provádí Firma Y." },
      { id: "firm", label: "Firmu Y, která podle smlouvy provádí pokyny a vede můj majetek." },
      { id: "nobody", label: "Nikoho, aplikace z obchodu s aplikacemi je už prověřená.", explanation: "Obchod s aplikacemi nekontroluje investiční oprávnění." },
    ], correctOptionId: "firm", correctExplanation: "Rozhodující je firma, která pokyny provádí a vede tvůj majetek. Jak ji ověřit v registru, ukáže lekce 2.1.2.", incorrectExplanation: "Logo aplikace neurčuje, kdo ti drží majetek. Najdi ve smlouvě obchodníka, který pokyny provádí." },

    { id: "sorting", type: "categorizeQuestion", prompt: "Modelový příklad · Zařaď osm smyšlených nabídek k typu služby. Rozhoduje, kdo vybírá investice a co kupuješ, ne název.", categories: [
      { id: "broker", label: "Broker (execution-only)" },
      { id: "managed", label: "Robo-poradce nebo správa portfolia" },
      { id: "funds", label: "Banka nebo fondová platforma" },
      { id: "pension", label: "Penzijní společnost" },
    ], items: [
      { id: "offer-a", label: "Nabídka A · v aplikaci vybíráš a kupuješ ETF; 0 Kč za pokyn, přirážka 0,5 % při směně měny", categoryId: "broker" },
      { id: "offer-b", label: "Nabídka B · vyplníš dotazník, portfolio z ETF ti sestaví a vyvažuje algoritmus; 0,9 % ročně z majetku", categoryId: "managed" },
      { id: "offer-c", label: "Nabídka C · na pobočce si vybereš podílový fond banky; vstupní poplatek 2 % z každého vkladu", categoryId: "funds" },
      { id: "offer-d", label: "Nabídka D · doplňkové penzijní spoření; vybereš si jeden z účastnických fondů", categoryId: "pension" },
      { id: "offer-e", label: "Nabídka E · správce podle smlouvy sám nakupuje a prodává za tebe; roční poplatek z majetku", categoryId: "managed" },
      { id: "offer-f", label: "Nabídka F · zadáváš vlastní pokyny k nákupu akcií a ETF; 30 Kč za pokyn", categoryId: "broker" },
      { id: "offer-g", label: "Nabídka G · na jednom účtu pravidelně kupuješ podílové listy fondů různých správců", categoryId: "funds" },
      { id: "offer-h", label: "Nabídka H · spoření na stáří se státním příspěvkem; volíš strategii, investice řídí fond", categoryId: "pension" },
    ], correctExplanation: "Správně. A a F jsou brokeři, B a E spravují portfolio za tebe, C a G prodávají podílové fondy a D a H jsou penzijní spoření.", incorrectExplanation: "U každé nabídky se zeptej, kdo vybírá konkrétní investice a co přesně kupuješ: akcie a ETF, podíly ve spravovaném portfoliu, podílové listy fondů, nebo podíl v účastnickém fondu." },

    { id: "decides", type: "multipleChoiceQuestion", prompt: "U které služby o konkrétních nákupech nerozhoduješ ty?", options: [
      { id: "broker", label: "U brokera, který jen provádí pokyny.", explanation: "Broker provede tvůj pokyn. Co, kdy a za kolik koupit, určuješ ty." },
      { id: "managed", label: "U robo-poradce nebo správy portfolia." },
      { id: "platform", label: "U fondové platformy.", explanation: "Na platformě si fond vybíráš ty. O nákupech uvnitř fondu rozhoduje jeho správce, ale o tvém nákupu fondu ty." },
    ], correctOptionId: "managed", correctExplanation: "Při správě portfolia nastavíš cíl a rizikový profil a konkrétní nákupy dělá algoritmus nebo správce. Za tuhle práci platíš roční poplatek.", incorrectExplanation: "U brokera i fondové platformy zadáváš nákupy ty. Rozhodování předáváš až při správě portfolia." },

    { id: "passport", type: "explanation", title: "Evropský pas: zahraniční neznamená neregulovaný", content: "Obchodník s povolením v jiném státě EU může na základě notifikace nabízet své služby i v ČR (evropský pas). Hlavní dohled nad ním má regulátor jeho domovského státu. ČNB ho eviduje jako zahraniční osobu ve svých seznamech: {{cnb.jerrs}}. Ochranu majetku a případný kompenzační systém určuje právo domovského státu; český režim na něj automaticky nepřenášej. Jak záznam v seznamech ČNB najít a přečíst, procvičíš v lekci 2.1.2." },
    { id: "passport-facts", type: "factNotice", factKeys: ["cnb.jerrs"] },
    { id: "passport-check", type: "multipleChoiceQuestion", prompt: "Modelový příklad · Nabídka F patří obchodníkovi z jiného státu EU. Modelový záznam uvádí notifikaci pro ČR. Co z toho plyne?", options: [
      { id: "unregulated", label: "Je neregulovaná, protože nemá české povolení.", misconception: "Zahraniční = bez dohledu", explanation: "Notifikace znamená, že ji dohlíží regulátor domovského státu a v ČR smí působit." },
      { id: "home", label: "Smí v ČR působit; dohled i ochranu majetku primárně určuje domovský stát, a to si ověřím." },
      { id: "czech", label: "Platí pro ni stejná česká ochrana majetku jako pro českého obchodníka.", explanation: "Ochranu majetku určuje domovský stát. Český režim nepředpokládej automaticky." },
    ], correctOptionId: "home", correctExplanation: "Notifikace je důležitá informace, ne konec prověrky. Dál ověř, kdo je smluvní strana a jak je chráněn tvůj majetek.", incorrectExplanation: "Zahraniční obchodník z EU není automaticky bez dohledu, ale ani nepodléhá stejné ochraně jako český. Rozhoduje domovský stát." },

    { id: "costs", type: "explanation", title: "Každý typ účtuje jinak", content: "Broker účtuje hlavně za jednotlivé obchody, směnu měny a někdy za úschovu. Robo-poradce a správa portfolia berou roční poplatek v procentech z majetku a k němu platíš náklady fondů uvnitř portfolia. Banka a fondová platforma účtují vstupní poplatek z vkladu a fond má průběžné náklady. U penzijního spoření určuje poplatky smlouva a statut fondu. Porovnávej vždy celkové roční náklady pro svůj plán; jak je spočítat, ukáže modul 2.2." },
    { id: "cost-myths", type: "conceptCallout", title: "Dvě časté chybné úvahy", content: "„Robo-poradce je zdarma“: i bez poplatku za obchod platíš roční poplatek z majetku a náklady fondů. „Banka je bezpečnější, takže i levnější“: známá značka neříká nic o výši vstupního poplatku ani průběžných nákladů. Bezpečnost majetku a cena služby jsou dvě oddělené otázky." },

    { id: "persona", type: "multipleChoiceQuestion", prompt: "Modelový příklad · Jana nechce vybírat fondy ani hlídat vyvažování portfolia a je ochotná za to platit. Který typ služby odpovídá jejímu přání?", options: [
      { id: "broker", label: "Broker, který jen provádí pokyny.", explanation: "U brokera by Jana musela sama vybírat i vyvažovat." },
      { id: "managed", label: "Robo-poradce nebo správa portfolia." },
      { id: "bank", label: "Bankovní fond, protože banka je bezpečnější.", misconception: "Banka = bezpečnější a levnější", explanation: "Fond si Jana vybírá sama a značka banky neříká nic o nákladech." },
    ], correctOptionId: "managed", correctExplanation: "Správa portfolia odpovídá Janinu přání. Než ji zvolí, má porovnat celkové roční náklady: poplatek za správu i náklady fondů uvnitř.", incorrectExplanation: "Jana chce předat výběr i vyvažování. To dělá jen služba, která portfolio spravuje za ni." },

    { id: "plan-compare", type: "workedExample", title: "Modelový příklad · 3 000 Kč měsíčně", introduction: "Obě nabídky kupují stejné ETF obchodované v eurech. Nabídka A: 0 Kč za pokyn, přirážka 0,5 % při směně měny. Nabídka F: 30 Kč za pokyn, směna bez přirážky (modelový předpoklad). Úschovu, náklady fondu a daně neuvažujeme.", steps: [
      { label: "Nabídka A: 3 000 × 0,5 %", value: "15 Kč za nákup" },
      { label: "Nabídka F: pevný poplatek", value: "30 Kč za nákup" },
      { label: "Levnější pro Ondřejův plán", value: "Nabídka A", emphasis: true },
    ], conclusion: "U malé pravidelné částky vychází v tomto modelu levněji procentní přirážka. Změní se výsledek, když se změní plán?" },
    { id: "one-off", type: "numericQuestion", prompt: "Modelový příklad · Ondřejova sestra chce jednorázově investovat 300 000 Kč do stejného ETF přes Nabídku A. Kolik zaplatí na přirážce ke směně měny?", answer: 1500, tolerance: 0, unit: "Kč", correctExplanation: "300 000 × 0,5 % = 1 500 Kč. Přes Nabídku F by zaplatila 30 Kč. Pro jednorázový velký nákup vychází v tomto modelu levněji pevný poplatek.", incorrectExplanation: "Přirážka je procento z celé směňované částky: 300 000 × 0,005. Pevný poplatek Nabídky F se s částkou nemění." },

    { id: "criteria", type: "workedExample", title: "Co prověřit u každé nabídky", steps: [
      { label: "Povolení a dohled", value: "Kdo je smluvní strana a který regulátor na ni dohlíží (2.1.2)" },
      { label: "Ochrana majetku", value: "Kdo vede tvůj majetek a jaký kompenzační systém platí" },
      { label: "Celkové náklady", value: "Roční náklady pro tvůj plán, ne jeden poplatek z reklamy (2.2)" },
      { label: "Nabídka instrumentů", value: "Evropská ETF a fondy, které chceš držet (2.3)" },
      { label: "Pravidelné investování", value: "Spořicí plány a nákup zlomků kusů" },
      { label: "Podklady a podpora", value: "Roční výpis pro daně, jazyk podpory, možnost DIP" },
    ], conclusion: "Kritéria nemají univerzální váhy. Co je pro tebe důležité, záleží na částce, pravidelnosti a na tom, kolik rozhodování si chceš nechat." },
    { id: "no-best", type: "takeaway", title: "Žádná nejlepší platforma neexistuje", content: "Pro pravidelnou malou částku mohou rozhodovat jiné poplatky než pro jednorázový velký nákup. Kdo nechce o nákupech rozhodovat, platí za správu. Vyber typ služby podle svého plánu a teprve potom porovnej konkrétní nabídky." },

    { id: "recall", type: "multipleChoiceQuestion", prompt: "Bez nápovědy: jaký je hlavní rozdíl mezi brokerem, který jen provádí pokyny, a správou portfolia?", options: [
      { id: "decision", label: "U brokera rozhoduji o nákupech já; u správy portfolia je za roční poplatek dělá algoritmus nebo správce." },
      { id: "safety", label: "Správa portfolia je vždy bezpečnější, protože ji dělá profesionál.", explanation: "Správce nebo algoritmus neodstraní tržní riziko. Mění se, kdo rozhoduje, ne zda může hodnota klesnout." },
      { id: "price", label: "Broker je vždy dražší, protože účtuje poplatek za každý obchod.", explanation: "Záleží na plánu. V modelovém příkladu vyšel jednou levněji broker s procentní přirážkou, jindy s pevným poplatkem." },
    ], correctOptionId: "decision", correctExplanation: "Klíčový rozdíl je v tom, kdo rozhoduje. Z něj plyne i způsob účtování: za obchody, nebo procentem z majetku.", incorrectExplanation: "Ani bezpečnost, ani cena nejsou pevně dané typem služby. Rozdíl je v tom, kdo dělá investiční rozhodnutí." },

    { id: "reflection", type: "writtenReflection", prompt: "Proč neexistuje jedna nejlepší platforma pro všechny? Napiš 2–4 věty a uveď, který typ služby by odpovídal tvému plánu a co je u něj potřeba ověřit jako první. Neuváděj osobní údaje.", rubric: [{ id: "decides", text: "Rozlišuji typy podle toho, kdo rozhoduje o nákupech." }, { id: "plan", text: "Vztahuji náklady k částce a pravidelnosti svého plánu." }, { id: "verify", text: "Zmiňuji ověření smluvní strany, dohledu nebo ochrany majetku." }], sampleAnswer: "Každý typ účtuje jinak, takže u malé pravidelné částky může být levnější jiná služba než u velkého jednorázového nákupu. Chci o nákupech rozhodovat a investovat měsíčně, proto by mi odpovídal broker. Nejdřív ověřím, kdo je smluvní strana a kdo na ni dohlíží." },

    { id: "sources", type: "paragraph", content: "Primární zdroje · ČNB, Seznamy a evidence: https://www.cnb.cz/cs/dohled-financni-trh/seznamy/ · Zákon č. 256/2004 Sb., o podnikání na kapitálovém trhu: https://www.e-sbirka.cz/sb/2004/256 · FINRA, Working With an Investment Professional: https://www.finra.org/investors/investing/working-with-investment-professional · Nabídky A–H, X a Y jsou smyšlené; nejde o výstup registru ani srovnání skutečných poskytovatelů." },
    { id: "summary", type: "lessonSummary", title: "Nejdřív typ služby, potom nabídka", content: "Typy platforem odlišíš podle toho, kdo rozhoduje o nákupech, co vlastníš a jak se platí. Aplikace může být jen prodejním kanálem jiné firmy, proto hledej smluvní stranu. Zahraniční obchodník z EU smí v ČR působit na základě notifikace, ale dohled a ochranu majetku určuje domovský stát. Nejlepší platforma pro všechny neexistuje: vyber typ podle svého plánu a porovnej celkové roční náklady. Lekce nedoporučuje konkrétního poskytovatele." },
  ],
};
