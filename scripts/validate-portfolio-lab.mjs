import { finishOnboarding } from "./onboarding-helper.mjs";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

/** Portfolio Lab (Pen "Investi / Portfolio Lab — 390px", states 1–5) against deterministic sample
 * data: locked, zero capital, first visit, search → instrument detail → buy/sell, the overview
 * with its split in koruny, attribution, unavailable prices, reset, responsive layouts and 200 % text. */
const baseURL = process.env.PORTFOLIO_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires local app and database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const screenshotDir = process.env.PORTFOLIO_SCREENSHOT_DIR ?? "/tmp/investi-portfolio-qa";
await mkdir(screenshotDir, { recursive: true });
const email = `portfolio-browser-${randomUUID()}@example.com`;
const password = randomUUID();
const widths = [320, 375, 390, 768, 1024, 1440];
let userId;
const minorFromCzk = (value) => BigInt(Math.round(Number(value.replace(/[\s ]/g, "").replace("Kč", "").replace("−", "-").replace("+", "").replace(",", ".")) * 100));
const clean = (text) => text.replace(/[\s ]+/g, " ").trim();

async function overflowing(page, root = "body") {
  return page.evaluate((selector) => {
    const scope = document.querySelector(selector) ?? document.body;
    const wide = document.documentElement.scrollWidth > innerWidth;
    const outside = [...scope.querySelectorAll("*")].filter((element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || getComputedStyle(element).visibility === "hidden" || element.closest(".sr-only")) return false;
      return box.right > innerWidth + 1 || box.left < -1;
    }).slice(0, 6).map((element) => `${element.tagName}.${element.className?.toString().slice(0, 40)} "${element.textContent?.trim().slice(0, 40)}"`);
    return { wide, outside };
  }, root);
}

/** Every width, plus 320 px at 200 % text: no horizontal page scroll, nothing pushed off screen. */
async function responsive(page, name, { root = "body", reloadEachWidth = true, ready } = {}) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    if (reloadEachWidth) { await page.reload(); if (ready) await ready(); }
    assert.deepEqual(await overflowing(page, root), { wide: false, outside: [] }, `${name} fits at ${width}px`);
    await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.deepEqual(await overflowing(page, root), { wide: false, outside: [] }, `${name} reflows at 320px with 200% text`);
  await page.screenshot({ path: `${screenshotDir}/${name}-320-200-percent.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 950 });
}

async function targetsAtLeast44(page, selectors) {
  const small = await page.evaluate((list) => list.flatMap((selector) => [...document.querySelectorAll(selector)].filter((element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && (box.height < 44 || box.width < 44);
  }).map((element) => `${selector} ${Math.round(element.getBoundingClientRect().width)}×${Math.round(element.getBoundingClientRect().height)}`)), selectors);
  assert.deepEqual(small, [], "interactive targets are at least 44 px");
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, timezoneId: "Europe/Prague" });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Portfolio Browser QA", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;

  // Locked: the Lab explains how to unlock it and offers no trading.
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByRole("heading", { name: "Portfolio Lab", exact: true }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Pokračovat v učení", exact: true }).getAttribute("href"), "/learn", "new learner sees unlock path");
  assert.equal(await page.getByRole("combobox").count(), 0, "locked Lab offers no instrument search");

  // Zero capital: an explicit entitlement fixture with no money points back to learning.
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at)
    values (${userId}, 'PORTFOLIO_LAB', 0, 'test_fixture', now())`;
  await page.reload();
  await page.getByRole("heading", { name: "Získej kapitál učením", exact: true }).waitFor();
  assert.equal(await page.getByTestId("portfolio-cash").textContent(), "0 Kč", "zero capital is stated, not hidden");
  assert.equal(await page.getByRole("combobox").count(), 0, "zero capital does not suggest investing is possible");
  assert.equal(await page.getByRole("link", { name: "Pokračovat v učení", exact: true }).getAttribute("href"), "/learn");
  await responsive(page, "zero", { ready: () => page.getByRole("heading", { name: "Získej kapitál učením" }).waitFor() });

  // First visit (state 1): a later reward is cash, the guide explains weights with the real amount.
  const [{ id: lessonId }] = await sql`select id from lesson where is_published = true order by id limit 1`;
  await sql.begin(async (tx) => {
    const now = new Date();
    await tx`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${lessonId}, 'completed', 0, ${now}, ${now}) on conflict do nothing`;
    await tx`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${lessonId}, 60, 200000, 1, '2026-09-14', 'Europe/Prague', ${now})`;
  });
  await page.reload();
  await page.getByRole("heading", { name: "Zkus si investovat nanečisto.", level: 1 }).waitFor();
  assert.equal(await page.getByTestId("portfolio-cash").textContent(), "2 000 Kč", "later reward becomes available cash");
  assert.match(clean(await page.locator("main").innerText()), /Váha je díl z celku: 60 % z 2 000 Kč je 1 200 Kč\./, "the guide uses the learner's real capital");
  assert.equal(await page.getByText("Ukázková data", { exact: true }).count(), 1, "deterministic mode is labeled as sample data");
  assert.equal(await page.getByText(/Příklad rozdělení · ne doporučení/i).count(), 1, "the example mix is labeled as an example, not advice");
  assert.equal(await page.getByRole("button", { name: "Možnosti portfolia" }).count(), 0, "reset is absent before anything happened");
  assert.equal(await page.locator('input[type="range"]').count(), 0, "no weight sliders");
  assert.equal(await page.locator('img[src*="15-weights"]').count(), 0, "concept pose 15 stays in its lesson (guide rule 01)");
  await responsive(page, "first-visit", { ready: () => page.getByRole("heading", { name: "Zkus si investovat nanečisto." }).waitFor() });

  // The retired weight builder redirects; search is the way to a first purchase.
  await page.goto(`${baseURL}/lab/portfolio/mix`);
  await page.waitForURL(/\/lab\/portfolio$/);
  const firstSearch = page.getByRole("combobox", { name: "Najdi, co chceš koupit" });
  await firstSearch.focus();
  await page.keyboard.type("apple");
  await page.getByRole("option", { name: /AAPL/ }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("option").count(), 0, "Escape closes the results");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("e");
  await page.getByRole("option", { name: /AAPL/ }).waitFor();
  await targetsAtLeast44(page, ["#first-buy-search", 'button[aria-label="Vymazat hledání"]', '[role="option"]']);
  await page.screenshot({ path: `${screenshotDir}/first-visit-search-1440.png`, fullPage: true });
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/lab\/instruments\/US-XNAS%3AAAPL$/);
  await page.getByRole("heading", { name: "Apple Inc.", exact: true }).waitFor();

  // Instrument detail (Pen Instrument board; default period 5L, URL range=1Y keeps the 1R view): charts, metrics, ETF analytics and the single-instrument order flow.
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL?range=1Y`);
  await page.getByRole("heading", { name: "Apple Inc.", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Tvoje pozice" }).count(), 0, "unowned instrument has no invented position");
  assert.equal(await page.getByText("Ukázková data", { exact: true }).count(), 1, "deterministic detail is labeled as sample data");
  assert.match(await page.getByRole("img", { name: /denní graf závěrečných cen očištěných o splity/ }).getAttribute("aria-label"), /\d+ pozorování od/, "daily chart uses available sample observations");
  assert.equal(await page.locator('[data-chart-tone="positive"]').count(), 1, "positive equity return marks the chart tone");
  assert.ok(await page.locator('[data-chart-type="line"] canvas').count() >= 1, "the line chart renders on canvas");
  assert.equal(await page.getByRole("button", { name: "Křivka", exact: true }).getAttribute("aria-pressed"), "true");
  assert.equal(await page.getByRole("button", { name: "Svíčky", exact: true }).isEnabled(), true, "OHLC supports candlesticks");
  assert.match(await page.locator("main").innerText(), /Cenový výnos za zobrazené období/);
  await page.getByRole("heading", { name: "Klíčové ukazatele" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Přehled fondu" }).count(), 0, "equities do not render ETF analytics");
  assert.match(await page.locator("main").innerText(), /382,4B USD/);
  const metricSignal = async (id) => page.locator(`[data-metric="${id}"]`).getAttribute("data-signal");
  assert.equal(await metricSignal("pe"), "neutral", "P/E remains neutral");
  assert.equal(await metricSignal("market-cap"), "neutral", "size remains neutral");
  assert.equal(await metricSignal("operating-margin"), "positive", "operating profitability uses the broad reference");
  assert.equal(await metricSignal("debt-equity"), "neutral", "middle debt-to-equity values remain neutral");
  assert.equal(await metricSignal("net-debt-ebitda"), "positive", "low net debt uses the broad reference");
  await page.getByRole("button", { name: "P/E TTM" }).click();
  await page.getByText(/Cena akcie vůči zisku na akcii za posledních 12 měsíců/).waitFor();
  await page.getByRole("button", { name: "P/E TTM" }).click();
  const equityScreenshotStyle = await page.addStyleTag({ content: 'header.sticky { position: static !important; } nav[aria-label="Mobilní navigace"] { position: static !important; }' });
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-1y-1440.png`, fullPage: true });
  await page.locator('section[aria-labelledby="key-metrics-heading"]').screenshot({ path: `${screenshotDir}/instrument-equity-metrics-clean.png` });
  const priceHistory = page.locator('section[aria-labelledby="price-history-heading"]');
  const selectedStatistics = async () => priceHistory.locator("dl").last().innerText();
  const fullStatistics = await selectedStatistics();
  const lineHorizon = (await page.getByRole("img", { name: /denní graf závěrečných cen očištěných o splity/ }).getAttribute("aria-label")).match(/pozorování od (.*?) do (.*?)\./);
  assert.ok(lineHorizon, "line chart announces the full observation horizon");
  const readout = page.getByTestId("chart-readout");
  const resetViewport = page.getByRole("button", { name: "Obnovit rozsah" });
  const chartBox = async () => {
    await page.locator("[data-chart-type]").scrollIntoViewIfNeeded();
    return page.locator("[data-chart-type]").boundingBox();
  };
  const wheelZoom = async () => {
    const box = await chartBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    for (let index = 0; index < 5; index++) await page.mouse.wheel(0, -240);
    await resetViewport.waitFor();
    await page.mouse.move(0, 0);
  };
  assert.match(await readout.innerText(), /poslední zavření/, "the readout shows the latest close before any hover");
  const latestReadout = await readout.innerText();
  {
    const box = await chartBox();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await page.waitForFunction((latest) => document.querySelector('[data-testid="chart-readout"]').innerText !== latest, latestReadout);
    assert.doesNotMatch(await readout.innerText(), /poslední/, "hover shows the hovered observation instead of the latest one");
    await page.mouse.move(0, 0);
    await page.waitForFunction((latest) => document.querySelector('[data-testid="chart-readout"]').innerText === latest, latestReadout);
  }
  await wheelZoom();
  assert.match(await priceHistory.innerText(), /Zobrazeno\s+\d+\. \d+\. \d{4} – \d+\. \d+\. \d{4}/, "zoom names the visible dates");
  assert.equal(await selectedStatistics(), fullStatistics, "line zoom leaves selected-period statistics unchanged");
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-line-zoom-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "Svíčky", exact: true }).focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.getByRole("button", { name: "Svíčky", exact: true }).getAttribute("aria-pressed"), "true", "keyboard activates candle mode");
  await page.waitForURL(/range=1Y&chart=candles/);
  await page.getByRole("img", { name: /denní, svíčkový graf cen očištěných o splity/ }).waitFor();
  assert.equal(await resetViewport.count(), 1, "switching chart type preserves the viewport");
  assert.match(await readout.innerText(), /Otevření[\s\S]*Maximum[\s\S]*Minimum/, "candle readout shows OHLC");
  const candleStatistics = await selectedStatistics();
  assert.equal(candleStatistics.match(/Cenový výnos za zobrazené období\n([^\n]+)/)?.[1], fullStatistics.match(/Cenový výnos za zobrazené období\n([^\n]+)/)?.[1], "candle mode keeps the selected-period return");
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-candles-zoom-1440.png`, fullPage: true });
  await resetViewport.click();
  await resetViewport.waitFor({ state: "hidden" });
  assert.equal(await selectedStatistics(), candleStatistics, "reset does not change candle selected-period statistics");
  assert.ok((await page.getByRole("img", { name: /denní, svíčkový graf cen očištěných o splity/ }).getAttribute("aria-label")).includes(`pokrývá pozorování od ${lineHorizon[1]} do ${lineHorizon[2]}`), "reset candle chart covers the original full horizon");
  assert.ok(await page.locator('[data-chart-type="candles"] canvas').count() >= 1, "candles render on canvas");
  const chartKeys = page.getByRole("group", { name: "Interaktivní cenový graf" });
  await chartKeys.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  assert.doesNotMatch(await readout.innerText(), /poslední/, "arrow keys step the crosshair to earlier bars");
  assert.match(await page.locator('[aria-live="polite"]').filter({ hasText: /zavření/ }).innerText(), /otevření .*maximum .*minimum .*zavření/, "keyboard steps are announced with OHLC");
  await page.keyboard.press("Escape");
  assert.match(await readout.innerText(), /poslední svíčka/, "Escape returns the readout to the latest bar");
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-candles-1440.png`, fullPage: true });
  const timeframe = (label) => page.getByRole("group", { name: "Období vývoje ceny" }).getByRole("button", { name: label, exact: true });
  // Timeframes and chart types are slices and views of the history already on the page:
  // switching them must not navigate, render on the server or fetch anything.
  const switchRequests = [];
  const recordRequest = (request) => { if (["document", "fetch", "xhr"].includes(request.resourceType())) switchRequests.push(`${request.method()} ${request.url()}`); };
  page.on("request", recordRequest);
  for (const longRange of ["5Y", "Max"]) {
    await timeframe(longRange === "5Y" ? "5L" : longRange).click();
    await page.waitForURL(new RegExp(`range=${longRange}&chart=candles`));
    assert.equal(await timeframe(longRange === "5Y" ? "5L" : longRange).getAttribute("aria-pressed"), "true", `${longRange} is the pressed timeframe`);
    // The sample history spans about a year, so even 5L and Max keep daily candles.
    assert.match(await page.getByRole("img", { name: /denní, svíčkový graf cen očištěných o splity/ }).getAttribute("aria-label"), /pokrývá pozorování od 2\. 1\. 2025 do 16\. 1\. 2026/, `${longRange} candles retain all available observations`);
    await page.screenshot({ path: `${screenshotDir}/instrument-aapl-${longRange.toLowerCase()}-candles-1440.png`, fullPage: true });
  }
  await timeframe("1R").click();
  await page.waitForURL(/range=1Y/);
  await equityScreenshotStyle.evaluate((style) => style.remove());
  await page.getByRole("button", { name: "Křivka", exact: true }).click();
  await page.waitForURL((url) => !url.search.includes("chart="));
  await wheelZoom();
  await timeframe("1M").click();
  await page.waitForURL(/range=1M/);
  await resetViewport.waitFor({ state: "hidden" });
  assert.equal(await resetViewport.isVisible(), false, "changing timeframe resets the viewport");
  assert.match(await page.locator("main").innerText(), /Cenový výnos za zobrazené období/);
  assert.match(await page.locator("main").innerText(), /Začátek · .*Konec · .*Minimum období.*Maximum období/s);
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-1m-1440.png`, fullPage: true });
  {
    const horizon = async () => (await page.locator("[data-chart-type]").getAttribute("aria-label")).match(/od (\d+\. \d+\. \d{4}) do (\d+\. \d+\. \d{4})/).slice(1).join(" – ");
    const seen = new Map();
    for (const [label, range] of [["5L", "5Y"], ["1M", "1M"], ["3M", "3M"], ["6M", "6M"], ["Letos", "YTD"], ["1R", "1Y"], ["Max", "Max"], ["5L", "5Y"]]) {
      await timeframe(label).click();
      await page.waitForURL(new RegExp(`range=${range}(&|$)`));
      assert.equal(await page.getByRole("status").filter({ hasText: /Načítá|není dostupná/ }).count(), 0, `${label} renders without a loading or unavailable state`);
      const statistics = await selectedStatistics();
      if (seen.has(range)) assert.equal(statistics, seen.get(range), `${label} recomputes the same statistics on a revisit`);
      seen.set(range, statistics);
      assert.match(await horizon(), /\d{4} – \d+\. \d+\. 2026/, `${label} chart names its observation horizon`);
    }
    // The sample history starts in January 2025 and ends 16 January 2026, so 1M, 3M and 1R are distinct slices.
    assert.notEqual(seen.get("1M"), seen.get("3M"), "1M and 3M statistics differ");
    assert.notEqual(seen.get("3M"), seen.get("1Y"), "3M and 1R statistics differ");
    assert.equal(seen.get("5Y"), seen.get("Max"), "5L and Max cover the same year of sample data");
    for (let index = 0; index < 3; index++) {
      await page.getByRole("button", { name: "Svíčky", exact: true }).click();
      await page.locator('[data-chart-type="candles"]').waitFor();
      await page.getByRole("button", { name: "Křivka", exact: true }).click();
      await page.locator('[data-chart-type="line"]').waitFor();
    }
    await timeframe("1M").click();
    await page.waitForURL(/range=1M/);
  }
  page.off("request", recordRequest);
  assert.deepEqual(switchRequests, [], "switching timeframes and chart types makes no request");
  await page.getByRole("button", { name: "Svíčky", exact: true }).click();
  for (const width of [320, 375, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("img", { name: /denní, svíčkový graf cen očištěných o splity/ }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `instrument detail has no overflow at ${width}`);
    if (width === 390) await page.screenshot({ path: `${screenshotDir}/instrument-aapl-candles-390.png`, fullPage: true });
    if (width === 320) {
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "instrument detail supports 200% text");
      await page.screenshot({ path: `${screenshotDir}/instrument-aapl-candles-320-200-percent.png`, fullPage: true });
      await page.screenshot({ path: `${screenshotDir}/instrument-aapl-320-200-percent.png`, fullPage: true });
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
    await page.screenshot({ path: `${screenshotDir}/instrument-aapl-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3ANVDA`);
  await page.getByRole("heading", { name: "NVIDIA Corporation" }).waitFor();
  assert.equal(await metricSignal("p-fcf"), "unavailable", "missing valuation stays muted");
  assert.equal(await metricSignal("fcf"), "unavailable", "missing fiscal cash flow stays muted");
  assert.match(await page.locator("main").innerText(), /Cena \/ FCF TTM\s*—/);
  assert.match(await page.locator("main").innerText(), /Volný peněžní tok FY\s*—/);
  await page.screenshot({ path: `${screenshotDir}/instrument-equity-partial-1440.png`, fullPage: true });
  await page.goto(`${baseURL}/lab/instruments/IE-XETR%3AVWCE?range=1Y`);
  await page.getByRole("heading", { name: "Vanguard FTSE All-World UCITS ETF" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Klíčové ukazatele" }).count(), 0, "ETF detail excludes company fundamentals");
  assert.match(await page.locator("main").innerText(), /VWCE\s+ETF · burza XETR/, "ETF detail uses ETF identity and exchange");
  assert.equal(await page.getByText("Poslední dostupná cena · Poslední dostupná cena", { exact: false }).count(), 0, "unknown session state does not duplicate the observation label");
  assert.equal(await page.getByRole("heading", { name: "Tvoje pozice" }).count(), 0, "unowned ETF has no fake position");
  await page.getByRole("heading", { name: "Přehled fondu" }).waitFor();
  assert.match(await page.locator('[data-testid="etf-analytics"]').innerText(), /Nákladovost[\s\S]*0,22\s*%[\s\S]*AUM[\s\S]*14,8B EUR[\s\S]*NAV[\s\S]*123,68 EUR/);
  assert.match(await page.locator('[data-testid="etf-analytics"]').innerText(), /Největší pozice[\s\S]*Podíl 10 největších pozic[\s\S]*23,1\s*%[\s\S]*Sample Atlas Devices/);
  assert.equal(await page.getByRole("heading", { name: "Sektorové zastoupení" }).count(), 1);
  assert.equal(await page.getByRole("heading", { name: "Geografické zastoupení" }).count(), 1);
  assert.equal(await page.getByText("P/E TTM", { exact: true }).count(), 0, "ETF does not show company ratios");
  await page.getByLabel("Více o položce Nákladovost").focus();
  await page.keyboard.press("Enter");
  await page.getByText("Roční provozní náklady fondu jako procento aktiv.").waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Přehled fondu" }).click();
  const etfScreenshotStyle = await page.addStyleTag({ content: 'header.sticky { position: static !important; } nav[aria-label="Mobilní navigace"] { position: static !important; }' });
  await page.screenshot({ path: `${screenshotDir}/instrument-etf-1440.png`, fullPage: true });
  await page.locator('[data-testid="etf-analytics"]').screenshot({ path: `${screenshotDir}/instrument-etf-analytics-clean.png` });
  const etfStatistics = await page.locator('section[aria-labelledby="price-history-heading"] dl').last().innerText();
  await wheelZoom();
  assert.equal(await page.locator('section[aria-labelledby="price-history-heading"] dl').last().innerText(), etfStatistics, "ETF line zoom keeps range statistics");
  await page.screenshot({ path: `${screenshotDir}/instrument-etf-line-zoom-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "Svíčky", exact: true }).click();
  await page.getByRole("img", { name: /denní, svíčkový graf cen očištěných o splity/ }).waitFor();
  assert.equal(await resetViewport.isVisible(), true, "ETF candle mode preserves zoom");
  await page.screenshot({ path: `${screenshotDir}/instrument-etf-candles-zoom-1440.png`, fullPage: true });
  await resetViewport.click();
  assert.match(await page.locator('section[aria-labelledby="price-history-heading"]').innerText(), /Minimum období · \d+\. \d+\. \d{4}\s*117,789 EUR/, "candle summary uses OHLC low instead of closing low, with its date");
  await page.screenshot({ path: `${screenshotDir}/instrument-etf-candles-1440.png`, fullPage: true });
  await page.locator('[data-testid="etf-analytics"] > div').screenshot({ path: `${screenshotDir}/instrument-etf-holdings-sectors.png` });
  await page.locator('section[aria-labelledby="etf-countries-heading"]').screenshot({ path: `${screenshotDir}/instrument-etf-countries.png` });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `ETF detail has no overflow at ${width}`);
    if (width === 320) await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const etfOverflow = await page.evaluate(() => ({ exceeds: document.documentElement.scrollWidth > innerWidth, elements: [...document.querySelectorAll("main *")].filter((element) => element.scrollWidth > element.clientWidth + 1).slice(0, 18).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 45), className: element.className?.toString().slice(0, 80), scroll: element.scrollWidth, client: element.clientWidth })) }));
    assert.equal(etfOverflow.exceeds, false, `ETF detail supports ${width}px${width === 320 ? " and 200% text" : ""}: ${JSON.stringify(etfOverflow.elements)}`);
    await page.screenshot({ path: `${screenshotDir}/instrument-etf-${width}${width === 320 ? "-200-percent" : ""}.png`, fullPage: true });
    if (width === 320) await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
  await etfScreenshotStyle.evaluate((style) => style.remove());
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL`);
  const detailInvest = page.getByRole("button", { name: "Koupit AAPL", exact: true }).first();
  await detailInvest.click();
  const orderDialog = page.getByRole("dialog", { name: "Investovat do AAPL" });
  await orderDialog.getByRole("heading", { name: "Zvol množství", exact: true }).waitFor();
  await orderDialog.getByLabel("Množství", { exact: true }).fill("1");
  await page.screenshot({ path: `${screenshotDir}/buy-1440.png`, fullPage: true });
  await orderDialog.getByRole("button", { name: "Zkontrolovat pokyn", exact: true }).click();
  await orderDialog.getByRole("heading", { name: "Zkontroluj investici", exact: true }).waitFor();
  assert.equal(await orderDialog.getByTestId("review-trade-fee").textContent(), "10 Kč");
  assert.equal(await orderDialog.getByTestId("review-fx-cost").textContent(), "12,97 Kč");
  assert.equal(await orderDialog.getByTestId("review-total-cost").textContent(), "22,97 Kč");
  await page.screenshot({ path: `${screenshotDir}/buy-review-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const reviewOverflow = await orderDialog.evaluate((dialog) => [...dialog.querySelectorAll("*")].filter((element) => { const box = element.getBoundingClientRect(); return box.right > innerWidth + 1 || box.left < -1; }).slice(0, 8).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 80), className: element.className?.toString().slice(0, 100), box: element.getBoundingClientRect().toJSON() })));
  assert.deepEqual(reviewOverflow, [], "buy review supports 200% text");
  await page.screenshot({ path: `${screenshotDir}/buy-review-320-200-percent.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 950 });
  await orderDialog.getByRole("button", { name: "Potvrdit nákup AAPL", exact: true }).click();
  await orderDialog.getByRole("alert").filter({ hasText: "dost hotovosti" }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/insufficient-cash-1440.png`, fullPage: true });
  await orderDialog.getByRole("button", { name: "Upravit pokyn", exact: true }).click();
  // A different fictional profile persists, but switching back never reprices past trades.
  await orderDialog.getByLabel("Fiktivní profil brokera").selectOption("investi-low-fx-v1");
  await page.waitForFunction(() => document.querySelector("#broker-fee-profile")?.value === "investi-low-fx-v1");
  assert.equal((await sql`select broker_fee_profile_id from learning_profile where user_id = ${userId}`)[0].broker_fee_profile_id, "investi-low-fx-v1");
  await orderDialog.getByLabel("Fiktivní profil brokera").selectOption("investi-standard-v1");
  await orderDialog.getByLabel("Množství", { exact: true }).fill("0.25");
  await orderDialog.getByRole("button", { name: "Zkontrolovat pokyn", exact: true }).click();
  await page.screenshot({ path: `${screenshotDir}/buy-review-confirm-1440.png`, fullPage: true });
  await orderDialog.getByRole("button", { name: "Potvrdit nákup AAPL", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Nákup dokončen" }).waitFor();
  assert.equal(await page.getByRole("status").filter({ hasText: "Nákup dokončen" }).getByRole("link", { name: /Zobrazit portfolio/ }).getAttribute("href"), "/lab/portfolio");
  await page.getByRole("heading", { name: "Tvoje pozice" }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-owned-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: `${screenshotDir}/instrument-aapl-owned-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 950 });

  // Overview after one buy: real ledger numbers, no fabricated performance.
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByRole("heading", { name: "Moje portfolio", level: 1 }).waitFor();
  assert.equal(await page.getByTestId("portfolio-cash").textContent(), "1 338,38 Kč");
  const coherent = async (label) => {
    const cash = minorFromCzk(await page.getByTestId("portfolio-cash").textContent());
    const invested = minorFromCzk(await page.getByTestId("portfolio-invested").textContent());
    const total = minorFromCzk(await page.getByTestId("portfolio-value").textContent());
    assert.equal(cash + invested, total, `${label}: value = cash + holdings`);
    return { cash, invested, total };
  };
  assert.equal((await coherent("single holding")).total, 198_676n, "commission and conversion reduce portfolio value by 13.24 Kč");
  assert.equal(await page.getByTestId("portfolio-gain-loss").textContent(), "−13,24 Kč", "fees are included in performance");
  assert.equal(await page.getByTestId("portfolio-cost-effect").textContent(), "−13,24 Kč");
  assert.equal(await page.getByTestId("portfolio-fx-effect").textContent(), "0 Kč", "commission is not attributed to currency movement");
  assert.match(clean(await page.getByTestId("holding-AAPL").innerText()), /AAPL 32,6 %/, "weight is measured against the whole portfolio, cash included");
  assert.equal(await page.getByText(/cíl \d|Můj mix|mimo mix/).count(), 0, "no targets or mixes");
  assert.match(clean(await page.getByRole("img", { name: /Rozložení portfolia/ }).getAttribute("aria-label")), /^Rozložení portfolia: Akcie 32,6 %, 648,38 Kč; Hotovost 67,4 %, 1 338,38 Kč\.$/, "the split names each share in koruny");
  assert.equal(await page.getByText(/Poplatky a přirážka konverze otevřených pozic ubraly/).count(), 1, "costs are explained independently of price and FX");
  assert.equal(clean(await page.getByTestId("contribution-costs").locator('td[role="cell"]').textContent()), "−13,24 Kč", "the contribution chart explains costs without inventing market movement");
  assert.equal(await page.getByRole("status").filter({ hasText: "Ukázková data" }).count(), 1, "the data banner names sample data");
  await page.getByText("Cvičný kapitál je vklad, ne výnos.", { exact: false }).waitFor();
  assert.match(await page.getByTestId("time-weighted-return").innerText(), /−0,66\s*%\s*za období/, "TWR includes costs and avoids annualizing a short period");
  assert.equal(await page.getByTestId("money-weighted-return").innerText(), await page.getByTestId("time-weighted-return").innerText(), "without intermediate contributions MWR equals TWR");
  const performanceHelp = page.getByText("Jak výnosy počítáme", { exact: true });
  await performanceHelp.focus();
  await page.keyboard.press("Enter");
  assert.equal(await performanceHelp.locator("..").getAttribute("open"), "", "performance disclosure works from the keyboard");
  await page.getByText(/sám ale nedokazuje chybu v chování/).waitFor();
  await responsive(page, "overview-single", { ready: async () => {
    await page.getByTestId("portfolio-value").waitFor();
    await page.getByText("Jak výnosy počítáme", { exact: true }).click();
  } });
  await performanceHelp.click();

  // A second purchase from the overview search: an ETF bought on its detail page, one order.
  const buySearch = page.getByRole("combobox", { name: "Koupit akcii, ETF nebo dluhopis" });
  await buySearch.fill("vanguard");
  await page.getByRole("option", { name: /VWCE/ }).click();
  await page.waitForURL(/\/lab\/instruments\/IE-XETR%3AVWCE$/);
  await page.getByRole("button", { name: "Koupit VWCE", exact: true }).first().click();
  const etfOrder = page.getByRole("dialog", { name: "Investovat do VWCE" });
  await etfOrder.getByRole("heading", { name: "Zvol množství", exact: true }).waitFor();
  await etfOrder.getByLabel("Množství", { exact: true }).fill("0.2");
  await etfOrder.getByRole("button", { name: "Zkontrolovat pokyn", exact: true }).click();
  await etfOrder.getByRole("button", { name: "Potvrdit nákup VWCE", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Nákup dokončen" }).getByRole("link", { name: /Zobrazit portfolio/ }).click();
  await page.waitForURL(/\/lab\/portfolio$/);
  await page.getByTestId("holding-VWCE").waitFor();
  const afterEtf = await coherent("two holdings");
  assert.equal(afterEtf.total, 197_367n, "two purchases include commission and FX costs");
  assert.equal(clean(await page.getByTestId("portfolio-gain-loss").textContent()), "−26,33 Kč", "two purchases include only their real simulated costs");
  const split = clean(await page.getByRole("img", { name: /Rozložení portfolia/ }).getAttribute("aria-label"));
  assert.match(split, /^Rozložení portfolia: Akcie 32,9 %, 648,38 Kč; ETF [\d,]+ %, [\d ,]+ Kč; Hotovost [\d,]+ %, [\d ,]+ Kč\.$/);
  const legend = page.locator('section[aria-labelledby="allocation-title"]');
  for (const label of ["Akcie", "ETF", "Hotovost"]) await legend.getByText(label, { exact: true }).waitFor();
  const ledger = await sql`select pt.side, pt.client_idempotency_key from portfolio_trade pt join portfolio p on p.id = pt.portfolio_id where p.user_id = ${userId} and p.closed_at is null order by pt.executed_at, pt.id`;
  assert.deepEqual(ledger.map(({ side }) => side), ["BUY", "BUY"], "two single orders, nothing planned on the learner's behalf");
  assert.equal(ledger.filter(({ client_idempotency_key }) => client_idempotency_key.startsWith("allocation:")).length, 0);
  await page.getByText("Poslední obchody · 2").click();
  await page.getByRole("list", { name: "Poslední obchody nanečisto" }).getByText("Nákup VWCE").waitFor();
  await targetsAtLeast44(page, ["#instrument-search"]);
  await responsive(page, "overview-holdings", { ready: () => page.getByTestId("portfolio-value").waitFor() });

  // Sector and country exposure: AAPL whole, VWCE looked through, cash and unclassified shares named.
  const splitSwitch = legend.getByRole("group", { name: "Rozložení podle" });
  assert.equal(await splitSwitch.getByRole("button", { name: "Typ aktiva", exact: true }).getAttribute("aria-pressed"), "true", "the asset-type view comes first");
  const exposureRows = async (dimension) => {
    const rows = await legend.getByTestId(`exposure-${dimension}`).locator("li").evaluateAll((items) => items.map((item) => ({
      label: item.querySelector("span")?.textContent ?? "",
      share: item.querySelector("strong")?.textContent ?? "",
      detail: item.querySelector("small")?.textContent ?? "",
    })));
    const total = rows.reduce((sum, row) => sum + minorFromCzk(row.detail.split(" · ")[0]), 0n);
    assert.equal(total, afterEtf.total, `${dimension}: the categories add up exactly to the portfolio value`);
    const percent = rows.reduce((sum, row) => sum + Number(row.share.replace(/[\s %]/g, "").replace(",", ".")), 0);
    assert.ok(Math.abs(percent - 100) <= rows.length * 0.05 + 1e-9, `${dimension}: shares add up to 100 % within display rounding (${percent})`);
    return rows;
  };
  await splitSwitch.getByRole("button", { name: "Sektor", exact: true }).click();
  assert.equal(await splitSwitch.getByRole("button", { name: "Sektor", exact: true }).getAttribute("aria-pressed"), "true");
  const sectorRows = await exposureRows("sector");
  assert.equal(sectorRows[0].label, "Technologie", "the stock and the fund's technology share land in one sector");
  assert.match(clean(sectorRows[0].detail), /AAPL, VWCE$/, "the sector names both holdings that feed it");
  assert.ok(sectorRows.some(({ label, detail }) => label === "Finance" && /VWCE$/.test(clean(detail))), "VWCE is looked through into its other sectors");
  assert.equal(sectorRows.at(-1).label, "Hotovost", "cash is its own category");
  assert.equal(sectorRows.some(({ label }) => label === "Neznámé"), false, "the sample fund's sectors cover 100 %");
  assert.match(clean(await legend.getByTestId("exposure-sector-largest").textContent()), /^Největší sektor: Technologie \d+,\d %$/, "an explainable rule, not a score");
  assert.equal(await legend.getByText(/\d+\s?\/\s?100|skóre/).count(), 0, "no composite score");
  assert.equal(await legend.getByRole("link", { name: "Lekce: Sektory a země", exact: true }).getAttribute("href"), "/learn/diversification/sectors-and-countries", "the split leads to the diversification lesson");
  await splitSwitch.getByRole("button", { name: "Země", exact: true }).click();
  const countryRows = await exposureRows("country");
  assert.equal(countryRows[0].label, "Spojené státy", "AAPL's US and VWCE's United States meet in one country");
  assert.match(clean(countryRows[0].detail), /AAPL, VWCE$/);
  assert.ok(countryRows.some(({ label }) => label === "Japonsko"));
  assert.ok(countryRows.some(({ label }) => label === "Neznámé"), "the fund's unreported countries are shown, not dropped");
  await legend.getByText("VWCE: zdroj nerozepsal celý fond", { exact: false }).waitFor();
  await targetsAtLeast44(page, ['section[aria-labelledby="allocation-title"] [role="group"] button']);
  await responsive(page, "overview-countries", { reloadEachWidth: false });
  await splitSwitch.getByRole("button", { name: "Sektor", exact: true }).click();
  await responsive(page, "overview-sectors", { reloadEachWidth: false });

  // Selling stays a single-instrument flow on the instrument page; oversell is refused by the server.
  await page.getByTestId("holding-AAPL").getByRole("link").click();
  await page.waitForURL(/\/lab\/instruments\/US-XNAS%3AAAPL/);
  await page.getByRole("heading", { name: "Tvoje pozice" }).waitFor();
  await page.getByRole("button", { name: "Prodat", exact: true }).click();
  const sellDialog = page.getByRole("dialog", { name: "Prodat" });
  await sellDialog.getByLabel("Množství k prodeji").fill("1");
  await sellDialog.getByRole("button", { name: "Prodat AAPL", exact: true }).click();
  await sellDialog.getByRole("button", { name: "Potvrdit prodej AAPL", exact: true }).click();
  await sellDialog.getByRole("alert").filter({ hasText: "prodat více" }).waitFor();
  await sellDialog.getByRole("button", { name: "Upravit pokyn", exact: true }).click();
  await sellDialog.getByLabel("Množství k prodeji").fill("0.05");
  await sellDialog.getByRole("button", { name: "Prodat AAPL", exact: true }).click();
  assert.equal(await sellDialog.getByTestId("review-trade-fee").textContent(), "10 Kč");
  await sellDialog.getByRole("button", { name: "Potvrdit prodej AAPL", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Prodej dokončen" }).waitFor();

  // Attribution (state 5): a ledger buy at another price and FX splits the result into price and FX.
  const [{ id: activePortfolioId }] = await sql`select id from portfolio where user_id = ${userId} and closed_at is null`;
  const historicTime = new Date();
  await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, client_idempotency_key)
    values (${randomUUID()}, ${activePortfolioId}, 'US-XNAS:MSFT', 'MSFT', 'Microsoft Corporation', 'equity', 'BUY', '0.1', '200', 'USD', '23.1', 46200, 0, -46200, ${historicTime}, ${historicTime}, 'investi-deterministic', 'investi-education-market-v1', 'synthetic', true, ${randomUUID()})`;
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByTestId("holding-MSFT").waitFor();
  assert.equal(await page.getByText(/mimo mix|cíl \d/).count(), 0, "holdings carry no targets");
  // MSFT: 0.1 × 212 USD × 22.75 = 482.30 Kč vs 462.00 Kč paid → price +27.72 Kč (at the 23.10 purchase rate), FX −7.42 Kč.
  assert.equal(await page.getByTestId("portfolio-price-effect").textContent(), "+27,72 Kč");
  assert.equal(await page.getByTestId("portfolio-fx-effect").textContent(), "−7,42 Kč");
  const gain = minorFromCzk(await page.getByTestId("portfolio-gain-loss").textContent());
  const realizedRow = page.getByTestId("contribution-realized");
  const realized = await realizedRow.count() ? minorFromCzk((await realizedRow.locator('td[role="cell"]').textContent())) : 0n;
  const costs = minorFromCzk(await page.getByTestId("portfolio-cost-effect").textContent());
  assert.equal(2772n - 742n + realized + costs, gain, "price + FX + costs + closed sells add up exactly to investment gain");
  assert.equal(clean(await page.getByTestId("contribution-equity").locator('td[role="cell"]').textContent()), "+27,72 Kč");
  assert.match(clean(await page.locator("#story-title").textContent()), /^Ubylo 17 Kč\. Nejvíc pohnuly akcie\.$/);
  assert.match(clean(await page.locator("main").innerText()), /Akcie \(AAPL, MSFT\) přidaly 27,72 Kč pohybem cen\./);
  await coherent("attribution");
  await responsive(page, "overview-attribution", { ready: () => page.getByTestId("portfolio-value").waitFor() });

  // A new reward is a contribution; sample history does not cover this real-time flow.
  const cashBeforeReward = minorFromCzk(await page.getByTestId("portfolio-cash").textContent());
  const [{ id: laterLessonId }] = await sql`select id from lesson where is_published = true and id <> ${lessonId} order by id limit 1`;
  await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at)
    values (${userId}, ${laterLessonId}, 60, 200000, 1, '2026-10-21', 'Europe/Prague', now())`;
  await page.reload();
  assert.equal(minorFromCzk(await page.getByTestId("portfolio-gain-loss").textContent()), gain, "a new reward does not become investment gain");
  assert.equal(minorFromCzk(await page.getByTestId("portfolio-cash").textContent()), cashBeforeReward + 200_000n);
  assert.equal(await page.getByTestId("time-weighted-return").innerText(), "Nedostupné", "missing historical flow valuation never becomes zero");
  assert.match(await page.getByTestId("money-weighted-return").innerText(), /%\s*za období/, "MWR remains available independently of missing historical prices");
  await responsive(page, "overview-return-unavailable", { ready: async () => {
    await page.getByTestId("time-weighted-return").waitFor();
    await page.getByText("Jak výnosy počítáme", { exact: true }).click();
    await page.getByText("Chybí úplné ocenění nebo historické ceny či kurzy.", { exact: false }).waitFor();
  } });
  await sql`delete from lesson_award where user_id = ${userId} and lesson_id = ${laterLessonId}`;

  // Unavailable prices (state 4d): no total, no estimate, only what the ledger knows.
  await sql`insert into portfolio_trade (id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type, side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor, fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at, market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic, fx_rate_provider, fx_rate_dataset, fx_rate_kind, fx_rate_is_deterministic, fx_reference_date, fx_rate_retrieved_at, client_idempotency_key)
    values (${randomUUID()}, ${activePortfolioId}, 'FMP:NASDAQ:NVDA', 'NVDA', 'NVIDIA Corporation', 'equity', 'BUY', '0.01', '100', 'USD', '22', 2200, 0, -2200, ${historicTime}, ${historicTime}, 'fmp', 'quote', 'live', false, 'frankfurter', 'ecb-reference', 'reference', false, '2026-09-20', ${historicTime}, ${randomUUID()})`;
  await page.reload();
  await page.getByRole("status").filter({ hasText: "Některé ceny chybí" }).filter({ hasText: "Oceněno 3 z 4 položek" }).waitFor();
  await page.getByRole("heading", { name: "Co víme jistě" }).waitFor();
  assert.equal(await page.getByTestId("portfolio-value").count(), 0, "an incomplete valuation shows no total at all");
  assert.equal(await page.getByTestId("portfolio-gain-loss").count(), 0, "and no gain or loss");
  assert.match(clean(await page.getByTestId("holding-NVDA").innerText()), /cena chybí/);
  assert.match(clean(await page.getByTestId("holding-NVDA").innerText()), /nakoupeno 22 Kč|22 Kč/);
  await page.getByRole("button", { name: "Načíst znovu" }).click();
  await page.getByRole("heading", { name: "Co víme jistě" }).waitFor();
  assert.equal(await page.getByTestId(/^exposure-/).count(), 0, "a missing price shows no sector or country split at all, never zeros");
  await responsive(page, "unavailable", { ready: () => page.getByRole("heading", { name: "Co víme jistě" }).waitFor() });
  const tradesBlocked = (await sql`select count(*)::int as count from portfolio_trade where portfolio_id = ${activePortfolioId}`)[0].count;

  // Reset: options → confirm (Escape-safe) → a clean generation with all earned capital; history retained.
  await page.goto(`${baseURL}/lab/portfolio`);
  const options = page.getByRole("button", { name: "Možnosti portfolia", exact: true });
  await options.click();
  await page.getByRole("menu", { name: "Možnosti portfolia" }).getByRole("menuitem", { name: "Resetovat portfolio" }).click();
  const resetDialog = page.getByRole("dialog", { name: "Resetovat portfolio?" });
  await resetDialog.getByText("Postup v učení i dřívější obchody zůstanou zaznamenané.", { exact: false }).waitFor();
  await page.keyboard.press("Escape");
  await resetDialog.waitFor({ state: "hidden" });
  await page.waitForFunction((element) => document.activeElement === element, await options.elementHandle());
  assert.equal(await options.evaluate((element) => element === document.activeElement), true, "Escape returns focus to the options button");
  await options.click();
  await page.getByRole("menuitem", { name: "Resetovat portfolio" }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.deepEqual(await overflowing(page, "dialog[open]"), { wide: false, outside: [] }, "reset confirmation reflows at 200% text");
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 950 });
  await resetDialog.getByRole("button", { name: "Resetovat portfolio", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Portfolio resetováno" }).waitFor();
  await page.getByRole("heading", { name: "Zkus si investovat nanečisto." }).waitFor();
  assert.equal(await page.getByTestId("portfolio-cash").textContent(), "2 000 Kč", "reset restores all earned capital as cash");
  await page.waitForFunction(() => document.activeElement?.id === "first-buy-search");
  const generations = await sql`select id, closed_at from portfolio where user_id = ${userId} order by opened_at`;
  assert.equal(generations.length, 2);
  assert.ok(generations[0].closed_at, "the old generation is closed, not deleted");
  assert.equal((await sql`select count(*)::int as count from portfolio_trade where portfolio_id = ${generations[0].id}`)[0].count, tradesBlocked, "old trades are retained");
  assert.equal((await sql`select count(*)::int as count from portfolio_allocation where portfolio_id = ${generations[0].id}`)[0].count, 0, "single orders never write a mix");
  await page.screenshot({ path: `${screenshotDir}/post-reset-1440.png`, fullPage: true });
  assert.deepEqual(errors, [], "Portfolio Lab has no browser errors");
  console.log("PASS: locked, zero capital, first visit, instrument buy/sell, search → detail → buy, split in koruny, sector/country look-through, price/FX attribution, unavailable prices, reset, 44 px targets, responsive layouts and 200% text. Screenshots:", screenshotDir);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
