import { finishOnboarding } from "./onboarding-helper.mjs";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.INSTRUMENT_UNAVAILABLE_TEST_URL ?? "http://localhost:3104";
const screenshotDir = process.env.INSTRUMENT_UNAVAILABLE_SCREENSHOT_DIR ?? "/tmp/investi-instrument-unavailable-qa";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires local app and database.");
await mkdir(screenshotDir, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `instrument-unavailable-${randomUUID()}@example.com`;
const password = randomUUID();
let userId;

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 }, timezoneId: "Europe/Prague" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Instrument Unavailable QA", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  // Instrument Detail is part of Portfolio Lab, so this isolated fixture must
  // explicitly cross the same entitlement boundary as the Portfolio suite.
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at)
    values (${userId}, 'PORTFOLIO_LAB', 0, 'test_fixture', now())`;

  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL`);
  await page.getByRole("heading", { name: "Apple Inc." }).waitFor();
  assert.match(await page.locator("main").innerText(), /Zastaralá cena/, "old quote is labeled stale rather than live");
  assert.equal(await page.getByRole("img", { name: /denní graf závěrečných cen očištěných o splity/ }).count(), 1, "historical chart remains visible when the quote is stale");
  await page.screenshot({ path: `${screenshotDir}/stale-quote-history-available-1440.png`, fullPage: true });

  await page.goto(`${baseURL}/lab/instruments/US-XNAS%3AAAPL?range=1M`);
  await page.getByRole("status").filter({ hasText: "Cenová historie pro toto období není dostupná" }).waitFor();
  assert.equal(await page.getByRole("img", { name: /denní graf závěrečných cen/ }).count(), 0, "an empty range never fabricates chart points");
  assert.equal(await page.getByText("Přiblížit graf", { exact: true }).count(), 0, "unavailable history has no zoom controls");
  await page.screenshot({ path: `${screenshotDir}/history-unavailable-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "unavailable detail supports 320px and 200% text");
  await page.screenshot({ path: `${screenshotDir}/history-unavailable-320-200-percent.png`, fullPage: true });

  await page.goto(`${baseURL}/lab/instruments/FMP%3ANASDAQ%3AA%25ZZ`);
  await page.getByRole("heading", { name: "Tato stránka není k dispozici" }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Apple Inc." }).count(), 0, "malformed encoded provider identity never renders instrument data");
  assert.deepEqual(errors, [], "partial and invalid detail states have no browser errors");
  console.log("PASS: stale quote retains history, unavailable range has no fabricated chart, invalid route renders not-found, and 320px/200% text has no overflow. Screenshots:", screenshotDir);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
