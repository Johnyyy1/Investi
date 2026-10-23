# 0.1.6 — Podvody, slibované výnosy a finfluenceři

Issue: [#153](https://github.com/Johnyyy1/Investnik/issues/153). Autorství a kontrola zdrojů: 23. 10. 2026. **Nepublikovaný regulatorní návrh; odborná revize podle #133 zatím neproběhla.** Tento dokument není záznamem odborného schválení.

| Oblast | Rozhodnutí |
| --- | --- |
| Identita | `before-investing-scams`, úložný modul `module-before-investing`, slug `scams-and-finfluencers` |
| Umístění | L0 / 0.1.6, doporučená, bez předpokladů, dovednost `scam-prevention` |
| Výsledek | Rozpoznat nejméně pět varovných znaků, prověřit entitu a rozsah oprávnění, rozlišit notifikaci od pouhého zápisu firmy a identifikovat střet zájmů |
| Scénář | Pavel, vymyšlené částky v Kč, Firma A/B/C bez značek, log a skutečných identifikátorů; nejde o živý výpis ani prověrku firmy |
| Ověření | Čtyři řádky zprávy, tři nabídky, finfluencer, první reakce po platbě, retrieval a vlastní vysvětlení se třemi znaky a pojistkou |
| Přenos | Vlastní kontrolní postup před nevyžádanou nabídkou; obchod v Labu se nevyžaduje |
| Fakta | `cnb.jerrs@2026-10-21`, aktuální vydání registru; datum v hlavičce se odvozuje z ověření faktu, nikoli data tohoto PR |
| Vlastník | Redakce — daně a regulace; expert dle redakčního workflow |
| Kompatibilita | Nové ID a plánovaná položka; žádný publikovaný kurzor, odměna, přístup ani osobní portfolio se nemění |

## Obsah a použití existujícího enginu

Patnáct kroků používá stávající `personaDecision`, `documentTap`, `multipleChoiceQuestion`, `workedExample`, `factNotice` a `writtenReflection`. Není potřeba nový `offer-checker` ani rozšíření enginu. Ověřené oprávnění v nabídce A znamená pouze splnění tohoto kroku kontroly, nikoli doporučení produktu nebo záruku výnosu. B se označuje jako podezření na podvod, nikoli konečný právní verdikt odvozený jen z nedohledatelnosti. C vyžaduje další kontrolu oprávnění a režimu ochrany majetku. Partnerská odměna je střet zájmů, sama o sobě nedokazuje podvod.

Všechny otázky mají serverově ověřitelnou odpověď. Přechodový test používá stejné `validateStepMove` jako publikované lekce, kontroluje chybnou i správnou odpověď, nejvýše jednu otázku na krok a nehodnocený závěr. Regulatorní publikační kontrola výslovně odmítá pokus o zveřejnění bez odborného schválení.

Vývojový náhled `/dev/scams-and-finfluencers` používá sdílený redakční přehrávač (původně pro rezervu), bez síťových mutací, pokroku, ukládání textu, dokončení nebo odměn. V produkci vrací not-found. Veřejná URL `/learn/before-investing/scams-and-finfluencers` zůstává nedostupná. Připravená položka ani umístění nezvyšují počet publikovaných lekcí (30), jejich XP součet ani podmínky odemčení Labu. Po budoucí publikaci bude L0 podle aktuální politiky v4 pouze za XP.

## Primární zdroje a skutečný rozsah ověření

| Zdroj | Co bylo 23. 10. 2026 ověřeno |
| --- | --- |
| [ČNB — Seznamy a evidence](https://www.cnb.cz/cs/dohled-financni-trh/seznamy/) | Oficiální vstup do JERRS; záznamy zahrnují licence, povolení, registrace a notifikace, které je třeba rozlišovat. |
| [JERRS — úvod](https://jerrs.cnb.cz/apljerrsdad/JERRS.WEB07.INTRO_PAGE?p_lang=cz) | Živé menu obsahuje „Přímé vyhledání“ a „Základní seznamy“. Úvod uvádí detail subjektu po kliknutí na název a omezení aktuálnosti kontaktů. |
| [ČNB — stanovisko RS2025-29](https://www.cnb.cz/cs/dohled-financni-trh/legislativni-zakladna/stanoviska-k-regulaci-financniho-trhu/RS2025-29) | Povolení domovského státu a přeshraniční působení nejsou zaměnitelné s pouhým přesunem sídla. Text lekce neuděluje obecné oprávnění všem zahraničním firmám. |
| [ČNB — upozornění](https://www.cnb.cz/cs/dohled-financni-trh/vykon-dohledu/upozorneni-pro-verejnost/) | Samostatný oficiální rozcestník varování; lekce nevykládá nepřítomnost varování jako schválení. |
| [ESMA — finfluenceři](https://www.esma.europa.eu/sites/default/files/2026-01/Finfluencers_factsheet_EN.pdf) | Transparentnost odměn a vlastní expozice, oddělení faktů od názorů, rizika a nepodložené sliby. Žádné nové právní sazby ani sankce. |
| [Policie ČR — Podvod s investicemi](https://policie.gov.cz/clanek/podvod-s-investicemi.aspx) | Vzdálený přístup, zneužité celebrity, nespolehlivé recenze a rychlý kontakt s bankou. |
| [ESMA / EBA / EIOPA — online podvody](https://www.esma.europa.eu/sites/default/files/2025-12/AI_and_online_financial_fraud_and_scams_factsheet.pdf) | Zastavení kontaktu a plateb, banka oficiální cestou, hesla, oznámení policii/regulátorovi a druhotný podvod s vymáháním. |
| [FCA — recovery room scams](https://www.fca.org.uk/consumers/recovery-room-scams) | Definice klonů a dalšího poplatku za údajnou záchranu. Použit obecný mechanismus podvodu, nikoli britské kompenzační či oznamovací postupy. |

## Zbývající publikační brány

1. JERRS po kliknutí na „Přímé vyhledání“ zobrazil CAPTCHA. Kontrola nepokračovala za tuto hranici. [Screenshot skutečného stavu](scams-evidence/jerrs-captcha-2026-10-23.png) dokládá dostupnost aplikace a překážku, **nikoli ověření vyhledávacího formuláře, IČO nebo detailu**. Člověk před publikací ověří přesný postup vyhledání, rozsah činností a kontakty v dnešním rozhraní a doplní screenshot bez osobních údajů. Verzi faktu tento částečný průchod nepřepisuje.
2. Odborník dle [redakčního workflow](../editorial-workflow.md) zreviduje regulatorní formulace, včetně evropského pasu, ochrany majetku a postupu po kompromitaci zařízení. Záznam role, data a aktuálních verzí faktů patří do `content-reviews.ts` a `reviews.md`; žádné schválení není předstíráno.
3. Až poté publikovat manifest, přidat obsah do `authoredLessons`, publikovaný kompatibilitní kontrakt a aktualizovat inventáře browser testů; ověřit reálnou délku 12 minut s cílovým začátečníkem a uložený průchod/dokončení/odměnu. Žádné přejmenování stabilní identity.

Automatický Chromium průchod kontroluje celou redakční lekci, chybu → zpětnou vazbu → opravu, klávesnici a viditelný fokus, 320/390/1440 px, 200% základní text, restart, nedostupnost veřejné URL a nulové POST požadavky. Nenahrazuje odbornou revizi, fyzické mobilní zařízení ani odečítač obrazovky.

## Snímky redakčního průchodu

Sdílené typy kroků z katalogu; přidaná hlavička označuje nepovolený redakční návrh. Snímky jsou po odpovědi, kde je krok hodnocený.

| Krok | 390 px | 1440 px |
| --- | --- | --- |
| 1 | [Náhled](scams-evidence/step-1-390.png) | [Náhled](scams-evidence/step-1-1440.png) |
| 2 | [Náhled](scams-evidence/step-2-390.png) | [Náhled](scams-evidence/step-2-1440.png) |
| 3 | [Náhled](scams-evidence/step-3-390.png) | [Náhled](scams-evidence/step-3-1440.png) |
| 4 | [Náhled](scams-evidence/step-4-390.png) | [Náhled](scams-evidence/step-4-1440.png) |
| 5 | [Náhled](scams-evidence/step-5-390.png) | [Náhled](scams-evidence/step-5-1440.png) |
| 6 | [Náhled](scams-evidence/step-6-390.png) | [Náhled](scams-evidence/step-6-1440.png) |
| 7 | [Náhled](scams-evidence/step-7-390.png) | [Náhled](scams-evidence/step-7-1440.png) |
| 8 | [Náhled](scams-evidence/step-8-390.png) | [Náhled](scams-evidence/step-8-1440.png) |
| 9 | [Náhled](scams-evidence/step-9-390.png) | [Náhled](scams-evidence/step-9-1440.png) |
| 10 | [Náhled](scams-evidence/step-10-390.png) | [Náhled](scams-evidence/step-10-1440.png) |
| 11 | [Náhled](scams-evidence/step-11-390.png) | [Náhled](scams-evidence/step-11-1440.png) |
| 12 | [Náhled](scams-evidence/step-12-390.png) | [Náhled](scams-evidence/step-12-1440.png) |
| 13 | [Náhled](scams-evidence/step-13-390.png) | [Náhled](scams-evidence/step-13-1440.png) |
| 14 | [Náhled](scams-evidence/step-14-390.png) | [Náhled](scams-evidence/step-14-1440.png) |
| 15 | [Náhled](scams-evidence/step-15-390.png) | [Náhled](scams-evidence/step-15-1440.png) |

[Závěr při 320 px a 200% základním textu](scams-evidence/summary-320-text-200.png).
