# Hero and scroll sequence: working implementation

Adapt the palette, copy, and proportions freely. Keep the mechanics, because each detail here
replaces something that failed in practice.

## Contents

- [Tokens](#tokens)
- [Hero markup](#hero-markup)
- [Hero CSS](#hero-css)
- [Scroll section markup](#scroll-section-markup)
- [Scroll section CSS](#scroll-section-css)
- [Scroll section JS](#scroll-section-js)
- [Failure modes](#failure-modes)

---

## Tokens

The two video sections need their own scrim and text tokens. Reusing the body text color over
footage is what produces unreadable headlines in one of the two themes.

```css
:root {
  color-scheme: light dark;

  /* Dark palette, designed first here; invert the pattern if the design is light-first */
  --bg: #0f130f;
  --bg-2: #151b15;
  --line: rgba(233, 231, 223, 0.16);
  --text: #e9e7df;
  --muted: #b3b5a8;
  --accent: #c69a45;

  /* Buttons keep fixed values so the CTA never inverts into low contrast */
  --btn-bg: #c69a45;
  --btn-ink: #171204;

  /* Video sections */
  --media-scrim: rgba(11, 15, 11, 0.48);
  --media-text: #f2f0e8;
  --media-muted: rgba(233, 231, 223, 0.85);
  --img-tint: rgba(15, 19, 15, 0.28);

  --nav-h: 68px;
}

@media (prefers-color-scheme: light) {
  :root {
    --bg: #f1f2ec;
    --bg-2: #e8eae0;
    --line: rgba(28, 35, 28, 0.18);
    --text: #1c231c;
    --muted: #566050;
    --accent: #8a6a1e;

    /* A light wash, not a dark scrim: the footage must dissolve into a light ground */
    --media-scrim: rgba(241, 242, 236, 0.58);
    --media-text: #1c231c;
    --media-muted: rgba(28, 35, 28, 0.78);
    --img-tint: rgba(28, 35, 28, 0.12);
  }
}
```

---

## Hero markup

Source order matters: WebM first. A browser without H.264 skips the mp4 and would otherwise render
nothing at all.

```html
<section class="hero">
  <div class="hero-bg" aria-hidden="true">
    <video class="hero-video" autoplay muted loop playsinline
           preload="metadata" poster="assets/hero-poster.jpg">
      <source src="assets/hero.webm" type="video/webm" />
      <source src="assets/hero.mp4" type="video/mp4" />
    </video>
  </div>
  <div class="shell hero-inner">
    <h1 class="hero-headline anim-rise" style="--d:0">Headline here.</h1>
    <p class="hero-sub anim-rise" style="--d:1">One sentence of support, under about 20 words.</p>
    <div class="hero-cta anim-rise" style="--d:2">
      <a class="btn btn-primary" href="#cta">Primary action</a>
    </div>
  </div>
</section>
```

`muted` and `playsinline` are both required for autoplay; without them mobile Safari refuses to
start and shows the poster forever.

---

## Hero CSS

```css
.hero {
  position: relative;
  overflow: hidden;
  display: grid;
  border-bottom: 1px solid var(--line);
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--bg-2); /* visible while the video loads, or if it is missing entirely */
}

.hero-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.72) contrast(1.04);
}

/* Soft mask: legibility scrim plus fades to the page ground at both edges */
.hero-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to bottom, var(--bg) 0%, transparent 24%),
    linear-gradient(to top,    var(--bg) 0%, transparent 30%),
    var(--media-scrim);
}

.hero-inner {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: calc(100dvh - var(--nav-h));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-block: clamp(3rem, 8vh, 5rem);
  color: var(--media-text);
}

.hero-headline {
  font-size: clamp(2.6rem, 6vw, 4.6rem);
  line-height: 1.05;
  text-wrap: balance;
}

.hero-sub {
  margin-top: 1.6rem;
  max-width: 46ch;
  margin-inline: auto;
  color: var(--media-muted);
}

.hero-cta { margin-top: 2.2rem; }

/* Load-in cascade */
@media (prefers-reduced-motion: no-preference) {
  .anim-rise {
    opacity: 0;
    transform: translateY(22px);
    animation: rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    animation-delay: calc(var(--d, 0) * 120ms);
  }
  @keyframes rise { to { opacity: 1; transform: translateY(0); } }
}
```

`100dvh`, never `100vh`: the mobile address bar makes `vh` jump on first scroll.

---

## Scroll section markup

No text, no overlay. The animation is the content.

```html
<section class="unfold" aria-label="Describe what unfolds, for screen readers">
  <div class="unfold-sticky">
    <canvas class="unfold-canvas"></canvas>
  </div>
</section>
```

Leave `width`/`height` attributes off the canvas; the script owns them.

---

## Scroll section CSS

```css
.unfold {
  position: relative;
  height: 320vh; /* the scroll runway the sequence plays across */
}

.unfold-sticky {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
  background: var(--bg-2);
}

.unfold-canvas {
  display: block;
  width: 100%;
  height: 100%;
  filter: saturate(0.72) contrast(1.04);
}

.unfold-sticky::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(to bottom, var(--bg) 0%, transparent 16%),
    linear-gradient(to top,    var(--bg) 0%, transparent 16%),
    var(--img-tint);
}

@media (prefers-reduced-motion: reduce) {
  .unfold { height: 100dvh; }
}
```

Do not put `object-fit` on the canvas. It does nothing there; the script handles cover-fit while
drawing.

---

## Scroll section JS

```js
(function () {
  "use strict";

  var section = document.querySelector(".unfold");
  var canvas  = document.querySelector(".unfold-canvas");
  if (!section || !canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var FRAME_COUNT = 120;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // __FRAMES__ lets the inlined preview swap in data URIs without touching this file
  function frameSrc(i) {
    if (window.__FRAMES__) return window.__FRAMES__[i];
    return "assets/frames/frame-" + String(i).padStart(3, "0") + ".webp";
  }

  var frames  = new Array(FRAME_COUNT);
  var current = -1;
  var shown   = 0;

  // Backing store at display size x DPR, so frames render at native sharpness
  // instead of a small buffer being stretched across the viewport.
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth  * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (w === canvas.width && h === canvas.height) return;
    canvas.width  = w;
    canvas.height = h;
    current = -1;          // the buffer was cleared, so force a redraw
    draw(shown);
  }

  function draw(value) {
    var i = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(value)));
    if (i === current) return;
    var img = frames[i];
    if (!img || !img.complete || !img.naturalWidth) return;
    current = i;
    var scale = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    var w = img.naturalWidth  * scale;
    var h = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  resize();

  if (reduce) {                     // one still of the end state, no scrub
    var still = new Image();
    still.onload = function () {
      frames[FRAME_COUNT - 1] = still;
      shown = FRAME_COUNT - 1;
      draw(FRAME_COUNT - 1);
    };
    still.src = frameSrc(FRAME_COUNT - 1);
    return;
  }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    for (var i = 0; i < FRAME_COUNT; i++) {
      var img = new Image();
      if (i === 0) img.onload = function () { draw(0); };
      img.src = frameSrc(i);
      frames[i] = img;
    }
  }

  var running = false;
  var rafId = 0;

  function progress() {
    var rect = section.getBoundingClientRect();
    var runway = rect.height - window.innerHeight;
    if (runway <= 0) return 0;
    return Math.max(0, Math.min(1, -rect.top / runway));
  }

  function tick() {
    var target = progress() * (FRAME_COUNT - 1);
    shown += (target - shown) * 0.2;                    // lerp: smooths fast scrolling
    if (Math.abs(target - shown) < 0.4) shown = target; // snap, so it settles exactly
    draw(shown);
    if (running) rafId = requestAnimationFrame(tick);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        load();
        if (!running) { running = true; rafId = requestAnimationFrame(tick); }
      } else if (running) {
        running = false;
        cancelAnimationFrame(rafId);
      }
    });
  }, { rootMargin: "60% 0px 60% 0px" });

  io.observe(section);
})();
```

Set `FRAME_COUNT` to the number of files actually produced.

---

## Failure modes

**Soft or blurry sequence.** Almost always the canvas backing store, not the frames. Confirm with
`canvas.width` in the console: it should be roughly viewport width × DPR, not a small fixed number.
Then check the frames were extracted at source resolution and encoded at WebP quality 72 or above.

**Hero shows only the poster, or nothing.** Missing WebM source on a browser without H.264, or a
missing `muted`. Check `document.querySelector('.hero-video').readyState` — 4 means it decoded, 0
with `networkState` 3 means no source was playable.

**Sequence never advances.** `FRAME_COUNT` doesn't match the files on disk, or the runway is shorter
than the viewport so `progress()` divides by a non-positive number and pins at 0.

**Stutter while scrolling.** Frames too heavy, or the lerp factor too low. Raise it toward 0.3 for a
tighter follow, or cut frame weight.

**Section scrolls past without sticking.** An ancestor has `overflow: hidden` or a `transform`, both
of which break `position: sticky`.

**Muddy band instead of a clean dissolve.** The scrim token isn't theme-aware: a dark scrim over
footage on a light ground. Give the light theme its own light wash.
