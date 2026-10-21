// Fresh local production servers only; never use real OAuth credentials.
// AUTH_TEST_URL: both fake providers; AUTH_DISABLED_TEST_URL: neither provider.
// DATABASE_URL must point to the disposable investi_6a4_qa database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import postgres from "postgres";

const baseURL = process.env.AUTH_TEST_URL;
const disabledURL = process.env.AUTH_DISABLED_TEST_URL;
const local = (url) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
assert.ok(baseURL && disabledURL && local(baseURL) && local(disabledURL));
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_6a4_qa");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const output = process.env.AUTH_SCREENSHOT_DIR ?? "/tmp/investi-6a4-screenshots";
await mkdir(output, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [], ids = [], publicBodies = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.url().startsWith(baseURL) && /text\/html|javascript/.test(response.headers()["content-type"] ?? "")) {
    publicBodies.push(response.text().catch(() => ""));
  }
});
async function reflow() {
  await page.evaluate(async () => { await document.fonts.ready; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "page overflow");
  assert.deepEqual(await page.locator('button, input, label, h1').evaluateAll((elements) => elements.filter((e) => e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent)), [], "clipped controls");
  const broken = await page.locator('h1, button, label, p').evaluateAll((elements) => {
    const failures = [], segmenter = new Intl.Segmenter("cs", { granularity: "word" });
    for (const element of elements) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) for (const { segment, index, isWordLike } of segmenter.segment(walker.currentNode.textContent)) {
        if (!isWordLike) continue;
        const range = document.createRange(); range.setStart(walker.currentNode, index); range.setEnd(walker.currentNode, index + segment.length);
        if (new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size > 1) failures.push(segment);
      }
    }
    return failures;
  });
  assert.deepEqual(broken, [], "arbitrary word breaks");
}
try {
  // Registration is the last onboarding step now; /sign-up only forwards there.
  await page.goto(`${baseURL}/sign-up`); await page.waitForURL("**/onboarding");
  // OAuth errors return to the save step, which sends a visitor without a guest session back to onboarding.
  await page.goto(`${baseURL}/sign-up?error=access_denied`); await page.waitForURL((url) => url.pathname === "/onboarding");
  for (const mode of ["sign-in"]) {
    await page.goto(`${disabledURL}/${mode}`);
    assert.equal(await page.getByRole("button", { name: /Pokračovat přes/ }).count(), 0);
    assert.ok(await page.getByLabel("E-mail", { exact: true }).isVisible());
    await page.goto(`${baseURL}/${mode}`);
    assert.equal(await page.getByRole("button", { name: /Pokračovat přes/ }).count(), 2);
    assert.equal(await page.getByRole("link", { name: "Investník · úvodní stránka", exact: true }).getAttribute("href"), "/");
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await reflow();
      if (process.env.AUTH_SKIP_SCREENSHOTS !== "1" && width !== 320) await page.screenshot({ path: `${output}/${mode}-${width}.png`, fullPage: true });
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await reflow();
    if (process.env.AUTH_SKIP_SCREENSHOTS !== "1" && mode === "sign-in") await page.screenshot({ path: `${output}/sign-in-320-text-200.png`, fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/sign-in`);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").getAttribute("href"), "/");
  await page.keyboard.press("Tab");
  assert.match(await page.locator(":focus").innerText(), /Google/);
  assert.equal(await page.locator(":focus").evaluate((e) => getComputedStyle(e).outlineStyle), "solid");
  assert.ok(await page.getByRole("button", { name: /Pokračovat přes Google/ }).evaluate((e) => e.getBoundingClientRect().height >= 44));

  for (const provider of ["google", "facebook"]) {
    const mode = "sign-in";
    await page.goto(`${baseURL}/${mode}`);
    let destination, requestBody, count = 0, release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("**/api/auth/sign-in/social", async (route) => {
      count++; requestBody = route.request().postDataJSON(); await gate; await route.continue();
    });
    await page.route(/^https:\/\/(accounts\.google\.com|www\.facebook\.com)\//, async (route) => {
      destination = new URL(route.request().url());
      await route.fulfill({ contentType: "text/html", body: "<p>OAuth navigation intercepted by local QA</p>" });
    });
    await page.getByRole("button", { name: `Pokračovat přes ${provider === "google" ? "Google" : "Facebook"}` }).click();
    await page.locator('button[aria-busy="true"]').waitFor();
    assert.equal(await page.locator('button[aria-busy="true"]').count(), 1);
    assert.equal(await page.getByRole("button", { name: /Pokračovat přes|Otevírám/ }).evaluateAll((buttons) => buttons.every((b) => b.disabled)), true);
    release();
    await page.waitForURL((url) => url.hostname === (provider === "google" ? "accounts.google.com" : "www.facebook.com"));
    assert.equal(count, 1);
    assert.deepEqual(requestBody, { provider, callbackURL: "/learn", errorCallbackURL: `/${mode}` });
    assert.equal(destination.searchParams.get("client_id"), `investi-qa-${provider}-id`);
    assert.equal(destination.searchParams.get("redirect_uri"), `${baseURL}/api/auth/callback/${provider}`);
    assert.equal(destination.searchParams.has("client_secret"), false);
    const state = destination.searchParams.get("state"); assert.ok(state);
    await page.unroute("**/api/auth/sign-in/social");
    await page.goBack();
    await page.getByRole("button", { name: /Pokračovat přes Google/ }).waitFor();
    assert.ok(await page.getByRole("button", { name: /Pokračovat přes Google/ }).isEnabled(), "Browser Back must clear the redirect lock");
    await page.goto(`${baseURL}/api/auth/callback/${provider}?state=${encodeURIComponent(state)}&error=access_denied&error_description=PRIVATE_PROVIDER_DETAIL`);
    await page.getByRole("main").getByRole("alert").waitFor();
    assert.equal(new URL(page.url()).pathname, `/${mode}`);
    assert.match(await page.getByRole("main").getByRole("alert").innerText(), /zrušeno/);
    assert.ok(!(await page.locator("body").innerText()).includes("PRIVATE_PROVIDER_DETAIL"));
  }
  await page.goto(`${baseURL}/api/auth/callback/google?error=access_denied`);
  assert.equal(new URL(page.url()).pathname, "/sign-in");
  await page.getByRole("main").getByRole("alert").waitFor();
  await page.goto(`${baseURL}/sign-in?error=email_not_found&error_description=PRIVATE_PROVIDER_DETAIL`);
  assert.match(await page.getByRole("main").getByRole("alert").innerText(), /neposkytla e-mail/);
  await page.route("**/api/auth/sign-in/social", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "PROVIDER_NOT_FOUND", message: "PRIVATE_PROVIDER_DETAIL" }) }));
  await page.getByRole("button", { name: /Pokračovat přes Google/ }).click();
  await page.getByRole("main").getByRole("alert").filter({ hasText: "není dostupný" }).waitFor();
  assert.ok(await page.getByRole("button", { name: /Pokračovat přes Google/ }).isEnabled());
  await page.unroute("**/api/auth/sign-in/social");

  await page.goto(`${baseURL}/learn`); assert.equal(new URL(page.url()).pathname, "/sign-in");
  const email = `auth-qa-${randomUUID()}@example.com`, password = randomUUID();
  // The onboarding save step posts the same Better Auth sign-up; its UI is covered by validate-onboarding-redesign.
  assert.ok((await page.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Jana", email, password } })).ok());
  await page.goto(`${baseURL}/learn`); await page.waitForURL("**/onboarding");
  const [{ id }] = await sql`select id from "user" where email = ${email}`; ids.push(id);
  assert.equal((await sql`select * from lesson_award where user_id = ${id}`).length, 0);
  assert.equal((await sql`select * from lesson_progress where user_id = ${id}`).length, 0);
  await page.goto(`${baseURL}/sign-in`); await page.waitForURL("**/onboarding");
  // An existing completed profile exercises the authoritative returning-user gate.
  await sql`insert into learning_profile (user_id, onboarding_completed_at) values (${id}, now()) on conflict (user_id) do update set onboarding_completed_at = now()`;
  await context.clearCookies();
  await page.goto(`${baseURL}/sign-in`);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.waitForURL("**/learn");
  await page.goto(`${baseURL}/sign-up`); await page.waitForURL("**/learn");
  await context.clearCookies();
  await page.goto(`${baseURL}/sign-in`);
  await page.getByRole("button", { name: "Vyzkoušet demo", exact: true }).click();
  await page.waitForURL("**/learn");
  const session = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json();
  assert.equal(session.user.isAnonymous, true); ids.push(session.user.id);
  const bodies = await Promise.all(publicBodies);
  for (const body of bodies) for (const value of ["investi-qa-google-secret", "investi-qa-facebook-secret", "investi-qa-google-id", "investi-qa-facebook-id"]) assert.ok(!body.includes(value), "credential leaked into app HTML/JS");
  assert.deepEqual(errors, []);
  console.log("Auth smoke passed: email signup/login, onboarding/returning redirects, demo, provider visibility, OAuth requests/cancellation/errors, secret boundary, keyboard/focus, reflow. Five screenshots:", output);
} finally {
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await browser.close(); await sql.end();
}
