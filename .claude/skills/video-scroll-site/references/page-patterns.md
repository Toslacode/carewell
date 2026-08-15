# Section inventory for the page below the fold

Read this when composing the rest of the site. It is a menu, not a running order to follow blindly.
Pick the sections the brief actually needs, and drop the rest: a short page that says real things
beats a long one padded with generic bands.

The ordering below reflects how visitors actually read a marketing page — what is it, what can I
buy, why trust you, how does it work, how do I start.

---

## After the hero and the scroll sequence

**Marquee or ticker.** A single band of short items (product varieties, service names, cities
served) directly after the scroll section works as a palate cleanser between two heavy visual
moments. One per page, never two.

**Categories.** An asymmetric tile grid, 3 to 5 tiles, each an image with a label overlaid at the
bottom over a gradient. Vary the tile spans (7/5, 5/7) rather than making them equal, which is the
difference between designed and defaulted. Cells must match the number of items exactly; an empty
cell means the grid was planned wrong.

**Product or service grid.** Card anatomy that carries its weight: image at a consistent aspect
ratio, name, one line of description, then a row with the price on one side and the action on the
other. Three across on desktop, two on tablet, one on mobile. Keep the price in tabular numerals so
the column aligns.

**Benefits strip.** Three short claims on a tinted band: the thing that makes delivery or service
credible. Each is a heading of a few words plus one sentence. This is where concrete beats clever,
since it exists to answer objections.

**About.** A narrow, centered editorial block. Two or three sentences on how the work is actually
made. Resist the temptation to make this section large; its job is tone, not information.

**Testimonial.** One quote, at most three lines, attributed to a name plus a location or a role. A
wall of testimonials reads as filler; a single well-set quote reads as confidence.

**Process.** Three or four steps as a two-column split, with the heading sticky in one column while
the steps scroll past in the other. Label steps with the verb, not with "Step 1" — the sequence is
already visible from the layout.

**Closing CTA.** Full-bleed image with a scrim, one heading, one line, one button. Repeat the same
CTA label used everywhere else on the page.

**Footer.** Brand line, two or three link columns, contact details and hours, copyright. If the
content is invented for a demo, this is where that is stated.

---

## Things that make the page feel templated

- More than two consecutive sections sharing a layout family, especially alternating image/text
  rows.
- An eyebrow label above every section heading. Roughly one per three sections is plenty.
- Numbered section markers (`01 / 02 / 03`) when the content isn't actually a sequence.
- Equal three-column card rows repeated down the page.
- Two CTAs with the same intent under different labels ("Get started", "Contact us", "Let's talk").
- Decorative status dots, version stamps, or locale/time strips that carry no real information.
- Fabricated precise statistics presented as fact.

---

## Imagery when the client has no photography

Crop stills from their own footage. Vary the timestamp *and* the crop so the set doesn't look like
one frame repeated: different moments of the transformation, different zoom levels, a mix of
portrait crops for product cards and landscape for category tiles.

```bash
# portrait 4:5 product crop from a 1280x720 source
ffmpeg -ss 6.2 -i clip.mp4 -frames:v 1 -vf "crop=576:720:120:0" -c:v libwebp -quality 80 out.webp
```

Crop rectangles must fit inside the source dimensions or ffmpeg errors out; compute the offset from
the source size rather than guessing.

Apply the same `saturate`/`contrast` treatment used on the video so stills and footage read as one
body of work.
