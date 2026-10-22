// Fresh local production server only, started with EMAIL_TRANSPORT=outbox, RESEND_API_KEY empty and EMAIL_OUTBOX_DIR=$RECOVERY_OUTBOX_DIR,
// so every e-mail lands in that directory instead of Resend. DATABASE_URL must be a disposable local database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import postgres from "postgres";

const baseURL = process.env.RECOVERY_TEST_URL;
const outbox = process.env.RECOVERY_OUTBOX_DIR;
const local = (url) => ["localhost", "127.0.0.1"].includes(new URL(url).hostname);
assert.ok(baseURL && local(baseURL), "RECOVERY_TEST_URL must be a loopback server.");
assert.ok(outbox, "RECOVERY_OUTBOX_DIR must match the server's EMAIL_OUTBOX_DIR.");
assert.ok(process.env.DATABASE_URL && local(process.env.DATABASE_URL), "DATABASE_URL must be a local database.");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL, headless: true });
const output = process.env.RECOVERY_SCREENSHOT_DIR ?? "/tmp/investi-recovery-screenshots";
await mkdir(output, { recursive: true });
await mkdir(outbox, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const run = randomUUID().slice(0, 8);
const ids = [];

/** Settings scrolls inside its own layout, so its screenshots frame `target` in the viewport instead of the full page. */
async function reflow(label, target) {
  const shoot = async (path) => {
    if (target) { await target.scrollIntoViewIfNeeded(); await page.screenshot({ path }); }
    else await page.screenshot({ path, fullPage: true });
  };
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: page overflow at ${width}`);
    assert.deepEqual(await page.locator("main button, main input, main label, main h1").evaluateAll((elements) => elements.filter((e) => e.tagName !== "INPUT" && e.scrollWidth > e.clientWidth + 2).map((e) => e.textContent)), [], `${label}: clipped controls at ${width}`);
    // Text inputs scroll their value natively; their control box must still fit the viewport.
    assert.equal(await page.locator("main input").evaluateAll((elements) => elements.some((e) => e.getBoundingClientRect().right > innerWidth)), false, `${label}: input box overflows at ${width}`);
    if (width !== 1440) await shoot(`${output}/${label}-${width}.png`);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  // Captured before the check so a failing run leaves the evidence behind.
  await shoot(`${output}/${label}-320-text-200.png`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at 320 and 200% text`);
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  await page.setViewportSize({ width: 1440, height: 1000 });
}

const seen = new Set();
/** The newest unseen message for `to`; the server sends after responding, so wait briefly. */
async function mailFor(to, kind) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const file of (await readdir(outbox)).filter((file) => file.endsWith(".json")).sort()) {
      if (seen.has(file)) continue;
      const message = JSON.parse(await readFile(join(outbox, file), "utf8"));
      if (message.to === to && message.kind === kind) { seen.add(file); return message.text.match(/https?:\/\/\S+/)[0]; }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`no ${kind} e-mail for ${to}`);
}
async function noMailFor(to) {
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  for (const file of (await readdir(outbox)).filter((file) => file.endsWith(".json"))) assert.notEqual(JSON.parse(await readFile(join(outbox, file), "utf8")).to, to, `unexpected e-mail for ${to}`);
}
const session = async (ctx) => (await ctx.request.get(`${baseURL}/api/auth/get-session`)).json();

try {
  const email = `rcv-${run}@example.com`, unknown = `rcv-${run}-x@example.com`;
  const signUp = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: "Obnova QA", email, password: "first-password-1", callbackURL: "/verify-email" } });
  assert.ok(signUp.ok(), `sign-up: ${signUp.status()}`);
  const { user } = await session(context); ids.push(user.id);
  await sql`insert into learning_profile (user_id, onboarding_completed_at) values (${user.id}, now()) on conflict (user_id) do update set onboarding_completed_at = now()`;
  await mailFor(email, "email-verification");
  // A second device stays signed in until the reset.
  const otherDevice = await browser.newContext();
  assert.ok((await otherDevice.request.post(`${baseURL}/api/auth/sign-in/email`, { headers: { origin: baseURL }, data: { email, password: "first-password-1" } })).ok());
  await context.clearCookies();

  await page.clock.install();
  // 1. Sign-in offers the reset link with a visible focus ring and a 44 px target.
  await page.goto(`${baseURL}/sign-in`);
  const forgot = page.getByRole("link", { name: "Zapomenuté heslo?" });
  await forgot.focus();
  assert.equal(await forgot.evaluate((e) => getComputedStyle(e).outlineStyle), "solid");
  assert.ok(await forgot.evaluate((e) => e.getBoundingClientRect().height >= 44));
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await forgot.click(); await page.waitForURL("**/forgot-password");
  assert.equal(await page.getByRole("button", { name: "Vyzkoušet demo" }).count(), 0, "recovery screens leave the demo out");
  assert.equal(await page.getByLabel("E-mail", { exact: true }).inputValue(), email);
  await reflow("forgot-password");

  // 2. Unknown and known addresses get the same confirmation; only the account receives mail.
  for (const address of [unknown, email]) {
    await page.goto(`${baseURL}/forgot-password`);
    await page.getByLabel("E-mail", { exact: true }).fill(address);
    await page.getByRole("button", { name: "Poslat odkaz" }).click();
    const status = page.getByRole("main").getByRole("status").filter({ hasText: "Pokud k adrese" });
    await status.waitFor();
    assert.equal((await status.innerText()).replace(address, "<adresa>"), "Pokud k adrese <adresa> existuje účet, poslali jsme na ni odkaz pro nastavení nového hesla. Odkaz platí 30 minut.");
    assert.ok(await page.waitForFunction(() => document.activeElement?.matches("main [role=status]"), null, { timeout: 5_000 }).then(() => true, () => false), "focus moves to the confirmation");
  }
  const resend = page.getByRole("button", { name: /Poslat znovu za/ });
  assert.equal(await resend.isDisabled(), true);
  await reflow("forgot-password-sent");
  await page.clock.fastForward(61_000);
  const resendReady = page.getByRole("button", { name: "Poslat znovu", exact: true });
  await resendReady.waitFor();
  await page.route("**/api/auth/request-password-reset", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "120", "Content-Type": "application/json" }, body: JSON.stringify({ message: "Too many requests" }) }));
  await resendReady.click();
  await page.getByRole("alert").filter({ hasText: "2 min." }).waitFor();
  await page.unroute("**/api/auth/request-password-reset");
  await noMailFor(unknown);
  const resetLink = await mailFor(email, "password-reset");

  // 3. Token is retained in memory but removed from the address bar; a single field can show/hide it.
  const resetResponse = await page.goto(resetLink);
  assert.equal(resetResponse.headers()["referrer-policy"], "no-referrer");
  await page.getByRole("heading", { name: "Nastav si nové heslo" }).waitFor();
  await page.waitForURL((url) => url.pathname === "/reset-password" && !url.searchParams.has("token"));
  await reflow("reset-password");
  await page.getByLabel("Nové heslo", { exact: true }).fill("second-password-2");
  await page.getByRole("button", { name: "Zobrazit heslo" }).click();
  assert.equal(await page.getByLabel("Nové heslo", { exact: true }).getAttribute("type"), "text");
  await page.getByRole("button", { name: "Skrýt heslo" }).click();
  await page.getByRole("button", { name: "Uložit nové heslo" }).click();
  await page.waitForURL("**/sign-in?password=reset");
  await page.getByRole("main").getByRole("status").filter({ hasText: "Heslo je změněné a ostatní přihlášení jsou ukončená." }).waitFor();
  assert.equal(await page.getByLabel("E-mail", { exact: true }).inputValue(), email);
  assert.equal(await session(otherDevice), null, "the reset signs out other devices");

  // 4. The link works once; reopening it explains what to do next.
  await page.goto(resetLink); await page.waitForURL((url) => url.searchParams.get("error") === "INVALID_TOKEN");
  await page.getByRole("heading", { name: "Odkaz už neplatí" }).waitFor();
  assert.equal(await page.getByRole("link", { name: "Poslat nový odkaz" }).getAttribute("href"), "/forgot-password");
  await reflow("reset-password-expired");

  // 5. The new password signs in.
  await page.goto(`${baseURL}/sign-in?password=reset`);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill("second-password-2");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.waitForURL("**/learn");

  // Opening the reset link proved the mailbox, so the address is verified now.
  assert.equal((await sql`select email_verified from "user" where id = ${user.id}`)[0].email_verified, true);

  // 6. Settings shows an unverified address and sends a new link, which verifies it.
  await sql`update "user" set email_verified = false where id = ${user.id}`;
  await page.goto(`${baseURL}/settings?section=account`);
  await page.getByText("Neověřený", { exact: true }).filter({ visible: true }).waitFor();
  await page.getByRole("link", { name: "Ověřit e-mail" }).click(); await page.waitForURL("**/settings?section=security");
  await page.getByText("Zatím neověřený. Ověření potvrdí, že adresa patří tobě.").filter({ visible: true }).waitFor();
  await writeFile(join(outbox, ".force-failure"), "QA");
  try {
    await page.getByRole("button", { name: "Poslat ověřovací odkaz" }).click();
    await page.getByRole("alert").filter({ hasText: "Odkaz se nepodařilo odeslat" }).waitFor();
  } finally { await unlink(join(outbox, ".force-failure")); }
  await page.getByRole("button", { name: "Poslat ověřovací odkaz" }).click();
  assert.equal(await page.getByRole("main").getByRole("status").filter({ hasText: "Odkaz jsme poslali" }).innerText(), `Odkaz jsme poslali na ${email}. Platí 24 hodin.`);
  await reflow("settings-security-unverified", page.getByRole("button", { name: "Poslat ověřovací odkaz" }));
  await page.goto(await mailFor(email, "email-verification")); await page.waitForURL("**/verify-email");
  await page.getByRole("heading", { name: "E-mail je ověřený" }).waitFor();
  await reflow("verify-email");
  await page.getByRole("link", { name: "Pokračovat v učení" }).click(); await page.waitForURL("**/learn");
  assert.equal((await sql`select email_verified from "user" where id = ${user.id}`)[0].email_verified, true);
  await page.goto(`${baseURL}/verify-email?error=INVALID_TOKEN`);
  assert.equal(await page.getByRole("link", { name: "Otevřít Nastavení" }).getAttribute("href"), "/settings?section=security");

  // 7. Password change: focus moves into the form, a wrong current password is explained, other devices sign out.
  const thirdDevice = await browser.newContext();
  assert.ok((await thirdDevice.request.post(`${baseURL}/api/auth/sign-in/email`, { headers: { origin: baseURL }, data: { email, password: "second-password-2" } })).ok());
  await page.goto(`${baseURL}/settings?section=security`);
  await page.getByText("Ověřený", { exact: true }).filter({ visible: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Poslat ověřovací odkaz" }).count(), 0);
  await page.getByRole("button", { name: "Změnit heslo" }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "current-password", null, { timeout: 2_000 });
  await reflow("settings-password-form", page.getByRole("checkbox", { name: /Odhlásit ostatní zařízení/ }));
  await page.getByLabel("Současné heslo").fill("not-the-password");
  await page.getByLabel("Nové heslo", { exact: true }).fill("third-password-3");
  await page.getByRole("button", { name: "Uložit nové heslo" }).click();
  await page.getByRole("main").getByRole("alert").filter({ hasText: "Současné heslo není správně." }).waitFor();
  await page.getByLabel("Současné heslo").fill("second-password-2");
  assert.ok(await page.getByRole("checkbox", { name: /Odhlásit ostatní zařízení/ }).isChecked(), "signing out other devices is the default");
  await page.getByRole("button", { name: "Uložit nové heslo" }).click();
  await page.getByRole("main").getByRole("status").filter({ hasText: "Heslo je změněné. Ostatní zařízení jsou odhlášená." }).waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === "Změnit heslo", null, { timeout: 2_000 });
  assert.equal(await session(thirdDevice), null, "other devices are signed out");
  assert.ok((await session(context))?.user, "this device stays signed in");
  await page.reload(); await page.getByRole("button", { name: "Změnit heslo" }).waitFor();

  // 8. Cancel returns focus to the trigger without changing anything.
  await page.getByRole("button", { name: "Změnit heslo" }).click();
  await page.getByRole("button", { name: "Zrušit" }).click();
  await page.waitForFunction(() => document.activeElement?.textContent === "Změnit heslo", null, { timeout: 2_000 });
  await context.clearCookies();
  assert.ok((await context.request.post(`${baseURL}/api/auth/sign-in/email`, { headers: { origin: baseURL }, data: { email, password: "third-password-3" } })).ok(), "the changed password signs in");

  // 9. Verified-current email change: approve old, then verify new, and notify old.
  await page.goto(`${baseURL}/settings?section=security`);
  await page.getByRole("button", { name: "Změnit e-mail", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("name") === "email");
  const nextEmail = `rcv-${run}-changed@example.com`;
  await page.getByLabel("Nový e-mail", { exact: true }).fill(nextEmail);
  await reflow("settings-email-change", page.getByRole("button", { name: "Poslat potvrzení změny" }));
  await page.getByRole("button", { name: "Poslat potvrzení změny" }).click();
  await page.getByRole("status").filter({ hasText: "Zkontroluj současnou schránku" }).waitFor();
  assert.equal((await sql`select email from "user" where id = ${user.id}`)[0].email, email);
  await page.goto(await mailFor(email, "email-change-confirmation"));
  assert.equal((await sql`select email from "user" where id = ${user.id}`)[0].email, email);
  await page.goto(await mailFor(nextEmail, "email-verification"));
  await page.getByRole("heading", { name: "E-mail je ověřený" }).waitFor();
  assert.equal((await sql`select email from "user" where id = ${user.id}`)[0].email, nextEmail);
  await mailFor(email, "email-changed");

  // 10. Social-only first password is set directly with a fresh session, without waiting for mail.
  await sql`delete from account where user_id = ${user.id} and provider_id = 'credential'`;
  await page.goto(`${baseURL}/settings?section=security`);
  const firstPassword = page.getByRole("form", { name: "Nastavit heslo", exact: true });
  await firstPassword.getByLabel("Nové heslo", { exact: true }).fill("fourth-password-4");
  await firstPassword.getByRole("button", { name: "Nastavit heslo", exact: true }).click();
  await page.getByRole("button", { name: "Změnit heslo", exact: true }).waitFor();
  assert.ok((await context.request.post(`${baseURL}/api/auth/sign-in/email`, { headers: { origin: baseURL }, data: { email: nextEmail, password: "fourth-password-4" } })).ok());

  await otherDevice.close(); await thirdDevice.close();
  assert.deepEqual(errors, []);
  console.log(`Account recovery browser flow passed: forgot → e-mail → reset → sign-in, single-use link, verification, password change, focus, reflow. Screenshots: ${output}`);
} finally {
  for (const id of ids) await sql`delete from verification where value = ${id}`;
  for (const id of ids) await sql`delete from "user" where id = ${id}`;
  await browser.close(); await sql.end();
}
