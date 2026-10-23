// v14.1 landing acceptance. Only isolated browser-demo identities may be mutated.
import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import postgres from "postgres";

const baseURL = process.env.MARKETING_TEST_URL ?? "http://localhost:3000";
const local = host => ["localhost", "127.0.0.1", "[::1]"].includes(host);
assert.ok(local(new URL(baseURL).hostname) && local(new URL(process.env.DATABASE_URL).hostname), "Use a local app and database only.");
const output = process.env.MARKETING_SCREENSHOT_DIR ?? "/tmp/investi-marketing-qa";
await mkdir(output, { recursive: true });
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "chrome" });
const owners = new Set(), errors = [], checks = [];
const widths = [1440, 1024, 768, 390, 375, 320];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague" });
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
const lesson = () => page.locator("main > section").first();
const compactLesson = () => page.locator('section[aria-labelledby="lesson-title"]');
const portfolio = () => page.locator("#portfolio-lab");
const sliders = () => portfolio().getByRole("slider");
const button = (scope, name) => scope.getByRole("button", { name, exact: true });
async function recordSession(ctx) {
  const session = await (await ctx.request.get(`${baseURL}/api/auth/get-session`)).json();
  assert.equal(session.user.isAnonymous, true);
  owners.add(session.user.id);
  return session.user.id;
}
async function settle() {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await document.fonts.ready;
    for (const image of document.images) image.loading = "eager";
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  // Paint offscreen illustrations before a full-page capture; decode alone can
  // precede Chrome's rasterization when responsive sources change.
  for (const section of await page.locator("main > section").all()) await section.scrollIntoViewIfNeeded();
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function layout(width, enlarged = false) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(large => { document.documentElement.style.fontSize = large ? "200%" : ""; }, enlarged);
  await settle();
  const dimensions = await page.evaluate(() => {
    const visible = element => element.checkVisibility();
    const copy = [...document.querySelectorAll("h1,h2,h3,p,button,a,label,output,small")].filter(visible);
    const midWordWraps = [];
    for (const element of copy) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        for (const match of walker.currentNode.textContent.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)) {
          const range = document.createRange();
          range.setStart(walker.currentNode, match.index);
          range.setEnd(walker.currentNode, match.index + match[0].length);
          const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)));
          if (lines.size > 1 && getComputedStyle(element).hyphens !== "auto") midWordWraps.push(match[0]);
        }
      }
    }
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: copy.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > innerWidth + 1 || rect.left < -1;
      }).map(element => element.textContent.slice(0, 80)),
      clipped: copy.filter(element => {
        const css = getComputedStyle(element);
        return (css.overflowX !== "visible" && element.scrollWidth > element.clientWidth + 1)
          || (css.overflowY !== "visible" && element.scrollHeight > element.clientHeight + 1);
      }).map(element => element.textContent.slice(0, 80)),
      midWordWraps,
      overlaps: (() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const course = rect('[class*="courseCard"]');
        const steps = rect('[class*="threeSteps"]');
        const closingTitle = rect('#closing-title');
        const closingArt = rect('[class*="closingArt"]');
        const image = rect('[class*="progressImage"] img');
        const imageBox = rect('[class*="progressImage"]');
        return {
          courseOverSteps: course.bottom > steps.top + 1,
          closingArtOverTitle: closingArt.left < closingTitle.right - 1 && closingArt.right > closingTitle.left + 1
            && closingArt.top < closingTitle.bottom - 1 && closingArt.bottom > closingTitle.top + 1,
          progressImageEscapes: image.top < imageBox.top - 1 || image.bottom > imageBox.bottom + 1,
        };
      })(),
      sections: [...document.querySelectorAll("main > section")].map(element => ({ top: element.offsetTop, height: element.offsetHeight })),
    };
  });
  assert.deepEqual(dimensions.overlaps, { courseOverSteps: false, closingArtOverTitle: false, progressImageEscapes: false }, `${width}px, text 200%=${enlarged}: content overlap`);
  assert.equal(dimensions.scroll, width, `${width}px, text 200%=${enlarged}: document overflow`);
  assert.deepEqual(dimensions.outside, [], `${width}px, text 200%=${enlarged}: content outside viewport`);
  assert.deepEqual(dimensions.clipped, [], `${width}px, text 200%=${enlarged}: clipped content`);
  assert.deepEqual(dimensions.midWordWraps, [], `${width}px, text 200%=${enlarged}: split words`);
  await page.screenshot({ path: `${output}/landing-${width}${enlarged ? "-200" : ""}.png`, fullPage: true, animations: "disabled" });
  if (!enlarged && [1440, 1024, 768, 390].includes(width)) {
    for (let index = 1; index <= 6; index++) {
      await page.locator(`main > section:nth-child(${index})`).screenshot({ path: `${output}/section-${width}-${index}.png`, animations: "disabled" });
    }
  }
  if (width <= 768) {
    const trigger = page.getByLabel("Navigační menu", { exact: true });
    await trigger.focus(); await trigger.press("Enter");
    const nav = page.getByRole("navigation", { name: "Mobilní navigace" });
    assert.equal(await nav.isVisible(), true);
    for (const link of await nav.getByRole("link").all()) {
      const rect = await link.boundingBox();
      assert.ok(rect && rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= width, "Menu touch targets and reflow");
    }
    await trigger.press("Escape");
    assert.equal(await nav.isVisible(), false);
    assert.equal(await trigger.evaluate(element => document.activeElement === element), true, "Menu returns focus");
  }
  return dimensions;
}
async function mix() {
  const percentages = await sliders().evaluateAll(inputs => inputs.map(input => Number(input.value)));
  assert.equal(percentages.reduce((a, b) => a + b, 0), 100);
  assert.ok(percentages.every(percent => Number.isInteger(percent) && percent >= 0 && percent <= 100));
  const amounts = await portfolio().locator('output').allTextContents();
  assert.deepEqual(amounts.map(value => Number(value.replace(/\D/g, ""))), percentages);
  return percentages;
}
async function snapshot(owner) {
  const [result] = await sql`
    select
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.lesson_id), '[]') from lesson_progress p where p.user_id = ${owner}) as progress,
      (select coalesce(jsonb_agg(to_jsonb(a) order by a.lesson_id), '[]') from lesson_award a where a.user_id = ${owner}) as awards,
      (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from portfolio_trade t join portfolio p on p.id = t.portfolio_id where p.user_id = ${owner}) as trades,
      (select coalesce(jsonb_agg(to_jsonb(g) order by g.id), '[]') from portfolio g where g.user_id = ${owner}) as generations`;
  return result;
}
try {
  await page.goto(baseURL);
  assert.equal(await page.title(), "Investník – nauč se investovat od základů po vlastní plán");
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("main > section").count(), 6);
  assert.deepEqual(await page.locator("main > section").evaluateAll(sections => sections.map(section => section.querySelector("h1,h2").textContent)), [
    "Peníze jsou vážné.Učení nemusí být.", "Malé kroky.Velké souvislosti.", "Jedna otázka.O jedno aha víc.",
    "Vlastní nápady.Cvičný kapitál.", "Rostou znalosti. Ne tlak.", "Zvědavost stačí.Začni první lekcí.",
  ]);
  const expectedAssets = ["v14-curiosity-cropped.webp", "v14-discovery-edge.webp", "v14-discovery-top-grip.webp", "v14-discovery-side-grip.webp", "v14-steady-understanding.webp", "generated-19.webp"];
  await settle();
  assert.equal(await page.locator('img[src*="marketing"]').count(), 6);
  for (const asset of expectedAssets) {
    const image = page.locator(`img[src*="${asset}"]`);
    assert.equal(await image.count(), 1);
    assert.equal(await image.getAttribute("alt"), "");
    assert.equal(await image.evaluate(element => element.complete && element.naturalWidth > 0), true);
  }
  assert.deepEqual([...new Set(await page.locator("a[href]").evaluateAll(links => links.map(link => link.getAttribute("href"))))].sort(), ["#jak-to-funguje", "#main", "#portfolio-lab", "/", "/onboarding", "/privacy", "/sign-in", "/terms"]);
  const layouts = [];
  for (const width of widths) {
    layouts.push(await layout(width));
    await layout(width, true);
  }
  checks.push("Six original assets and all six sections; responsive/text-200% reflow, no overflow/clipping/unintentional split words; natural Czech heading hyphenation; mobile menu keyboard, Escape, focus return and touch targets.");
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  // Landing below the lesson triggers (deep link, restored scroll) fires them on creation; the compact demo must still play.
  for (const width of [1440, 800, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("about:blank");
    await page.goto(`${baseURL}/#portfolio-lab`);
    await compactLesson().locator('[data-answer="A"][data-selected]').waitFor();
    assert.equal(await page.locator("main > section").count(), 6, `${width}px: deep link renders the landing`);
  }
  checks.push("Deep link below the lesson demos renders the landing and plays the compact demo at desktop and mobile widths.");
  // From load, reduced motion leaves both previews in their server-rendered state; with motion the landing resets
  // them and replays a scripted answer, so the deterministic checks below run without it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(baseURL);
  await page.keyboard.press("Tab");
  assert.equal(await page.getByRole("link", { name: "Přejít k obsahu" }).evaluate(element => element === document.activeElement), true);
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("main").evaluate(element => element === document.activeElement), true);
  assert.equal(await button(portfolio(), "Uložit portfolio").evaluate(element => getComputedStyle(element).transitionDuration), "0s");
  assert.equal(await page.locator('img[src*="curiosity"]').evaluate(element => getComputedStyle(element).animationName), "none");
  const writes = [];
  page.on("request", request => { if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.url()); });
  // The lesson previews are read-only illustrations: nothing inside them is focusable or clickable.
  for (const scope of [lesson(), compactLesson()]) {
    const demo = scope.locator("[data-lesson-demo]");
    assert.equal(await demo.locator("button, a[href], input, [tabindex]").count(), 0, "Lesson preview has no controls");
    await demo.getByRole("status").filter({ hasText: "Přesně." }).first().waitFor();
  }
  await lesson().locator('[data-answer="B"][data-selected]').waitFor(); // the compact card shows only the explanation once answered
  assert.deepEqual(await mix(), [60, 30, 10]);
  for (const [name, value] of [["Akcie", "40"], ["Dluhopisy", "100"], ["Hotovost", "100"], ["Akcie", "100"], ["Dluhopisy", "25"]]) {
    await portfolio().getByRole("slider", { name, exact: true }).fill(value); await mix();
  }
  await portfolio().getByRole("slider", { name: "Akcie", exact: true }).focus();
  await page.keyboard.press("ArrowLeft"); await mix();
  await button(portfolio(), "Uložit portfolio").click();
  await portfolio().getByRole("status").filter({ hasText: "pouze v této ukázce" }).waitFor();
  await button(portfolio(), "Vrátit původní mix").click();
  assert.deepEqual(await mix(), [60, 30, 10]);
  assert.deepEqual(writes, [], "Marketing interactions perform no network mutation");
  assert.equal((await (await context.request.get(`${baseURL}/api/auth/get-session`)).json()), null, "Previews never create an anonymous identity");
  checks.push("Both lesson previews are read-only (no controls) and show the answered state. Three keyboard/pointer allocation controls keep 100%; save/reset remains local; no mutation request or session creation.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const [label, path, heading] of [["Začít se učit", "/onboarding", "Co se chceš naučit?"], ["Přihlásit se", "/sign-in", "Vítej zpět"]]) {
    await page.goto(baseURL);
    await page.getByRole("link", { name: label, exact: true }).first().click();
    await page.waitForURL(`**${path}`);
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    const leaked = await page.locator("main").evaluate(element => ({ font: getComputedStyle(element).getPropertyValue("--pen-body"), marketing: document.querySelector('[class*="pen-landing"]') !== null }));
    assert.deepEqual(leaked, { font: "", marketing: false }, "Marketing styles/fonts unmount on auth routes");
    await settle();
    const screenshot = `${output}/${path.slice(1)}.png`;
    await page.screenshot({ path: screenshot, animations: "disabled" });
    if (process.env.MARKETING_AUTH_BASELINE_DIR) {
      const baseline = await readFile(`${process.env.MARKETING_AUTH_BASELINE_DIR}/${path.slice(1)}.png`);
      const actual = await readFile(screenshot);
      assert.equal(createHash("sha256").update(actual).digest("hex"), createHash("sha256").update(baseline).digest("hex"), "Auth appearance matches pre-change baseline");
    }
  }
  for (const [anchor, target] of [["Jak to funguje", "#jak-to-funguje"], ["Portfolio Lab", "#portfolio-lab"]]) {
    await page.goto(baseURL); await page.getByRole("navigation", { name: "Hlavní navigace", exact: true }).getByRole("link", { name: anchor, exact: true }).click();
    // With motion, anchors smooth-scroll and update the hash once they land.
    await page.waitForURL(url => url.hash === target);
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(baseURL); await page.getByLabel("Navigační menu").click();
  await page.getByRole("navigation", { name: "Mobilní navigace" }).getByRole("link", { name: "Jak to funguje" }).click();
  assert.equal(await page.getByRole("navigation", { name: "Mobilní navigace" }).isVisible(), false);
  checks.push("Signup/login and section anchors navigate; marketing fonts/styles leave the page on client navigation.");
  await page.goto(baseURL);
  await page.route("**/api/auth/sign-in/anonymous", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Unavailable" }) }));
  await button(page, "Vyzkoušet demo").click();
  await page.getByRole("alert").filter({ hasText: "Demo se nepodařilo otevřít" }).waitFor();
  assert.equal(await button(page, "Vyzkoušet demo").isEnabled(), true);
  await page.unroute("**/api/auth/sign-in/anonymous");
  await button(page, "Vyzkoušet demo").click();
  await page.waitForURL("**/learn");
  const owner = await recordSession(context);
  for (const path of ["/lab/portfolio", "/lab/backtesting", "/progress", "/learn/returns/log-returns"]) {
    // The lesson starts through a hydrated Server Action; its heading can appear before that write finishes.
    const started = path.startsWith("/learn/") ? page.waitForResponse(response =>
      new URL(response.url()).pathname === path && Boolean(response.request().headers()["next-action"])) : null;
    await page.goto(`${baseURL}${path}`);
    assert.equal(new URL(page.url()).pathname, path);
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(await page.locator('[class*="pen-landing"]').count(), 0);
    if (started) {
      assert.equal((await started).ok(), true, "lesson-start action succeeds before the baseline snapshot");
      const progress = await sql`select status, last_position from lesson_progress where user_id=${owner} and lesson_id='returns-log-returns'`;
      assert.equal(progress.length, 1);
      assert.deepEqual(progress[0], { status: "in_progress", last_position: 0 });
    }
  }
  const before = await snapshot(owner);
  await page.goto(baseURL);
  await portfolio().getByRole("slider", { name: "Akcie", exact: true }).fill("40");
  await button(portfolio(), "Uložit portfolio").click();
  assert.deepEqual(await snapshot(owner), before, "Authenticated previews preserve exact lesson, reward, trade and generation records");
  await button(page, "Vyzkoušet demo").click(); await page.waitForURL("**/learn");
  assert.equal(await recordSession(context), owner, "Existing session reused");
  const other = await browser.newContext(); const otherPage = await other.newPage();
  await otherPage.goto(baseURL); await button(otherPage, "Vyzkoušet demo").click(); await otherPage.waitForURL("**/learn");
  assert.notEqual(await recordSession(other), owner, "Independent demo identities");
  checks.push("Existing DemoButton failure/retry, real entry, session reuse and isolation; protected product routes; authenticated landing interactions preserve exact persisted records.");
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ widths, checks, layouts }, null, 2));
  console.log(`PASS\n${checks.join("\n")}\nScreenshots: ${output}`);
} finally {
  await browser.close();
  for (const owner of owners) await sql`delete from "user" where id = ${owner}`;
  await sql.end();
}
