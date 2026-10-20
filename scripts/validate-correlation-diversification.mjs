// Local production acceptance for #23: the Returns checkpoint and the Correlation and Diversification modules.
// Disposable learner, real lesson actions, v3 reward receipts, the separate scenario and Lab links.
// Run against a deterministic-data server: MARKET_DATA_PROVIDER=deterministic FX_DATA_PROVIDER=deterministic.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.CORRELATION_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app/database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague", extraHTTPHeaders: { "x-forwarded-for": "127.0.0.67" } });
const page = await context.newPage();
const screenshotDir = process.env.CORRELATION_SCREENSHOT_DIR ?? "/tmp/investi-correlation-qa";
await mkdir(screenshotDir, { recursive: true });
const email = `correlation-${randomUUID()}@example.com`;
let userId;
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
const button = (name) => page.getByRole("button", { name, exact: true });
const text = (value) => page.getByText(value, { exact: true }).first().waitFor();
const next = async (name) => { await button("Pokračovat").click(); await heading(name); };
const awards = (prefix) => sql`select lesson_id, xp, practice_capital_minor, reward_policy_version from lesson_award where user_id = ${userId} and lesson_id like ${`${prefix}%`} order by lesson_id`;
async function choose(index, correct = true) {
  await page.getByRole("radio").nth(index).check();
  await button("Zkontrolovat odpověď").click();
  await heading(correct ? "Správně" : "Zkus to ještě jednou");
}
async function fill(value, correct = true) {
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill(value);
  await button("Zkontrolovat odpověď").click();
  await heading(correct ? "Správně" : "Zkus to ještě jednou");
}
async function retry() { await button("Zkusit znovu").click(); }
async function layout(label, screenshots = false) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at ${width}`);
    assert.equal(await page.getByText("Tento vzorec se nepodařilo zobrazit.", { exact: true }).count(), 0, `${label}: formula renders`);
    if (screenshots && [320, 1440].includes(width)) await page.screenshot({ path: `${screenshotDir}/${label}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: reflows with 200% text`);
  await page.evaluate(() => document.documentElement.style.fontSize = "");
  await page.setViewportSize({ width: 1440, height: 1000 });
}
async function complete(lessonId) {
  await button("Dokončit lekci").click();
  await heading("Lekce dokončena");
  assert.equal(await page.getByLabel("Získáno 60 XP", { exact: true }).count(), 1);
  const receipt = (await awards(lessonId)).find((award) => award.lesson_id === lessonId);
  assert.deepEqual({ ...receipt, practice_capital_minor: BigInt(receipt.practice_capital_minor) }, { lesson_id: lessonId, xp: 60, practice_capital_minor: 200_000n, reward_policy_version: 3 });
}
async function markCompleted(where) {
  for (const { id } of await where) {
    await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${id}, 'completed', 0, now() - interval '1 day', now() - interval '1 day')`;
    await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${id}, 60, 0, 2, current_date - 1, 'Europe/Prague', now() - interval '1 day')`;
  }
}
async function recommends(title) {
  await page.goto(`${baseURL}/learn`);
  await page.getByRole("region", { name: "Doporučeno pro tebe", exact: true }).getByText(title).first().waitFor();
}
async function startModule(slug, title, count, first) {
  await page.goto(`${baseURL}/learn/${slug}`);
  await heading(title);
  assert.equal(await page.getByTestId("module-progress").textContent(), `0 / ${count} lekcí dokončeno`);
  await page.getByRole("listitem").filter({ hasText: first }).getByRole("button", { name: "Začít lekci" }).click();
}

try {
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Correlation QA", email, password: randomUUID() } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  // Fixture: Foundations and the first five Returns lessons are done; everything new is completed through the UI.
  await markCompleted(sql`select l.id from lesson l join learning_module m on m.id = l.module_id where l.is_published and (m.slug = 'investing-foundations' or (m.slug = 'returns' and l.id <> 'returns-checkpoint'))`);

  // Returns checkpoint: recommended next, then completed with retries.
  await recommends("Kontrola výnosů");
  await page.goto(`${baseURL}/learn/returns/returns-checkpoint`);
  await heading("Dvě akcie, jedna otázka");
  await choose(0, false);
  await retry();
  await choose(1);
  await next("Výnos každého roku");
  await layout("checkpoint-years");
  for (const [label, value] of [["1. rok", "25"], ["2. rok", "-25"], ["3. rok", "20"]]) await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await button("Zkontrolovat odpověď").click();
  await heading("Zkus to ještě jednou");
  await retry();
  for (const [label, value] of [["1. rok", "25"], ["2. rok", "-20"], ["3. rok", "20"]]) await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  await button("Zkontrolovat odpověď").click();
  await heading("Správně");
  await next("Celé období");
  await fill("25", false);
  await retry();
  await fill("20");
  await next("Cesta zpět na vrchol");
  await fill("25");
  await next("Cenový a celkový výnos");
  await fill("23");
  await next("Sečti logaritmy");
  await choose(1);
  await next("Shrň si to");
  await complete("returns-checkpoint");

  // Correlation is recommended once Volatility is done too.
  await markCompleted(sql`select l.id from lesson l join learning_module m on m.id = l.module_id where l.is_published and m.slug = 'volatility'`);
  await recommends("Co je korelace");

  // Correlation L1: prediction, four pairs, the formula and the calculation.
  await startModule("correlation", "Korelace", 4, "Co je korelace");
  await heading("Stejný směr, jiná velikost");
  await layout("c1-prediction");
  await choose(1, false);
  await retry();
  await choose(0);
  await next("Pohyb spolu");
  await next("Prozkoumej čtyři dvojice");
  await button("Nezávisle").click();
  await text("0,00");
  await button("Spolu, ale menší").click();
  await text("1,00");
  await page.getByText("Zobrazit hodnoty v tabulce", { exact: true }).click();
  await page.getByRole("table").getByText("+1,5 %", { exact: true }).waitFor();
  await layout("c1-explorer", true);
  await choose(1);
  await next("Jak se korelace počítá");
  await layout("c1-formula", true);
  await next("Spočítej ji");
  await fill("0,8", false);
  await retry();
  await fill("0,6");
  await next("Směr, ne velikost");
  await choose(1);
  await next("Shrň si to");
  assert.equal(await page.getByRole("link", { name: "Vyzkoušej v Labu: Korelace výnosů", exact: true }).getAttribute("href"), "/lab/compare");
  await complete("correlation-what-is-correlation");

  // Correlation L2: the shared market move.
  await page.goto(`${baseURL}/learn/correlation/correlation-is-not-causation`);
  await heading("Zmrzlina a opalovací krém");
  await choose(1);
  await next("Tři cesty ke korelaci");
  await next("Společný pohyb trhu");
  await text("0,72");
  const share = page.getByRole("slider");
  await share.focus();
  await share.press("ArrowRight"); await share.press("ArrowRight");
  await text("Podíl společného pohybu trhu: 100 %");
  await text("1,00");
  for (let step = 0; step < 4; step++) await share.press("ArrowLeft");
  await text("Podíl společného pohybu trhu: 0 %");
  await text("0,00");
  await layout("c2-factor", true);
  await choose(1);
  await next("Krátké období klame");
  await choose(1);
  await next("Výnosy, ne ceny");
  await choose(1);
  await next("Shrň si to");
  await complete("correlation-not-causation");

  // Correlation L3: calm against crisis.
  await page.goto(`${baseURL}/learn/correlation/correlation-in-crises`);
  await heading("Klid a bouře");
  await choose(1);
  await next("Korelace se mění");
  await next("Projdi klid a krizi");
  await text("0,24");
  await button("Krize: měsíce 13–18").click();
  await text("0,99");
  await text("−11 %");
  await layout("c3-crisis", true);
  await fill("-11");
  await next("Ochrana slábne");
  await choose(1);
  await next("Které období platí");
  await choose(1);
  await next("Shrň si to");
  await complete("correlation-in-crises");

  // Correlation L4: predict, then reveal the correlation of the fixed 2022 year.
  await page.goto(`${baseURL}/learn/correlation/correlation-on-real-data`);
  await heading("Jedno číslo, jedna věta");
  await choose(0);
  await next("Vyzkoušej to na reálných datech");
  const exercise = page.getByRole("region", { name: "Cvičení na historických cenách", exact: true });
  await exercise.getByText(/^Předpověď: Jak silně spolu v roce 2022 korelovaly denní výnosy/).waitFor();
  assert.equal(await exercise.getByText(/^Korelace .+ ↔ /).count(), 0, "the coefficient stays hidden until the prediction");
  assert.equal(await exercise.getByRole("img").count(), 0, "so do the dots");
  await exercise.getByText(/^(Ukázková data|Historická data)/).first().waitFor();
  await exercise.getByRole("button", { name: /^Silně/ }).click();
  await exercise.getByText(/(Odhad sedí|Tentokrát ne)\./).waitFor();
  const coefficient = await exercise.locator("p", { hasText: /^Korelace .+ ↔ / }).locator("xpath=following-sibling::p[1]").textContent();
  assert.match(coefficient, /^−?\d,\d\d$/, "a coefficient, never filled in");
  await exercise.getByText("Leden až červen", { exact: true }).waitFor();
  await exercise.getByRole("img").waitFor();
  assert.match(await exercise.getByRole("link", { name: "Porovnej tuhle dvojici v Labu" }).getAttribute("href"), /^\/lab\/compare\?a=.+&b=.+/);
  await layout("c4-real-history", true);
  await next("Spočítej korelaci");
  await fill("0,58");
  await next("Příčina, nebo společný pohyb");
  await choose(1);
  await next("Když přijde krize");
  await choose(1);
  await next("Shrň si to");
  await complete("correlation-real-data");
  assert.equal((await awards("correlation-")).length, 4);
  await page.goto(`${baseURL}/learn/correlation`);
  assert.equal(await page.getByTestId("module-progress").textContent(), "4 / 4 lekcí dokončeno");

  // Diversification is recommended next.
  await recommends("Koncentrace portfolia");

  // Diversification L1: weights and the largest position.
  await startModule("diversification", "Diverzifikace", 5, "Koncentrace portfolia");
  await heading("Deset firem, nebo čtyři");
  await choose(0);
  await next("Váha pozice");
  await fill("28,57", false);
  await retry();
  await fill("25");
  await next("Prozkoumej největší pozici");
  await text("Nesplněno");
  await text("−16,00 %");
  await page.getByRole("textbox", { name: "Firma A", exact: true }).fill("abc");
  await page.getByRole("alert").filter({ hasText: "Zadej hodnoty v korunách" }).waitFor();
  await page.getByRole("textbox", { name: "Firma A", exact: true }).fill("15000");
  await text("Splněno");
  await text("−8,00 %");
  await layout("d1-explorer", true);
  await next("Dopad na celé portfolio");
  await fill("-12");
  await next("Počet nestačí");
  await choose(1);
  await next("Shrň si to");
  await complete("diversification-concentration");

  // Diversification L2: sectors and countries.
  await page.goto(`${baseURL}/learn/diversification/sectors-and-countries`);
  await heading("Pět firem, jedno odvětví");
  await choose(1);
  await next("Sektory");
  await next("Porovnej dvě portfolia");
  await text("Technologie 90,0 %");
  await button("Země").click();
  await text("USA 72,0 %");
  await button("Pět různých odvětví").click();
  await page.getByText(/^\S+( \S+)? 18,0 %$/).first().waitFor();
  await layout("d2-explorer", true);
  await fill("55");
  await next("Země a měna");
  await choose(1);
  await next("Co ještě chybí");
  await choose(1);
  await next("Shrň si to");
  await complete("diversification-sectors-countries");

  // Diversification L3: ETF look-through.
  await page.goto(`${baseURL}/learn/diversification/etf-look-through`);
  await heading("Kolik máš ve firmě Čip");
  await choose(1);
  await next("Pohled dovnitř fondu");
  await layout("d3-formula");
  await next("Prozkoumej fondy a akcie");
  await text("Čip 25,6 %");
  await button("Sektor").click();
  await text("Technologie 62,5 %");
  await button("Jen Fond Svět").click();
  await text("Technologie 25,0 %");
  await layout("d3-explorer", true);
  await fill("62,5");
  await next("Překryv fondů");
  await choose(1);
  await next("Jeden fond, nebo deset akcií");
  await choose(0);
  await next("Shrň si to");
  await complete("diversification-etf-look-through");

  // Diversification L4: correlation and portfolio volatility.
  await page.goto(`${baseURL}/learn/diversification/correlation-and-portfolio-risk`);
  await heading("Dvě dvacítky");
  await choose(1);
  await next("Výkyvy se vyruší");
  await layout("d4-formula", true);
  await next("Prozkoumej korelaci a váhy");
  await text("13,23 %");
  const rho = page.getByRole("slider").first();
  await rho.focus();
  await rho.press("ArrowRight");
  await text("Korelace A a B: +1,0");
  await text("Při korelaci +1 se nic nevyruší.");
  await layout("d4-explorer", true);
  await fill("13,23");
  await next("Korelace +1");
  await choose(0);
  await next("Když korelace roste");
  await choose(2);
  await next("Shrň si to");
  await complete("diversification-correlation-risk");

  // Diversification L5: decision → prediction → lock → reveal → retry, without touching Portfolio Lab.
  const ledger = () => sql`select (select count(*) from portfolio where user_id = ${userId})::int as portfolios, (select count(*) from portfolio_trade t join portfolio p on p.id = t.portfolio_id where p.user_id = ${userId})::int as trades`;
  const before = await ledger();
  await page.goto(`${baseURL}/learn/diversification/diversification-scenario`);
  await heading("Zadání scénáře");
  await choose(0);
  await next("Sestav portfolio");
  const scenario = page.getByRole("region", { name: "Scénář diverzifikace", exact: true });
  assert.equal(await scenario.getByRole("button", { name: "Zamknout rozhodnutí" }).isDisabled(), true, "nothing to lock yet");
  for (let step = 0; step < 10; step++) await scenario.getByRole("button", { name: "Fond Technologie: přidat 10 %", exact: true }).click();
  assert.match(await scenario.getByTestId("scenario-cash").textContent(), /^0 %/);
  assert.equal(await scenario.getByRole("button", { name: "Fond Svět: přidat 10 %", exact: true }).isDisabled(), true, "no more than 100 %");
  await scenario.getByRole("button", { name: "Ano, projde", exact: true }).click();
  await scenario.getByRole("button", { name: "Zamknout rozhodnutí" }).click();
  await scenario.getByText("Tentokrát ne.", { exact: false }).waitFor();
  await scenario.getByText("Portfolio splnilo 1 ze 4 pravidel.", { exact: false }).waitFor();
  assert.equal(await scenario.getByText("Nesplněno", { exact: true }).count(), 3);
  await scenario.getByText("−30,00 %", { exact: true }).first().waitFor();
  await scenario.getByText("+35,00 %", { exact: true }).first().waitFor();
  assert.equal(await scenario.getByRole("button", { name: "Fond Technologie: ubrat 10 %", exact: true }).isDisabled(), true, "the decision is locked");
  await layout("d5-locked", true);
  await scenario.getByRole("button", { name: "Upravit portfolio a zkusit znovu" }).click();
  for (let step = 0; step < 10; step++) await scenario.getByRole("button", { name: "Fond Technologie: ubrat 10 %", exact: true }).click();
  const world = scenario.getByRole("button", { name: "Fond Svět: přidat 10 %", exact: true });
  await world.focus();
  for (let step = 0; step < 10; step++) await page.keyboard.press("Enter");
  await scenario.getByRole("button", { name: "Ano, projde", exact: true }).click();
  await scenario.getByRole("button", { name: "Zamknout rozhodnutí" }).click();
  await scenario.getByText("Odhad sedí.", { exact: false }).waitFor();
  await scenario.getByText("Portfolio splnilo 4 ze 4 pravidel.", { exact: false }).waitFor();
  await scenario.getByText("−8,85 %", { exact: true }).waitFor();
  await scenario.getByText("+11,00 %", { exact: true }).waitFor();
  assert.deepEqual(await ledger(), before, "the scenario never creates a portfolio or a trade");
  await next("Výsledek není známka");
  await choose(1);
  await next("Pohled dovnitř");
  await fill("42,4");
  await next("Co přidat");
  await choose(1);
  await next("Shrň si to");
  await complete("diversification-scenario");
  assert.equal((await awards("diversification-")).length, 5);
  await page.goto(`${baseURL}/learn/diversification`);
  assert.equal(await page.getByTestId("module-progress").textContent(), "5 / 5 lekcí dokončeno");

  // Lab → lessons: the comparison's correlation and the backtest's diversification note.
  await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=US-XNAS%3AMSFT&range=1Y`);
  const correlation = page.getByRole("region", { name: "Korelace A ↔ B" });
  await correlation.locator("summary").click();
  assert.equal(await correlation.getByRole("link", { name: "Lekce: Co je korelace", exact: true }).getAttribute("href"), "/learn/correlation/what-is-correlation");
  await page.goto(`${baseURL}/lab/backtesting`);
  assert.equal(await page.getByRole("link", { name: "Lekce: Korelace a riziko portfolia", exact: true }).getAttribute("href"), "/learn/diversification/correlation-and-portfolio-risk");

  const actionable = errors.filter((message) => !message.startsWith("You have Reduced Motion enabled on your device.") && !message.includes("404 (Not Found)"));
  assert.deepEqual(actionable, []);
  console.log(`PASS: Returns checkpoint, four Correlation and five Diversification lessons walked with retries, explorers, the real-data prediction and the locked scenario at six widths and 200% text; recommendations in curriculum order; one 2,000 Kč v3 receipt per lesson; no portfolio writes from the scenario; Lab compare and backtest lesson links. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId} and email = ${email}`;
  await sql.end();
}
