import { finishOnboarding } from "./onboarding-helper.mjs";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

/** Market-data states 4b (closed) and 4c (stale) against the deterministic closed-market runtime
 * (DETERMINISTIC_MARKET_NOW=2026-01-17T12:00:00.000Z): values stay real, orders stay disabled. */
const baseURL = process.env.PORTFOLIO_CLOSED_TEST_URL ?? "http://localhost:3001";
const databaseUrl = process.env.DATABASE_URL;
assert.ok(databaseUrl, "DATABASE_URL is required.");
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(databaseUrl).hostname), "Requires a local app and database.");

const sql = postgres(databaseUrl, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const screenshotDir = process.env.PORTFOLIO_CLOSED_SCREENSHOT_DIR ?? "/tmp/investi-portfolio-closed-qa";
await mkdir(screenshotDir, { recursive: true });
const email = `portfolio-closed-${randomUUID()}@example.com`;
const password = randomUUID();
const clean = (text) => text.replace(/[\s ]+/g, " ").trim();
let userId;

const fixtureTrade = (portfolioId, instrumentId, symbol, name, assetType, quantity, price, currency, fx, gross) => sql`insert into portfolio_trade (
    id, portfolio_id, instrument_id, instrument_symbol, instrument_name, instrument_asset_type,
    side, quantity, unit_price, quote_currency, fx_rate_to_base, gross_amount_base_minor,
    fee_base_minor, cash_delta_base_minor, quote_observed_at, executed_at,
    market_data_provider, market_data_dataset, market_data_kind, market_data_is_deterministic,
    fx_rate_provider, fx_rate_dataset, fx_rate_kind, fx_rate_is_deterministic,
    fx_reference_date, fx_rate_retrieved_at, client_idempotency_key
  ) values (
    ${randomUUID()}, ${portfolioId}, ${instrumentId}, ${symbol}, ${name}, ${assetType},
    'BUY', ${quantity}, ${price}, ${currency}, ${fx}, ${gross},
    0, ${-gross}, '2026-01-16T20:45:00.000Z', '2026-01-16T20:50:00.000Z',
    'investi-deterministic', 'investi-education-market-v1', 'synthetic', true,
    'investi-deterministic', 'investi-education-market-v1', 'synthetic', true,
    '2026-01-16', '2026-01-16T20:50:00.000Z', ${randomUUID()}
  )`;
const tradeCount = async () => (await sql`select count(*)::int as count from portfolio_trade pt join portfolio p on p.id = pt.portfolio_id where p.user_id = ${userId}`)[0].count;
async function noOverflow(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label} has no horizontal overflow`);
}

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 }, timezoneId: "Europe/Prague" });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseURL}/sign-up`);
  await page.getByLabel("Jméno", { exact: true }).fill("Closed Market QA");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Vytvořit účet", exact: true }).click();
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  const [{ id: lessonId }] = await sql`select id from lesson where is_published = true order by id limit 1`;
  const now = new Date("2026-01-17T12:00:00.000Z");
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${lessonId}, 'completed', 0, ${now}, ${now}) on conflict do nothing`;
  await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${lessonId}, 60, 200000, 1, '2026-01-17', 'Europe/Prague', ${now})`;
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at) values (${userId}, 'PORTFOLIO_LAB', 0, 'test_fixture', ${now})`;

  // First mix while the U.S. market is closed: the builder explains why it cannot buy and stays disabled.
  await page.goto(`${baseURL}/lab/portfolio/mix`);
  await page.getByRole("heading", { name: "Sestav svůj první mix" }).waitFor();
  const search = page.getByRole("combobox", { name: "Přidat nástroj" });
  await search.fill("apple");
  await page.getByRole("option", { name: /AAPL/ }).waitFor();
  await search.press("Enter");
  const aaplLine = page.getByTestId("mix-line-AAPL");
  await aaplLine.getByText("Trh je teď zavřený. Nakoupit nebo prodat půjde, až se otevře.").waitFor();
  await page.getByText("Rozděleno 100 %", { exact: true }).waitFor();
  await page.getByText("Teď nejde nakoupit: AAPL. Důvod je u položky.").waitFor();
  const save = page.getByRole("button", { name: /Uložit portfolio/ });
  assert.equal(await save.getAttribute("aria-disabled"), "true", "orders needing a fresh quote stay disabled");
  await save.click({ force: true });
  assert.equal(await page.getByRole("dialog").count(), 0, "no review opens for a closed market");
  await search.fill("vanguard");
  await page.getByRole("option", { name: /VWCE/ }).waitFor();
  await search.press("Enter");
  await page.getByTestId("mix-line-VWCE").getByText("Poslední cena je zastaralá. Nákup teď nejde.").waitFor();
  await page.screenshot({ path: `${screenshotDir}/builder-closed-390.png`, fullPage: true });
  await noOverflow(page, "closed builder");
  assert.equal(await tradeCount(), 0, "nothing executes while the market is closed");

  // State 4b: the closing reference still values the portfolio, labeled with its session.
  await page.goto(`${baseURL}/lab/portfolio`);
  const [{ id: portfolioId }] = await sql`select id from portfolio where user_id = ${userId} and closed_at is null`;
  await fixtureTrade(portfolioId, "US-XNAS:AAPL", "AAPL", "Apple Inc.", "equity", "0.25", "114", "USD", "22.75", 64838);
  await page.reload();
  await page.getByRole("status").filter({ hasText: "Trh je zavřený" }).filter({ hasText: "Nakupovat a prodávat půjde, až se trh otevře." }).waitFor();
  assert.match(clean(await page.locator("#portfolio-value-label").textContent()), /^Hodnota při zavření 16\. 1\.$/);
  const holding = page.getByTestId("holding-AAPL");
  assert.match(clean(await holding.innerText()), /648,38 Kč/, "the last-session quote produces a non-zero closed-market valuation");
  assert.match(clean(await holding.innerText()), /114 USD · zavírací cena/, "the row keeps the native reference price and its session context");
  assert.equal(await page.getByTestId("portfolio-value").textContent(), "2 000 Kč");
  await page.screenshot({ path: `${screenshotDir}/closed-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.screenshot({ path: `${screenshotDir}/closed-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 900 });

  // The instrument page still disables a single-instrument order.
  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL`);
  await page.getByRole("heading", { name: "Apple Inc.", exact: true }).waitFor();
  await page.getByText(/Trh zavřen/).first().waitFor();
  await page.getByRole("button", { name: /Investovat/ }).first().click();
  const orderDialog = page.getByRole("dialog", { name: "Investovat do AAPL" });
  await orderDialog.getByText(/čerstvé tržní pozorování/i).waitFor();
  assert.equal(await orderDialog.getByRole("button", { name: "Zkontrolovat pokyn", exact: true }).isDisabled(), true, "closed-market execution is disabled");
  await page.screenshot({ path: `${screenshotDir}/instrument-closed-390.png`, fullPage: true });

  // State 4c: a quote without a session calendar ages into "stale"; the last known value is labeled as such.
  await fixtureTrade(portfolioId, "IE-XETR:VWCE", "VWCE", "Vanguard FTSE All-World UCITS ETF", "etf", "0.25", "124", "EUR", "24.9", 77190);
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByRole("status").filter({ hasText: "Data jsou zastaralá" }).waitFor();
  assert.match(clean(await page.locator("#portfolio-value-label").textContent()), /^Naposledy známá hodnota · 21:45$/);
  await page.getByRole("button", { name: "Načíst znovu" }).click();
  await page.getByRole("status").filter({ hasText: "Data jsou zastaralá" }).waitFor();
  assert.equal(await page.getByTestId("portfolio-value").textContent(), "2 000 Kč", "stale but usable prices still value exactly");
  await page.screenshot({ path: `${screenshotDir}/stale-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.screenshot({ path: `${screenshotDir}/stale-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await noOverflow(page, "stale state at 320px and 200% text");
  await page.screenshot({ path: `${screenshotDir}/stale-320-200-percent.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });

  assert.equal(await tradeCount(), 2, "the closed and stale states create no trade");
  const [{ cash }] = await sql`select (coalesce((select sum(practice_capital_minor) from lesson_award where user_id = ${userId}), 0) + coalesce((select sum(cash_delta_base_minor) from portfolio_trade where portfolio_id = ${portfolioId}), 0))::text as cash`;
  assert.equal(cash, "57972", "Practice Capital moved only through the two fixture buys");
  assert.deepEqual(errors, [], "closed-market Portfolio Lab has no browser errors");
  console.log("PASS: closed market (4b) and stale data (4c) keep exact valuations with their as-of labels, disable the mix builder and single orders, add no trade, and leave Practice Capital unchanged.");
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
