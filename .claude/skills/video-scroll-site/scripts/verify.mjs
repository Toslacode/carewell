#!/usr/bin/env node
/**
 * Drive the built site in a real browser and capture the moments that matter.
 *
 *   node verify.mjs --url http://localhost:8021 [--out ./shots]
 *
 * Serve the site yourself first, e.g. `python3 -m http.server 8021` in the site root.
 *
 * Captures the hero, the scroll section at 0/33/66/100% progress, both themes, and
 * mobile. Reports the hero video's readyState and the document scrollWidth, because
 * a silent codec failure and a horizontal overflow both look fine in a top-of-page
 * screenshot and ruin the page in a real browser.
 */

import { mkdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[++i] ?? true;
}

const url = args.url || "http://localhost:8021";
const outDir = resolve(args.out || "shots");
const scrollSelector = args.selector || ".unfold";

// ---------- playwright ----------

/** Chromium is preinstalled in many agent sandboxes; only the driver may be missing. */
async function loadChromium() {
  const candidates = [process.cwd(), join(tmpdir(), "video-scroll-site-pw")];
  for (const dir of candidates) {
    try {
      const require = createRequire(join(dir, "noop.js"));
      return require("playwright-core").chromium;
    } catch {}
  }
  const cacheDir = join(tmpdir(), "video-scroll-site-pw");
  console.log("Installing playwright-core (one time)...");
  mkdirSync(cacheDir, { recursive: true });
  execFileSync("npm", ["install", "playwright-core", "--no-fund", "--no-audit", "--silent"], {
    cwd: cacheDir,
    stdio: "inherit",
  });
  const require = createRequire(join(cacheDir, "noop.js"));
  return require("playwright-core").chromium;
}

function chromiumPath() {
  for (const p of ["/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser"]) {
    if (existsSync(p)) return p;
  }
  return undefined; // let playwright find its own download
}

const chromium = await loadChromium();
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});

const problems = [];
const report = [];

async function open(width, height, scheme) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    colorScheme: scheme,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
}

// ---------- hero, both themes ----------

for (const scheme of ["dark", "light"]) {
  const { ctx, page } = await open(1440, 900, scheme);

  const hero = await page.evaluate(() => {
    const v = document.querySelector("video");
    if (!v) return null;
    return {
      readyState: v.readyState,
      networkState: v.networkState,
      paused: v.paused,
      currentSrc: (v.currentSrc || "").split("/").pop(),
      error: v.error ? v.error.code : null,
    };
  });

  if (hero) {
    report.push(`hero (${scheme}): readyState ${hero.readyState}, playing ${!hero.paused}, src ${hero.currentSrc}`);
    if (hero.readyState < 3) {
      problems.push(
        `Hero video did not decode in ${scheme} (readyState ${hero.readyState}, networkState ${hero.networkState}). ` +
        `Check that a WebM source is listed before the mp4.`
      );
    }
  } else {
    report.push(`hero (${scheme}): no <video> element found`);
  }

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  report.push(`layout (${scheme}): scrollWidth ${width} at viewport 1440`);
  if (width > 1441) {
    problems.push(`Horizontal overflow in ${scheme}: scrollWidth ${width} exceeds the 1440 viewport.`);
  }

  await page.screenshot({ path: join(outDir, `hero-${scheme}.png`) });
  await page.screenshot({ path: join(outDir, `full-${scheme}.png`), fullPage: true });
  await ctx.close();
}

// ---------- scroll sequence ----------

{
  const { ctx, page } = await open(1440, 900, "dark");

  const geom = await page.evaluate((sel) => {
    const s = document.querySelector(sel);
    if (!s) return null;
    return { top: s.offsetTop, runway: s.offsetHeight - window.innerHeight };
  }, scrollSelector);

  if (!geom) {
    problems.push(`No element matches "${scrollSelector}". Pass --selector if the class differs.`);
  } else if (geom.runway <= 0) {
    problems.push(
      `The scroll section is not taller than the viewport (runway ${geom.runway}px), so it can never ` +
      `scrub. Give it a runway of roughly 250vh to 350vh.`
    );
  } else {
    const digests = [];
    for (const p of [0, 0.33, 0.66, 1]) {
      await page.evaluate(
        ({ top, runway, p }) => window.scrollTo(0, top + runway * p),
        { ...geom, p }
      );
      await page.waitForTimeout(900);
      const file = join(outDir, `scrub-${String(Math.round(p * 100)).padStart(3, "0")}.png`);
      await page.screenshot({ path: file });

      // Sample the canvas so identical frames can be detected without eyeballing
      digests.push(
        await page.evaluate((sel) => {
          const c = document.querySelector(sel + " canvas");
          if (!c) return null;
          const g = c.getContext("2d");
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let sum = 0;
          for (let i = 0; i < d.length; i += 4001) sum += d[i];
          return `${c.width}x${c.height}:${sum}`;
        }, scrollSelector)
      );
    }

    report.push(`scroll: canvas backing store ${digests[0]?.split(":")[0] ?? "unknown"}`);
    const unique = new Set(digests.filter(Boolean));
    if (digests.every(Boolean) && unique.size < 3) {
      problems.push(
        `The sequence barely changes across the scroll (${unique.size} distinct frames sampled). ` +
        `Check FRAME_COUNT matches the files on disk and that the frames actually loaded.`
      );
    }
    const backing = Number(digests[0]?.split("x")[0] || 0);
    if (backing && backing < 1400) {
      problems.push(
        `Canvas backing store is only ${backing}px wide on a 1440px viewport, so frames are being ` +
        `stretched and will look soft. Size it to clientWidth x devicePixelRatio.`
      );
    }
  }
  await ctx.close();
}

// ---------- mobile ----------

{
  const { ctx, page } = await open(390, 844, "dark");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  report.push(`layout (mobile): scrollWidth ${width} at viewport 390`);
  if (width > 391) {
    problems.push(`Horizontal overflow on mobile: scrollWidth ${width} exceeds the 390 viewport.`);
  }
  await page.screenshot({ path: join(outDir, "mobile-dark.png"), fullPage: true });
  await ctx.close();
}

await browser.close();

console.log("\n" + report.join("\n"));
console.log(`\nScreenshots in ${outDir}`);

if (problems.length) {
  console.log("\nProblems found:");
  for (const p of problems) console.log("  - " + p);
  process.exitCode = 1;
} else {
  console.log("\nNo automated problems found. Still look at the screenshots.");
}
