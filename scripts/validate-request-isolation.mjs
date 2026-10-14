// Request-scoped memoization acceptance: session, profile, learner and unlock reads are shared only inside one
// render. Interleaved users never see each other's data, mutations are visible on the next request, and sign-out
// and account switching take effect immediately. Local app + disposable local database only.
//   REQUEST_ISOLATION_TEST_URL=http://localhost:3100 DATABASE_URL=postgresql://…@127.0.0.1:…/… node scripts/validate-request-isolation.mjs
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

const baseURL = process.env.REQUEST_ISOLATION_TEST_URL;
const local = (value) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
assert.ok(baseURL && local(baseURL), "REQUEST_ISOLATION_TEST_URL must be a local app.");
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL), "Requires a disposable local database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome", headless: true });
const ids = [];
const origin = { origin: baseURL };

/** The RSC payload embedded in the HTML carries the settings props, escaped or not. */
const prop = (html, name) => html.match(new RegExp(`\\\\?"${name}\\\\?":\\\\?"([^"\\\\]*)`))?.[1];

async function account(name) {
  const context = await browser.newContext({ timezoneId: "Europe/Prague" });
  const email = `isolation-${randomUUID()}@example.com`, password = randomUUID();
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: origin, data: { name, email, password } });
  assert.ok(response.ok(), `sign-up: ${response.status()}`);
  const { user } = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json();
  ids.push(user.id);
  await sql`insert into learning_profile (user_id, experience_level, goals, interests, daily_goal_minutes, time_zone, onboarding_completed_at) values (${user.id}, 'BASIC', '{CONFIDENCE}', '{}', 10, 'Europe/Prague', now())`;
  return { context, id: user.id, name, email, password };
}
async function award(userId, lessonId, practiceCapitalMinor) {
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, completed_at, updated_at) values (${userId}, ${lessonId}, 'completed', 0, now(), now())`;
  await sql`insert into lesson_award (user_id, lesson_id, xp, practice_capital_minor, reward_policy_version, learning_date, time_zone, awarded_at) values (${userId}, ${lessonId}, 60, ${practiceCapitalMinor}, 1, current_date, 'UTC', now())`;
}
async function settings(who) {
  const response = await who.context.request.get(`${baseURL}/settings`);
  assert.equal(response.status(), 200);
  return response.text();
}

try {
  const [lessonA, lessonB] = (await sql`select id from lesson where is_published order by id limit 2`).map((row) => row.id);
  const ada = await account("Ada Izolace"), bob = await account("Bořek Izolace");
  await award(ada.id, lessonA, 200_000n);

  // Hard loads (layout + page in one request) for both users, interleaved and concurrent.
  for (let round = 0; round < 12; round += 1) {
    const pages = await Promise.all([settings(ada), settings(bob), settings(ada), settings(bob)]);
    for (const [index, html] of pages.entries()) {
      const [self, other, capital] = index % 2 === 0 ? [ada, bob, "200000"] : [bob, ada, "0"];
      assert.ok(html.includes(self.email), `round ${round}: own email present`);
      assert.ok(!html.includes(other.email) && !html.includes(other.name), `round ${round}: no data of the other user`);
      assert.equal(prop(html, "earnedCapital"), capital, `round ${round}: exact own Practice Capital`);
    }
    const learn = await Promise.all([ada, bob].map((who) => who.context.request.get(`${baseURL}/learn`).then((r) => r.text())));
    assert.ok(learn[0].includes(ada.name) && !learn[0].includes(bob.name));
    assert.ok(learn[1].includes(bob.name) && !learn[1].includes(ada.name));
  }

  // A mutation between requests is visible on the next one: nothing outlives its request.
  await award(bob.id, lessonB, 123_457n);
  assert.equal(prop(await settings(bob), "earnedCapital"), "123457", "new receipt visible immediately");
  assert.equal(prop(await settings(ada), "earnedCapital"), "200000");

  // Soft navigation in a real page keeps the user's own shell and data.
  const page = await ada.context.newPage();
  await page.goto(`${baseURL}/learn`);
  for (const route of ["/progress", "/lab", "/settings", "/learn"]) {
    await page.evaluate((href) => window.next.router.push(href), route);
    await page.waitForURL(`**${route}`);
    await page.locator("h1").first().waitFor({ state: "attached" });
    const html = await page.content();
    assert.ok(html.includes(ada.name) && !html.includes(bob.name), `soft navigation to ${route}`);
  }

  // Sign-out takes effect on the very next request.
  assert.ok((await ada.context.request.post(`${baseURL}/api/auth/sign-out`, { headers: origin, data: {} })).ok());
  await page.goto(`${baseURL}/learn`);
  await page.waitForURL("**/sign-in");

  // Switching accounts in the same browser shows only the new account.
  assert.ok((await ada.context.request.post(`${baseURL}/api/auth/sign-in/email`, { headers: origin, data: { email: bob.email, password: bob.password } })).ok());
  const switched = await (await ada.context.request.get(`${baseURL}/settings`)).text();
  assert.ok(switched.includes(bob.email) && !switched.includes(ada.email), "account switch shows the new account only");
  assert.equal(prop(switched, "earnedCapital"), "123457");

  // Demo identities stay isolated and get their one-time lab access.
  const demo = await browser.newContext();
  const signIn = await demo.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: origin, data: {} });
  assert.equal(signIn.status(), 200);
  ids.push((await signIn.json()).user.id);
  // The first render records the grant; the Practice Capital read of that same render can still precede it.
  assert.equal((await demo.request.get(`${baseURL}/learn`)).status(), 200);
  const demoSettings = await (await demo.request.get(`${baseURL}/settings`)).text();
  assert.equal(prop(demoSettings, "earnedCapital"), "500000", "demo grant counted once");
  assert.ok(!demoSettings.includes(ada.email) && !demoSettings.includes(bob.email));
  assert.equal((await sql`select count(*)::int as n from progression_unlock where user_id = ${ids.at(-1)}`)[0].n, 1);

  console.log("PASS: concurrent multi-user hard loads, exact per-user Practice Capital, fresh data after mutation, soft navigation, sign-out, account switch, demo isolation.");
} finally {
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await sql.end();
  await browser.close();
}
