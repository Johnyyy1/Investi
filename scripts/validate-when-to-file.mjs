import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.TAX_FILING_TEST_URL ?? "http://localhost:3183";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires local development runtime");
const screenshots = process.env.TAX_FILING_SCREENSHOT_DIR ?? "test-results/when-to-file";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`${baseURL}/dev/when-to-file`);
  await page.getByRole("heading", { name: "Kdy musí investor podat daňové přiznání", exact: true }).waitFor();
  assert.match(await page.locator("header").innerText(), /čeká na odbornou revizi/);
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  const check = () => page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  async function choice(label) { await page.getByRole("radio", { name: label, exact: true }).check(); await check(); }
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  for (let step = 0; step < 14; step++) {
    await page.getByText(`Krok ${step + 1} z 14`, { exact: true }).waitFor();
    console.log(`Checking tax filing step ${step + 1}/14`);
    if (step === 0) {
      const radio = page.getByRole("radio", { name: "Osvobození prodeje, druh dividend a podmínky zaměstnanecké výjimky.", exact: true });
      await radio.focus();
      assert.equal(await radio.evaluate((node) => node === document.activeElement), true);
      await page.keyboard.press("Space");
      await check();
    }
    if (step === 4) {
      // The tree is practice, not a graded requirement or personal tax advice.
      await page.getByRole("button", { name: "Ne", exact: true }).click();
      await page.getByRole("button", { name: "Ano", exact: true }).click();
      await page.getByRole("button", { name: "Nepřesahují", exact: true }).click();
      assert.match(await page.locator("main").innerText(), /Kvůli těmto modelovým příjmům povinnost nevzniká/);
    }
    if (step === 5) {
      await choice("Ne, zahraniční srážka vyřeší i českou povinnost.");
      assert.match(await page.locator("main").innerText(), /Zahraniční srážku nezaměňuj/);
      assert.equal(await page.getByRole("button", { name: "Pokračovat", exact: true }).count(), 0);
      await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
      await choice("Ano, započitatelné jiné příjmy přesahují zaměstnaneckou hranici.");
    }
    if (step === 6) await choice("Ne, do této hranice se nezapočítávají.");
    if (step === 7) {
      await page.getByLabel("Hrubý příjem z prodeje", { exact: true }).fill("150000");
      await page.getByLabel("Rozdíl proti nákupní ceně", { exact: true }).fill("30000");
      await check();
    }
    if (step === 8) await choice("Ano, prodej není osvobozený a hrubý příjem přesahuje obecnou hranici.");
    if (step === 9) await choice("Ne, daňová ztráta je samostatný důvod k podání.");
    if (step === 11) await choice("Osvobozené příjmy a příjmy s českou konečnou srážkou podle zvláštní sazby.");
    if (step === 12) {
      await page.getByRole("textbox").fill("Rozliším osvobození, českou srážku a hrubé příjmy. Ověřím rok, zaměstnanecké podmínky a nejasnosti u poradce.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
    }
    if (step === 13) {
      assert.match(await page.locator("main").innerText(), /Vzdělávací obsah/);
      assert.match(await page.locator("main").innerText(), /Neověřeno/);
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await noOverflow(), true, `Step ${step + 1} at ${width}px`);
      if (width !== 320) await page.screenshot({ path: `${screenshots}/step-${String(step + 1).padStart(2, "0")}-${width}.png`, fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    const style = await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    assert.equal(await noOverflow(), true, `Step ${step + 1} at 200% text`);
    await style.evaluate((node) => node.remove());
    if (step < 13) {
      await next();
      await page.locator("section > h2").evaluate((node) => { if (node !== document.activeElement) throw new Error("Step heading must receive focus"); });
    }
  }
  assert.deepEqual(posts, [], "Draft must not persist progress, private inputs or rewards");
  assert.deepEqual(errors, [], "No browser errors");
  await page.goto(`${baseURL}/learn/czech-taxes/when-to-file`);
  if (new URL(page.url()).pathname === "/sign-in") {
    await page.getByRole("heading", { name: "Vítej zpět", exact: true }).waitFor();
  } else {
    await page.getByRole("heading", { name: "Tuhle stránku jsme nenašli", exact: true }).waitFor();
  }
  assert.equal(await page.getByText("Modelový příklad · Jana je česká daňová rezidentka.", { exact: false }).count(), 0, "Public route never renders the draft");
  console.log("Tax filing: 14 steps, retry, decision tree, public gate, no mutations, keyboard, focus, 320/390/1440px and 200% text passed.");
} finally { await browser.close(); }
