/**
 * Lesson route JS budget (issue #131). Run after `next build`.
 *
 * 1. No authored lesson text may reach the browser as JavaScript: the server sends the current lesson's steps as
 *    props, so no client chunk of the build (initial or lazily loaded, any route) may contain a lesson's copy.
 * 2. The initial JS of `/learn/[moduleSlug]/[lessonSlug]` (gzip) stays within the budget below.
 *
 * `LESSON_BUNDLE_REPORT=1` prints the chunk list without failing on the budget.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { authoredLessons } from "../src/features/lessons/registry";

/**
 * Initial JS of the lesson route, gzip. Measured 2026-10-22: 546.8 KB before #131, 322.3 KB after. Lesson content no
 * longer ships as JS, so a new lesson adds only its manifest entry (+0.9 KB gzip for 50 test lessons); the headroom
 * covers the ~130 planned lessons. Raise it deliberately, with a measurement in docs/performance-baseline.md.
 */
const INITIAL_JS_BUDGET_GZIP_BYTES = 340 * 1024;
const MIN_TEXT_LENGTH = 30;

const nextDir = path.resolve(process.argv[2] ?? ".next");
const route = "(app)/learn/[moduleSlug]/[lessonSlug]/page";
const routeDir = path.join(nextDir, "server/app", route);
if (!existsSync(`${routeDir}_client-reference-manifest.js`)) throw new Error(`No production build of /${route} in ${nextDir}. Run \`npm run build\` first.`);

type ClientManifest = { clientModules: Record<string, { chunks: string[] }>; entryJSFiles: Record<string, string[]> };
// The manifest assigns `globalThis.__RSC_MANIFEST`; inside a vm context `globalThis` is the sandbox.
const sandbox: { __RSC_MANIFEST?: Record<string, ClientManifest> } = {};
vm.runInNewContext(readFileSync(`${routeDir}_client-reference-manifest.js`, "utf8"), sandbox);
const manifest = sandbox.__RSC_MANIFEST?.[`/${route}`];
if (!manifest) throw new Error("The client reference manifest has no entry for the lesson route.");
const buildManifest = JSON.parse(readFileSync(path.join(routeDir, "build-manifest.json"), "utf8")) as { rootMainFiles: string[] };

const normalize = (file: string) => file.replace(/^\/?_next\//, "");
const initial = [...new Set([...buildManifest.rootMainFiles, ...Object.values(manifest.entryJSFiles).flat()].map(normalize))].filter((file) => file.endsWith(".js"));
// Lazily imported chunks appear in no route manifest, so the text check reads every client chunk.
const clientChunks = readdirSync(path.join(nextDir, "static"), { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".js")).map((file) => path.join("static", file));
const read = (file: string) => readFileSync(path.join(nextDir, file));
const sizes = initial.map((file) => ({ file, raw: read(file).length, gzip: gzipSync(read(file)).length }));
const totalRaw = sizes.reduce((sum, item) => sum + item.raw, 0);
const totalGzip = sizes.reduce((sum, item) => sum + item.gzip, 0);

/** Every prose string of every authored lesson: long enough to be copy, not an ID or a number. */
const texts = new Set<string>();
const collect = (value: unknown): void => {
  if (typeof value === "string") { if (value.length >= MIN_TEXT_LENGTH && value.includes(" ")) texts.add(value); }
  else if (Array.isArray(value)) value.forEach(collect);
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
};
for (const lesson of authoredLessons) collect(lesson.blocks);

// Minifiers may keep UTF-8 or write \uXXXX escapes; compare against decoded source with escaped quotes undone.
const decode = (source: string) => source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\\(["'`])/g, "$1");
const leaks = clientChunks.flatMap((file) => {
  const source = decode(read(file).toString("utf8"));
  const found = [...texts].filter((text) => source.includes(text));
  return found.length ? [{ file, count: found.length, sample: found[0].slice(0, 80) }] : [];
});

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`Lesson route initial JS: ${initial.length} chunks, ${kb(totalRaw)} raw, ${kb(totalGzip)} gzip (budget ${kb(INITIAL_JS_BUDGET_GZIP_BYTES)}).`);
if (process.env.LESSON_BUNDLE_REPORT) for (const item of sizes.sort((a, b) => b.gzip - a.gzip)) console.log(`  ${item.file}  ${kb(item.raw)} raw  ${kb(item.gzip)} gzip`);
console.log(`Checked ${texts.size} lesson texts from ${authoredLessons.length} authored lessons against ${clientChunks.length} client chunks.`);

const failures = [
  ...leaks.map((leak) => `${leak.file} contains ${leak.count} lesson text(s), e.g. "${leak.sample}"`),
  ...(!process.env.LESSON_BUNDLE_REPORT && totalGzip > INITIAL_JS_BUDGET_GZIP_BYTES ? [`Initial JS ${kb(totalGzip)} gzip exceeds the ${kb(INITIAL_JS_BUDGET_GZIP_BYTES)} budget.`] : []),
];
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("No lesson text in client JS.");
