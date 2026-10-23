import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.EMERGENCY_FUND_TEST_URL ?? "http://localhost:3150";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires local development runtime");
const screenshots = process.env.EMERGENCY_FUND_SCREENSHOT_DIR ?? "test-results/emergency-fund";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`${baseURL}/dev/emergency-fund`);
  await page.getByRole("heading", { name: "Rezerva: kolik a kde", exact: true }).waitFor();
  assert.match(await page.locator("header").innerText(), /čeká na odbornou revizi/);
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  const check = () => page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  async function choice(label) { await page.getByRole("radio", { name: label, exact: true }).check(); await check(); }
  for (let step = 0; step < 12; step++) {
    console.log(`Checking emergency-fund step ${step + 1}/12`);
    if (step === 0) {
      await choice("Spolehnout se, že ETF příští měsíc vyroste.");
      await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
      await choice("Peníze oddělené v dostupné rezervě.");
    }
    if (step === 1) {
      await page.getByLabel("Tři měsíce", { exact: true }).fill("90000");
      await page.getByLabel("Šest měsíců", { exact: true }).fill("180000");
      await check();
    }
    if (step === 2) await choice("K šesti nebo více měsícům, podle závazků a výpadků zakázek.");
    if (step === 3) await choice("Spořicí účet s okamžitou dostupností a ověřeným pojištěním vkladu.");
    if (step === 6) {
      await page.getByRole("textbox").fill("1,00"); await check();
      assert.match(await page.locator("main").innerText(), /blízký odhad/);
      await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
      await page.getByRole("textbox").fill("0,98"); await check();
    }
    if (step === 8) {
      const calculator = page.getByRole("region", { name: "Kalkulačka rezervy", exact: true });
      await calculator.waitFor();
      assert.match(await calculator.innerText(), /0,46 %/);
      await page.getByLabel("Měsíční výdaje", { exact: true }).fill("41237,25");
      await page.getByLabel("Počet měsíců rezervy", { exact: true }).fill("6");
      assert.match(await calculator.innerText(), /247\s*423,5/);
      await page.getByLabel("Modelová roční sazba účtu", { exact: true }).fill("0");
      assert.match(await calculator.innerText(), /Kupní síla v tomto modelu klesá/);
      await page.getByLabel("Měsíční výdaje", { exact: true }).fill("");
      assert.equal(await calculator.getByRole("region", { name: "Výsledek rezervy" }).count(), 0);
      await page.getByLabel("Měsíční výdaje", { exact: true }).fill("30000");
      await page.getByLabel("Modelová roční sazba účtu", { exact: true }).fill("3,5");
      await page.getByLabel("Počet měsíců rezervy", { exact: true }).focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Modelová roční sazba účtu", { exact: true }).evaluate((node) => node === document.activeElement), true);
      assert.equal(await page.getByLabel("Modelová roční sazba účtu", { exact: true }).evaluate((node) => parseFloat(getComputedStyle(node.parentElement).outlineWidth) > 0), true);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No overflow at ${width}`);
        await page.screenshot({ path: `${screenshots}/calculator-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 320, height: 1000 });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No overflow at 200% text");
      await page.screenshot({ path: `${screenshots}/calculator-320-text-200.png`, fullPage: true });
      await page.evaluate(() => document.querySelectorAll("style").forEach((node) => { if (node.textContent.includes("200% !important")) node.remove(); }));
      await next();
      await page.getByRole("button", { name: "Předchozí", exact: true }).click();
      assert.equal(await page.getByLabel("Měsíční výdaje", { exact: true }).inputValue(), "30000", "Leaving the calculator clears drafts");
    }
    if (step === 9) await choice("Výdaj může přijít během propadu a vynutit prodej se ztrátou.");
    if (step === 10) {
      await page.getByRole("textbox").fill("Inflace může převýšit čistý úrok. Oddělím rezervu na dostupném účtu a po čerpání ji doplním.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Step ${step + 1} at ${width}`);
    }
    if (step < 11) await next();
  }
  assert.deepEqual(posts, [], "Editorial draft must never save progress or private inputs");
  assert.deepEqual(errors, [], "No hydration or browser errors");
  await page.getByRole("button", { name: "Projít náhled znovu", exact: true }).click();
  await page.getByRole("heading", { name: "Když vypadne příjem", exact: true }).waitFor();
  const unavailable = await page.request.get(`${baseURL}/learn/before-investing/emergency-fund`);
  assert.ok([200, 404].includes(unavailable.status()), "Next may stream its not-found response with status 200");
  const unavailableHtml = await unavailable.text();
  assert.match(unavailableHtml, /Tuhle stránku jsme nenašli/, "Unapproved lesson shows the not-found screen");
  assert.doesNotMatch(unavailableHtml, /Když vypadne příjem/, "No draft lesson content reaches its public URL");
  console.log("Emergency fund: draft gate, full question/retry flow, calculator, privacy, keyboard, 320/390/1440px and 200% text passed.");
} finally { await browser.close(); }
