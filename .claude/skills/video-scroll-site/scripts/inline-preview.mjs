#!/usr/bin/env node
/**
 * Build a single self-contained HTML file from a static site, for publishing as an
 * Artifact preview.
 *
 *   node inline-preview.mjs --root . --out /tmp/preview.html [--title "Name"] [--max-mb 15]
 *
 * The artifact sandbox blocks every external request, so fonts, video, images and the
 * scroll frames all have to travel as data URIs. This also rewrites the theme rules so
 * the viewer's explicit light/dark toggle wins, which a plain prefers-color-scheme
 * stylesheet does not handle.
 *
 * Assumes the conventional layout: index.html, css/*.css, js/*.js, assets/**.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, extname } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[++i] ?? true;
}

const root = resolve(args.root || ".");
const outFile = resolve(args.out || "/tmp/preview.html");
const maxBytes = Number(args["max-mb"] || 15) * 1e6;
const framesDirName = args.frames || "assets/frames";

const MIME = {
  ".woff2": "font/woff2", ".woff": "font/woff",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".avif": "image/avif",
  ".mp4": "video/mp4", ".webm": "video/webm",
};

function dataUri(absPath) {
  const mime = MIME[extname(absPath).toLowerCase()] || "application/octet-stream";
  return `data:${mime};base64,` + readFileSync(absPath).toString("base64");
}

const indexPath = join(root, "index.html");
if (!existsSync(indexPath)) {
  console.error(`No index.html in ${root}`);
  process.exit(1);
}
const html = readFileSync(indexPath, "utf8");

// ---------- css ----------

let css = "";
for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)) {
  const p = join(root, m[1]);
  if (existsSync(p)) css += readFileSync(p, "utf8") + "\n";
}
for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) css += m[1] + "\n";

// Inline every url(...) the stylesheet references, resolved from the css file's folder
css = css.replace(/url\(["']?((?:\.\.\/|\.\/)?[^"')]+)["']?\)/g, (whole, ref) => {
  if (ref.startsWith("data:") || ref.startsWith("http")) return whole;
  const clean = ref.replace(/^\.\//, "").replace(/^\.\.\//, "");
  const candidate = join(root, clean);
  return existsSync(candidate) ? `url("${dataUri(candidate)}")` : whole;
});

/**
 * Artifact viewers have three theme states: an explicit data-theme stamp, or none at
 * all with only the OS preference to go on. A stylesheet written for
 * prefers-color-scheme alone ignores the viewer's toggle, so mirror the dark-mode
 * token block onto the explicit stamps too.
 */
const light = css.match(/@media\s*\(prefers-color-scheme:\s*light\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\n\}/);
const dark = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\n\}/);
if (light) {
  css = css.replace("@media (prefers-color-scheme: light) {\n  :root {",
                    '@media (prefers-color-scheme: light) {\n  :root:not([data-theme="dark"]) {');
  css += `\n/* explicit viewer choice */\n:root[data-theme="light"] {${light[1]}\n}\n`;
}
if (dark) {
  css = css.replace("@media (prefers-color-scheme: dark) {\n  :root {",
                    '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {');
  css += `\n/* explicit viewer choice */\n:root[data-theme="dark"] {${dark[1]}\n}\n`;
}

// ---------- js ----------

let js = "";
for (const m of html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/g)) {
  const p = join(root, m[1]);
  if (existsSync(p)) js += readFileSync(p, "utf8") + "\n";
}

// ---------- body ----------

let body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, html])[1];
body = body.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/g, "");
body = body.replace(/<!--[\s\S]*?-->/g, "");

// Every local src="..." becomes a data URI
body = body.replace(/(src|poster)="([^"]+)"/g, (whole, attr, ref) => {
  if (ref.startsWith("data:") || ref.startsWith("http")) return whole;
  const p = join(root, ref.replace(/^\.\//, ""));
  return existsSync(p) && statSync(p).isFile() ? `${attr}="${dataUri(p)}"` : whole;
});

// ---------- scroll frames ----------

const framesDir = join(root, framesDirName);
let framesScript = "";
if (existsSync(framesDir)) {
  const files = readdirSync(framesDir).filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f)).sort();
  if (files.length) {
    const uris = files.map((f) => dataUri(join(framesDir, f)));
    framesScript = `<script>window.__FRAMES__ = ${JSON.stringify(uris)};</script>\n`;
    console.log(`Inlined ${files.length} scroll frames.`);
  }
}

// ---------- assemble ----------

const titleMatch = html.match(/<title>([^<]*)<\/title>/);
const title = args.title || (titleMatch ? titleMatch[1] : "Preview");
const langMatch = html.match(/<html([^>]*)>/);
const isRtl = langMatch && /dir="rtl"/.test(langMatch[1]);
const lang = (langMatch && (langMatch[1].match(/lang="([^"]+)"/) || [])[1]) || "en";

const out =
  `<title>${title}</title>\n<style>\n${css}\n` +
  (isRtl ? "body { direction: rtl; }\n" : "") +
  `</style>\n` +
  `<div lang="${lang}"${isRtl ? ' dir="rtl"' : ""}>\n${body}\n</div>\n` +
  framesScript +
  `<script>\n${js}\n</script>\n`;

writeFileSync(outFile, out);

const size = statSync(outFile).size;
console.log(`\n${outFile}  ${(size / 1e6).toFixed(2)} MB`);

const leftover = out.match(/(?:src|href)="(?!data:|https?:|#|mailto:)[^"]+"/g);
if (leftover) {
  console.log(`\nStill referencing local files (they will not load in the sandbox):`);
  for (const l of [...new Set(leftover)].slice(0, 10)) console.log("  " + l);
}

if (size > maxBytes) {
  console.log(
    `\nOver the ${(maxBytes / 1e6).toFixed(0)} MB budget. Re-run prep-media.mjs with a lower ` +
    `--fps or --quality for the preview only, and leave the committed site alone.`
  );
  process.exitCode = 1;
}
