import type { LessonBlock } from "../types";

/**
 * Reference content for every step kind, taken from the Pen boards F–M ("Časový test: 3 roky pro každou tranši").
 * It is NOT a published lesson: it feeds /dev/lesson-steps and the step-kind tests, and shows authors a complete,
 * internally consistent example of each block. Amounts are a fictional model; tax values come from the fact registry.
 */
export const timeTestSpecimens = {
  fadedExample: {
    id: "spec-faded", type: "fadedExample", title: "Jedna tranše, jeden prodej",
    steps: [
      { label: "Nákup tranše", value: "12. 3. 2022" },
      { label: "Prodej", value: "20. 5. 2025" },
      { label: "Tři roky od nákupu uplynou", value: "12. 3. 2025 → osvobození od 13. 3. 2025" },
      { label: "Uplynuly mezi nákupem a prodejem víc než 3 roky?", value: "Ano · 3 roky a 69 dní" },
    ],
    blank: { label: "Je zisk z této tranše osvobozený?", input: "choice", options: [{ id: "yes", label: "Ano" }, { id: "no", label: "Ne", misconception: "počítat roky, ne dny od nákupu", explanation: "Rozhoduje den nákupu, ne kalendářní roky 2022 a 2025. Tři roky od 12. 3. 2022 uplynuly 12. 3. 2025 a prodej 20. 5. 2025 je až potom. Test je splněný." }], correctOptionId: "yes" },
    correctExplanation: "Mezi nákupem 12. 3. 2022 a prodejem 20. 5. 2025 jsou 3 roky a 69 dní. Zisk z této tranše časový test splňuje.",
    incorrectExplanation: "Přičti k datu nákupu tři roky a porovnej výsledek s datem prodeje.",
  },
  choice: {
    id: "spec-choice", type: "multipleChoiceQuestion", prompt: "Máš ETF ze tří nákupů v letech 2021, 2023 a 2024. V roce 2025 prodáš všechno. Co platí?",
    options: [
      { id: "all", label: "Všechno je osvobozené, protože první nákup je starší než 3 roky.", misconception: "test od prvního nákupu", explanation: "Tři roky se nepočítají od prvního nákupu. Každý nákup má vlastní lhůtu, takže kusy z let 2023 a 2024 test v roce 2025 nesplní." },
      { id: "first", label: "Časový test splní jen nákup z roku 2021. U nákupů z let 2023 a 2024 tři roky neuplynuly." },
      { id: "none", label: "Nic není osvobozené, protože v jednom prodeji jsou i mladší kusy.", misconception: "prodej jako jeden celek", explanation: "Prodej se neposuzuje jako celek, ale po tranších. Kusy z roku 2021 test splnily, i když je prodáváš ve stejný den jako mladší kusy." },
    ],
    correctOptionId: "first",
    correctExplanation: "Každá tranše má vlastní tři roky. Kusy z roku 2021 je mají za sebou, kusy z let 2023 a 2024 ještě ne.",
    incorrectExplanation: "Posuď každý nákup zvlášť: od jeho data přičti tři roky a porovnej s rokem prodeje.",
  },
  documentTap: {
    id: "spec-document", type: "documentTap", prompt: "Označ nákupy, které při prodeji 15. 6. 2025 splňují časový test.",
    document: {
      eyebrow: "Výpis obchodů · fiktivní broker", title: "Broker Ukázka · účet 0042-118",
      meta: "Globální akcie ETF (fiktivní) · ISIN XX00GLOB0017 · měna EUR", period: "1. 1. 2021 – 30. 6. 2025",
      columns: [
        { id: "date", label: "Datum", mobile: "title" },
        { id: "isin", label: "ISIN" },
        { id: "type", label: "Typ", mobile: "subtitle" },
        { id: "qty", label: "Kusy", align: "end", mobile: "value" },
        { id: "price", label: "Cena", align: "end", mobile: "value", mobileLabel: "×" },
        { id: "currency", label: "Měna" },
        { id: "fee", label: "Poplatek", align: "end", mobile: "detail", mobileLabel: "popl." },
      ],
      rows: [
        { id: "b1", cells: { date: "14. 1. 2021", isin: "XX00GLOB0017", type: "Nákup", qty: "10 ks", price: "61,20", currency: "EUR", fee: "1,00" }, note: "osvobození od 15. 1. 2024" },
        { id: "b2", cells: { date: "3. 8. 2021", isin: "XX00GLOB0017", type: "Nákup", qty: "8 ks", price: "70,40", currency: "EUR", fee: "1,00" }, note: "osvobození od 4. 8. 2024" },
        { id: "b3", cells: { date: "2. 3. 2022", isin: "XX00GLOB0017", type: "Nákup", qty: "12 ks", price: "58,90", currency: "EUR", fee: "1,00" }, note: "test splněný od 3. 3. 2025" },
        { id: "b4", cells: { date: "21. 6. 2022", isin: "XX00GLOB0017", type: "Nákup", qty: "6 ks", price: "55,30", currency: "EUR", fee: "1,00" }, note: "tři roky uplynou až 21. 6. 2025" },
        { id: "b5", cells: { date: "9. 5. 2023", isin: "XX00GLOB0017", type: "Nákup", qty: "10 ks", price: "72,80", currency: "EUR", fee: "1,00" }, note: "test až od 10. 5. 2026" },
        { id: "s1", cells: { date: "15. 6. 2025", isin: "XX00GLOB0017", type: "Prodej", qty: "46 ks", price: "84,50", currency: "EUR", fee: "1,50" }, selectable: false, note: "Prodej, ne nákup" },
      ],
    },
    correctRowIds: ["b1", "b2", "b3"],
    correctExplanation: "Nákupy z 14. 1. 2021, 3. 8. 2021 a 2. 3. 2022 měly k 15. 6. 2025 za sebou víc než tři roky. Nákup z 21. 6. 2022 test nesplní o 6 dní, nákup z 9. 5. 2023 ani zdaleka.",
    incorrectExplanation: "Projdi řádky zvlášť: k datu každého nákupu přičti tři roky a porovnej s prodejem 15. 6. 2025. U každého řádku je teď důvod.",
  },
  findError: {
    id: "spec-find-error", type: "findError", title: "Prodej 20 ks 15. 6. 2025", introduction: "Tenhle výpočet má jednu chybu. Ceny jsou pro jednoduchost v Kč, bez poplatků.",
    rows: [
      { id: "r1", label: "Tranše 1 · 10 ks nakoupeno 14. 1. 2021", value: "Víc než 3 roky → osvobozeno" },
      { id: "r2", label: "Tranše 2 · 10 ks nakoupeno 9. 5. 2023", value: "Test počítán od 14. 1. 2021 → osvobozeno", correction: "9. 5. 2023 + 3 roky → osvobození až od 10. 5. 2026, test nesplněn" },
      { id: "r3", label: "Zisk tranše 2 · 10 × (2 110 − 1 820 Kč)", value: "2 900 Kč" },
      { id: "r4", label: "Zisk, který časový test nesplnil", value: "0 Kč", correction: "2 900 Kč" },
    ],
    errorRowId: "r2",
    fixes: [
      { id: "own-date", label: "Počítat test od nákupu tranše 2: 9. 5. 2023" },
      { id: "fee", label: "Od zisku odečíst ještě poplatek za nákup", explanation: "Výpočet je podle zadání bez poplatků. Chyba je v tom, od kterého data se tři roky počítají." },
      { id: "fine", label: "Řádek je v pořádku, chyba je jinde", explanation: "Řádek 2 je opravdu špatně: test se u tranše 2 počítá od jejího vlastního nákupu, ne od prvního." },
    ],
    correctFixId: "own-date",
    correctExplanation: "Tranše 2 je z 9. 5. 2023, takže při prodeji 15. 6. 2025 tři roky neuplynuly. Zisk 2 900 Kč časový test nesplnil; jestli z něj bude daň, rozhoduje ještě hodnotový test.",
    incorrectExplanation: "Podívej se, od kterého data se u každé tranše počítají tři roky.",
  },
  personaDecision: {
    id: "spec-persona", type: "personaDecision",
    persona: { name: "Petra", age: 34, need: "Potřebuje 60 000 Kč na auto. Má ETF ze dvou nákupů.", facts: [
      { label: "Nákup 1 · 14. 11. 2023", value: "40 ks × 1 180 Kč", detail: "Osvobození od 15. 11. 2026 · za 26 dní" },
      { label: "Nákup 2 · 2. 9. 2024", value: "45 ks × 1 450 Kč", detail: "Osvobození od 3. 9. 2027 · za 318 dní" },
      { label: "Cena dnes · 20. 10. 2026", value: "1 600 Kč/ks" },
      { label: "Letos už prodala za", value: "70 000 Kč", detail: "Hodnotový test (100 000 Kč za rok) letos nevyjde" },
    ] },
    note: { title: "Proč dvě data u každého nákupu", content: "Datum nákupu a datum osvobození jsou vedle sebe, aby rozhodnutí nestálo na počítání z hlavy. Počet dní je vždy k 20. 10. 2026." },
    prompt: "Petra potřebuje 60 000 Kč. Co má prodat?",
    options: [
      { id: "newer", label: "Prodat hned 38 ks z nákupu 2 (novějšího)", consequence: { lead: "Daň asi 855 Kč", content: "Novější nákup byl dražší, takže zisk i daň jsou menší. Starší nákup zůstává celý a za 26 dní splní časový test.", rows: [{ label: "Prodej 38 × 1 600 Kč", value: "60 800 Kč" }, { label: "Zisk 38 × (1 600 − 1 450 Kč)", value: "5 700 Kč" }, { label: "Daň 15 % ze zisku", value: "≈ 855 Kč" }, { label: "Zbývá z nákupu 2", value: "7 ks · test za 318 dní" }] } },
      { id: "older", label: "Prodat hned 38 ks z nákupu 1 (staršího)", consequence: { lead: "Daň asi 2 394 Kč", content: "Starší nákup ještě 26 dní test nesplňuje, takže se daní celý zisk. Je větší, protože starší kusy byly levnější.", rows: [{ label: "Prodej 38 × 1 600 Kč", value: "60 800 Kč" }, { label: "Zisk 38 × (1 600 − 1 180 Kč)", value: "15 960 Kč" }, { label: "Daň 15 % ze zisku", value: "≈ 2 394 Kč" }, { label: "Zbývá z nákupu 1", value: "2 ks · test za 26 dní" }] } },
      { id: "wait", label: "Počkat do 15. 11. 2026 a prodat 38 ks z nákupu 1", consequence: { lead: "Daň 0 Kč, ale peníze až za 26 dní", content: "Po splnění časového testu je zisk z nákupu 1 osvobozený. Cena se ale za 26 dní může změnit oběma směry a Petra musí vydržet bez peněz.", rows: [{ label: "Prodej 38 × 1 600 Kč (při stejné ceně)", value: "60 800 Kč" }, { label: "Zisk osvobozený časovým testem", value: "15 960 Kč" }, { label: "Daň", value: "0 Kč" }, { label: "Čekání", value: "26 dní" }] } },
    ],
    disclaimer: "Daň je ilustrativní: 15 % ze zisku, bez poplatků a dalších příjmů.",
  },
  labMission: {
    id: "spec-mission", type: "labMission",
    mission: { title: "Najdi svůj nejstarší nákup", goal: "V Portfolio Labu najdi svůj nejstarší cvičný nákup a zapiš si jeho datum.", minutes: 2, target: "/lab/portfolio",
      steps: ["Otevři Portfolio Lab a podívej se na poslední aktivitu.", "Najdi nákup s nejstarším datem.", "Vrať se do této karty s lekcí."],
      afterReturn: "Rozebereme tranše modelového investora vedle obecného pravidla. Lekce na tebe počká tady, postup zůstane uložený." },
    analysis: { title: "modelový investor", summary: "Jako první splní test nákup GLOB z 2. 2. 2024: osvobození od 3. 2. 2027, tedy za 106 dní.", rows: [
      { badge: "GLOB", label: "Nákup 2. 2. 2024 · 6 ks", status: "první · za 106 dní", highlight: true, progress: 0.904, start: "2. 2. 2024", end: "osvobození od 3. 2. 2027" },
      { badge: "DLUH", label: "Nákup 18. 7. 2025 · 12 ks", status: "za 638 dní", progress: 0.419, start: "18. 7. 2025", end: "osvobození od 19. 7. 2028" },
      { badge: "GLOB", label: "Nákup 1. 9. 2026 · 4 ks", status: "za 1 048 dní", progress: 0.045, start: "1. 9. 2026", end: "osvobození od 2. 9. 2029" },
    ], generalRule: "Každý nákup má vlastní tři roky. Osvobození proto přichází po tranších, od nejstarší. Kdo prodává po částech, může nejdřív prodat tranše, které test už splnily.", selfExplanationPrompt: "Proč by se ti vyplatilo počkat?" },
  },
  factNotice: { id: "spec-facts", type: "factNotice", factKeys: ["cz.tax.securities.time_test", "cz.tax.securities.value_test"] },
  writtenReflection: {
    id: "spec-reflection", type: "writtenReflection", prompt: "Napiš, kdy plánuješ prodávat a jak zohledníš časový test.",
    rubric: [
      { id: "when", text: "Uvádím, kdy zhruba plánuju prodávat." },
      { id: "lots", text: "Počítám tři roky pro každý nákup zvlášť." },
      { id: "nearest", text: "Vím, kdy moje nejbližší tranše test splní." },
      { id: "early", text: "Mám plán pro případ, že budou peníze potřeba dřív." },
    ],
    sampleAnswer: "Prodávat plánuju až za 10 let a po částech. Každý měsíční nákup má vlastní tři roky, takže prodám nejdřív nejstarší tranše, které test už splnily. Kdyby byly peníze potřeba dřív, podívám se, kterým nákupům chybí nejméně dní.",
  },
} as const satisfies Record<string, LessonBlock>;
