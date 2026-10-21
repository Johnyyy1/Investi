import { finishOnboarding } from "./onboarding-helper.mjs";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.NOT_FOUND_TEST_URL ?? "http://localhost:3104";
const screenshotDir = process.env.NOT_FOUND_SCREENSHOT_DIR ?? "/tmp/investi-not-found-qa";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires local app and database.");
await mkdir(screenshotDir, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `not-found-${randomUUID()}@example.com`;
const password = randomUUID();
let userId;

async function assertReflows(page, name) {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} has no horizontal overflow at ${width}px`);
    await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} supports 320px and 200% text`);
  await page.screenshot({ path: `${screenshotDir}/${name}-320-200-percent.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 900 });
}

const heading = (page, name) => page.getByRole("heading", { level: 1, name, exact: true }).waitFor();
const link = (page, name) => page.getByRole("link", { name, exact: true });

try {
  const errors = [];

  // Marketing typo, signed out: generic copy, title, a way home, and no route into the signed-in app.
  const visitor = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  visitor.on("pageerror", (error) => errors.push(error.message));
  const response = await visitor.goto(`${baseURL}/cenik-neexistuje`);
  assert.equal(response?.status(), 404, "an unmatched URL answers 404");
  await heading(visitor, "Tuhle stránku jsme nenašli");
  assert.equal(await visitor.title(), "Stránka nenalezena · Investník");
  assert.doesNotMatch(await visitor.locator("main").innerText(), /lekc/i, "the generic 404 does not talk about lessons");
  assert.equal(await link(visitor, "Pokračovat v učení").count(), 0, "a visitor is not sent through sign-in");
  assert.equal(await link(visitor, "Investník · úvodní stránka").getAttribute("href"), "/");
  await assertReflows(visitor, "marketing-404");
  await link(visitor, "Na úvodní stránku").click();
  await visitor.waitForURL(`${baseURL}/`);
  await visitor.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
  page.on("pageerror", (error) => errors.push(error.message));
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Not Found QA", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;

  // Unmatched URL, signed in: the same page also offers the way back to Učení.
  await page.goto(`${baseURL}/lab/neexistuje`);
  await heading(page, "Tuhle stránku jsme nenašli");
  assert.equal(await link(page, "Pokračovat v učení").getAttribute("href"), "/learn");
  assert.equal(await link(page, "Úvodní stránka").getAttribute("href"), "/");

  // Unknown lesson and unknown module share the lesson-specific state.
  for (const path of ["/learn/returns/lekce-neexistuje", "/learn/modul-neexistuje"]) {
    await page.goto(`${baseURL}${path}`);
    await heading(page, "Tahle lekce zatím není k dispozici");
    assert.equal(await page.getByRole("heading", { name: "Tuhle stránku jsme nenašli" }).count(), 0);
  }
  await assertReflows(page, "lesson-404");
  await link(page, "Zpět na Učení").click();
  await page.waitForURL(`${baseURL}/learn`);

  // Instrument Detail sits behind the Portfolio Lab entitlement.
  await sql`insert into progression_unlock (user_id, unlock_id, practice_capital_minor, reason, unlocked_at)
    values (${userId}, 'PORTFOLIO_LAB', 0, 'test_fixture', now())`;
  for (const path of ["/lab/instruments/US-XNAS%3AZZZZ", "/lab/instruments/FMP%3ANASDAQ%3AA%25ZZ"]) {
    await page.goto(`${baseURL}${path}`);
    await heading(page, "Tenhle instrument jsme nenašli");
    assert.equal(await page.locator("main").getByText(/Kč|USD|EUR/).count(), 0, `${path} shows no price`);
  }
  await assertReflows(page, "instrument-404");
  await link(page, "Zpět do Portfolio Labu").click();
  await page.waitForURL(`${baseURL}/lab/portfolio`);

  assert.deepEqual(errors, [], "not-found pages raise no browser errors");
  console.log("PASS: marketing 404 (status, title, visitor and learner actions), lesson and module 404, instrument 404, 320px/200% reflow. Screenshots:", screenshotDir);
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
}
