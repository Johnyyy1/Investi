import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.PORTFOLIO_TEST_URL ?? "http://localhost:3000";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app and database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const screenshotDir = process.env.PROGRESSION_SCREENSHOT_DIR ?? "/tmp/investi-progression-qa";
await mkdir(screenshotDir, { recursive: true });
const ids = [];
const required = [
  { id: "foundations-why-invest", slug: "why-invest", finalPosition: 2 },
  { id: "foundations-stocks", slug: "stocks", finalPosition: 6 },
  { id: "foundations-etfs-indexes", slug: "etfs-and-indexes", finalPosition: 6 },
  { id: "foundations-bonds-cash", slug: "bonds-and-cash", finalPosition: 6 },
  { id: "foundations-markets", slug: "how-markets-work", finalPosition: 7 },
  { id: "foundations-risk-reward", slug: "risk-vs-reward", finalPosition: 6 },
  { id: "foundations-portfolio", slug: "your-first-portfolio", finalPosition: 7 },
];

async function signUp(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const email = `progression-browser-${randomUUID()}@example.com`;
  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  const password = randomUUID();
  const signup = () => page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: label, email, password } });
  let response = await signup();
  // Better Auth rate-limits sign-up; the UI flow used to space these out naturally.
  for (let attempt = 0; response.status() === 429 && attempt < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, (Number(response.headers()["retry-after"]) || 11) * 1000 + 1000));
    response = await signup();
  }
  assert.ok(response.ok(), `sign-up: ${response.status()}`);
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  const [{ id }] = await sql`select id from "user" where email = ${email}`;
  ids.push(id);
  return { page, context, id };
}
async function seedFinalCursor(userId, lessonId, position) {
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, updated_at)
    values (${userId}, ${lessonId}, 'in_progress', ${position}, now())
    on conflict (user_id, lesson_id) do update set last_position = excluded.last_position, updated_at = excluded.updated_at`;
}
async function grants(userId) {
  return sql`select * from progression_unlock where user_id = ${userId} and unlock_id = 'PORTFOLIO_LAB'`;
}
async function layout(page, name) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} overflows at ${width}px`);
    if ([320, 390, 1440].includes(width)) await page.screenshot({ path: `${screenshotDir}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const overflow = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth > innerWidth, width: document.documentElement.scrollWidth, viewport: innerWidth, elements: [...document.querySelectorAll("body *")].filter((element) => element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > innerWidth + 1 || element.getBoundingClientRect().left < -1).slice(0, 12).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 60), className: element.className?.toString().slice(0, 80), scroll: element.scrollWidth, client: element.clientWidth, left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right })) }));
  assert.equal(overflow.wide, false, `${name} overflows at 200% text: ${JSON.stringify(overflow)}`);
  await page.screenshot({ path: `${screenshotDir}/${name}-320-text-200.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 900 });
}

try {
  const { page, id } = await signUp("New learner");
  await page.goto(`${baseURL}/progress`);
  await page.getByTestId("total-xp").filter({ hasText: "0 XP" }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/progress-zero-1440.png`, fullPage: true });
  await page.goto(`${baseURL}/lab`);
  await page.getByRole("heading", { name: "Otevře se po Základech investování" }).waitFor();
  assert.equal(await page.getByText("0 / 7 lekcí Základů").count(), 1);
  assert.equal(await page.getByRole("link", { name: /Otevřít další lekci/ }).getAttribute("href"), "/learn/investing-foundations/why-invest");
  assert.equal(await page.getByRole("link", { name: /Nastavit pokus/ }).getAttribute("href"), "/lab/backtesting", "Backtesting stays open while Portfolio Lab is locked");
  const labNav = page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: /Lab/ });
  assert.equal(await labNav.getAttribute("href"), "/lab", "locked Lab navigation remains clickable");
  await labNav.focus();
  await labNav.press("Enter");
  await page.waitForURL(`${baseURL}/lab`);
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByRole("heading", { name: "Portfolio Lab", exact: true }).waitFor();
  assert.equal(await page.getByText("0 / 420 XP").count(), 1);
  assert.equal(await page.getByText("0 / 7 lekcí").count(), 1);
  assert.equal(await page.getByRole("button", { name: /Investovat/ }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Pozice" }).count(), 0);
  await layout(page, "locked-portfolio");

  await seedFinalCursor(id, required[0].id, required[0].finalPosition);
  await page.goto(`${baseURL}/learn/investing-foundations/why-invest`);
  await page.getByRole("button", { name: "Dokončit lekci" }).click();
  await page.getByRole("heading", { name: "Lekce dokončena" }).waitFor();
  await page.getByText("+60 XP").waitFor();
  await page.screenshot({ path: `${screenshotDir}/lesson-xp-1440.png`, fullPage: true });
  await page.goto(`${baseURL}/progress`);
  await page.getByTestId("total-xp").filter({ hasText: "60 XP" }).waitFor();
  assert.equal((await grants(id)).length, 0);
  await page.screenshot({ path: `${screenshotDir}/progress-60xp-1440.png`, fullPage: true });

  for (let index = 1; index < required.length - 1; index += 1) {
    const lesson = required[index];
    await seedFinalCursor(id, lesson.id, lesson.finalPosition);
    await page.goto(`${baseURL}/learn/investing-foundations/${lesson.slug}`);
    await page.getByRole("button", { name: "Dokončit lekci" }).click();
    await page.getByRole("heading", { name: "Lekce dokončena" }).waitFor();
    await page.getByText("+60 XP").waitFor();
    await page.goto(`${baseURL}/progress`);
    await page.getByTestId("total-xp").filter({ hasText: `${(index + 1) * 60} XP` }).waitFor();
    assert.equal((await grants(id)).length, 0, "unlock stays absent before final prerequisite");
  }
  await page.goto(`${baseURL}/progress`);
  await page.getByTestId("total-xp").filter({ hasText: "360 XP" }).waitFor();
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByText("360 / 420 XP").waitFor();
  assert.equal((await grants(id)).length, 0);

  await seedFinalCursor(id, required.at(-1).id, required.at(-1).finalPosition);
  await page.goto(`${baseURL}/learn/investing-foundations/your-first-portfolio`);
  await page.getByRole("button", { name: "Dokončit lekci" }).click();
  await page.getByRole("heading", { name: "Lekce dokončena" }).waitFor();
  await page.getByText("+60 XP").waitFor();
  await page.getByText(/Portfolio Lab odemčen · \+5\s000\sKč virtuálního kapitálu/).waitFor();
  await page.screenshot({ path: `${screenshotDir}/lesson-unlock-1440.png`, fullPage: true });
  await page.reload();
  assert.equal(await page.getByText("Portfolio Lab odemčen", { exact: false }).count(), 0, "unlock feedback is not replayed on reload");
  assert.equal(Number((await sql`select coalesce(sum(xp), 0)::int as xp from lesson_award where user_id = ${id}`)[0].xp), 420, "reload does not duplicate XP");
  assert.equal((await grants(id)).length, 1, "reload does not duplicate entitlement");
  await page.goto(`${baseURL}/progress`);
  await page.getByTestId("total-xp").filter({ hasText: "420 XP" }).waitFor();
  await page.getByTestId("total-practice-capital").filter({ hasText: /5\s000\sKč/ }).waitFor();
  await layout(page, "progress-unlocked");
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByTestId("portfolio-cash").filter({ hasText: /5\s000\sKč/ }).waitFor();
  await page.reload();
  await page.getByTestId("portfolio-cash").filter({ hasText: /5\s000\sKč/ }).waitFor();
  assert.equal((await grants(id)).length, 1, "refresh does not duplicate unlock grant");
  assert.equal((await grants(id))[0].practice_capital_minor, "500000");
  await page.screenshot({ path: `${screenshotDir}/portfolio-unlocked-1440.png`, fullPage: true });

  const legacy = await signUp("Existing portfolio learner");
  const portfolioId = randomUUID();
  await sql`insert into portfolio (id, user_id, base_currency, opened_at, opening_capital_minor)
    values (${portfolioId}, ${legacy.id}, 'CZK', now(), 0)`;
  await legacy.page.goto(`${baseURL}/lab/portfolio`);
  await legacy.page.getByTestId("portfolio-cash").filter({ hasText: "0 Kč" }).waitFor();
  assert.equal((await grants(legacy.id)).length, 1);
  assert.equal((await grants(legacy.id))[0].practice_capital_minor, "0", "grandfathered users receive no new capital");
  assert.equal((await sql`select count(*)::int as count from portfolio where user_id = ${legacy.id}`)[0].count, 1);
  await legacy.page.screenshot({ path: `${screenshotDir}/grandfathered-portfolio-1440.png`, fullPage: true });
  console.log("PASS: locked new user, XP progression, lesson unlock feedback, one-time grant, grandfathered portfolio, responsive layouts, and 200% text. Screenshots:", screenshotDir);
} finally {
  await browser.close();
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await sql.end();
}
