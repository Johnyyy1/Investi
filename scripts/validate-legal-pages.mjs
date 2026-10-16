// Legal pages and the links to them, against a running server: public access, structure, reflow at every
// width and 200% text, and links from the marketing, sign-in and registration entry points.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseURL = process.env.LEGAL_TEST_URL ?? 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname), 'Run against a local server.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);

  for (const [path, title] of [['/privacy', 'Zásady ochrany osobních údajů'], ['/terms', 'Podmínky použití']]) {
    const response = await page.goto(`${baseURL}${path}`);
    assert.equal(response.status(), 200, `${path} is public`);
    await page.getByRole('heading', { level: 1, name: title }).waitFor();
    assert.match(await page.title(), new RegExp(`^${title} · investi$`));
    const toc = page.getByRole('navigation', { name: 'Obsah' }).getByRole('link');
    const sections = await page.locator('article section[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
    assert.deepEqual(await toc.evaluateAll((links) => links.map((link) => link.getAttribute('href').slice(1))), sections, `${path}: the table of contents lists every section`);
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await overflow(), false, `${path}: overflow at ${width}`);
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    for (const width of [320, 768]) { await page.setViewportSize({ width, height: 900 }); assert.equal(await overflow(), false, `${path}: overflow at ${width}/200%`); }
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const privacy = await (await page.goto(`${baseURL}/privacy`)).text();
  for (const fact of ['IP adresu', '30 dní po vypršení', 'Moje data', 'cookies']) assert.ok(privacy.includes(fact), `privacy mentions ${fact}`);
  await page.getByRole('navigation', { name: 'Právní informace' }).getByRole('link', { name: 'Podmínky použití' }).click();
  await page.waitForURL('**/terms');
  assert.ok((await page.content()).includes('Nejde o investiční doporučení'));
  console.log('PASS: /privacy and /terms are public, structured, and reflow at 320–1440 px and 200% text.');

  for (const [path, label] of [['/', 'landing footer'], ['/sign-in', 'sign-in']]) {
    await page.goto(`${baseURL}${path}`);
    for (const [name, href] of [['Ochrana osobních údajů', '/privacy'], ['Podmínky použití', '/terms']]) {
      assert.equal(await page.getByRole('link', { name, exact: true }).first().getAttribute('href'), href, `${label} links ${href}`);
    }
  }
  for (const width of [390, 320]) { await page.setViewportSize({ width, height: 900 }); await page.goto(`${baseURL}/`); assert.equal(await overflow(), false, `landing footer overflow at ${width}`); }
  console.log('PASS: the landing footer and sign-in link both legal pages without overflow.');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
