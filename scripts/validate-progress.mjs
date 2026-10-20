// Progress UI acceptance against an explicitly disposable local database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import postgres from "postgres";
import { chromium } from "playwright";
import { finishOnboarding } from "./onboarding-helper.mjs";

const baseURL = process.env.PROGRESS_TEST_URL;
const local = (value) => ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname);
assert.ok(baseURL && local(baseURL) && process.env.DATABASE_URL && local(process.env.DATABASE_URL));
assert.equal(new URL(process.env.DATABASE_URL).pathname, "/investi_progress_qa");
assert.equal(process.env.PROGRESS_QA_DISPOSABLE, "1");
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const output = process.env.PROGRESS_SCREENSHOT_DIR ?? "/tmp/investi-progress-redesign";
await mkdir(output, { recursive: true });
const userIds = [];
const errors = [];
const lessons = await sql`select l.id,l.title,l.slug,m.slug as module_slug from lesson l join learning_module m on m.id=l.module_id where l.is_published=true order by m.position,l.position`;
assert.equal(lessons.length, 27);
const foundation = lessons.filter((lesson) => lesson.module_slug === "investing-foundations");
const returns = lessons.filter((lesson) => lesson.module_slug === "returns");
const href = (lesson) => `/learn/${lesson.module_slug}/${lesson.slug}`;

async function learner(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: "Europe/Prague", reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name, email: `progress-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(response.ok(), `signup: ${response.status()}`);
  const { user } = await (await context.request.get(`${baseURL}/api/auth/get-session`)).json();
  userIds.push(user.id);
  await page.goto(`${baseURL}/onboarding`); await finishOnboarding(page);
  if (await page.getByRole("button", { name: "Teď ne", exact: true }).count()) await page.getByRole("button", { name: "Teď ne", exact: true }).click();
  await sql`update learning_profile set time_zone='Europe/Prague',daily_goal_minutes=10 where user_id=${user.id}`;
  return { page, id: user.id };
}
/** Receipts mirror reward policy v3: 60 XP each, no capital in Foundations and 2,000 Kč beyond it. */
async function complete(userId, items) {
  for (const item of items) {
    const capital = item.module_slug === "investing-foundations" ? 0 : 200000;
    await sql`insert into lesson_progress(user_id,lesson_id,status,last_position,completed_at,updated_at) values(${userId},${item.id},'completed',0,clock_timestamp(),clock_timestamp()) on conflict(user_id,lesson_id) do update set status='completed',completed_at=clock_timestamp(),updated_at=clock_timestamp()`;
    await sql`insert into lesson_award(user_id,lesson_id,xp,practice_capital_minor,reward_policy_version,learning_date,time_zone,awarded_at) values(${userId},${item.id},60,${capital},3,(now() at time zone 'Europe/Prague')::date,'Europe/Prague',clock_timestamp()) on conflict(user_id,lesson_id) do nothing`;
  }
}
const koruna = (minor) => `${new Intl.NumberFormat("cs-CZ").format(minor / 100)}\u00a0Kč`;
const start = (userId, lesson, position) => sql`insert into lesson_progress(user_id,lesson_id,status,last_position,updated_at) values(${userId},${lesson.id},'in_progress',${position},clock_timestamp()) on conflict(user_id,lesson_id) do update set status='in_progress',last_position=${position},updated_at=clock_timestamp()`;

async function render(page, label, { state, xp, capital, count, action, actionHref, lab }) {
  const root = () => page.locator("[data-investi-progress]:visible");
  async function settle() {
    await root().waitFor();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((image) => image.decode().catch(() => {}))); window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  }
  async function reflow(width, note) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: overflow at ${note}`);
    const clipped = await root().locator("h1,h2,h3,h4,p,a,button,summary,dt,dd,li").evaluateAll((elements) => elements.filter((el) => el.clientWidth && el.scrollWidth > el.clientWidth + 2).map((el) => el.textContent?.slice(0, 80)));
    assert.deepEqual(clipped, [], `${label}: clipped text at ${note}`);
    const offscreen = await root().locator("a:visible,button:visible,summary:visible").evaluateAll((elements, viewport) => elements.filter((el) => { const box = el.getBoundingClientRect(); return box.left < -1 || box.right > viewport + 1; }).map((el) => el.textContent?.slice(0, 60)), width);
    assert.deepEqual(offscreen, [], `${label}: controls outside the viewport at ${note}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseURL}/progress`); await settle();
  assert.equal(await root().getAttribute("data-state"), state, `${label}: state`);
  assert.equal(await root().getByTestId("total-xp").textContent(), `${new Intl.NumberFormat("cs-CZ").format(xp)} XP`);
  assert.equal(await root().getByTestId("available-progress").textContent(), `${count} / 27`);
  // Capital is read from receipts and agrees in the summary and the breakdown card.
  assert.equal(await root().getByTestId("total-practice-capital").textContent(), koruna(capital), `${label}: capital`);
  assert.equal(await root().getByTestId("earned-practice-capital").textContent(), koruna(capital), `${label}: summary capital`);
  assert.equal(await root().getByRole("link", { name: lab.link, exact: true }).getAttribute("href"), "/lab/portfolio");
  assert.equal(await root().getByRole("heading", { name: lab.title, exact: true }).count(), 1, `${label}: Lab card title`);
  assert.equal(await root().getByText("Připravujeme", { exact: true }).count(), 0, `${label}: every chapter is published`);
  assert.equal(await root().getByText(/^(?:\d+ )?(?:streak|série)/i).count(), 0, `${label}: no streaks`);
  const continuation = root().getByRole("link", { name: action, exact: true });
  assert.equal(await continuation.count(), 1, `${label}: one ${action} link`);
  assert.equal(await continuation.getAttribute("href"), actionHref, `${label}: continuation`);
  assert.ok((await root().getByRole("link", { name: /^Zopakovat celou lekci/ }).count()) === Math.min(count, 3), `${label}: shelf review links`);
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 }); await settle();
    await reflow(width, `${width}px`);
    assert.equal(await page.locator("main h1:visible").count(), 1);
    assert.ok(await root().locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)));
    const nav = page.getByRole("navigation", { name: width < 1024 ? "Mobilní navigace" : "Hlavní navigace" });
    assert.equal(await nav.locator('[aria-current="page"]').getAttribute("href"), "/progress");
    const account = page.getByLabel("Nabídka účtu", { exact: true });
    await account.focus(); await account.press("Enter"); await page.getByRole("banner").getByRole("link", { name: "Nastavení", exact: true }).waitFor(); await account.press("Escape");
    assert.equal(await account.evaluate((element) => element === document.activeElement && !element.parentElement.open), true);
    await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; }); await settle();
  await reflow(320, "320px/200%");
  await page.screenshot({ path: `${output}/${label}-320-text-200.png`, fullPage: true, animations: "disabled" });
  await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await settle();
    for (const target of await root().locator("a:visible,summary:visible,button:visible").all()) {
      await target.focus();
      assert.equal(await target.evaluate((el) => el === document.activeElement && getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) >= 3), true, `visible keyboard focus: ${await target.textContent()}`);
      assert.ok((await target.boundingBox()).height >= 44, `touch target ${width}: ${await target.textContent()}`);
    }
    const chapter = root().locator("details").filter({ has: page.locator('[aria-label="Lekce kapitoly Základy investování"]') });
    const wasOpen = await chapter.evaluate((element) => element.open);
    await chapter.locator(":scope > summary").focus(); await chapter.locator(":scope > summary").press("Enter");
    assert.equal(await chapter.evaluate((element) => element.open), !wasOpen, "chapter toggles from the keyboard");
    await chapter.locator(":scope > summary").press("Enter");
    const explanation = root().getByText("Jak funguje pokrok", { exact: true });
    await explanation.focus(); await explanation.press("Enter");
    assert.equal(await explanation.evaluate((el) => el.parentElement.open), true); await explanation.press("Enter");
  }
  assert.equal(await root().getByText("Jak funguje pokrok", { exact: true }).locator("svg").evaluate((el) => getComputedStyle(el).transitionDuration), "0s", "reduced motion");
  if (count > 3) {
    const more = root().locator("details").filter({ has: page.getByText(`Další hotové lekce (${count - 3})`, { exact: true }) });
    await more.locator("summary").press("Enter");
    assert.equal(await root().getByRole("region", { name: "Co už umíš", exact: true }).locator("article").count(), count);
    await more.locator("summary").press("Enter");
  }
  return root;
}

try {
  const { page, id } = await learner("Jana Nováková");
  const markets = foundation.find((lesson) => lesson.id === "foundations-markets");
  const locked = { link: "Zobrazit podmínky", title: "Zatím zamčený" };

  let root = await render(page, "zero", { state: "empty", xp: 0, capital: 0, count: 0, action: "Začít první lekci", actionHref: href(foundation[0]), lab: locked });
  assert.equal(await root().getByText("Tvoje police je zatím prázdná.", { exact: true }).count(), 1);
  assert.equal(await root().locator("img").count(), 0, "no guide for an expected empty state");
  assert.equal(await root().getByText(/^Cvičný kapitál přibývá učením\./).count(), 1, "zero capital explains how to earn it");
  assert.equal((await sql`select * from lesson_award where user_id=${id}`).length, 0, "visiting Progress awards nothing");

  await start(id, markets, 2);
  root = await render(page, "returning", { state: "empty", xp: 0, capital: 0, count: 0, action: "Pokračovat od kroku 3", actionHref: href(markets), lab: locked });
  await root().getByRole("link", { name: "Pokračovat od kroku 3", exact: true }).click(); await page.waitForURL(`**${href(markets)}`);
  await page.getByText("Krok 3", { exact: true }).waitFor();
  assert.equal((await sql`select last_position from lesson_progress where user_id=${id} and lesson_id='foundations-markets'`)[0].last_position, 2, "resume keeps the saved cursor");

  await complete(id, foundation.slice(0, 3));
  root = await render(page, "partial", { state: "partial", xp: 180, capital: 0, count: 3, action: "Pokračovat od kroku 3", actionHref: href(markets), lab: locked });
  assert.equal(await root().getByRole("heading", { name: "Co už umíš, Jana.", level: 1 }).count(), 1);
  assert.equal(await root().getByText("Tři lekce hotové, jedna rozdělaná. Rostou znalosti, ne tlak.", { exact: true }).count(), 1);
  assert.equal(await root().locator('[aria-current="step"]').getAttribute("href"), href(markets));
  assert.equal(await root().getByText("Kde to využiješ", { exact: true }).count(), 1, "authored Lab bridge");
  const before = await sql`select * from lesson_progress where user_id=${id} order by lesson_id`;
  const awards = await sql`select * from lesson_award where user_id=${id} order by lesson_id`;
  await root().getByRole("link", { name: /^Zopakovat celou lekci/ }).first().click();
  await page.waitForURL(`**${href(foundation[0])}`);
  await page.getByText("Lekce už je dokončena. Opakování uložený postup nezmění.", { exact: true }).waitFor();
  // Spoření vs. investování: concepts → one question → summary.
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  await page.getByRole("heading", { name: "Peníze v obálce", exact: true }).waitFor();
  await page.getByLabel("Koupím si za ně o něco méně.", { exact: true }).check();
  await page.getByRole("button", { name: "Zkontrolovat odpověď", exact: true }).click();
  await page.getByRole("heading", { name: "Správně", exact: true }).waitFor();
  await page.getByRole("button", { name: "Pokračovat", exact: true }).click();
  await page.getByRole("heading", { name: "Lekce hotová", exact: true }).waitFor();
  await page.getByRole("button", { name: "Dokončit opakování", exact: true }).click();
  await page.getByRole("heading", { name: "Opakování dokončeno", exact: true }).waitFor();
  await page.waitForTimeout(500);
  assert.deepEqual(await sql`select * from lesson_progress where user_id=${id} order by lesson_id`, before, "review leaves saved progress intact");
  assert.deepEqual(await sql`select * from lesson_award where user_id=${id} order by lesson_id`, awards, "review awards nothing");

  await complete(id, foundation);
  await page.goto(`${baseURL}/lab`); // The existing qualifying-account repair grants the unlock once.
  const unlocked = { link: "Otevřít Portfolio Lab", title: "Připravené k prvnímu nákupu" };
  root = await render(page, "chapter-complete", { state: "milestone", xp: 420, capital: 500000, count: 7, action: "Začít lekcí Co je výnos?", actionHref: href(returns[0]), lab: unlocked });
  assert.equal(await root().getByRole("heading", { name: "Základy investování máš za sebou.", level: 1 }).count(), 1);
  assert.equal(await root().getByText("Kapitola 01 hotová", { exact: true }).count(), 1);
  assert.equal(await root().getByRole("list", { name: "Za co je cvičný kapitál" }).getByRole("listitem").count(), 1, "one unlock grant, no XP-only receipts");
  assert.equal(await root().getByText("založení", { exact: false }).count(), 1, "fresh generation shows its opening, not a value");
  assert.equal((await sql`select * from progression_unlock where user_id=${id}`).length, 1);

  await start(id, returns[0], 1);
  root = await render(page, "next-chapter", { state: "partial", xp: 420, capital: 500000, count: 7, action: "Pokračovat od kroku 2", actionHref: href(returns[0]), lab: unlocked });
  assert.equal(await root().locator('[aria-current="step"]').getAttribute("href"), href(returns[0]));

  await complete(id, lessons);
  root = await render(page, "complete", { state: "complete", xp: 1620, capital: 4500000, count: 27, action: "Prozkoumat Lab", actionHref: "/lab", lab: unlocked });
  assert.equal(await root().locator('[aria-current="step"]').count(), 0);
  assert.equal(await root().getByRole("list", { name: "Za co je cvičný kapitál" }).getByRole("listitem").count(), 5, "newest five receipts");
  assert.equal(await root().getByText("Starší odměny (16)", { exact: true }).count(), 1, "older receipts wait behind a disclosure");
  const entitlement = await sql`select (select coalesce(sum(practice_capital_minor),0) from lesson_award where user_id=${id}) + (select coalesce(sum(practice_capital_minor),0) from progression_unlock where user_id=${id}) as total`;
  assert.equal(Number(entitlement[0].total), 4500000, "breakdown total equals the stored entitlement");
  assert.equal((await sql`select * from progression_unlock where user_id=${id}`).length, 1, "no duplicate unlock");
  await root().getByRole("link", { name: "Otevřít Portfolio Lab", exact: true }).click(); await page.waitForURL("**/lab/portfolio"); await page.getByTestId("portfolio-cash").waitFor();

  const other = await learner("Petr");
  await complete(other.id, [...foundation.slice(0, 3), ...returns.slice(0, 4)]);
  root = await render(other.page, "xp-without-prerequisites", { state: "partial", xp: 420, capital: 800000, count: 7, action: "Začít lekci", actionHref: href(returns[4]), lab: locked });
  assert.equal(await root().getByText("420 / 420 XP", { exact: true }).count(), 1);
  assert.equal(await root().getByText("Kapitál počká na odemčení Portfolio Labu. Pak ho můžeš investovat.", { exact: true }).count(), 1, "capital earned before the unlock waits");
  assert.match(await root().getByText(/^Odemkne se po dokončení všech lekcí Základů investování\./).textContent(), /není skutečné peníze/);
  assert.equal((await sql`select * from progression_unlock where user_id=${other.id}`).length, 0, "XP alone does not unlock");

  assert.deepEqual(errors, []);
  console.log(`PASS: zero, returning/saved cursor, partial, chapter milestone, next chapter, all complete, XP without prerequisites; authored shelf and Lab bridge, review invariants, authoritative XP/capital/ledger, receipt-derived capital breakdown, six widths plus 320/200% text, keyboard/focus/targets, reduced motion, real links, no browser errors. Screenshots: ${output}`);
} finally { await browser.close(); for (const id of userIds) await sql`delete from "user" where id=${id}`; await sql.end(); }
