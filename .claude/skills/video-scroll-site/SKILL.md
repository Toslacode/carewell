---
name: video-scroll-site
description: >-
  Builds a high-end marketing site whose hero is a full-bleed autoplaying video and whose next
  section is a scroll-scrubbed video sequence, where the footage advances frame by frame as the
  visitor scrolls, followed by a full animated page. Use this whenever the user asks to design or
  build a website, landing page, or homepage, including the bare phrases "עיצוב אתר", "תעצב לי
  אתר", "design a website", "build me a landing page", and whenever they mention a video hero,
  video that moves or plays on scroll, scroll animation, scrollytelling, or a site built around
  footage they have. Trigger it even when they say nothing about video: asking for their two clips
  is the first thing this skill does. Also use it when returning to a site built this way to
  restyle it, translate it, swap the footage, or add sections.
---

# Video-Scroll Site

Two signature moments carry this kind of site: a video hero the visitor lands on, and directly
beneath it a video that the visitor *drives* by scrolling. Everything else on the page is a
well-built marketing site, and it should look designed for this client, not assembled from a
template.

The scroll section is what people remember. It is also the part that goes wrong quietly, in ways
that look like "the video is low quality" when the real cause is a canvas resolution bug. The
reference file has the working implementation. Use it rather than rebuilding from memory.

---

## 1. Ask for the footage first

Do this before writing any code, and before designing anything. Two clips are needed, and they do
different jobs. Ask in one message, be concrete about what makes a clip work, and say the user can
generate them with any AI video tool if they don't have footage.

**The hero clip.** Plays behind the headline, looping, muted, forever. It wants slow ambient motion
with no hard cuts and no camera moves that yank attention: petals drifting, steam rising, fabric
breathing, a slow push through a space. Text sits on top of it, so it must stay calm and it must
have a region that can go quiet enough to read against.

**The scroll clip.** This one becomes a timeline the visitor scrubs, so it must be *one continuous
transformation with a clear start and end*: a bouquet opening, a product assembling, a room filling
with light, a build unfolding. Loops, cuts, or ambient drift all fail here, because scrubbing back
and forth through them reads as noise rather than as control.

For both: 6 to 12 seconds, 1080p or better, no burned-in text or logos, and shot or generated so the
subject stays roughly centered (the canvas crops to fill and the edges get eaten on wide screens).

Ask where the files are. Uploaded files land in unpredictable places and users frequently drop them
into whatever folder they had open, so search the repo rather than assuming a path, check for
duplicates by checksum, and rename to something ASCII and hyphenated before building (spaces and
non-Latin filenames survive git but break in URLs and shell pipelines).

If the user wants to start designing before their footage exists, build with the videos absent: the
hero falls back to a tinted background and the scroll section holds a still. Wire the real paths in
when the clips arrive. Never stall the whole build waiting on media.

---

## 2. Choose a visual direction from *this* footage

The palette must come from the client's own material, and the point is that it changes every time.
Deep green and amber may have suited one project; reaching for the same tokens again is how a
signature becomes a template.

`scripts/prep-media.mjs` prints the dominant colors of both clips. Read them and decide:

- **Ground:** pick a near-black or an off-white that shares a slight hue bias with the footage. A
  warm clip gets a warm-leaning ground, never a neutral #111 that reads as unconsidered.
- **Accent:** exactly one, and let it *contrast* the footage rather than echo it. Pink-heavy floral
  footage with a pink accent turns into mush; the same footage against a deep ink or a brass reads
  as designed. Lock the accent and use it on every CTA on the page.
- **Photography treatment:** a slight desaturation and contrast bump (`filter: saturate(.72)
  contrast(1.04)`) pulls disparate footage into one palette. Apply it to hero video, canvas, and
  every image so the whole page looks shot for the same brand.

Type: pair a display face with a body face, self-hosted. Font CDNs are blocked in artifacts and slow
elsewhere, so fetch faces from npm (`npm pack @fontsource-variable/<face>` or the `geist` package)
and commit the woff2. Hebrew needs a Hebrew face; see `references/rtl-hebrew.md`.

Both themes get designed. Define every color as a token on `:root`, redefine only tokens under
`@media (prefers-color-scheme: dark)`, and never declare a color solely inside a media block. The
hero and scroll scrims need their own tokens, because a dark scrim over footage on a light page
leaves a muddy grey band where the mask should dissolve.

---

## 3. Prepare the media

```bash
node .claude/skills/video-scroll-site/scripts/prep-media.mjs \
  --hero "assets/hero-source.mp4" \
  --scroll "assets/scroll-source.mp4" \
  --out assets
```

It installs a static ffmpeg if the machine has none (most don't), then produces:

- `hero.webm` (VP9) and `hero.mp4`, listed in that order in the markup. Some browsers, including the
  sandboxed Chromium used for verification, ship without H.264, so an mp4-only hero silently shows
  nothing and looks like a CSS bug.
- `hero-poster.jpg`, so the hero paints before the video decodes.
- `frames/frame-000.webp …`, the scroll sequence at 12fps and **full source resolution**.
- Dominant colors for both clips.

Two numbers matter. **Resolution:** extract at the source's own size. Downscaling here is the single
biggest cause of a blurry scroll section, and it cannot be recovered later. **Weight:** 90 to 150
frames total, ideally under about 6 MB. If the clip is long, drop to 8 or 10 fps rather than
shrinking the frames; the scrub still reads as continuous because scroll velocity rarely outruns it.

---

## 4. Build the two signature sections

Read `references/hero-and-scroll.md` and use the implementation there. It is the corrected version,
and each piece of it exists because the naive version failed:

- The canvas sizes its backing store to `clientWidth × devicePixelRatio` and draws cover-fit. A
  fixed `width`/`height` attribute stretches a small buffer across the screen and looks soft on
  every modern display, even with perfect frames.
- Progress comes from `getBoundingClientRect()` sampled inside a `requestAnimationFrame` loop, gated
  by an `IntersectionObserver`. Scroll listeners fire per scroll event and jank; this doesn't.
- Frames only start loading as the section approaches, and the loop only runs while it's near the
  viewport.
- A small lerp between current and target frame keeps fast scrolling smooth instead of steppy.
- Both sections carry the same soft mask: a scrim for legibility plus gradient fades to the page
  background at top and bottom, so video dissolves into the page instead of ending on a seam.
- `prefers-reduced-motion` collapses the runway to one viewport and shows a single still. The
  section still exists; it just stops being a scroll toy.

The runway height sets the pacing. 320vh over ~120 frames feels unhurried and is a good default;
shorter than about 250vh makes the animation flick past.

---

## 5. Build the rest of the page

Everything below the scroll section is an ordinary well-made site, and it should look like it
belongs to the same studio. Compose sections from what the brief actually needs, and vary the layout
family between neighbours so the page doesn't read as a stack of identical bands.

Some discipline that keeps this from drifting into generic territory:

- One layout family per section. Three consecutive image-left/text-right rows is the tell.
- Motion earns its place: scroll reveals on entry, hover on interactive things, at most one marquee.
  Ambient animation everywhere reads as noise.
- Real imagery. When the client has no photography, crop stills from their own footage at varied
  timestamps and zoom levels; it is better than placeholder services and it keeps the page coherent.
- One CTA label per intent across the whole page.
- Content the user can act on: prices, categories, delivery terms, whatever the brief implies. If
  the content is invented for a demo, say so plainly somewhere in the footer.

If the site is a commerce or service page, `references/page-patterns.md` has the section inventory
that tends to work, in a sensible order.

---

## 6. Verify in a real browser, at real scroll positions

Screenshots of the top of the page prove nothing about a scroll animation. Drive it:

```bash
node .claude/skills/video-scroll-site/scripts/verify.mjs --url http://localhost:8021
```

It serves nothing itself, so start a static server in the site root first. It captures the hero, the
scroll section at 0/33/66/100% progress, both themes, and mobile, and it reports the video's
`readyState` and the document's `scrollWidth`.

Read the output and check: the hero video actually reaches `readyState 4` (not a silent codec
failure), successive scrub captures show *different* frames, the scroll section fills the viewport
with no letterboxing, text stays legible over both hero and scrim in both themes, and `scrollWidth`
matches the viewport (no horizontal overflow, which fixed-position offsets and long unbreakable
strings both cause).

---

## 7. Show the user

They cannot see localhost. Publish a self-contained preview:

```bash
node .claude/skills/video-scroll-site/scripts/inline-preview.mjs --root . --out /tmp/preview.html
```

This inlines fonts, video, frames, and images as data URIs, because the artifact sandbox blocks
every external request. Publish the result with the Artifact tool, then keep republishing that same
file path on later edits so the link stays stable.

Watch the size: the artifact ceiling is 16 MB and base64 inflates by about a third. If it overflows,
lower the frame fps or the WebP quality for the preview only, and leave the committed site alone.

Also send a couple of screenshots directly. Users skim; a picture in the reply lands faster than a
link they have to open.

---

## Working notes

**Keep what the user blessed.** Once they say the hero and the scroll section are right, treat them
as frozen. Later requests like "translate it" or "restyle it" mean everything *around* those two
moments changes and those two are left alone, unless the user says otherwise. Say so explicitly when
reporting back, so they know their approved work survived.

**Commit the media.** Frames, videos, and fonts belong in the repo. A site that depends on a file
sitting in someone's uploads folder is broken the moment it's cloned.

**When the user says it looks low quality**, check in this order, because the causes look identical
on screen: canvas backing-store resolution first, then extraction resolution, then compression
quality, then the source clip itself. Only the last one requires going back to the user.
