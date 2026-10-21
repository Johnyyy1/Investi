// Rasterizes the committed Investník SVG sources in public/brand into the PNG and ICO files that
// browsers, installed apps and link previews need. The SVGs are outlined (no web font needed), so
// the output only depends on Chromium. Run after changing a source SVG and commit the results:
//   BROWSER_CHANNEL=chrome npm run brand:assets
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const source = (name) => resolve(root, "public/brand", name);

const targets = [
  { from: "investnik-symbol.svg", to: "public/brand/icon-192.png", size: [192, 192] },
  { from: "investnik-symbol.svg", to: "public/brand/icon-512.png", size: [512, 512] },
  { from: "investnik-symbol-maskable.svg", to: "public/brand/icon-maskable-512.png", size: [512, 512] },
  // iOS rounds the corners itself, so the touch icon is the full-bleed tile.
  { from: "investnik-symbol-maskable.svg", to: "src/app/apple-icon.png", size: [180, 180] },
  { from: "investnik-og.svg", to: "src/app/opengraph-image.png", size: [1200, 630] },
];
const faviconSizes = [16, 32, 48];

const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });

const scratch = await mkdtemp(join(tmpdir(), "investnik-brand-"));

/** Inline the SVG into a file page whose base URL is the SVG's folder, so relative <image> hrefs load. */
async function render(file, [width, height]) {
  const svg = (await readFile(source(file), "utf8")).replace("<svg ", '<svg style="display:block;width:100%;height:100%" ');
  const html = join(scratch, "render.html");
  await writeFile(html, `<!doctype html><base href="${pathToFileURL(dirname(source(file)))}/"><style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.setViewportSize({ width, height });
  await page.goto(pathToFileURL(html).href);
  // SVG <image> elements expose no load state; give the decoder a moment.
  await page.waitForTimeout(300);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width, height } });
}

for (const { from, to, size } of targets) {
  await writeFile(resolve(root, to), await render(from, size));
  console.log(`${to} ← ${from}`);
}

// ICO with embedded PNG images (supported by every current browser).
const images = [];
for (const size of faviconSizes) images.push(await render("investnik-symbol.svg", [size, size]));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + 16 * index;
  header.writeUInt8(faviconSizes[index], entry);
  header.writeUInt8(faviconSizes[index], entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(resolve(root, "src/app/favicon.ico"), Buffer.concat([header, ...images]));
console.log("src/app/favicon.ico ← investnik-symbol.svg");

await browser.close();
await rm(scratch, { recursive: true, force: true });
