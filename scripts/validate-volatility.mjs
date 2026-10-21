// Local production acceptance for the Volatility module: disposable learner, real lesson actions, reward receipts and Lab links.
// Run against a deterministic-data server: MARKET_DATA_PROVIDER=deterministic FX_DATA_PROVIDER=deterministic.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.VOLATILITY_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app/database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague", extraHTTPHeaders: { "x-forwarded-for": "127.0.0.66" } });
const page = await context.newPage();
const screenshotDir = process.env.VOLATILITY_SCREENSHOT_DIR ?? "/tmp/investi-volatility-qa";
await mkdir(screenshotDir, { recursive: true });
const email = `volatility-${randomUUID()}@example.com`;
let userId;
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
const button = (name) => page.getByRole("button", { name, exact: true });
const text = (value) => page.getByText(value, { exact: true }).first().waitFor();
const next = async (name) => { await button("Pokračovat").click(); await heading(name); };
const awards = () => sql`select lesson_id, xp, practice_capital_minor, reward_policy_version from lesson_award where user_id = ${userId} and lesson_id like 'volatility-%' order by lesson_id`;
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
  const receipt = (await awards()).find((award) => award.lesson_id === lessonId);
  assert.deepEqual({ ...receipt, practice_capital_minor: BigInt(receipt.practice_capital_minor) }, { lesson_id: lessonId, xp: 60, practice_capital_minor: 200_000n, reward_policy_version: 4 });
}

try {
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Volatility QA", email, password: randomUUID() } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  // Fixture: Foundations and Returns are done; the Volatility lessons are completed through the UI below.
  const predecessors = await sql`select id from lesson where is_published and module_id <> 'module-volatility'`;
  for (const { id } of predecessors) {
    await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${id}, 'completed', 0, now() - interval '1 day', now() - interval '1 day')`;
    await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${id}, 60, 0, 2, current_date - 1, 'Europe/Prague', now() - interval '1 day')`;
  }

  // Learn recommends the new module once Returns is finished.
  await page.goto(`${baseURL}/learn`);
  const recommended = page.getByRole("region", { name: "Doporučeno pro tebe", exact: true });
  await recommended.getByText("Co je volatilita").first().waitFor();
  await page.goto(`${baseURL}/learn/volatility`);
  await heading("Volatilita");
  assert.equal(await page.getByTestId("module-progress").textContent(), "0 / 5 lekcí dokončeno");
  const items = page.getByRole("listitem");
  assert.match((await items.allTextContents()).join("|"), /Co je volatilita.*Směrodatná odchylka výnosů.*Anualizace volatility.*Největší propad a zotavení.*Kontrola: volatilita a propad/s);

  // L1: prediction → figure → calculation → misconception checks → completion with the v3 reward.
  await items.filter({ hasText: "Co je volatilita" }).getByRole("button", { name: "Začít lekci" }).click();
  await heading("Stejný cíl, jiná cesta");
  await layout("l1-prediction");
  await choose(0, false);
  await button("Zkusit znovu").click();
  await choose(1);
  await next("Riziko a volatilita");
  await next("Projdi obě cesty");
  await button("Fond Vlna").click();
  await text("Výnos za čtvrtletí: −17,39 %");
  await text("43,71 p. b.");
  await layout("l1-paths", true);
  await fill("-17,39", false);
  await button("Zkusit znovu").click();
  await fill("-5");
  await next("Kolísání oběma směry");
  await choose(0);
  await next("Co volatilita neřekne");
  await choose(1);
  await next("Shrň si to");
  await layout("l1-summary");
  await complete("volatility-what-is-volatility");

  // L2: the step-by-step explorer and the n − 1 calculation.
  await page.goto(`${baseURL}/learn/volatility/standard-deviation`);
  await heading("Stejný průměr, jiná řada");
  await choose(1);
  await next("Začni průměrem");
  await layout("l2-mean", true);
  await next("Odchylky od průměru");
  await choose(0);
  await next("Směrodatná odchylka");
  await layout("l2-formula", true);
  await next("Prozkoumej výpočet");
  await text("2,94 %");
  await button("Řada X").click();
  await page.getByText("0,00 %", { exact: true }).first().waitFor();
  await page.getByRole("textbox", { name: "Výnos 1", exact: true }).fill("abc");
  await page.getByRole("alert").filter({ hasText: "Zadej čtyři čísla" }).waitFor();
  await page.getByRole("textbox", { name: "Výnos 1", exact: true }).fill("4");
  await layout("l2-explorer", true);
  await next("Spočítej ji");
  await page.getByRole("textbox", { name: "Průměrný výnos", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "Směrodatná odchylka", exact: true }).fill("1,58");
  await button("Zkontrolovat odpověď").click();
  await heading("Zkus to ještě jednou");
  await button("Zkusit znovu").click();
  await page.getByRole("textbox", { name: "Průměrný výnos", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "Směrodatná odchylka", exact: true }).fill("1,83");
  await button("Zkontrolovat odpověď").click();
  await heading("Správně");
  await next("Jednotky a období");
  await choose(0);
  await next("Shrň si to");
  await complete("volatility-standard-deviation");

  // L3: √N explorer and the real-history exercise on the configured provider's fixed year.
  await page.goto(`${baseURL}/learn/volatility/annualising-volatility`);
  await heading("Od dne k roku");
  await choose(1);
  await next("Proč ne krát 252");
  await next("Tři frekvence dat");
  await next("Vyzkoušej anualizaci");
  await button("Měsíční").click();
  await page.getByRole("textbox", { name: "Směrodatná odchylka měsíčních výnosů", exact: true }).fill("5");
  await text("17,32 %");
  await layout("l3-explorer", true);
  await fill("60", false);
  await button("Zkusit znovu").click();
  await fill("17,32");
  await next("Stejně jako v Labu");
  await next("Vyzkoušej to na reálných datech");
  await page.getByText("Předpověď: Který z nich v roce 2022 kolísal víc?").waitFor();
  assert.equal(await page.getByText("Denní směrodatná odchylka", { exact: true }).count(), 0, "numbers stay hidden until the prediction");
  const exercise = page.getByRole("region", { name: "Cvičení na historických cenách", exact: true });
  await exercise.getByRole("button").first().click();
  await exercise.getByText(/(Odhad sedí|Tentokrát ne)\./).waitFor();
  await exercise.getByText(/^(Ukázková data|Historická data)/).first().waitFor();
  const daily = Number((await exercise.locator("dt", { hasText: "Denní směrodatná odchylka" }).locator("xpath=following-sibling::dd[1]").textContent()).replace(/[^\d,]/g, "").replace(",", "."));
  assert.ok(daily > 0, "a daily deviation is shown, never zero");
  await exercise.getByRole("textbox", { name: "Anualizovaná volatilita", exact: true }).fill((daily * Math.sqrt(252)).toFixed(2).replace(".", ","));
  await exercise.getByRole("button", { name: "Zkontrolovat výpočet", exact: true }).click();
  await exercise.getByText("Správně.", { exact: true }).waitFor();
  await exercise.getByText("Spočítáno stejnou funkcí, kterou používá Lab na detailu instrumentu.").waitFor();
  await layout("l3-real-history", true);
  await next("Porovnej férově");
  await choose(1);
  await next("Shrň si to");
  await complete("volatility-annualising");

  // L4: running peak explorer, recovery and the real-history drawdown.
  await page.goto(`${baseURL}/learn/volatility/max-drawdown`);
  await heading("Kde začíná propad");
  await choose(1);
  await next("Propad od vrcholu");
  await layout("l4-definition", true);
  await next("Projdi cestu měsíc po měsíci");
  const slider = page.getByRole("slider");
  await slider.focus();
  for (let step = 0; step < 6; step++) await slider.press("ArrowRight");
  await text("−25,22 %");
  await button("Odhalit největší propad").click();
  await text("bře (115 Kč) → čvc (86 Kč)");
  await layout("l4-explorer", true);
  await fill("-30");
  await next("Cesta zpět je delší");
  await fill("42,86");
  await next("Na pořadí záleží");
  await choose(1);
  await next("Vyzkoušej to na reálných datech");
  const drawdown = page.getByRole("region", { name: "Cvičení na historických cenách", exact: true });
  await drawdown.getByRole("button").first().click();
  await drawdown.getByText("Vrchol před propadem", { exact: true }).waitFor();
  await drawdown.getByRole("textbox", { name: "Největší propad", exact: true }).fill("5");
  await drawdown.getByRole("button", { name: "Zkontrolovat výpočet", exact: true }).click();
  await drawdown.getByText("Zatím to nesedí.", { exact: true }).waitFor();
  await drawdown.getByRole("button", { name: "Ukázat řešení", exact: true }).click();
  await drawdown.getByText(/^Řešení: −\d/).waitFor();
  await drawdown.getByText("Zisk potřebný k návratu", { exact: true }).waitFor();
  await layout("l4-real-history", true);
  await next("Shrň si to");
  await complete("volatility-max-drawdown");

  // L5: the checkpoint completes the module.
  await page.goto(`${baseURL}/learn/volatility/volatility-checkpoint`);
  await heading("Dva fondy, čtyři čísla");
  await choose(1);
  await next("Spočítej rozptyl");
  await page.getByRole("textbox", { name: "Průměrný výnos", exact: true }).fill("1");
  await page.getByRole("textbox", { name: "Směrodatná odchylka", exact: true }).fill("1,63");
  await button("Zkontrolovat odpověď").click();
  await heading("Správně");
  await next("Převeď na rok");
  await fill("14,42");
  await next("Najdi největší propad");
  await fill("-25");
  await next("Cesta zpět");
  await fill("33,33");
  await next("Co čísla neřeknou");
  await choose(1);
  await next("Shrň si to");
  await complete("volatility-checkpoint");
  assert.equal((await awards()).length, 5);
  await page.goto(`${baseURL}/learn/volatility`);
  assert.equal(await page.getByTestId("module-progress").textContent(), "5 / 5 lekcí dokončeno");

  // Lab metrics lead to the lessons.
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL?range=1Y`);
  const analytics = page.getByRole("region", { name: "Co říkají čísla", exact: true });
  await analytics.waitFor();
  // The lesson link sits in each metric's "Co to znamená?" disclosure.
  for (const [metricLabel, label, href] of [["Volatilita", "Lekce: Co je volatilita", "/learn/volatility/what-is-volatility"], ["Největší propad", "Lekce: Největší propad a zotavení", "/learn/volatility/max-drawdown"]]) {
    const metric = analytics.locator("dl > div").filter({ has: page.getByText(metricLabel, { exact: true }) });
    await metric.locator("summary").click();
    assert.equal(await metric.getByRole("link", { name: label, exact: true }).getAttribute("href"), href);
  }
  await analytics.getByRole("link", { name: "Lekce: Co je volatilita", exact: true }).click();
  await page.waitForURL("**/learn/volatility/what-is-volatility");
  await page.goto(`${baseURL}/lab/backtesting`);
  await button("Spustit backtest").click();
  await page.getByTestId("metric-volatilita").waitFor();
  assert.equal(await page.getByRole("link", { name: "Lekce: Největší propad a zotavení", exact: true }).getAttribute("href"), "/learn/volatility/max-drawdown");
  assert.equal(await page.getByRole("link", { name: "Lekce: Co je volatilita", exact: true }).getAttribute("href"), "/learn/volatility/what-is-volatility");

  const actionable = errors.filter((message) => !message.startsWith("You have Reduced Motion enabled on your device.") && !message.includes("404 (Not Found)"));
  assert.deepEqual(actionable, []);
  console.log(`PASS: Volatility recommended after Returns; L1–L4 and the checkpoint walked with retries, explorers, real-history prediction and calculation at six widths and 200% text; one 2,000 Kč v3 receipt per lesson; Lab metric and backtest links. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId} and email = ${email}`;
  await sql.end();
}
