import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.PLATFORM_TYPES_TEST_URL ?? "http://localhost:3165";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires local development runtime");
const screenshots = process.env.PLATFORM_TYPES_SCREENSHOT_DIR ?? "test-results/platform-types";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = [], posts = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`${baseURL}/dev/platform-types`);
  await page.getByRole("heading", { name: "Typy investičních platforem", exact: true }).waitFor();
  assert.match(await page.locator("header").innerText(), /čeká na odbornou revizi/);
  const next = () => page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  const check = () => page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  async function choice(label) { await page.getByRole("radio", { name: label, exact: true }).check(); await check(); }
  const sort = (offer, category) => page.locator("label", { hasText: `Nabídka ${offer} · ` }).locator("select").selectOption({ label: category });
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  for (let step = 0; step < 13; step++) {
    await page.getByText(`Krok ${step + 1} z 13`, { exact: true }).waitFor();
    console.log(`Checking platform types step ${step + 1}/13`);
    if (step === 0) {
      const radio = page.getByRole("radio", { name: "Kdo rozhoduje o nákupech, co vlastníš a kolik za službu celkem zaplatíš.", exact: true });
      await radio.focus();
      assert.equal(await radio.evaluate((node) => node === document.activeElement), true);
      await page.keyboard.press("Space");
      await check();
    }
    if (step === 2) await choice("Firmu Y, která podle smlouvy provádí pokyny a vede můj majetek.");
    if (step === 3) {
      const broker = "Broker (execution-only)", managed = "Robo-poradce nebo správa portfolia", funds = "Banka nebo fondová platforma", pension = "Penzijní společnost";
      const answers = { A: broker, B: managed, C: funds, D: pension, E: managed, F: broker, G: funds, H: pension };
      // Swap A and B first: wrong → textual feedback → retry.
      for (const [offer, category] of Object.entries({ ...answers, A: managed, B: broker })) await sort(offer, category);
      await check();
      assert.match(await page.locator("main").innerText(), /kdo vybírá konkrétní investice/);
      assert.equal(await page.getByRole("button", { name: "Pokračovat", exact: true }).count(), 0);
      await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
      for (const [offer, category] of Object.entries(answers)) await sort(offer, category);
      await check();
    }
    if (step === 4) await choice("U robo-poradce nebo správy portfolia.");
    if (step === 5) {
      assert.match(await page.locator("main").innerText(), /Seznamy regulovaných a registrovaných subjektů/);
      await choice("Smí v ČR působit; dohled i ochranu majetku primárně určuje domovský stát, a to si ověřím.");
    }
    if (step === 7) await choice("Robo-poradce nebo správa portfolia.");
    if (step === 8) {
      await page.getByLabel("Tvoje odpověď", { exact: false }).fill("1500");
      await check();
    }
    if (step === 10) await choice("U brokera rozhoduji o nákupech já; u správy portfolia je za roční poplatek dělá algoritmus nebo správce.");
    if (step === 11) {
      await page.getByRole("textbox").fill("Každý typ účtuje jinak a záleží na částce i pravidelnosti. Chci rozhodovat o nákupech, takže nejdřív ověřím smluvní stranu a dohled.");
      await page.getByRole("button", { name: "Odeslat a porovnat", exact: true }).click();
    }
    if (step === 12) assert.match(await page.locator("main").innerText(), /Nabídky A–H, X a Y jsou smyšlené/);
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
    if (step < 12) {
      await next();
      await page.locator("section > h2").evaluate((node) => { if (node !== document.activeElement) throw new Error("Step heading must receive focus"); });
    }
  }
  assert.deepEqual(posts, [], "Draft must not persist progress or rewards");
  assert.deepEqual(errors, [], "No browser errors");
  await page.goto(`${baseURL}/learn/broker-and-account/platform-types`);
  if (new URL(page.url()).pathname === "/sign-in") {
    await page.getByRole("heading", { name: "Vítej zpět", exact: true }).waitFor();
  } else {
    await page.getByRole("heading", { name: "Tuhle stránku jsme nenašli", exact: true }).waitFor();
  }
  assert.equal(await page.getByText("Ondřej chce každý měsíc investovat", { exact: false }).count(), 0, "Public route never renders the draft");
  console.log("Platform types: 13 steps, sorting retry, public gate, no mutations, keyboard, focus, 320/390/1440px and 200% text passed.");
} finally { await browser.close(); }
