import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.CALCULATORS_TEST_URL ?? "http://localhost:3129";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname), "Requires a local development server.");
const screenshots = process.env.CALCULATORS_SCREENSHOT_DIR ?? "/tmp/investi-calculators-129";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto(`${baseURL}/dev/lesson-calculators`);
  assert.equal(response.status(), 200);
  await page.getByText("Modelový příklad", { exact: true }).waitFor();
  const text = page.getByRole("textbox", { name: "Velikost ztráty", exact: true });
  const slider = page.getByRole("slider", { name: "Velikost ztráty · posuvník", exact: true });
  const result = page.getByRole("region", { name: "Výsledek výpočtu", exact: true });
  await result.waitFor();
  assert.match(await result.innerText(), /\+25/);
  // Text edits must propagate without rounding or losing the decimal comma.
  for (const raw of ["0,1", "0,25", "1,3333"]) {
    await text.fill(raw);
    assert.equal(await text.inputValue(), raw);
    assert.equal(Number(await slider.inputValue()), Number(raw.replace(",", ".")));
    assert.equal(await result.count(), 1);
  }
  for (const raw of ["", "-1", "100", "0,0,25"]) {
    await text.fill(raw);
    assert.equal(await text.getAttribute("aria-invalid"), "true");
    assert.equal(await result.count(), 0, `invalid ${raw} hides the result`);
    const descriptionId = await text.getAttribute("aria-describedby");
    assert.equal(await slider.getAttribute("aria-describedby"), descriptionId);
    assert.ok((await page.locator(`[id="${descriptionId}"]`).innerText()).length > 0);
  }
  await text.fill("20");
  await text.focus();
  await page.keyboard.press("Tab");
  assert.equal(await slider.evaluate((element) => element === document.activeElement), true);
  const before = Number(await slider.inputValue());
  await page.keyboard.press("ArrowRight");
  assert.ok(Number(await slider.inputValue()) > before, "arrow key updates the native slider");
  assert.equal(await slider.inputValue(), await text.inputValue(), "slider updates the text input");
  assert.equal(await slider.evaluate((element) => getComputedStyle(element).outlineStyle), "solid");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(await text.inputValue(), "10", "keyboard activates the example button");
  await page.getByRole("button", { name: "Zkusit −50%", exact: true }).click();
  assert.match(await result.innerText(), /\+100/);
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px reflows`);
    if ([1440, 390, 320].includes(width)) await page.screenshot({ path: `${screenshots}/calculator-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "320px with 200% text reflows");
  const clippedText = await page.locator("main p, main h1, main h3").evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => element.textContent));
  assert.deepEqual(clippedText, [], "200% text remains readable without clipping");
  const headingDescriptionOverlap = await page.locator('[aria-labelledby="calculator-specimen-title"] > div').first().evaluate((header) => {
    const heading = header.querySelector("h3").getBoundingClientRect();
    const description = header.querySelector("h3 + p").getBoundingClientRect();
    return heading.bottom > description.top;
  });
  assert.equal(headingDescriptionOverlap, false, "enlarged heading does not overlap its description");
  await page.screenshot({ path: `${screenshots}/calculator-320-200.png`, fullPage: true });
  assert.deepEqual(errors, [], "no hydration or browser errors");
  console.log("Lesson calculators: decimal input, validation, keyboard, focus, 320–1440px and 200% text passed.");
} finally {
  await browser.close();
}
