import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.STUDOVNA_TEST_URL ?? "http://localhost:3000";
const local = (value) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
assert.ok(local(baseURL) && local(process.env.DATABASE_URL), "Requires a local runtime and disposable database.");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = process.env.STUDOVNA_SCREENSHOT_DIR ?? "/tmp/investi-studovna-final";
await mkdir(output, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Europe/Prague", reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let userId;
const learn = () => page.locator("[data-investi-studovna]:visible");
async function settle() {
  await learn().waitFor();
  await page.evaluate(async () => { window.scrollTo(0, 0); await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function layouts(state, capture = true) {
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: overflow at ${width}`);
    assert.equal(await page.locator("h1:visible").count(), 1);
    assert.equal(await page.locator("#main-content").count(), 1);
    assert.ok(await page.locator("main img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), "illustration loads");
    const account = page.getByLabel("Nabídka účtu", { exact: true });
    await account.focus();
    if (await account.evaluate((element) => element.parentElement.open)) await account.press("Escape");
    await account.press("Enter");
    await page.getByRole("banner").getByRole("link", { name: "Nastavení", exact: true }).waitFor();
    await account.press("Escape");
    assert.equal(await account.evaluate((element) => element === document.activeElement && !element.parentElement.open), true);
    const nav = page.getByRole("navigation", { name: width < 1024 ? "Mobilní navigace" : "Hlavní navigace" });
    assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "/learn");
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox(); assert.ok(box && box.height >= 44);
    }
    if (width === 390) {
      const chapter = page.getByTestId("journey-modules").locator("details").nth(1);
      const wasOpen = await chapter.evaluate((element) => element.open);
      await chapter.locator("summary").focus(); await chapter.locator("summary").press("Enter");
      await chapter.getByRole("link", { name: /Logaritmické/ }).waitFor({ state: wasOpen ? "hidden" : "visible" });
      assert.equal(await chapter.evaluate((element) => element.open), !wasOpen);
      await chapter.locator("summary").press("Enter");
    }
    if (capture) await page.screenshot({ path: `${output}/${state}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await settle();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${state}: 200% text overflow`);
  const clipped = await learn().locator("h1,h2,h3,a,button,label").evaluateAll((elements) => elements.filter((element) => element.clientWidth && element.scrollWidth > element.clientWidth + 2).map((element) => element.textContent));
  assert.deepEqual(clipped, [], `${state}: enlarged essential text clips`);
  const chapterGeometry = await page.locator("[data-testid=journey-modules]:visible details > summary").evaluateAll((summaries) => summaries.map((summary) => { const title = summary.querySelector("h3").getBoundingClientRect(); const number = summary.firstElementChild.getBoundingClientRect(); return { belowNumber: title.top >= number.bottom, width: title.width }; }));
  assert.ok(chapterGeometry.every((chapter) => chapter.belowNumber && chapter.width > 200), "enlarged chapter names reflow onto full-width rows");
  await page.screenshot({ path: `${output}/${state}-320-text-200.png`, fullPage: true, animations: "disabled" });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 900 });
}
try {
  const email = `studovna-${randomUUID()}@example.com`;
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Klára", email, password: randomUUID() } });
  assert.ok(response.ok(), `signup: ${response.status()}`);
  const session = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json(); userId = session.user.id;
  await page.goto(`${baseURL}/onboarding`); await finishOnboarding(page);
  await page.getByRole("button", { name: "Teď ne", exact: true }).click();
  await layouts("new");
  await learn().getByRole("radio", { name: /Co nejvyšší dlouhodobý růst/ }).check();
  await page.getByRole("status").filter({ hasText: "Zkus to ještě jednou." }).waitFor();
  assert.equal((await sql`select * from lesson_progress where user_id=${userId}`).length, 0, "wrong preview answer does not persist or skip");
  await learn().getByRole("radio", { name: /Snadný přístup a stabilita/ }).check();
  await page.getByRole("status").filter({ hasText: "Správně." }).waitFor();
  await context.setOffline(true);
  await learn().getByRole("button", { name: "Pokračovat v lekci", exact: true }).click();
  await learn().getByRole("alert").waitFor();
  await context.setOffline(false);
  assert.equal((await sql`select * from lesson_progress where user_id=${userId}`).length, 0, "failed save keeps cursor");
  await learn().getByRole("button", { name: "Pokračovat v lekci", exact: true }).click();
  await page.waitForURL("**/learn/investing-foundations/why-invest");
  await page.getByRole("heading", { name: "Spoření a investování řeší jiné potřeby", exact: true }).waitFor();
  const [saved] = await sql`select * from lesson_progress where user_id=${userId}`;
  assert.equal(saved.last_position, 1); assert.equal(saved.status, "in_progress");
  assert.equal((await sql`select * from lesson_award where user_id=${userId}`).length, 0, "preview never completes or awards capital");
  await page.goto(`${baseURL}/learn`);
  await learn().getByRole("link", { name: "Pokračovat", exact: true }).click();
  await page.waitForURL("**/learn/investing-foundations/why-invest");
  await page.getByRole("heading", { name: "Spoření a investování řeší jiné potřeby", exact: true }).waitFor();
  // Isolated cursor fixture: actual authored market question and real server transition.
  await sql`insert into lesson_progress(user_id,lesson_id,status,last_position,updated_at) values(${userId},'foundations-markets','in_progress',2,now())`;
  await page.goto(`${baseURL}/learn`); await layouts("resume");
  assert.equal(await learn().getByRole("link", { name: "Doporučená lekce: Spoření vs. investování", exact: true }).getAttribute("href"), "/learn/investing-foundations/why-invest");
  await learn().getByRole("radio", { name: /Ask · 100,20 Kč/ }).check();
  await learn().getByRole("button", { name: "Pokračovat v lekci", exact: true }).click();
  await page.waitForURL("**/learn/investing-foundations/how-markets-work");
  await page.getByRole("heading", { name: "Spočítej rozdíl", exact: true }).waitFor();
  assert.equal((await sql`select last_position from lesson_progress where user_id=${userId} and lesson_id='foundations-markets'`)[0].last_position, 3);
  await page.goto(`${baseURL}/learn`);
  assert.equal(await learn().getByRole("radio").count(), 0, "numeric current step resumes in focused lesson rather than previewing a later choice");
  assert.equal(await learn().getByRole("link", { name: "Pokračovat", exact: true }).getAttribute("href"), "/learn/investing-foundations/how-markets-work");
  // All-complete view is derived from published DB lessons, with no reward fabricated.
  await sql`insert into lesson_progress(user_id,lesson_id,status,last_position,updated_at,completed_at) select ${userId},id,'completed',0,now(),now() from lesson where is_published=true on conflict(user_id,lesson_id) do update set status='completed',completed_at=now()`;
  await page.goto(`${baseURL}/learn`); await page.getByRole("heading", { name: "To je všechno. Zatím.", exact: true }).waitFor(); await layouts("complete", false);
  await learn().getByRole("link", { name: "Vyzkoušet v Labu", exact: true }).click(); await page.waitForURL("**/lab");
  assert.deepEqual(errors, []);
  console.log(`PASS: catalog/state wiring, real authored inline question, incorrect/retry/save error, persisted continuation/reload, no completion/reward on preview, mobile chapter keyboard, account Escape/focus, navigation, illustrations, 320–1440px and 200% text. Screenshots: ${output}`);
} finally { await browser.close(); if (userId) await sql`delete from "user" where id=${userId}`; await sql.end(); }
