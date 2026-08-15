#!/usr/bin/env node
/**
 * Prepare media for a video-scroll site.
 *
 *   node prep-media.mjs --hero hero.mp4 --scroll scroll.mp4 --out assets [--fps 12] [--quality 76]
 *
 * Produces, in --out:
 *   hero.webm         VP9, listed first in markup (some browsers ship no H.264)
 *   hero.mp4          original H.264, kept as fallback
 *   hero-poster.jpg   first meaningful frame, so the hero paints before decode
 *   frames/frame-NNN.webp   the scroll sequence at source resolution
 *
 * Also prints the dominant colors of both clips, to steer the palette.
 * Either --hero or --scroll may be omitted.
 */

import { execFileSync } from "node:child_process";
import {
  mkdirSync, existsSync, readdirSync, statSync, rmSync, copyFileSync, readFileSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { tmpdir } from "node:os";

// ---------- args ----------

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) args[a.slice(2)] = process.argv[++i] ?? true;
}

const heroSrc = args.hero ? resolve(args.hero) : null;
const scrollSrc = args.scroll ? resolve(args.scroll) : null;
const outDir = resolve(args.out || "assets");
const fps = Number(args.fps || 12);
const quality = Number(args.quality || 76);

if (!heroSrc && !scrollSrc) {
  console.error("Nothing to do. Pass --hero and/or --scroll.\n");
  console.error("  node prep-media.mjs --hero hero.mp4 --scroll scroll.mp4 --out assets");
  process.exit(1);
}
for (const [label, p] of [["--hero", heroSrc], ["--scroll", scrollSrc]]) {
  if (p && !existsSync(p)) {
    console.error(`${label} not found: ${p}`);
    process.exit(1);
  }
}

// ---------- ffmpeg ----------

/** Most machines have no system ffmpeg; fall back to the static npm build. */
function findFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return "ffmpeg";
  } catch {}

  const cacheDir = join(tmpdir(), "video-scroll-site-ffmpeg");
  const binary = join(cacheDir, "node_modules", "ffmpeg-static", "ffmpeg");
  if (existsSync(binary)) return binary;

  console.log("No ffmpeg found, installing a static build (one time, ~80 MB)...");
  mkdirSync(cacheDir, { recursive: true });
  execFileSync("npm", ["install", "ffmpeg-static", "--no-fund", "--no-audit", "--silent"], {
    cwd: cacheDir,
    stdio: "inherit",
  });
  if (!existsSync(binary)) {
    console.error("Could not install ffmpeg-static. Install ffmpeg manually and rerun.");
    process.exit(1);
  }
  return binary;
}

const FFMPEG = findFfmpeg();

function ff(fnArgs, { capture = false } = {}) {
  return execFileSync(FFMPEG, ["-hide_banner", ...fnArgs], {
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "inherit"],
    maxBuffer: 1 << 28,
  });
}

/** ffmpeg reports stream info on stderr and exits non-zero without an output. */
function probe(file) {
  let text = "";
  try {
    ff(["-i", file], { capture: true });
  } catch (e) {
    text = String(e.stderr || "");
  }
  const dim = text.match(/,\s(\d{2,5})x(\d{2,5})[\s,]/);
  const dur = text.match(/Duration:\s(\d+):(\d+):([\d.]+)/);
  return {
    width: dim ? Number(dim[1]) : null,
    height: dim ? Number(dim[2]) : null,
    seconds: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : null,
  };
}

/** Dominant colors, via a generated palette read back as raw RGB. */
function dominantColors(file, count = 6) {
  const tmp = join(tmpdir(), `vss-pal-${Date.now()}.rgb`);
  try {
    ff([
      "-v", "error", "-i", file,
      "-vf", `fps=2,scale=160:-1,palettegen=max_colors=${count}:stats_mode=full`,
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-y", tmp,
    ]);
    const buf = readFileSync(tmp);
    const colors = [];
    for (let i = 0; i + 2 < buf.length && colors.length < count; i += 3) {
      const hex =
        "#" + [buf[i], buf[i + 1], buf[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("");
      // palettegen reserves pure green as its transparency marker; it is not in the footage
      if (hex === "#00ff00" || colors.includes(hex)) continue;
      colors.push(hex);
    }
    return colors;
  } catch {
    return [];
  } finally {
    try { rmSync(tmp, { force: true }); } catch {}
  }
}

function humanSize(bytes) {
  return bytes > 1e6 ? (bytes / 1e6).toFixed(1) + " MB" : Math.round(bytes / 1e3) + " KB";
}

function dirSize(dir) {
  return readdirSync(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
}

// ---------- run ----------

mkdirSync(outDir, { recursive: true });
const notes = [];

if (heroSrc) {
  const info = probe(heroSrc);
  console.log(`\nHero: ${basename(heroSrc)} ${info.width}x${info.height}, ${info.seconds?.toFixed(1)}s`);

  const mp4Out = join(outDir, "hero.mp4");
  if (resolve(heroSrc) !== mp4Out) copyFileSync(heroSrc, mp4Out);

  console.log("  encoding hero.webm (VP9)...");
  ff([
    "-v", "error", "-i", heroSrc,
    "-an",                                  // audio would be muted anyway; drop the weight
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34",
    "-row-mt", "1", "-cpu-used", "4",
    "-y", join(outDir, "hero.webm"),
  ]);

  console.log("  extracting hero-poster.jpg...");
  ff([
    "-v", "error", "-ss", "0.5", "-i", heroSrc,
    "-frames:v", "1", "-q:v", "3",
    "-y", join(outDir, "hero-poster.jpg"),
  ]);

  const colors = dominantColors(heroSrc);
  notes.push(["Hero", colors]);
  console.log(
    `  hero.webm ${humanSize(statSync(join(outDir, "hero.webm")).size)}, ` +
    `hero.mp4 ${humanSize(statSync(mp4Out).size)}`
  );
}

if (scrollSrc) {
  const info = probe(scrollSrc);
  const framesDir = join(outDir, "frames");
  const estimated = info.seconds ? Math.round(info.seconds * fps) : null;

  console.log(
    `\nScroll: ${basename(scrollSrc)} ${info.width}x${info.height}, ` +
    `${info.seconds?.toFixed(1)}s -> ~${estimated ?? "?"} frames at ${fps}fps`
  );
  if (estimated && estimated > 170) {
    console.log(`  note: that is a lot of frames. Consider --fps ${Math.max(6, Math.floor(fps / 2))}.`);
  }

  rmSync(framesDir, { recursive: true, force: true });
  mkdirSync(framesDir, { recursive: true });

  // No scale filter on purpose: extracting below source resolution is the main
  // cause of a soft-looking scroll sequence, and it cannot be undone later.
  console.log("  extracting frames at source resolution...");
  ff([
    "-v", "error", "-i", scrollSrc,
    "-vf", `fps=${fps}`,
    "-c:v", "libwebp", "-quality", String(quality),
    "-start_number", "0",
    "-y", join(framesDir, "frame-%03d.webp"),
  ]);

  const count = readdirSync(framesDir).length;
  const total = dirSize(framesDir);
  console.log(`  ${count} frames, ${humanSize(total)} total`);
  if (total > 7e6) {
    console.log(`  note: heavy for the web. Try --quality ${Math.max(55, quality - 15)} or a lower --fps.`);
  }

  const colors = dominantColors(scrollSrc);
  notes.push(["Scroll", colors]);

  console.log(`\n  Set FRAME_COUNT = ${count} in the scroll script.`);
}

if (notes.length) {
  console.log("\nDominant colors (steer the palette from these, and pick an accent that contrasts):");
  for (const [label, colors] of notes) {
    console.log(`  ${label.padEnd(7)} ${colors.join("  ") || "(unavailable)"}`);
  }
}

console.log("");
