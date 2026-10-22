// Run against `npm run dev`. Uses the existing Playwright dependency, no test runner added.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.DESIGN_SYSTEM_BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  await page.goto(`${baseURL}/dev/design-system`);
  await page.getByRole("heading", { name: "Small steps. Strong foundations." }).waitFor();
  await page.getByRole("button", { name: "Primary", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "primary button pressed." }).first().waitFor();

  // One visual system (#47): the primary action, UI font and heading font come from styles/tokens.css.
  // The resting color: move the pointer off the clicked button and let its hover transition finish.
  await page.mouse.move(0, 0);
  const system = await page.evaluate(async () => {
    await document.fonts.ready;
    const style = (element) => getComputedStyle(element);
    const button = [...document.querySelectorAll("button")].find((candidate) => candidate.textContent === "Primary");
    await Promise.all(button.getAnimations().map((animation) => animation.finished));
    const primary = style(button);
    return {
      primary: [primary.backgroundColor, primary.color, primary.borderTopLeftRadius, primary.minHeight],
      body: style(document.querySelector("main p")).fontFamily.split(",")[0].replaceAll('"', ""),
      heading: style(document.querySelector("main h2")).fontFamily.split(",")[0].replaceAll('"', ""),
      nunito: [...document.fonts].some((face) => /nunito/i.test(face.family)),
    };
  });
  assert.deepEqual(system.primary, ["rgb(35, 111, 102)", "rgb(255, 255, 255)", "8px", "52px"], "Primary action uses the shared token");
  assert.match(system.body, /Inter/, "UI text uses Inter");
  assert.match(system.heading, /Manrope/, "Headings use Manrope");
  assert.equal(system.nunito, false, "No second UI font is loaded");
  console.log("One visual system: primary action, Inter text and Manrope headings passed");

  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => {
      const chart = document.querySelector(".recharts-wrapper");
      return chart && Math.abs(chart.getBoundingClientRect().width - chart.closest(".recharts-responsive-container").getBoundingClientRect().width) < 2;
    });
    const geometry = await page.evaluate(() => {
      const chart = document.querySelector(".recharts-wrapper").getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, width: chart.width, height: chart.height, right: chart.right };
    });
    assert.equal(geometry.overflow, false, `Page overflow at ${width}px`);
    assert.ok(geometry.width > 0 && geometry.height === 256 && geometry.right <= width, `Responsive chart at ${width}px`);
    console.log(`Layout and chart: ${width}px passed`);
  }

  await page.getByText("Zobrazit tabulku dat", { exact: true }).press("Enter");
  assert.equal(await page.getByRole("table").isVisible(), true);
  assert.equal(await page.getByRole("cell", { name: "9,600", exact: true }).isVisible(), true);
  assert.equal(await page.getByText("Zatím nejsou k dispozici žádná data.", { exact: true }).isVisible(), true);
  await page.getByRole("textbox", { name: "Number of periods" }).fill("3");
  assert.equal(await page.getByRole("textbox", { name: "Number of periods" }).getAttribute("aria-invalid"), "false");
  await page.getByRole("textbox", { name: "Number of periods" }).fill("");
  assert.equal(await page.getByRole("textbox", { name: "Number of periods" }).getAttribute("aria-invalid"), "true");

  for (const reducedMotion of ["no-preference", "reduce"]) {
    await page.emulateMedia({ reducedMotion });
    await page.reload();
    const first = page.getByRole("radio", { name: "10,000", exact: true });
    await first.press("Space");
    await first.press("ArrowDown");
    const correct = page.getByRole("radio", { name: "9,600", exact: true });
    assert.equal(await correct.isChecked(), true);
    await correct.press("Tab");
    const check = page.getByRole("button", { name: "Check answer", exact: true });
    assert.equal(await check.evaluate((element) => element === document.activeElement && element.matches(":focus-visible") && getComputedStyle(element).outlineWidth === "3px"), true);
    if (reducedMotion === "reduce") {
      assert.equal(await check.evaluate((element) => getComputedStyle(element).transitionDuration), "0s");
      await check.scrollIntoViewIfNeeded();
      const bounds = await check.boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      const press = await check.evaluate((element) => ({ scale: getComputedStyle(element).scale, translate: getComputedStyle(element).translate }));
      assert.equal(press.scale, "none");
      assert.equal(press.translate, "none");
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
    await check.press("Enter");
    const next = page.getByRole("button", { name: "Pokračovat", exact: true });
    await next.waitFor();
    assert.equal(await next.evaluate((element) => element === document.activeElement), true);
    assert.ok(await next.getAttribute("aria-describedby"));
    await next.press("Enter");
    const finish = page.getByRole("button", { name: "Pokračovat v učení", exact: true });
    await finish.waitFor();
    assert.equal(await finish.evaluate((element) => element === document.activeElement), true);
    await page.waitForFunction(() => {
      const heading = [...document.querySelectorAll("h2")].find((element) => element.textContent === "A little progress, every day.");
      return heading && heading.getBoundingClientRect().top >= 0;
    });
    await finish.press("Enter");
    assert.equal(await page.getByRole("button", { name: "Zpět na Učení" }).evaluate((element) => element === document.activeElement), true);
    console.log(`Keyboard flow and motion preference: ${reducedMotion} passed`);
  }

  const noJS = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  const fallbackPage = await noJS.newPage();
  await fallbackPage.goto(`${baseURL}/dev/design-system`);
  await fallbackPage.getByText("Zobrazit tabulku dat", { exact: true }).click();
  assert.equal(await fallbackPage.getByRole("cell", { name: "9,600", exact: true }).isVisible(), true);
  assert.equal(await fallbackPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await noJS.close();
  // Motion deliberately emits this development notice when reduced motion is enabled.
  const motionNotice = "You have Reduced Motion enabled on your device. Animations may not appear as expected.. For more information and steps for solving, visit https://motion.dev/troubleshooting/reduced-motion-disabled";
  assert.deepEqual(errors.filter((message) => message !== motionNotice), [], "Unexpected browser warnings/errors");
  if (errors.includes(motionNotice)) console.log("Expected Motion development notice observed for reduced-motion emulation.");
  console.log("Chart no-JavaScript fallback, inputs, and clean console passed.");
} finally {
  await browser.close();
}
