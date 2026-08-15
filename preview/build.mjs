/**
 * Builds preview/carewell-preview.html — one self-contained file.
 *
 * The artifact sandbox blocks every external request (CDN, font host, image
 * host, fetch), so the font subsets and the branding artwork are inlined as
 * data URIs. The artwork is re-encoded to WebP at 1600px: visually identical at
 * the sizes it is displayed, ~50 KB instead of ~1.3 MB.
 *
 *   node preview/build.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = (name) => readFile(join(here, "src", name), "utf8");

const [shell, style, data, extract, store, ui, corridor, views, recorder, appjs] = await Promise.all([
  src("shell.html"),
  src("00-style.css"),
  src("10-data.js"),
  src("20-extract.js"),
  src("30-store.js"),
  src("40-ui.js"),
  src("50-corridor.js"),
  src("60-views.js"),
  src("70-recorder.js"),
  src("80-app.js"),
]);

const fontUri = async (file) => {
  const buf = await readFile(join(root, "public/assets/fonts", file));
  return `data:font/woff2;base64,${buf.toString("base64")}`;
};

const branding = await sharp(join(root, "public/assets/branding/carewell-branding.png"))
  .resize({ width: 1600 })
  .webp({ quality: 94 })
  .toBuffer();

const out = shell
  .replace("__STYLE__", () => style)
  .replace("__FONT_HE__", await fontUri("heebo-hebrew-wght-normal.woff2"))
  .replace("__FONT_LATIN__", await fontUri("heebo-latin-wght-normal.woff2"))
  .replace("__DATA__", () => data)
  .replace("__EXTRACT__", () => extract)
  .replace("__STORE__", () => store)
  .replace("__UI__", () => ui)
  .replace("__CORRIDOR__", () => corridor)
  .replace("__VIEWS__", () => views)
  .replace("__RECORDER__", () => recorder)
  .replace("__APP__", () => appjs)
  .replace("__BRANDING__", `data:image/webp;base64,${branding.toString("base64")}`);

const target = join(here, "carewell-preview.html");
await writeFile(target, out, "utf8");
console.log(`${target} — ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB`);
