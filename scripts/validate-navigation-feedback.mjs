// Client navigation acceptance: fast navigations commit without a Suspense reveal delay and never flash the
// pending indicator; slow ones keep the current page, show the indicator and a status, and stay interruptible.
// Slowness is simulated by delaying only the RSC navigation responses in the browser, so the server is untouched.
// Local production build + disposable local database only (creates one demo identity and deletes it).
//   NAVIGATION_TEST_URL=http://localhost:3100 DATABASE_URL=postgresql://…@127.0.0.1:…/… node scripts/validate-navigation-feedback.mjs
import "dotenv/config";
import assert from "node:assert/strict";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.NAVIGATION_TEST_URL;
const local = (value) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
assert.ok(baseURL && local(baseURL), "NAVIGATION_TEST_URL must be a local app.");
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL), "Requires a disposable local database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const SLOW_MS = 1500;
let userId;

/** Each route's h1, recorded from a full page load, so client navigations can be checked against it. */
const heading = {};
/** Delays RSC navigation responses (not prefetches) while `slow.on` is set. */
async function slowNavigations(page) {
  const slow = { on: false, seen: 0 };
  await page.route("**/*", async (route) => {
    const headers = route.request().headers();
    if (slow.on && headers.rsc && !headers["next-router-prefetch"]) { slow.seen += 1; await new Promise((resolve) => setTimeout(resolve, SLOW_MS)); }
    await route.continue();
  });
  return slow;
}
/** Samples the indicator, busy state and fallback every frame until stopped. */
async function startProbe(page) {
  await page.evaluate(() => {
    const probe = { maxOpacity: 0, busy: false, status: "", fallback: false, stop: false };
    window.__probe = probe;
    const tick = () => {
      const bar = document.querySelector("[data-navigation-indicator]");
      if (bar) probe.maxOpacity = Math.max(probe.maxOpacity, Number(getComputedStyle(bar).opacity));
      if (document.querySelector("#main-content[aria-busy='true']")) probe.busy = true;
      const status = [...document.querySelectorAll("[role='status']")].map((node) => node.textContent).find((text) => text?.includes("Načítám stránku"));
      if (status) probe.status = status;
      // The layout fallback must never replace a page during a client navigation.
      if (document.querySelector("[data-route-fallback]")) probe.fallback = true;
      if (!probe.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const stopProbe = (page) => page.evaluate(() => { window.__probe.stop = true; return window.__probe; });
const navLink = (page, name) => page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name });
async function arrived(page, path) {
  await page.waitForURL(`**${path}`);
  await page.locator("h1").first().waitFor({ state: "attached" });
  assert.equal(await page.locator("h1").first().textContent(), heading[path], `${path} content`);
}
const idle = (page) => page.evaluate(() => ({ busy: !!document.querySelector("#main-content[aria-busy='true']"), opacity: Number(getComputedStyle(document.querySelector("[data-navigation-indicator]")).opacity) }));

try {
  const seed = await browser.newContext();
  const signIn = await seed.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL }, data: {} });
  assert.equal(signIn.status(), 200);
  userId = (await signIn.json()).user.id;
  const storageState = await seed.storageState();
  await seed.close();

  const context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const slow = await slowNavigations(page);
  const prefetches = [];
  page.on("request", (request) => { if (request.headers()["next-router-prefetch"]) prefetches.push(new URL(request.url()).pathname); });
  for (const path of ["/progress", "/lab", "/learn"]) {
    await page.goto(`${baseURL}${path}`);
    heading[path] = await page.locator("h1").first().textContent();
  }
  await arrived(page, "/learn");
  await page.waitForTimeout(1000);

  // Fast: commits well below the ~300 ms Suspense reveal throttle; no indicator, no layout fallback.
  for (const [name, path] of [["Pokrok", "/progress"], ["Lab", "/lab"], ["Učení", "/learn"]]) {
    await startProbe(page);
    const started = Date.now();
    await navLink(page, name).click();
    await arrived(page, path);
    const elapsed = Date.now() - started;
    const probe = await stopProbe(page);
    assert.ok(elapsed < 250, `fast navigation to ${path} took ${elapsed} ms`);
    assert.equal(probe.maxOpacity, 0, `no indicator flash on a fast navigation to ${path}`);
    assert.equal(probe.fallback, false, `no fallback during client navigation to ${path}`);
  }

  // Slow: the current page stays, the URL waits for the commit, and the indicator, status and busy state appear.
  slow.on = true;
  await startProbe(page);
  await navLink(page, "Pokrok").click();
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).pathname, "/learn", "history updates only when the page commits");
  assert.equal(await page.locator("h1").first().textContent(), heading["/learn"], "current page stays visible");
  assert.equal((await idle(page)).opacity, 1, "indicator visible while slow");
  await arrived(page, "/progress");
  let probe = await stopProbe(page);
  assert.ok(probe.busy && probe.status.includes("Načítám stránku"), "busy region and polite status while slow");
  assert.equal(probe.fallback, false, "no fallback during a slow client navigation");
  assert.deepEqual(await idle(page), { busy: false, opacity: 0 }, "indicator cleared after commit");
  assert.ok(slow.seen >= 1);

  // Interrupted: a second click wins; nothing stays pending. (The superseded response can still commit
  // briefly before the last one, with its own history entry; the build before this change does the same.)
  await navLink(page, "Lab").click();
  await page.waitForTimeout(200);
  await navLink(page, "Učení").click();
  await arrived(page, "/learn");
  await page.waitForTimeout(SLOW_MS + 300);
  assert.equal(new URL(page.url()).pathname, "/learn", "the last click wins");
  assert.deepEqual(await idle(page), { busy: false, opacity: 0 }, "no stuck indicator after an interrupted navigation");

  // Rapid repeated clicks on one link: one destination, indicator cleared.
  await navLink(page, "Lab").click();
  await navLink(page, "Lab").click();
  await navLink(page, "Lab").click();
  await arrived(page, "/lab");
  await page.waitForTimeout(SLOW_MS + 300);
  assert.equal(new URL(page.url()).pathname, "/lab");
  assert.deepEqual(await idle(page), { busy: false, opacity: 0 }, "no stuck indicator after repeated clicks");
  slow.on = false;

  // Back/forward restore the right pages and leave nothing pending.
  await navLink(page, "Pokrok").click(); await arrived(page, "/progress");
  await navLink(page, "Učení").click(); await arrived(page, "/learn");
  await page.goBack(); await arrived(page, "/progress");
  await page.goBack(); await arrived(page, "/lab");
  await page.goForward(); await arrived(page, "/progress");
  assert.deepEqual(await idle(page), { busy: false, opacity: 0 });

  // A new page starts at the top; keyboard activation works like a click.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.ok(await page.evaluate(() => scrollY) > 0);
  await navLink(page, "Lab").focus();
  await page.keyboard.press("Enter");
  await arrived(page, "/lab");
  assert.equal(await page.evaluate(() => scrollY), 0, "new page starts at the top");

  // Hard reload renders the page directly.
  await page.reload(); await arrived(page, "/lab");
  assert.deepEqual(errors, [], "no page errors");
  const dynamicPrefetches = prefetches.filter((path) => ["/learn", "/progress", "/lab", "/lab/portfolio", "/settings"].includes(path));
  await context.close();

  // Mobile navigation and reduced motion: the bar still appears (static), and clears.
  const mobile = await browser.newContext({ storageState, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const phone = await mobile.newPage();
  const phoneSlow = await slowNavigations(phone);
  await phone.goto(`${baseURL}/learn`); await arrived(phone, "/learn");
  await phone.waitForLoadState("networkidle"); // hydrated: a click before hydration is a full page load
  phoneSlow.on = true;
  await phone.getByRole("navigation", { name: "Mobilní navigace" }).getByRole("link", { name: /Pokrok/ }).click();
  await phone.waitForTimeout(600);
  const bar = await phone.evaluate(() => { const node = document.querySelector("[data-navigation-indicator]"); return { opacity: Number(getComputedStyle(node).opacity), animation: getComputedStyle(node, "::before").animationName }; });
  assert.deepEqual(bar, { opacity: 1, animation: "none" }, "static indicator under reduced motion");
  await arrived(phone, "/progress");
  assert.deepEqual(await idle(phone), { busy: false, opacity: 0 });
  await mobile.close();

  console.log(`PASS: fast navigations < 250 ms without indicator flash or fallback; slow navigations keep the page with indicator, status and busy state; interrupted and repeated clicks; back/forward; scroll to top; keyboard; hard reload; mobile; reduced motion. Prefetches of dynamic app routes after load: ${dynamicPrefetches.length}.`);
} finally {
  if (userId) await sql`delete from "user" where id = ${userId}`;
  await sql.end();
  await browser.close();
}
