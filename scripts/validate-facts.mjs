import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.FACTS_TEST_URL ?? "http://localhost:3132";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Use an isolated local runtime.");
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", timezoneId: "Europe/Prague" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const output = process.env.FACTS_SCREENSHOT_DIR ?? "/tmp/investi-facts-132";
try {
  const response = await page.goto(`${baseURL}/dev/facts?date=2026-10-22`);
  if (process.env.FACTS_EXPECT_PRODUCTION === "1") {
    assert.equal(response.status(), 404);
    assert.equal(await page.getByRole("heading", { name: "Registr faktů", exact: true }).count(), 0);
    console.log("Facts editorial route: production 404 passed.");
  } else {
    assert.equal(response.status(), 200);
    await page.getByRole("heading", { name: "Registr faktů", exact: true }).waitFor();
    assert.equal(await page.locator("details").count(), 49);
    assert.equal(await page.getByRole("status").count(), 0);
    assert.equal((await page.locator("main").innerText()).includes("{{"), false);
    const first = page.locator("summary").first();
    await first.focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("details").first().evaluate((element) => element.open), true);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.tagName), "A");
    await page.getByLabel("Datum kontroly").fill("2027-04-01");
    await page.getByRole("button", { name: "Zobrazit datum" }).click();
    await page.waitForURL("**/dev/facts?date=2027-04-01");
    await page.getByRole("status").filter({ hasText: "Údaj může být zastaralý" }).waitFor();
    await mkdir(output, { recursive: true });
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const large of [false, true]) {
        await page.evaluate((enlarged) => { document.documentElement.style.fontSize = enlarged ? "200%" : ""; }, large);
        await page.locator("details").first().evaluate((element) => { element.open = true; });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px, text200%=${large}`);
        if (!large && [1440, 390].includes(width)) await page.screenshot({ path: `${output}/${width === 1440 ? "desktop" : "mobile"}.png`, fullPage: true });
      }
    }
    await page.goto(`${baseURL}/dev/facts?date=2026-02-30`);
    await page.getByRole("heading", { name: "Registr faktů", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log("Facts overview: tokens, freshness, keyboard, 6 widths and 200% text passed.");
  }
} finally {
  await context.close();
  await browser.close();
}
