import { finishOnboarding } from "./onboarding-helper.mjs";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

/** Instrument comparison (#26) against deterministic sample data: detail → „Porovnat s…“ → search
 * for the second instrument → rebased chart, metrics, correlation and their unavailable states,
 * range switching, keyboard help, invalid links and 320–1440 px plus 200 % text without overflow. */
const baseURL = process.env.COMPARE_TEST_URL ?? "http://localhost:3104";
const screenshotDir = process.env.COMPARE_SCREENSHOT_DIR ?? "/tmp/investi-compare-qa";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires local app and database.");
await mkdir(screenshotDir, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `compare-browser-${randomUUID()}@example.com`;
const password = randomUUID();
const widths = [320, 375, 390, 768, 1024, 1440];
let userId;

async function overflow(page) {
  return page.evaluate(() => ({
    wide: document.documentElement.scrollWidth > innerWidth,
    outside: [...document.querySelectorAll("main *")].filter((element) => {
      const box = element.getBoundingClientRect();
      // KaTeX keeps a visually hidden MathML copy for screen readers (like .sr-only) and draws a √ as a 400em SVG clipped by its own `.hide-tail`.
      if (box.width === 0 || element.closest(".sr-only, .katex-mathml, .katex .hide-tail")) return false;
      return box.right > innerWidth + 1 || box.left < -1;
    }).slice(0, 5).map((element) => `${element.tagName} "${element.textContent?.trim().slice(0, 40)}"`),
  }));
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, timezoneId: "Europe/Prague" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Compare QA", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;

  // Locked Portfolio Lab keeps the comparison locked too.
  await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=US-XNAS%3AMSFT`);
  assert.equal(await page.getByRole("heading", { name: "AAPL a MSFT" }).count(), 0, "comparison is part of the locked Portfolio Lab");
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at)
    values (${userId}, 'PORTFOLIO_LAB', 0, 'test_fixture', now())`;

  // Entry: the instrument detail offers „Porovnat s…“ and keeps the selected range.
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL?range=1Y`);
  await page.getByRole("heading", { name: "Apple Inc." }).waitFor();
  await page.getByRole("link", { name: "Porovnat s…" }).click();
  await page.getByRole("heading", { name: "Porovnat Apple Inc. s…" }).waitFor();
  assert.match(page.url(), /\/lab\/compare\?a=US-XNAS%3AAAPL&range=1Y$/);

  // Second instrument through the shared search combobox, keyboard only.
  const search = page.getByRole("combobox", { name: "Druhý instrument" });
  await search.fill("Micro");
  await page.getByRole("option", { name: /MSFT/ }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "AAPL a MSFT" }).waitFor();
  assert.match(page.url(), /a=US-XNAS%3AAAPL&b=US-XNAS%3AMSFT&range=1Y/);

  const main = page.locator("main");
  const text = await main.innerText();
  assert.match(text, /Ukázková data/, "sample data is labelled as such");
  assert.match(text, /jen cena, bez dividend/, "price-only scope is stated");
  assert.match(text, /společná data jen od 5\. 1\. 2026 do 16\. 1\. 2026/, "a common period shorter than the range is stated");
  const chart = page.getByRole("img", { name: /^Srovnávací graf: obě řady přepočtené na 100/ });
  assert.equal(await chart.count(), 1, "rebased chart has a text summary");
  assert.match(await chart.getAttribute("aria-label"), /plná čára.*přerušovaná čára/, "series differ by line style, not only colour");
  assert.equal(await page.locator(".recharts-line").count(), 2, "both series are drawn");
  assert.equal(await page.locator(".recharts-line-curve").nth(1).getAttribute("stroke-dasharray"), "6 4", "series B is dashed");

  // Metrics: a semantic table on wide screens, every cell filled or explicitly unavailable.
  const table = page.getByRole("table", { name: "Ukazatele A a B za společné období" });
  assert.equal(await table.getByRole("rowheader").count(), 4);
  assert.deepEqual(await table.getByRole("rowheader").evaluateAll((cells) => cells.map((cell) => cell.firstChild.textContent)), ["Jednoduchý výnos", "Roční výnos", "Největší propad", "Volatilita"]);
  assert.equal(await table.getByText("Nedostupné").count(), 4, "annualised return and volatility are unavailable for both short histories");
  assert.doesNotMatch(await table.innerText(), /\+0,0 %|^0 %$/m, "missing values never become zero");

  // Correlation: explicit unavailable state with the reason and its basis.
  const correlation = page.getByRole("region", { name: "Korelace A ↔ B" });
  assert.match(await correlation.innerText(), /Nedostupné\. Pro korelaci je potřeba alespoň 20 společných denních výnosů/);
  assert.match(await correlation.innerText(), /9 společných denních výnosů/);

  // Keyboard: „Co to znamená?“ opens with Enter.
  const help = correlation.getByText("Co to znamená?");
  await help.focus();
  await page.keyboard.press("Enter");
  await correlation.getByText(/Pearsonova korelace denních cenových výnosů/).waitFor();
  assert.equal(await page.getByRole("link", { name: /Lekce: Cenový a celkový výnos/ }).count(), 1);
  await page.screenshot({ path: `${screenshotDir}/compare-aapl-msft-1440.png`, fullPage: true });

  // Range switch keeps both instruments.
  await page.getByRole("navigation", { name: "Období srovnání" }).getByRole("link", { name: "1M" }).click();
  await page.waitForURL(/range=1M/);
  assert.match(page.url(), /a=US-XNAS%3AAAPL&b=US-XNAS%3AMSFT/);
  assert.equal(await page.getByRole("navigation", { name: "Období srovnání" }).locator('[aria-current="page"]').innerText(), "1M");

  // Different exchanges are called out next to the correlation; replacing B keeps A.
  const change = page.getByRole("combobox", { name: "Vyměnit instrument B" });
  await change.fill("VWCE");
  await page.getByRole("option", { name: /VWCE/ }).click();
  await page.getByRole("heading", { name: "AAPL a VWCE" }).waitFor();
  assert.match(await main.innerText(), /Burzy XNAS a XETR zavírají v různý čas/);
  assert.match(await main.innerText(), /v EUR/);

  // Responsive: structured list on narrow screens, no horizontal overflow, 200 % text at 320 px.
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=US-XNAS%3AMSFT&range=1Y`);
    await page.getByRole("heading", { name: "AAPL a MSFT" }).waitFor();
    const narrow = width < 768;
    assert.equal(await page.getByRole("table", { name: "Ukazatele A a B za společné období" }).isVisible(), !narrow, `metrics table only on wide screens (${width})`);
    if (narrow) assert.equal(await page.getByRole("heading", { level: 3, name: "Největší propad" }).isVisible(), true, `metrics list on narrow screens (${width})`);
    const result = await overflow(page);
    assert.deepEqual(result, { wide: false, outside: [] }, `no overflow at ${width}`);
    if (width === 320 || width === 390) await page.screenshot({ path: `${screenshotDir}/compare-${width}.png`, fullPage: true });
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      assert.deepEqual(await overflow(page), { wide: false, outside: [] }, "no overflow at 320 px with 200 % text");
      await page.screenshot({ path: `${screenshotDir}/compare-320-200-percent.png`, fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
  }
  await page.setViewportSize({ width: 1440, height: 950 });

  // Invalid and degenerate links.
  await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=US-XNAS%3AAAPL`);
  await page.getByText("Instrument nejde porovnat sám se sebou. Vyber jiný.").waitFor();
  await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=FMP%3ANASDAQ%3AA%25ZZ`);
  await page.getByRole("heading", { name: "Tohle srovnání jsme nenašli" }).waitFor();
  await page.goto(`${baseURL}/lab/compare?a=US-XNAS%3AAAPL&b=FMP%3ANASDAQ%3AAAPL`);
  await page.getByRole("heading", { name: "Tohle srovnání jsme nenašli" }).waitFor();
  await page.goto(`${baseURL}/lab/compare?b=US-XNAS%3AMSFT&range=6M`);
  await page.getByRole("heading", { name: "Porovnat Microsoft Corporation s…" }).waitFor();
  await page.goto(`${baseURL}/lab/compare`);
  await page.getByRole("heading", { name: "Co chceš porovnat?" }).waitFor();

  assert.deepEqual(errors, [], "no browser errors");
  console.log("PASS: detail → Porovnat s… → search → rebased chart, metrics and correlation with explicit unavailable states, range switch, B replacement, invalid links, 320–1440 px and 200 % text. Screenshots:", screenshotDir);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
