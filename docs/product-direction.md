# Přestavět Investník z kurzu metrik na přípravu k investování

Přijato jako nový produktový směr: **21. 10. 2026**.

## Jak tento dokument používat

Tento dokument vymezuje použití dodaného podkladu pro přestavbu Investníku na přípravu k investování. Prioritou je finanční připravenost, česká praxe, náklady, daně, investiční plán (IPS) a chování. Analýza akcií, oceňování a kvantitativní metody navazují jako volitelné pokročilé dráhy. Pokyny pro práci v repozitáři tento směr promítají do [AGENTS.md](../AGENTS.md).

Jde o cílový stav a pořadí rozvoje. Popsané funkce tím nejsou označené za implementované. Aktuální chování určují kód, testy a [smlouvy učení a persistence](product-reset.md). Přesuny kurikula zachovají stabilní ID, pokrok, historické odměny a už zaznamenané odemčení Labu. Změny odměn a měsíčního vyplácení budou platit do budoucna prostřednictvím verzované politiky; samotné přijetí směru nemění současnou politiku v4.

Celý [původní podklad](education/curriculum-research.md) je už uložen v dodaném znění včetně odkazů a seznamu neověřených položek; tento dokument na něj odkazuje. Jeho daňová, regulatorní, tržní ani výzkumná tvrzení nebyla v rámci této dokumentační úpravy nezávisle ověřena. Před publikací lekcí nebo implementací výpočtů je nutné ověřit příslušné primární zdroje a zaznamenat platnost a datum kontroly. Přesné počty otázek, prahy zvládnutí, termíny opakování a herní mechaniky jsou návrhy k implementaci a vyhodnocení.

Pro implementaci platí tato upřesnění: úroveň 0 je doporučená a lze ji prokázat vstupním testem; finanční check-up není zkouška. Milník A vyžaduje také praktický závěrečný úkol a krizový nácvik B10, i když související obsah vzniká ve více fázích. „Skóre procesu“ znamená především vysvětlitelná kritéria; souhrnné číslo vyžaduje doložený model. Podklad zachycuje dřívější stav produktu; aktuální publikovaný inventář je třeba ověřit v registru. MWR−TWR může ukázat vliv načasování peněžních toků, samo o sobě ale nedokazuje chybu v chování.

## Soulad s aktuální implementací

Na `main` už existuje registr kurikula 2.0, politika odměn v4, verzované výstupy uživatelů a poplatky s měnovými náklady v Portfolio Labu. Navazující úkoly je rozšiřují podle skutečně chybějícího rozsahu. Politika v4 odvozuje odměnu od úrovně kurikula, uchovává historické účtenky a ponechává odemčení Labu na původních sedmi Foundations a 420 XP. Měsíční příjem v simulovaném čase patří do odděleného tréninkového portfolia; osobní portfolio si zachovává kapitál odvozený z účtenek.

Při tvorbě lekcí platí [standard Lesson 2.0](education/lesson-standard.md). Podrobnosti již implementovaných kontraktů popisují [verzované výstupy uživatelů](learner-artifacts.md), [Portfolio Lab](portfolio-lab.md) a [smlouvy učení a persistence](product-reset.md).
