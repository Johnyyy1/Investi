export type MetricSignal = "neutral" | "positive" | "caution" | "unavailable" | "not-meaningful";

export type EquityMetricId =
  | "market-cap" | "pe" | "ps" | "pb" | "ev-ebitda" | "p-fcf"
  | "gross-margin" | "operating-margin" | "net-margin" | "roe" | "roic"
  | "debt-equity" | "current-ratio" | "net-debt-ebitda"
  | "revenue" | "net-income" | "fcf" | "eps";

/** `context` explains why the value earned its signal, so the learner sees the reasoning, not just a color. */
export type MetricPresentation = { signal: MetricSignal; context?: string };

/** Broad teaching references for individual metrics, never an investment rating. */
export function equityMetricSignal(id: EquityMetricId, value: number | null, status?: "not-meaningful", netCashConfirmed = false): MetricPresentation {
  if (status === "not-meaningful") return { signal: "not-meaningful" };
  if (value === null || !Number.isFinite(value)) return { signal: "unavailable" };

  switch (id) {
    case "market-cap":
      return { signal: "neutral", context: "Velikost firmy sama o sobě není dobrá ani špatná. Velké firmy bývají stabilnější, menší mají víc prostoru k růstu i k pádu." };
    case "pe":
      if (value <= 0) return { signal: "caution", context: "Záporný poměr znamená, že firma za posledních 12 měsíců nevydělala; cenu pak drží jen očekávání budoucího zisku." };
      return valuationSignal(value, 15, 30, {
        cheap: "Za každou 1 jednotku ročního zisku zaplatíš nejvýš 15 jednotek ceny. Nízké ocenění dává rezervu, ale může znamenat i to, že trh čeká pokles zisku.",
        fair: "Mezi orientačními hranicemi 15× a 30×: trh čeká mírný růst zisku a ocenění není výrazně levné ani drahé.",
        rich: "Za každou 1 jednotku ročního zisku platí investoři víc než 30 jednotek ceny. Takové ocenění počítá s rychlým růstem zisku; když nepřijde, cena může výrazně klesnout.",
      });
    case "ps":
      if (value <= 0) return { signal: "caution", context: "Nulové nebo záporné tržby jsou neobvyklé; zkontroluj zdroj a kontext výkazu." };
      return valuationSignal(value, 2, 10, {
        cheap: "Trh oceňuje firmu nejvýš na dvojnásobek ročních tržeb. To je nízko, pokud firma z tržeb dokáže vytvořit zisk.",
        fair: "Mezi orientačními hranicemi 2× a 10×. Vysoké marže unesou vyšší P/S, nízké marže ne.",
        rich: "Trh oceňuje firmu na víc než desetinásobek ročních tržeb. Aby to dávalo smysl, musí firma dlouho rychle růst a mít vysoké marže.",
      });
    case "pb":
      if (value < 0) return { signal: "caution", context: "Záporná účetní hodnota znamená, že závazky převyšují aktiva. U firem se zpětnými odkupy akcií to nemusí znamenat potíže, ale poměr pak nejde běžně číst." };
      return valuationSignal(value, 1.5, 10, {
        cheap: "Akcie se obchoduje blízko účetní hodnotě majetku firmy, takže za ni neplatíš velkou prémii navíc.",
        fair: "Mezi orientačními hranicemi 1,5× a 10×. U firem s málo fyzickým majetkem (software, značky) je vyšší P/B běžné.",
        rich: "Cena je víc než desetinásobkem účetní hodnoty. Trh platí hlavně za budoucí zisky, ne za majetek; malý vlastní kapitál po zpětných odkupech akcií poměr dál zvyšuje.",
      });
    case "ev-ebitda":
      if (value <= 0) return { signal: "caution", context: "Záporný poměr obvykle znamená zápornou EBITDA, tedy provozní ztrátu před odpisy." };
      return valuationSignal(value, 10, 20, {
        cheap: "Hodnota celé firmy včetně dluhu odpovídá nejvýš desetinásobku provozního zisku. To je nízké ocenění, které zohledňuje i zadlužení.",
        fair: "Mezi orientačními hranicemi 10× a 20×: běžné ocenění provozního zisku včetně dluhu.",
        rich: "Hodnota firmy je víc než dvacetinásobkem provozního zisku. Trh počítá s výrazným růstem, takže je méně prostoru pro zklamání.",
      });
    case "p-fcf":
      if (value <= 0) return { signal: "caution", context: "Záporný poměr znamená, že firma spotřebovala víc hotovosti, než vytvořila; růst nebo provoz tak musí financovat jinak." };
      return valuationSignal(value, 15, 30, {
        cheap: "Za každou 1 jednotku volné hotovosti zaplatíš nejvýš 15 jednotek ceny. Hotovost je těžší účetně přikrášlit než zisk.",
        fair: "Mezi orientačními hranicemi 15× a 30×: ocenění volné hotovosti není výrazně levné ani drahé.",
        rich: "Za každou 1 jednotku volné hotovosti platí investoři víc než 30 jednotek ceny. Ocenění počítá s tím, že hotovost bude rychle růst.",
      });
    case "gross-margin":
      if (value < 0) return { signal: "caution", context: "Záporná hrubá marže znamená, že přímé náklady převýšily tržby: firma prodělává na každém prodeji." };
      return value >= 0.4
        ? { signal: "positive", context: "Nad orientační hranicí 40 %. Vysoká hrubá marže ukazuje cenovou sílu: firma prodává výrazně dráž, než ji stojí výroba." }
        : { signal: "neutral", context: "Pod orientační hranicí 40 %. Nižší hrubá marže je běžná u obchodu nebo výroby; méně peněz pak zbývá na vývoj a marketing." };
    case "operating-margin":
      return marginSignal(value, 0.15, {
        loss: "Záporná provozní marže znamená, že samotné podnikání je ve ztrátě.",
        good: "Nad orientační hranicí 15 %. Firma si z tržeb nechá velkou část jako provozní zisk, a má tak rezervu, když náklady porostou.",
        modest: "Pod orientační hranicí 15 %. Z tržeb zbývá menší provozní zisk, takže firmu výkyv tržeb nebo nákladů zasáhne víc.",
      });
    case "net-margin":
      return marginSignal(value, 0.10, {
        loss: "Záporná čistá marže znamená, že po všech nákladech, úrocích a daních je firma ve ztrátě.",
        good: "Nad orientační hranicí 10 %. Po všech nákladech, úrocích a daních zbývá z tržeb solidní zisk.",
        modest: "Pod orientační hranicí 10 %. Po všech nákladech zbývá z tržeb jen menší zisk.",
      });
    case "roe":
      return marginSignal(value, 0.15, {
        loss: "Záporné ROE znamená, že firma v posledních 12 měsících na kapitálu akcionářů prodělala.",
        good: value > 0.5
          ? "Nad orientační hranicí 15 %. Takhle vysoké ROE ale často vzniká hlavně malým vlastním kapitálem (dluh, zpětné odkupy akcií), proto ho porovnej s ROIC a zadlužením."
          : "Nad orientační hranicí 15 %. Firma na penězích akcionářů vydělává víc, než je u běžných firem obvyklé.",
        modest: "Pod orientační hranicí 15 %. Firma na penězích akcionářů vydělává jen málo.",
      });
    case "roic":
      return marginSignal(value, 0.10, {
        loss: "Záporné ROIC znamená, že investovaný kapitál v posledních 12 měsících nevydělal.",
        good: "Nad orientační hranicí 10 %. Firma vydělává víc, než ji kapitál obvykle stojí, takže další investice do podnikání mohou tvořit hodnotu.",
        modest: "Pod orientační hranicí 10 %. Výnos z investovaného kapitálu nemusí pokrýt jeho cenu.",
      });
    case "debt-equity":
      if (value < 0) return { signal: "neutral", context: "Záporný vlastní kapitál akcionářů ztěžuje samostatnou interpretaci tohoto poměru." };
      if (value <= 0.5) return { signal: "positive", context: "V orientačním rozmezí nízkého zadlužení 0–0,5×. Firma stojí hlavně na vlastních penězích, takže ji růst úrokových sazeb ani horší rok tolik neohrozí." };
      return value > 2
        ? { signal: "caution", context: "Nad orientační hranicí 2×. Firma má víc než dvakrát víc dluhu než vlastního kapitálu; v horším roce mohou splátky a úroky začít tlačit." }
        : { signal: "neutral", context: "Mezi orientačními hranicemi 0,5× a 2×: střední zadlužení, které je u stabilních firem běžné." };
    case "current-ratio":
      if (value < 1) return { signal: "caution", context: "Pod 1×: krátkodobé závazky převyšují oběžná aktiva, takže firma může potřebovat novou hotovost, aby zaplatila účty splatné do roka." };
      if (value >= 1.5 && value <= 3) return { signal: "positive", context: "V orientačním rozmezí likvidity 1,5–3×. Firma má dost krátkodobých aktiv na pokrytí účtů splatných do roka." };
      return value > 3
        ? { signal: "neutral", context: "Nad 3×. Vyšší likvidita není automaticky lepší: velká hotovost ležící bez užitku nic nevydělává; záleží na kontextu odvětví." }
        : { signal: "neutral", context: "Mezi 1× a 1,5×: krátkodobé účty jsou pokryté, ale rezerva je menší. Velké firmy se silným peněžním tokem s tím běžně fungují." };
    case "net-debt-ebitda":
      if (value < 0) return netCashConfirmed
        ? { signal: "positive", context: "Zdrojová data potvrzují čistou hotovost vůči kladné EBITDA: firma má víc hotovosti než dluhu." }
        : { signal: "neutral", context: "Záporný poměr může znamenat čistou hotovost nebo zápornou EBITDA; zkontroluj podkladové hodnoty." };
      if (value <= 2) return { signal: "positive", context: "V orientačním rozmezí 0–2×. Firma by čistý dluh splatila z provozního zisku zhruba do dvou let." };
      return value > 4
        ? { signal: "caution", context: "Nad orientační hranicí 4×. Splacení čistého dluhu by trvalo přes čtyři roky provozního zisku; pokles zisku může dluh rychle zhoršit." }
        : { signal: "neutral", context: "Mezi orientačními hranicemi 2× a 4×: dluh je zvládnutelný, ale už vyžaduje stabilní provozní zisk." };
    case "revenue":
      return value < 0 ? { signal: "caution", context: "Záporné vykázané tržby jsou neobvyklé; zkontroluj zdroj a kontext výkazu." } : { signal: "neutral" };
    case "net-income":
    case "fcf":
    case "eps":
      return value < 0 ? { signal: "caution", context: "Záporná vykázaná hodnota znamená v tomto fiskálním roce ztrátu nebo odtok hotovosti." } : { signal: "neutral" };
    default:
      return { signal: "neutral" };
  }
}

/** Lower multiples mean the learner pays less per unit of the underlying figure. */
function valuationSignal(value: number, cheapAt: number, richAbove: number, context: { cheap: string; fair: string; rich: string }): MetricPresentation {
  if (value <= cheapAt) return { signal: "positive", context: context.cheap };
  return value > richAbove ? { signal: "caution", context: context.rich } : { signal: "neutral", context: context.fair };
}

function marginSignal(value: number, positiveAt: number, context: { loss: string; good: string; modest: string }): MetricPresentation {
  if (value < 0) return { signal: "caution", context: context.loss };
  return value >= positiveAt ? { signal: "positive", context: context.good } : { signal: "neutral", context: context.modest };
}
