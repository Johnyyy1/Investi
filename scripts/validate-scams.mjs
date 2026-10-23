import "dotenv/config";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.SCAMS_TEST_URL ?? "http://localhost:3150";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires local development runtime");
assert.ok(process.env.DATABASE_URL && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL).hostname), "Requires a disposable local database for the publication-gate check");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
let userId;
const screenshots = process.env.SCAMS_SCREENSHOT_DIR ?? "test-results/scams";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`${baseURL}/dev/scams-and-finfluencers`);
  await page.getByRole("heading", { name: "Podvody, slibované výnosy a finfluenceři", exact: true }).waitFor();
  assert.match(await page.locator("main > header").innerText(), /čeká na odbornou revizi/);
  await page.getByLabel("Platnost vzdělávacího obsahu").getByText(/stav k/).waitFor();
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  const check = () => page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  const retry = () => page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
  const choices = new Map([
    [3, "Oprávnění je v modelu ověřené; výnos ani vhodnost produktu to nezaručuje."],
    [4, "Zastavím kontakt: jde o podezření na podvod a nic neposílám."],
    [6, "Ověřit rozsah oprávnění, smluvní entitu, domovský dohled a ochranu majetku."],
    [9, "Nepodložený slib výnosu a neobjasněný finanční zájem autora."],
    [10, "Ihned kontaktovat banku oficiální cestou z bezpečného zařízení."],
    [12, "V JERRS ČNB: právní identitu a rozsah oprávnění; zvlášť kontakty a varování."],
  ]);
  for (let step = 0; step < 15; step++) {
    console.log(`Checking scams step ${step + 1}/15`);
    await page.getByText(`Krok ${step + 1} z 15`, { exact: true }).waitFor();
    // Check every screen before answering, including enlarged text on the narrowest viewport.
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Step ${step + 1} at ${width}`);
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    const zoom = await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Step ${step + 1} at 200% text`);
    if (step === 14) await page.screenshot({ path: `${screenshots}/summary-320-text-200.png`, fullPage: true });
    await zoom.evaluate((node) => node.remove());
    if (step === 0) {
      await page.getByRole("radio", { name: "Zastavit kontakt a nezávisle ověřit poskytovatele", exact: true }).check();
      await page.getByText("Získáš prostor bez nátlaku", { exact: true }).waitFor();
    }
    if (step === 1) {
      const checkbox = page.getByRole("checkbox", { name: "Označit řádek: Zaručíme 8 % měsíčně bez rizika.", exact: true });
      await checkbox.focus(); await page.keyboard.press("Space");
      assert.equal(await checkbox.isChecked(), true, "Native keyboard selection");
      assert.equal(await checkbox.evaluate((node) => parseFloat(getComputedStyle(node.closest("label")).outlineWidth) > 0), true, "Visible keyboard focus");
      await check();
      await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Pokračovat", exact: true }).count(), 0);
      await retry();
      for (const label of ["Zaručíme 8 % měsíčně bez rizika.", "Zaplaťte do hodiny, jinak místo propadne.", "Umožněte nám vzdálený přístup.", "Pošlete krypto na mou soukromou adresu."]) await page.getByRole("checkbox", { name: `Označit řádek: ${label}`, exact: true }).check();
      await check();
    }
    if (choices.has(step)) {
      const answer = page.getByRole("radio", { name: choices.get(step), exact: true });
      // Each required decision must reject a wrong answer and allow correction.
      for (const radio of await page.getByRole("radio").all()) {
        if (await radio.getAttribute("value") !== await answer.getAttribute("value")) { await radio.check(); break; }
      }
      await check();
      await page.getByRole("heading", { name: "Zkus to ještě jednou", exact: true }).waitFor();
      await retry();
      await answer.focus(); await page.keyboard.press("Space"); await check();
    }
    if (step === 13) {
      await page.getByRole("textbox").fill("Záruka, nátlak a vzdálený přístup. Licence nebrání poklesu trhu. Ukončím hovor a ověřím identitu mimo reklamu.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
    }
    {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Feedback ${step + 1} at ${width}`);
        await page.screenshot({ path: `${screenshots}/step-${step + 1}-${width}.png`, fullPage: true });
      }
    }
    if (step < 14) await next();
  }
  assert.deepEqual(posts, [], "Unpublished preview must never mutate learner state");
  assert.deepEqual(errors, [], "No hydration or browser errors");
  await page.getByRole("button", { name: "Projít náhled znovu", exact: true }).click();
  await page.getByRole("heading", { name: "Pavlova nabídka", exact: true }).waitFor();
  const signed = await page.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL }, data: {} });
  assert.ok(signed.ok(), await signed.text());
  userId = (await signed.json()).user.id;
  await page.goto(`${baseURL}/learn/before-investing/scams-and-finfluencers`);
  await page.getByRole("heading", { name: "Tahle lekce zatím není k dispozici", exact: true }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "Pavlova nabídka", exact: true }).count(), 0);
  assert.deepEqual(errors, [], "No browser errors during the publication-gate check");
  console.log("Scams draft: full walkthrough, wrong/retry flow, keyboard, no mutations, publication gate, 320/390/1440px and 200% text passed.");
} finally {
  await browser.close();
  if (userId) await sql`delete from "user" where id=${userId} and is_anonymous=true`;
  await sql.end();
}
