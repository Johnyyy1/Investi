import { finishOnboarding } from "./onboarding-helper.mjs";
// Local integration test: creates and removes only its own disposable learner.
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.RETURNS_TEST_URL ?? "http://localhost:3000";
const loopback = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(loopback(new URL(baseURL).hostname) && loopback(new URL(process.env.DATABASE_URL).hostname), "This disposable-account test is restricted to local app/database hosts.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const email = `returns-migration-${randomUUID()}@example.com`;
const password = randomUUID();
const lessonId = "returns-compounding";
const route = "/learn/returns/compounding-and-cumulative-returns";
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
let userId;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (["warning", "error"].includes(message.type())) errors.push(message.text()); });
  const heading = async (name) => page.getByRole("heading", { name, exact: true }).waitFor();
  const next = async (name) => { await page.getByRole("button", { name: "Pokračovat", exact: true }).click(); await heading(name); };
  // Steps advance before the cursor is saved; wait for the save before reading the database or leaving.
  const saved = async () => page.locator('main[data-save-state="idle"]').waitFor();
  const row = async () => (await sql`select status, last_position, completed_at from lesson_progress where user_id = ${userId} and lesson_id = ${lessonId}`)[0];
  const overflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  async function signIn() {
    await page.goto(`${baseURL}/sign-in`);
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(email);
    await page.getByRole("textbox", { name: "Heslo", exact: true }).fill(password);
    await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
    await page.waitForURL("**/learn");
    await page.getByRole("heading", { level: 1, name: "Vítej zpátky, Returns.", exact: true }).waitFor();
  }
  async function signOut() {
    const response = await page.request.post(`${baseURL}/api/auth/sign-out`, { data: {}, headers: { Origin: baseURL } });
    assert.equal(response.ok(), true);
    await page.goto(`${baseURL}${route}`);
    await page.waitForURL("**/sign-in");
  }

  // Registration now ends onboarding; create the account directly, then onboard as a signed-in learner.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Returns integration QA", email, password } })).ok());
  await page.goto(`${baseURL}/onboarding`);
  await finishOnboarding(page); // Ends on /learn (Studovna) for a fresh learner.
  await page.getByRole("heading", { level: 1, name: "Vítej v investi, Returns.", exact: true }).waitFor();
  [{ id: userId }] = await sql`select id from "user" where email = ${email}`;
  assert.equal(await page.locator(".learning-theme").count(), 1, "Learn uses the shared theme");
  // Studovna chapters list lessons directly; the Returns module page has no link from /learn any more.
  assert.equal(await page.getByRole("list", { name: "Lekce kapitoly Výnosy", exact: true }).locator(`a[href="${route}"]`).count(), 1, "Learn lists the Returns lessons");
  await page.goto(`${baseURL}/learn/returns`);
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "0 / 5 lekcí dokončeno");
  const compounding = page.getByRole("listitem").filter({ hasText: "Složené a kumulativní výnosy" });
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow();
    const mobileNav = page.getByRole("navigation", { name: "Mobilní navigace" });
    assert.equal(await mobileNav.isVisible(), width < 1024);
  }
  assert.equal(await page.getByRole("listitem").filter({ hasText: "Kontrola výnosů" }).getByRole("button").count(), 0);
  await compounding.getByRole("button", { name: "Začít lekci" }).click();
  await heading("Od jednoho období k posloupnosti");
  assert.equal(await page.getByRole("navigation", { name: /^(Hlavní|Mobilní) navigace$/ }).count(), 0, "Lesson mode has no app navigation");
  await next("Předpověz výsledek");
  await saved();
  assert.equal((await row()).status, "in_progress");
  assert.equal((await row()).last_position, 1);
  await page.goto(`${baseURL}/learn/returns`);
  await heading("Výnos a složené zhodnocení");
  assert.equal(await compounding.getByRole("button", { name: "Pokračovat v lekci", exact: true }).isVisible(), true);
  await compounding.getByRole("button", { name: "Pokračovat v lekci", exact: true }).click();
  await heading("Předpověz výsledek");
  // Saves revalidate nothing, so leaving the lesson must drop the Back/Forward cache: a stale restore
  // would reopen the lesson at its old starting step and its next save would move the cursor backwards.
  await page.getByRole("button", { name: "Předchozí", exact: true }).click();
  await heading("Od jednoho období k posloupnosti");
  await saved();
  await page.goBack();
  await heading("Výnos a složené zhodnocení");
  await page.goForward();
  await heading("Od jednoho období k posloupnosti");
  assert.equal(await page.getByRole("heading", { name: "Předpověz výsledek", exact: true }).count(), 0, "Forward restores the saved step, not a cached one");
  await next("Předpověz výsledek");
  await saved();
  assert.equal((await row()).last_position, 1);
  await page.reload();
  await heading("Předpověz výsledek");
  await page.getByRole("radio").first().press("Space");
  await page.getByRole("radio").first().press("ArrowDown");
  await page.getByRole("radio").nth(1).press("Tab");
  // The sticky action bar reads left to right: Předchozí, then the check.
  assert.equal(await page.getByRole("button", { name: "Předchozí", exact: true }).evaluate((element) => element === document.activeElement), true);
  await page.keyboard.press("Tab");
  const check = page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true });
  assert.equal(await check.evaluate((element) => element === document.activeElement && element.matches(":focus-visible")), true);
  await check.press("Enter");
  await heading("Správně");
  assert.equal(await page.getByRole("button", { name: "Pokračovat", exact: true }).evaluate((element) => element === document.activeElement), true);
  // A failed save returns the learner to the unsaved step with the answer kept, and Continue retries it.
  const failSave = (intercepted) => intercepted.request().method() === "POST" && intercepted.request().headers()["next-action"] ? intercepted.fulfill({ status: 500, body: "" }) : intercepted.fallback();
  await page.route(`${baseURL}${route}`, failSave);
  await next("Počáteční hodnota se mění");
  const saveError = page.getByRole("alert").filter({ hasText: "Postup se nepodařilo uložit. Zkus to znovu." });
  await saveError.waitFor();
  await heading("Předpověz výsledek");
  await heading("Správně");
  assert.equal(await page.getByRole("button", { name: "Pokračovat", exact: true }).evaluate((element) => element === document.activeElement), true, "Retry focuses Continue");
  await saved();
  assert.equal((await row()).last_position, 1, "A failed save leaves the cursor where it was");
  await page.unroute(`${baseURL}${route}`, failSave);
  // The 500 is induced on purpose; only its resource error is expected in the console.
  errors.splice(0, errors.length, ...errors.filter((message) => !message.includes("status of 500")));
  await next("Počáteční hodnota se mění");
  assert.equal(await saveError.count(), 0, "Continuing clears the save error");
  await saved();
  assert.equal((await row()).last_position, 2);
  await next("Přemýšlej v růstových faktorech");
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("0,96");
  await check.click();
  await heading("Správně");
  await next("Vynásob růstové faktory");
  assert.equal(await page.locator("math").count(), 2);
  await page.setViewportSize({ width: 320, height: 800 });
  await overflow();
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("2200");
  await check.click();
  await heading("Správně");
  await next("Prozkoumej složené zhodnocení");
  await page.getByText("96,00", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Počáteční hodnota", exact: true }).fill("");
  await page.getByRole("alert").filter({ hasText: "Pole „Počáteční hodnota“ je povinné." }).waitFor();
  assert.equal(await page.locator(".recharts-wrapper").count(), 0);
  await page.getByRole("textbox", { name: "Počáteční hodnota", exact: true }).fill("10000");
  await page.getByRole("textbox", { name: "Výnos za období 2", exact: true }).fill("-101");
  await page.getByRole("alert").filter({ hasText: "nemůže být nižší než −100 %" }).waitFor();
  await page.getByRole("textbox", { name: "Výnos za období 2", exact: true }).fill("-20");
  await page.getByRole("button", { name: "Přidat období", exact: true }).click();
  await page.getByRole("button", { name: "Odebrat období 3", exact: true }).click();
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => {
      const chart = document.querySelector(".recharts-wrapper");
      return chart && Math.abs(chart.getBoundingClientRect().width - chart.closest(".recharts-responsive-container").getBoundingClientRect().width) < 2;
    });
    await overflow();
    console.log(`Production layout and chart: ${width}px passed`);
  }
  await page.getByText("Zobrazit tabulku dat", { exact: true }).press("Enter");
  assert.equal(await page.getByRole("cell", { name: "9 600", exact: true }).isVisible(), true);
  await saved();
  await signOut();
  await signIn();
  await page.goto(`${baseURL}${route}`);
  await heading("Prozkoumej složené zhodnocení");
  assert.equal((await row()).last_position, 5);
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("21");
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await heading("Správně");
  await next("Propoj výnosy s cenami");
  await page.getByRole("textbox", { name: "100 → 110", exact: true }).fill("10");
  await page.getByRole("textbox", { name: "110 → 99", exact: true }).fill("-10");
  assert.equal(await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).isDisabled(), true);
  await page.getByRole("textbox", { name: "Kumulativní výnos", exact: true }).fill("-1");
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await heading("Správně");
  await next("Zotavení po ztrátě");
  for (const [loss, recovery] of [[10, "+11,11 %"], [20, "+25 %"], [50, "+100 %"]]) {
    await page.getByRole("button", { name: `Zkusit −${loss}%`, exact: true }).click();
    await page.getByText(recovery, { exact: true }).waitFor();
  }
  await page.getByRole("textbox", { name: "Velikost ztráty", exact: true }).fill("");
  assert.equal(await page.getByRole("textbox", { name: "Velikost ztráty", exact: true }).getAttribute("aria-invalid"), "true");
  await page.getByRole("button", { name: "Zkusit −50%", exact: true }).click();
  await page.getByRole("textbox", { name: "Tvoje odpověď", exact: true }).fill("100");
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await heading("Správně");
  await next("Ověř si porozumění");
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await heading("Zkus to ještě jednou");
  await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await heading("Správně");
  await next("Spoj si to dohromady");
  assert.equal((await row()).status, "in_progress", "Reaching the end does not auto-complete");
  await page.getByRole("button", { name: "Dokončit lekci", exact: true }).click();
  await heading("Lekce dokončena");
  assert.match(await page.getByTestId("completion-progress").textContent(), /Počet dokončených dostupných lekcí.*: 1/);
  const completed = await row();
  assert.equal(completed.status, "completed");
  await page.getByRole("link", { name: "Zobrazit modul", exact: true }).click();
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "1 / 5 lekcí dokončeno");
  await page.reload();
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "1 / 5 lekcí dokončeno");
  await signOut();
  await signIn();
  await page.goto(`${baseURL}/learn/returns`);
  await heading("Výnos a složené zhodnocení");
  assert.equal(await page.getByTestId("module-progress").textContent(), "1 / 5 lekcí dokončeno");
  await compounding.getByRole("button", { name: "Zopakovat lekci" }).click();
  await heading("Od jednoho období k posloupnosti");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await next("Předpověz výsledek");
  assert.equal(await page.getByRole("button", { name: "Předchozí" }).evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
  assert.deepEqual(await row(), completed, "Review never modifies persisted completion or cursor");
  await page.goto(`${baseURL}/learn/returns/simple-returns`);
  assert.equal(await page.locator(".learning-theme").count(), 1, "Lesson 2 uses the shared theme");
  const actionableErrors = errors.filter((message) => !message.startsWith("You have Reduced Motion enabled on your device."));
  assert.deepEqual(actionableErrors, [], "No unexpected console or hydration errors");
  console.log("All lesson steps, feedback, explorers, explicit completion, refresh, sign-out/sign-in, review, and reduced motion passed.");
} finally {
  await browser.close();
  // Constrained to the exact generated account; FK cascades remove only its test sessions/progress.
  if (userId) await sql`delete from "user" where id = ${userId} and email = ${email}`;
  await sql.end();
}
