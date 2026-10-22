// Disposable browser QA. Without ARTIFACTS_TEST_URL, creates/removes a temporary editor harness
// and starts its own dev server. With that URL, checks the shipped Settings UI on a fresh runtime.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import postgres from 'postgres';
import { chromium } from 'playwright';

assert.equal(process.env.ARTIFACTS_QA_DISPOSABLE, '1');
assert.equal(new URL(process.env.DATABASE_URL).pathname, '/investi_artifacts_qa');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname));
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const baseURL = process.env.ARTIFACTS_TEST_URL ?? process.env.BETTER_AUTH_URL;
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname));
const ids = [];
const output = 'test-results/artifacts';
await mkdir(output, { recursive: true });
let fixture, server, browser;
let serverLog = '';
const errors = [];
const goals = { goals: [{ label: 'Dlouhodobý plán', purpose: 'retirement', horizonMonths: 360, priority: 'important' }] };
async function seed(userId) {
  for (const version of [1, 2]) await sql`insert into learner_artifact (id,user_id,kind,version,payload,source_lesson_id,request_id) values (${randomUUID()},${userId},'goal_map',${version},${sql.json(goals)},'foundations-why-invest',${randomUUID()})`;
}
try {
  if (!process.env.ARTIFACTS_TEST_URL) {
    fixture = await mkdtemp(join('src/app/', 'artifact-qa-'));
    await writeFile(join(fixture, 'page.tsx'), `"use client";
import { useState } from "react";
import { ArtifactSaveControl } from "@/components/lesson/artifact-save-control";
import { saveArtifact, listArtifacts, deleteArtifact } from "@/features/artifacts/actions";
import { artifactExamples } from "@/features/artifacts/test-fixtures";
import { Button } from "@/components/ui/button";
export default function Editor() {
 const [label, setLabel] = useState("Dlouhodobý plán");
 const [response, setResponse] = useState("");
 return <main className="mx-auto max-w-2xl space-y-6 p-5"><h1>Výstup cvičení</h1><label>Cíl<input value={label} onChange={e => setLabel(e.target.value)} /></label>
 <ArtifactSaveControl content={{kind:"goal_map",payload:{goals:[{...artifactExamples.goal_map.goals[0],label}]}}} sourceLessonId="foundations-why-invest" />
 <Button onClick={async()=>setResponse(JSON.stringify(await saveArtifact({content:{kind:"goal_map",payload:artifactExamples.goal_map},sourceLessonId:"foundations-why-invest",consent:true,requestId:crypto.randomUUID()})))}>Přímý pokus uložit</Button>
 <Button onClick={async()=>setResponse(JSON.stringify(await listArtifacts()))}>Přímý pokus číst</Button>
 <Button onClick={async()=>setResponse(JSON.stringify(await deleteArtifact({id:crypto.randomUUID()})))}>Přímý pokus smazat</Button>
 <output>{response}</output></main>;
}`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', new URL(baseURL).port], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk; });
    const deadline = Date.now() + 60000;
    let ready = false;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(serverLog);
      try { if ((await fetch(`${baseURL}/${basename(fixture)}`)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready, serverLog);
  }
  browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const response = await context.request.post(`${baseURL}/api/auth/sign-up/email`, { headers: { origin: baseURL }, data: { name: 'Artifact QA', email: `artifacts-${randomUUID()}@example.com`, password: randomUUID() } });
  assert.ok(response.ok(), await response.text());
  const { user } = await response.json(); ids.push(user.id);
  await sql`insert into learning_profile(user_id,experience_level,goals,interests,daily_goal_minutes,time_zone,onboarding_completed_at) values(${user.id},'BEGINNER','{}','{}',10,'Europe/Prague',now())`;
  if (fixture) {
    await page.goto(`${baseURL}/${basename(fixture)}`);
    const consent = page.getByRole('checkbox');
    const save = page.getByRole('button', { name: 'Uložit výstup', exact: true });
    assert.equal(await consent.isChecked(), false);
    assert.equal(await save.isDisabled(), true);
    await consent.focus(); await page.keyboard.press('Space');
    assert.equal(await save.isEnabled(), true);
    // A failed request keeps the draft and can retry using the same request key.
    await page.route(`**/${basename(fixture)}`, route => route.request().method() === 'POST' ? route.abort() : route.continue());
    await save.click(); await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Cíl', { exact: true }).inputValue(), 'Dlouhodobý plán');
    await page.unroute(`**/${basename(fixture)}`);
    await save.click(); await page.getByRole('status').filter({ hasText: 'Verze 1' }).waitFor();
    await save.click(); await page.getByRole('status').filter({ hasText: 'Verze 1' }).waitFor();
    assert.equal((await sql`select * from learner_artifact where user_id=${user.id}`).length, 1);
    await page.getByLabel('Cíl', { exact: true }).fill('Upravený dlouhodobý plán');
    await save.click(); await page.getByRole('status').filter({ hasText: 'Verze 2' }).waitFor();
    assert.equal((await sql`select * from learner_artifact where user_id=${user.id}`).length, 2);
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/consent-320.png`, fullPage: true });
    console.log('PASS: unchecked explicit consent, keyboard toggle, network failure recovery, retry idempotence and edited revisions through real server actions.');
  } else await seed(user.id);
  const other = `${user.id}-other`; ids.push(other);
  await sql`insert into "user" (id,name,email,created_at,updated_at) values (${other},'Other QA',${`${other}@example.com`},now(),now())`;
  await seed(other);
  await page.goto(`${baseURL}/settings?section=data`);
  await page.getByRole('heading', { name: 'Výstupy z lekcí' }).waitFor();
  await page.getByRole('button', { name: 'Smazat: Mapa cílů' }).waitFor();
  const exported = await context.request.get(`${baseURL}/api/account/export`);
  assert.equal(exported.status(), 200);
  const data = await exported.json();
  assert.equal(data.learnerArtifacts.length, 2);
  assert.deepEqual(data.learnerArtifacts.map(row => row.version), [1, 2]);
  assert.ok(!JSON.stringify(data).includes(other));
  await page.getByRole('button', { name: 'Smazat: Mapa cílů' }).click();
  await page.getByRole('button', { name: 'Ponechat výstup' }).click();
  assert.equal(await page.getByRole('button', { name: 'Smazat: Mapa cílů' }).evaluate(el => el === document.activeElement), true);
  assert.equal((await sql`select * from learner_artifact where user_id=${user.id}`).length, 2);
  await page.getByRole('button', { name: 'Smazat: Mapa cílů' }).click();
  for (const width of [1440, 1024, 768, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    await page.screenshot({ path: `${output}/settings-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'overflow at 320 / 200% text');
  await page.screenshot({ path: `${output}/settings-320-200.png`, fullPage: true });
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.getByRole('button', { name: 'Smazat všechny verze' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('status').filter({ hasText: 'všechny verze jsou smazané' }).waitFor();
  assert.equal((await sql`select * from learner_artifact where user_id=${user.id}`).length, 0);
  assert.equal((await sql`select * from learner_artifact where user_id=${other}`).length, 2);
  assert.equal(await page.getByRole('heading', { name: 'Výstupy z lekcí' }).evaluate(el => el === document.activeElement), true);
  await page.reload(); await page.getByText('Zatím tu nemáš žádné uložené výstupy.').waitFor();
  assert.equal((await (await context.request.get(`${baseURL}/api/account/export`)).json()).learnerArtifacts.length, 0);
  console.log('PASS: Settings lists current revisions; cancel/delete, complete export, owner isolation, refresh persistence, keyboard/focus and six widths plus 200% text.');
  if (fixture) {
    const guestContext = await browser.newContext();
    const guestResponse = await guestContext.request.post(`${baseURL}/api/auth/sign-in/anonymous`, { headers: { origin: baseURL, 'x-investi-anonymous-kind': 'guest' }, data: {} });
    assert.ok(guestResponse.ok());
    const guest = (await guestResponse.json()).user; ids.push(guest.id);
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${baseURL}/${basename(fixture)}`);
    for (const name of ['Přímý pokus uložit', 'Přímý pokus číst', 'Přímý pokus smazat']) {
      await Promise.all([guestPage.waitForResponse(response => response.request().method() === 'POST' && response.url().includes(basename(fixture))), guestPage.getByRole('button', { name }).click()]);
      await guestPage.locator('output').filter({ hasText: '"ok":false' }).waitFor();
    }
    assert.equal((await sql`select * from learner_artifact where user_id=${guest.id}`).length, 0);
    console.log('PASS: guest sessions cannot bypass server save/list/delete boundaries.');
  }
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  if (server && server.exitCode === null) { const stopped = once(server, 'exit'); server.kill('SIGTERM'); await stopped; }
  if (fixture) {
    await rm(fixture, { recursive: true, force: true });
    await rm(".next/dev", { recursive: true, force: true });
  }
  if (ids.length) await sql`delete from "user" where id in ${sql(ids)}`;
  await sql.end();
  if (serverLog.includes('⨯')) await writeFile(`${output}/server.log`, serverLog);
}
