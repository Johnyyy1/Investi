import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { chromium } from "playwright";

// Explicit local credentials only; never inherit a .env or call a live provider.
const local = (url) => ["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname);
const baseURL = process.env.PERSONALIZATION_TEST_URL;
assert.ok(baseURL && local(baseURL));
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_6a3a_qa");
assert.equal(process.env.PERSONALIZATION_QA_DISPOSABLE, "1");
assert.equal(process.env.MARKET_DATA_PROVIDER, "deterministic");
assert.equal(process.env.FX_DATA_PROVIDER, "deterministic");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ids = [];
try {
  const context = await browser.newContext();
  const errors = [];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const email = `profile-browser-${randomUUID()}@example.com`;
  const signup = () => context.request.post(`${baseURL}/api/auth/sign-up/email`, {
    headers: { origin: baseURL }, data: { name: "Profil QA", email, password: randomUUID() },
  });
  let response = await signup();
  if (response.status() === 429) { await new Promise((resolve) => setTimeout(resolve, 11000)); response = await signup(); }
  assert.ok(response.ok(), `signup returned ${response.status()}`);
  const [{ id }] = await sql`select id from "user" where email = ${email}`;
  ids.push(id);
  await page.goto(`${baseURL}/learn`);
  await page.waitForURL("**/onboarding");
  await page.getByRole("heading", { name: "Co se chceš naučit?", exact: true }).waitFor();
  // A legacy account with existing progress and no profile must never be re-gated.
  await sql`insert into lesson_progress (user_id, lesson_id, status, last_position, updated_at) values (${id}, 'foundations-why-invest', 'in_progress', 1, now())`;
  await page.goto(`${baseURL}/learn`);
  await page.getByRole("region", { name: "Doporučeno pro tebe", exact: true }).waitFor();
  await page.goto(`${baseURL}/onboarding`);
  await page.waitForURL("**/learn");
  await page.goto(`${baseURL}/settings`);
  await page.getByRole("heading", { name: "Účet", exact: true }).waitFor();
  await page.getByRole("button", { name: "Změnit cíl nebo úroveň…", exact: true }).click();
  await page.getByRole("button", { name: "Uložit předvolby", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Tvoje předvolby učení jsou uložené." }).waitFor();
  const [profile] = await sql`select * from learning_profile where user_id = ${id}`;
  assert.ok(profile.onboarding_completed_at);
  assert.equal(profile.personalized_onboarding_completed_at, null);
  assert.equal(profile.diagnostic_result, null);
  // Incomplete profile + existing progress also bypasses the initial onboarding gate.
  await sql`update learning_profile set onboarding_completed_at = null where user_id = ${id}`;
  await page.goto(`${baseURL}/learn`);
  await page.getByRole("region", { name: "Doporučeno pro tebe", exact: true }).waitFor();
  // Existing portfolio-only account with no profile remains accessible.
  await sql`delete from learning_profile where user_id = ${id}`;
  await sql`delete from lesson_progress where user_id = ${id}`;
  await sql`insert into portfolio (id, user_id, opened_at, opening_capital_minor) values (${randomUUID()}, ${id}, now(), 0)`;
  await page.goto(`${baseURL}/lab/portfolio`);
  await page.getByRole("heading", { name: "Získej kapitál učením", exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/lab/portfolio");
  assert.equal(await page.getByText("0 / 420 XP", { exact: true }).count(), 0);
  assert.equal((await sql`select * from lesson_award where user_id = ${id}`).length, 0);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("PASS: new account retains onboarding; existing missing/incomplete profiles retain Learn, Settings saves, and Portfolio Lab access; no XP or fabricated diagnostic.");
} finally {
  await browser.close();
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await sql.end();
}
