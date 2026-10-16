import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.FOUNDATIONS_TEST_URL ?? "http://localhost:3000";
const screenshotDir = process.env.FOUNDATIONS_SCREENSHOT_DIR ?? "/tmp/investi-foundations-phase-6a2";
const local = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required");
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Requires a local app and database");

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const email = `foundations-6a2-${randomUUID()}@example.com`;
const password = randomUUID();
let userId;
await mkdir(screenshotDir, { recursive: true });

async function answerChoice(page, label) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
}

async function answerNumber(page, value) {
  await page.getByLabel("Tvoje odpověď", { exact: true }).fill(String(value));
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
}

async function continueTo(page, heading) {
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}

async function completeLesson(page, expectedXp) {
  await page.getByRole("button", { name: "Dokončit lekci", exact: true }).click();
  await page.getByRole("heading", { name: "Lekce dokončena", exact: true }).waitFor();
  await page.getByText("+60 XP", { exact: true }).waitFor();
  const [{ xp }] = await sql`select coalesce(sum(xp), 0)::int as xp from lesson_award where user_id = ${userId}`;
  assert.equal(xp, expectedXp);
  const [{ capital }] = await sql`select coalesce(sum(practice_capital_minor), 0)::bigint::text as capital from lesson_award where user_id = ${userId}`;
  assert.equal(capital, "0", "v2 lesson receipts add no Practice Capital");
}

async function nextLesson(page, heading) {
  await page.getByRole("button", { name: "Další lekce", exact: true }).click();
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
}

async function assertResponsive(page, label, screenshotAt = []) {
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
    assert.ok(overflow.document <= overflow.viewport, `${label} overflows at ${width}px: ${JSON.stringify(overflow)}`);
    if (screenshotAt.includes(width)) await page.screenshot({ path: `${screenshotDir}/${label}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (["warning", "error"].includes(message.type()) && !message.text().startsWith("You have Reduced Motion enabled")) errors.push(message.text()); });

  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Foundations learner", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page);
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;

  await page.goto(`${baseURL}/learn/investing-foundations`);
  await page.getByRole("heading", { name: "Základy investování", exact: true }).waitFor();
  assert.equal(await page.getByTestId("module-progress").textContent(), "0 / 7 lekcí dokončeno");
  await page.getByText("0 / 420 XP", { exact: true }).waitFor();
  await page.getByText("Zamčeno · dokonči základy", { exact: true }).waitFor();
  await assertResponsive(page, "01-foundations-overview", [1440]);

  await page.getByRole("button", { name: "Začít lekci", exact: true }).first().click();
  await page.getByRole("heading", { level: 2, name: "Spoření vs. investování", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/02-saving-vs-investing-1440.png`, fullPage: true });
  await continueTo(page, "Peníze v obálce");

  // Keyboard-only wrong answer → explanation → retry → correct answer.
  await page.getByLabel("Nic. Pořád je to 10 000 Kč, koupím za ně stejně.", { exact: true }).focus();
  await page.getByLabel("Nic. Pořád je to 10 000 Kč, koupím za ně stejně.", { exact: true }).press("Space");
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).focus();
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/06-incorrect-retry-state-1440.png`, fullPage: true });
  await page.getByRole("button", { name: "Zkusit znovu", exact: true }).press("Enter");
  // Retry moves focus to the first option on the next frame; a key pressed before then would land on that option instead.
  await page.waitForFunction(() => {
    const labelId = document.activeElement?.getAttribute("aria-labelledby");
    return Boolean(labelId && document.getElementById(labelId)?.textContent?.includes("Nic. Pořád je to 10 000 Kč"));
  });
  await page.getByLabel("Koupím si za ně o něco méně.", { exact: true }).press("Space");
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  await page.getByRole("button", { name: "Pokračovat", exact: true }).press("Enter");
  await page.getByRole("heading", { name: "Lekce hotová", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Lekce hotová", exact: true }).waitFor();
  assert.equal((await sql`select last_position from lesson_progress where user_id = ${userId} and lesson_id = 'foundations-why-invest'`)[0].last_position, 2);
  await completeLesson(page, 60);
  await page.screenshot({ path: `${screenshotDir}/07-lesson-complete-60xp-1440.png`, fullPage: true });

  await nextLesson(page, "Začni vlastnictvím");
  await answerChoice(page, "Vlastnický podíl ve firmě");
  await answerNumber(page, 450);
  await continueTo(page, "Tržní cena není vnitřní hodnota");
  await continueTo(page, "Ověření znalostí · přepočet pozice");
  await answerNumber(page, 360);
  await answerChoice(page, "Jedna akcie se právě obchoduje za 75 Kč");
  await page.getByRole("heading", { name: "Čti pozici jako počet × cena", exact: true }).waitFor();
  await completeLesson(page, 120);

  await nextLesson(page, "Ukazatel, nebo fond?");
  await answerChoice(page, "Podíly ETF");
  await continueTo(page, "Podívej se pod název fondu");
  await page.screenshot({ path: `${screenshotDir}/03-etf-holdings-1440.png`, fullPage: true });
  await continueTo(page, "Mnoho pozic může být stále koncentrovaných");
  await answerChoice(page, "Ne, největší váhy mohou stále ovládat výsledek");
  await answerChoice(page, "ETF může sledovat index, ale fond a ukazatel jsou dvě různé věci");
  await answerChoice(page, "Má na výsledek ETF větší vliv než pozice s vahou 5 %");
  await page.getByRole("heading", { name: "Zkoumej obsah, ne jen název", exact: true }).waitFor();
  await completeLesson(page, 180);

  await nextLesson(page, "Hotovost má v portfoliu svůj úkol");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${screenshotDir}/09-mobile-lesson-390.png`, fullPage: true });
  await answerChoice(page, "Vysoká likvidita a malé kolísání nominální hodnoty");
  await continueTo(page, "Dluhopis představuje půjčku");
  await continueTo(page, "Proč se cena staršího dluhopisu mění");
  await continueTo(page, "Ověření znalostí · vztah k emitentovi");
  await answerChoice(page, "Půjčuješ emitentovi peníze");
  await answerChoice(page, "Tržní cena staršího dluhopisu bude mít tendenci klesnout");
  await page.getByRole("heading", { name: "Rozpoznej úkol každého aktiva", exact: true }).waitFor();
  await completeLesson(page, 240);

  await nextLesson(page, "Obchod potřebuje dvě strany");
  await answerChoice(page, "Jiný účastník trhu ochotný prodat");
  await continueTo(page, "Směr obchodu určuje cenu");
  await answerChoice(page, "Ask · 100,20 Kč");
  await answerNumber(page, 0.4);
  await continueTo(page, "Ověření znalostí · okamžitý prodej");
  await answerChoice(page, "Bid");
  await answerChoice(page, "Limitní nákupní pokyn na 100 Kč");
  await page.getByRole("heading", { name: "Věz, co kotace slibuje — a co ne", exact: true }).waitFor();
  await completeLesson(page, 300);

  await nextLesson(page, "Nejdřív odhadni, potom počítej");
  await page.setViewportSize({ width: 1440, height: 900 });
  await answerChoice(page, "96");
  await continueTo(page, "Spočítej jedno období");
  await answerNumber(page, 10);
  await page.getByRole("heading", { name: "Násob přes měnící se základ", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/04-returns-compounding-1440.png`, fullPage: true });
  await continueTo(page, "Ověření znalostí · výpočet ztráty");
  await page.screenshot({ path: `${screenshotDir}/06-mastery-state-1440.png`, fullPage: true });
  await answerNumber(page, -20);
  await answerNumber(page, 96);
  await page.getByRole("heading", { name: "Přenášej nový základ dál", exact: true }).waitFor();
  await completeLesson(page, 360);

  await nextLesson(page, "Portfolio je celý soubor majetku");
  await answerChoice(page, "Hotovost a aktuální hodnota všech pozic");
  await page.getByRole("heading", { name: "Váhy popisují vliv", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/05-portfolio-weights-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const scaledOverflow = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(scaledOverflow.document <= scaledOverflow.viewport, `Portfolio weights overflow at 320px/200%: ${JSON.stringify(scaledOverflow)}`);
  await page.screenshot({ path: `${screenshotDir}/10-portfolio-weights-320-text-200.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await continueTo(page, "Spočítej jednu váhu");
  await answerNumber(page, 40);
  await answerNumber(page, 2);
  await continueTo(page, "Ověření znalostí · váha akcie");
  await answerNumber(page, 20);
  await answerChoice(page, "Ne, stále záleží na vahách a společných rizicích");
  await page.getByRole("heading", { name: "Teď umíš číst portfolio", exact: true }).waitFor();
  await completeLesson(page, 420);
  await page.getByText(/Portfolio Lab odemčen · \+5\s000\sKč virtuálního kapitálu/).waitFor();
  await page.screenshot({ path: `${screenshotDir}/08-portfolio-lab-unlocked-1440.png`, fullPage: true });
  assert.equal((await sql`select count(*)::int as count from progression_unlock where user_id = ${userId} and unlock_id = 'PORTFOLIO_LAB'`)[0].count, 1);
  assert.equal((await sql`select practice_capital_minor from progression_unlock where user_id = ${userId} and unlock_id = 'PORTFOLIO_LAB'`)[0].practice_capital_minor, "500000");

  await page.getByRole("button", { name: "Otevřít Portfolio Lab", exact: true }).click();
  await page.getByTestId("portfolio-cash").filter({ hasText: /5\s000\sKč/ }).waitFor();
  await page.getByRole("combobox", { name: "Najdi, co chceš koupit", exact: true }).waitFor();
  await page.screenshot({ path: `${screenshotDir}/11-unlocked-portfolio-1440.png`, fullPage: true });

  await page.goto(`${baseURL}/learn/investing-foundations`);
  await page.getByText("7 / 7 lekcí dokončeno", { exact: true }).waitFor();
  await page.getByText("420 / 420 XP", { exact: true }).waitFor();
  await page.getByText("Odemčen", { exact: true }).waitFor();
  await assertResponsive(page, "01-foundations-overview-complete", [390]);

  // A completed learner sees the new lesson UI, while review leaves receipts untouched.
  const beforeReview = (await sql`select coalesce(sum(xp), 0)::int as xp, count(*)::int as receipts from lesson_award where user_id = ${userId}`)[0];
  await page.goto(`${baseURL}/learn/investing-foundations/why-invest`);
  await page.getByText("Lekce už je dokončena. Opakování uložený postup nezmění.", { exact: true }).waitFor();
  await continueTo(page, "Peníze v obálce");
  await answerChoice(page, "Koupím si za ně o něco méně.");
  await page.getByRole("heading", { name: "Lekce hotová", exact: true }).waitFor();
  await page.getByRole("button", { name: "Dokončit opakování", exact: true }).click();
  await page.getByRole("heading", { name: "Opakování dokončeno", exact: true }).waitFor();
  await page.getByText("Opakováním si znalost upevníš. Další XP ani virtuální kapitál se nepřipisují.", { exact: true }).waitFor();
  const afterReview = (await sql`select coalesce(sum(xp), 0)::int as xp, count(*)::int as receipts from lesson_award where user_id = ${userId}`)[0];
  assert.deepEqual(afterReview, beforeReview, "Review does not duplicate XP or a lesson receipt");
  assert.equal((await sql`select count(*)::int as count from progression_unlock where user_id = ${userId} and unlock_id = 'PORTFOLIO_LAB'`)[0].count, 1, "Review does not duplicate unlock");
  assert.deepEqual(errors, [], `Unexpected browser errors: ${JSON.stringify(errors)}`);

  console.log(`PASS: complete seven-lesson beginner journey, wrong-answer retry, reload, 420 XP, one-time 5,000 Kč unlock grant, usable Portfolio Lab, review compatibility, keyboard, mobile, responsive, and 200% text. Screenshots: ${screenshotDir}`);
  await context.close();
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
  await browser.close();
}
