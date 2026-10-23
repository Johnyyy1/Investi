import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.PENSION_DIP_TEST_URL ?? "http://localhost:3152";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires local development runtime");
const screenshots = process.env.PENSION_DIP_SCREENSHOT_DIR ?? "test-results/pension-and-dip";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(10000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`${baseURL}/dev/pension-and-dip`);
  await page.getByRole("heading", { name: "Penzijko a DIP: kolik ti přidá stát", exact: true }).waitFor();
  const header = await page.locator("header").innerText();
  assert.match(header, /čeká na odbornou revizi/);
  assert.match(header, /stav k/);
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  const check = () => page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  const retry = () => page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
  async function choice(label) { await page.getByRole("radio", { name: label, exact: true }).check(); await check(); }
  async function numeric(value) { await page.getByRole("textbox").fill(value); await check(); }
  for (let step = 0; step < 12; step++) {
    console.log(`Checking pension-and-dip step ${step + 1}/12`);
    if (step === 0) await choice("Příspěvek jen do stropu; část vkladu nad ním může snížit daň.");
    if (step === 1) await numeric("240");
    if (step === 2) {
      await numeric("500");
      assert.match(await page.locator("main").innerText(), /20 % platí jen do vkladu 1 700 Kč/);
      await retry();
      await numeric("340");
    }
    if (step === 4) {
      await page.getByLabel("Roční odpočet", { exact: true }).fill("15600");
      await page.getByLabel("Úspora na dani", { exact: true }).fill("2340");
      await check();
    }
    if (step === 5) {
      await choice("63 600 Kč");
      assert.match(await page.locator("main").innerText(), /Každý produkt má vlastní limit/);
      await retry();
      await choice("48 000 Kč");
    }
    if (step === 7) await choice("V 60 letech.");
    if (step === 8) {
      const calculator = page.getByRole("region", { name: "Kalkulačka státní podpory", exact: true });
      await calculator.waitFor();
      assert.match(await calculator.innerText(), /4\s080 Kč/);
      await page.getByLabel("Měsíční vklad do DPS", { exact: true }).fill("2500");
      assert.match(await calculator.innerText(), /9\s600 Kč/);
      assert.match(await calculator.innerText(), /1\s440 Kč/);
      await page.getByLabel("Roční vklad do DIP", { exact: true }).fill("48000");
      assert.match(await calculator.innerText(), /limit odpočtu je vyčerpaný/);
      await page.getByLabel("Měsíční vklad do DPS", { exact: true }).fill("");
      assert.equal(await calculator.getByRole("region", { name: "Výsledek státní podpory" }).count(), 0);
      await page.getByLabel("Měsíční vklad do DPS", { exact: true }).fill("1700");
      await page.getByLabel("Měsíční vklad do DPS", { exact: true }).focus();
      await page.keyboard.press("Tab");
      const dip = page.getByLabel("Roční vklad do DIP", { exact: true });
      assert.equal(await dip.evaluate((node) => node === document.activeElement), true, "Tab reaches the second field");
      assert.equal(await dip.evaluate((node) => parseFloat(getComputedStyle(node.parentElement).outlineWidth) > 0), true, "Visible focus");
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        assert.equal(await noOverflow(page), true, `No overflow at ${width}`);
        await page.screenshot({ path: `${screenshots}/calculator-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 320, height: 1000 });
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      assert.equal(await noOverflow(page), true, "No overflow at 200% text");
      await page.screenshot({ path: `${screenshots}/calculator-320-text-200.png`, fullPage: true });
      await page.evaluate(() => document.querySelectorAll("style").forEach((node) => { if (node.textContent.includes("200% !important")) node.remove(); }));
    }
    if (step === 9) await choice("Odpočet snižuje základ daně; úspora je odpočet krát sazba daně.");
    if (step === 10) {
      await page.getByRole("textbox").fill("Vklad do hranice už podporuje příspěvek. Peníze budou vázané, proto sem nedám rezervu a porovnám poplatky.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
    }
    if (step === 11) assert.match(await page.locator("main").innerText(), /Vzdělávací obsah/);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await noOverflow(page), true, `Step ${step + 1} at ${width}`);
    }
    if (step < 11) await next();
  }
  assert.deepEqual(posts, [], "Editorial draft must never save progress or private inputs");
  assert.deepEqual(errors, [], "No hydration or browser errors");
  const unavailable = await page.request.get(`${baseURL}/learn/before-investing/pension-and-dip`);
  assert.ok([200, 404].includes(unavailable.status()), "Next may stream its not-found response with status 200");
  const unavailableHtml = await unavailable.text();
  assert.match(unavailableHtml, /Tuhle stránku jsme nenašli/, "Unapproved lesson shows the not-found screen");
  assert.doesNotMatch(unavailableHtml, /Kolik Evě přidá stát/, "No draft lesson content reaches its public URL");
  console.log("Pension and DIP: draft gate, question/retry flow, calculator, privacy, keyboard, 320/390/1440px and 200% text passed.");
} finally { await browser.close(); }
