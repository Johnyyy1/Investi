import type { AuthoredLesson } from "../types";
import { returnsLessons } from "./manifest";

const lesson = returnsLessons[5];

export const returnsCheckpointLesson: AuthoredLesson = {
  id: lesson.id,
  moduleSlug: "returns",
  slug: lesson.slug,
  title: lesson.title,
  eyebrow: "Výnosy a složené zhodnocení",
  position: 6,
  estimatedMinutes: lesson.estimatedMinutes,
  sections: [
    { id: "intro", label: "Dvě akcie, jedna otázka" },
    { id: "scenario", label: "Výnos každého roku" },
    { id: "cumulative-check", label: "Celé období" },
    { id: "recovery-check", label: "Cesta zpět na vrchol" },
    { id: "total-check", label: "Cenový a celkový výnos" },
    { id: "log-check", label: "Logaritmické výnosy" },
    { id: "summary", label: "Shrň si to" },
  ],
  navigation: { previous: { href: `/learn/returns/${returnsLessons[4].slug}`, label: returnsLessons[4].title } },
  blocks: [
    { id: "intro", type: "heading", title: "Jeden fond, pět otázek.", body: "Kontrola projde celý modul: výnos, výnosy po obdobích, skládání, návrat po ztrátě, cenový a celkový výnos a logaritmické výnosy. U každé úlohy můžeš odpověď opravit, dokud nesedí." },
    { id: "opening-check", type: "multipleChoiceQuestion", prompt: "Akcie X stoupla ze 400 Kč na 440 Kč, akcie Y ze 150 Kč na 180 Kč. Která měla vyšší výnos?", options: [{ id: "x", label: "X. Vydělala 40 Kč, Y jen 30 Kč." }, { id: "y", label: "Y. Vydělala 20 % své ceny, X jen 10 %." }, { id: "same", label: "Stejný, obě akcie rostly." }], correctOptionId: "y", correctExplanation: "Výnos dává změnu do poměru k počáteční ceně: 440 ÷ 400 − 1 = 10 %, 180 ÷ 150 − 1 = 20 %. Rozdíl v korunách investice neporovná.", incorrectExplanation: "Porovnávej procentní změnu, ne korunovou: 40 Kč ze 400 Kč je 10 %, 30 Kč ze 150 Kč je 20 %." },
    { id: "scenario", type: "workedExample", title: "Ukázkový fond za tři roky", introduction: "Vymyšlený fond, ne skutečný produkt. Cena na konci každého roku:", steps: [{ label: "Začátek", value: "200 Kč" }, { label: "Konec 1. roku", value: "250 Kč" }, { label: "Konec 2. roku", value: "200 Kč" }, { label: "Konec 3. roku", value: "240 Kč" }], conclusion: "Ve třetím roce fond navíc vyplatil 6 Kč na podíl. Úlohy pracují s těmito čísly." },
    { id: "period-check", type: "multiNumericQuestion", prompt: "Spočítej jednoduchý výnos každého roku z cen ukázkového fondu.", answers: [{ id: "first", label: "1. rok", answer: 25, tolerance: 0.05, unit: "%" }, { id: "second", label: "2. rok", answer: -20, tolerance: 0.05, unit: "%" }, { id: "third", label: "3. rok", answer: 20, tolerance: 0.05, unit: "%" }], correctExplanation: "250 ÷ 200 − 1 = 25 %, 200 ÷ 250 − 1 = −20 %, 240 ÷ 200 − 1 = 20 %. Každý rok se dělí cenou na jeho začátku.", incorrectExplanation: "Každý výnos počítej z ceny na začátku daného roku: 250 ÷ 200 − 1, 200 ÷ 250 − 1 a 240 ÷ 200 − 1. Pokles z 250 na 200 Kč je −20 %, ne −25 %." },
    { id: "cumulative-check", type: "numericQuestion", prompt: "Jaký je kumulativní cenový výnos fondu za celé tři roky?", answer: 20, tolerance: 0.05, unit: "%", correctExplanation: "Růstové faktory se násobí: 1,25 × 0,80 × 1,20 = 1,20, tedy +20 %. Stejně vyjde 240 ÷ 200 − 1.", incorrectExplanation: "Výnosy po obdobích se nesčítají. Vynásob růstové faktory 1,25 × 0,80 × 1,20 a odečti 1, nebo porovnej konečnou a počáteční cenu. Součet 25 % je chybný." },
    { id: "recovery-check", type: "numericQuestion", prompt: "Ve druhém roce fond klesl z 250 na 200 Kč. Jaký zisk by potřeboval, aby se vrátil na 250 Kč?", answer: 25, tolerance: 0.05, unit: "%", correctExplanation: "250 ÷ 200 − 1 = 25 %. Pokles o 20 % chce k návratu zisk 25 %, protože se počítá z nižší hodnoty. Třetí rok s +20 % na to nestačil.", incorrectExplanation: "Zisk k návratu se počítá z nižší ceny: 250 ÷ 200 − 1. Odpověď 20 % přehlíží, že se základ po poklesu zmenšil." },
    { id: "total-check", type: "numericQuestion", prompt: "Kdo fond držel celé tři roky, dostal kromě změny ceny i výplatu 6 Kč na podíl. Jaký byl jeho celkový výnos, když výplatu připočteš bez reinvestice?", answer: 23, tolerance: 0.05, unit: "%", correctExplanation: "(240 − 200 + 6) ÷ 200 = 46 ÷ 200 = 23 %. Cenový výnos je 20 %, výplata přidává 3 procentní body.", incorrectExplanation: "Celkový výnos přičte vyplacenou hotovost ke změně ceny: (240 − 200 + 6) ÷ 200. Výsledek 20 % je jen cenový výnos." },
    { id: "log-check", type: "multipleChoiceQuestion", prompt: "Součet logaritmických výnosů fondu za tři roky je ln(1,25) + ln(0,80) + ln(1,20) ≈ 18,23 %. Co z toho plyne?", options: [{ id: "gain", label: "Fond vydělal 18,23 %." }, { id: "convert", label: "Součet odpovídá ln(240 ÷ 200). Po převodu exp(0,1823) − 1 vyjde jednoduchý výnos 20 %." }, { id: "sum", label: "Správně bylo sečíst jednoduché výnosy: 25 %." }], correctOptionId: "convert", correctExplanation: "Logaritmické výnosy se v čase sčítají a jejich součet je logaritmus celého růstu. Zpět na jednoduchý výnos ho převedeš funkcí exp: 1,20 − 1 = 20 %.", incorrectExplanation: "Součet logaritmických výnosů není přímo zisk v procentech a jednoduché výnosy se nesčítají. Převeď součet zpět: exp(0,1823) − 1 ≈ 0,20." },
    { id: "lab-bridge", type: "labBridge", title: "Výnosy v Labu", content: "Na detailu instrumentu v Labu je jednoduchý cenový výnos za zvolené období, bez dividend. Teď víš, jak vzniká, a co by k němu přidala vyplacená hotovost.", metric: "simple-return" },
    { id: "summary", type: "lessonSummary", title: "Pět nástrojů pro výnos", content: "Výnos dává změnu do poměru k počáteční hodnotě. Výnosy po obdobích se skládají násobením růstových faktorů, ne sčítáním. Po ztrátě je k návratu potřeba větší zisk. Celkový výnos přidá k cenovému vyplacenou hotovost. Logaritmické výnosy se sčítají a exp je převede zpět." },
    { id: "takeaway", type: "takeaway", title: "+25 %, −20 %, +20 % není +25 %", content: "Ukázkový fond měl výnosy +25 %, −20 % a +20 %. Jejich součet je 25 %, ale fond vydělal 20 % na ceně a 23 % i s výplatou." },
    { id: "checkpoint", type: "checkpoint", label: "Modul dokončen", content: "Umíš spočítat, složit a porovnat výnosy. Další modul měří, jak moc výnosy kolísají." },
  ],
};
