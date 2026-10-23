// Current shell/backtesting acceptance. Lesson, portfolio, auth, and persistence
// contracts are exercised by their dedicated suites rather than duplicated here.
import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.PRODUCT_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app and disposable database.");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const screenshotDir = process.env.PRODUCT_SCREENSHOT_DIR ?? "/tmp/investi-product-qa";
await mkdir(screenshotDir, { recursive: true });
let userId;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const button = (name) => page.getByRole("button", { name, exact: true });
  const heading = (name) => page.getByRole("heading", { name, exact: true }).waitFor();
  async function layouts(label, activeHref) {
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(async () => {
        window.scrollTo(0, 0);
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: ${width}px overflow`);
      assert.equal(await page.locator("h1:visible").count(), 1, `${label}: one page heading`);
      const nav = page.getByRole("navigation", { name: width < 1024 ? "Mobilní navigace" : "Hlavní navigace" });
      assert.deepEqual(await nav.getByRole("link").allTextContents(), ["Učení", "Lab", "Pokrok"]);
      const active = nav.locator('[aria-current="page"]');
      assert.equal(await active.count(), activeHref ? 1 : 0);
      if (activeHref) assert.equal(await active.getAttribute("href"), activeHref);
      for (const link of await nav.getByRole("link").all()) {
        const box = await link.boundingBox();
        assert.ok(box && box.height >= 48, `${label}: navigation touch target`);
      }
      const account = page.getByLabel("Nabídka účtu", { exact: true });
      await account.focus();
      await account.press("Enter");
      for (const control of [page.getByRole("banner").getByRole("link", { name: "Nastavení", exact: true }), page.getByRole("banner").getByRole("button", { name: "Odhlásit se", exact: true })]) {
        const box = await control.boundingBox();
        assert.ok(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width, `${label}: account menu reflow`);
      }
      await account.press("Escape");
      assert.equal(await account.evaluate((el) => el === document.activeElement && !el.parentElement.open), true, "Escape closes the menu and returns focus");
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.evaluate(async () => {
      document.documentElement.style.fontSize = "200%";
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: enlarged text overflow`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${screenshotDir}/${label}-320-text-200.png`, fullPage: false, animations: "disabled" });
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${screenshotDir}/${label}-1440.png`, fullPage: false, animations: "disabled" });
  }
  await page.goto(`${baseURL}/sign-in`);
  await button("Vyzkoušet demo").click();
  await page.waitForURL("**/learn");
  const session = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json();
  assert.equal(session.user.isAnonymous, true);
  userId = session.user.id;
  const [xp] = await sql`select sum(xp)::int as total from lesson_award where user_id = ${userId}`;
  assert.equal(xp.total, 360);
  const receipts = await sql`select practice_capital_minor, reward_policy_version from lesson_award where user_id = ${userId}`;
  assert.equal(receipts.length, 6);
  assert.ok(receipts.every((receipt) => receipt.reward_policy_version === 4));
  assert.equal(receipts.reduce((sum, receipt) => sum + BigInt(receipt.practice_capital_minor), 0n), 200_000n, "the seeded Returns lesson carries 2,000 Kč");
  const [grant] = await sql`select practice_capital_minor from progression_unlock where user_id = ${userId} and unlock_id = 'PORTFOLIO_LAB'`;
  assert.equal(BigInt(grant.practice_capital_minor), 500_000n);
  await page.getByRole("region", { name: "Doporučeno pro tebe", exact: true }).waitFor();
  await layouts("learn", "/learn");
  await page.goto(`${baseURL}/dashboard`);
  await page.waitForURL("**/learn");
  await page.goto(`${baseURL}/settings`);
  await heading("Účet");
  await layouts("settings", null);
  await page.goto(`${baseURL}/progress`);
  await page.getByRole("heading", { level: 1, name: /^(Co už umíš|.+ máš za sebou\.)/ }).waitFor();
  assert.equal(await page.getByTestId("available-progress").textContent(), "6 / 29");
  await layouts("progress", "/progress");
  await page.goto(`${baseURL}/lab`);
  await heading("Co se stane, když…");
  await layouts("lab", "/lab");
  await page.getByRole("link", { name: /Nastavit pokus/ }).click();
  await button("Spustit backtest").click();
  const finalValue = page.getByTestId("metric-konečná-hodnota");
  await finalValue.waitFor();
  assert.equal((await finalValue.textContent()).replace(/\s/g, ""), "159732Kč");
  await page.locator(".recharts-surface").waitFor();
  await page.getByText("Ověř si porozumění", { exact: true }).click();
  await page.getByRole("radio", { name: "Největší propad", exact: true }).check();
  await button("Zkontrolovat odpověď").click();
  await page.getByRole("status").filter({ hasText: "Správně." }).waitFor();
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await page.getByRole("row").count(), 134, "full monthly table and initial value");
  await page.getByText("Zobrazit tabulku dat", { exact: true }).click();
  await layouts("backtesting", "/lab");
  await button("Změnit nastavení").click();
  await page.getByRole("textbox", { name: "Počáteční částka", exact: true }).fill("0");
  await button("Spustit backtest").click();
  await page.locator("main").getByRole("alert").waitFor();
  await page.getByRole("textbox", { name: "Počáteční částka", exact: true }).fill("100000");
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2025");
  await page.getByLabel("Do prosince", { exact: true }).selectOption("2020");
  await button("Spustit backtest").click();
  await page.locator("main").getByRole("alert").filter({ hasText: "počáteční rok" }).waitFor();
  await page.getByLabel("Od ledna", { exact: true }).selectOption("2020");
  await button("Spustit backtest").click();
  await page.locator("main").getByRole("alert").waitFor({ state: "hidden" });
  // Check the rendered run summary; the simulation intro repeats this period.
  await page.getByTestId("backtest-result-period").filter({ hasText: /^Leden 2020 – prosinec 2020 · 12 měsíců ·/ }).waitFor();
  await button("Změnit nastavení").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await button("Spustit backtest").evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  await page.goto(`${baseURL}/learn/returns/log-returns`);
  await page.locator("h1").waitFor();
  assert.equal(await page.getByRole("navigation", { name: /^(Hlavní|Mobilní) navigace$/ }).count(), 0, "lesson focus mode");
  await page.goto(`${baseURL}/learn`);
  await page.getByLabel("Nabídka účtu", { exact: true }).click();
  await button("Odhlásit se").click();
  await page.waitForURL("**/sign-in");
  await page.goto(`${baseURL}/lab`);
  await page.waitForURL("**/sign-in");
  assert.deepEqual(errors, [], "no browser runtime errors");
  console.log(`PASS: current demo receipts/grant, shell navigation/account keyboard and reflow, dashboard redirect, focus mode, sign-out/auth gate, Backtesting results/table/validation/reduced motion. Screenshots: ${screenshotDir}`);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
