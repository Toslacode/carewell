# Hebrew and RTL

Read this whenever the site's content is Hebrew, Arabic, or any right-to-left language, including
when an existing left-to-right site is being translated.

A translated site is not the same site with swapped strings. Direction, typography, and several
layout habits all change, and the parts that break are usually the ones nobody thought about.

---

## Document and direction

```html
<html lang="he" dir="rtl">
```

That single attribute flips text direction, list markers, and the default flow of inline content.
Everything else is a consequence of it.

**Use logical properties everywhere.** Physical offsets survive the flip visually intact, which is
exactly the problem: they stay glued to the wrong edge.

| Replace | With |
| --- | --- |
| `margin-left: auto` | `margin-inline-start: auto` |
| `left: 1rem` | `inset-inline-start: 1rem` |
| `padding-right` | `padding-inline-end` |
| `text-align: left` | `text-align: start` |
| `border-left` | `border-inline-start` |

`inset: 0`, `margin-inline: auto`, and centered flex layouts are direction-agnostic and need no
changes.

**Keep the marquee LTR.** A horizontal ticker animated with `translateX(-50%)` reverses direction
under RTL and reads as running backwards. Set `direction: ltr` on the marquee container only; the
words inside still render correctly.

**Off-screen elements need care.** A skip link parked at `left: -999px` sits 999px outside the
*right* edge under RTL and stretches the document, producing horizontal scroll on every page. Park
it vertically instead:

```css
.skip-link { position: fixed; top: -100%; inset-inline-start: 0; }
.skip-link:focus { top: 0; }
```

Always verify `document.documentElement.scrollWidth` equals the viewport width after translating.

---

## Typography

Latin display faces have no Hebrew glyphs, so the browser silently falls back to a system font and
the careful type pairing evaporates. Ship a real Hebrew face.

Good variable Hebrew faces on npm, all open licensed:

| Package | Character |
| --- | --- |
| `@fontsource-variable/heebo` | Neutral geometric sans, the safe workhorse |
| `@fontsource-variable/assistant` | Slightly warmer, friendly, good for consumer brands |
| `@fontsource-variable/rubik` | Rounder, more personality, good for playful briefs |

```bash
npm pack @fontsource-variable/heebo
# copy files/heebo-hebrew-wght-normal.woff2 and files/heebo-latin-wght-normal.woff2
```

Declare both subsets under one family with `unicode-range`, so Latin fragments (emails, prices,
brand names) still render in the Latin cut:

```css
@font-face {
  font-family: "Heebo";
  src: url("../assets/fonts/heebo-hebrew-wght-normal.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face {
  font-family: "Heebo";
  src: url("../assets/fonts/heebo-latin-wght-normal.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
  unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122, U+FEFF, U+FFFD;
}
```

Keep the Latin display face in the stack behind the Hebrew one for numerals and stray Latin.

**Habits from Latin typography that hurt in Hebrew:**

- *Negative letter-spacing* on headlines collapses Hebrew letterforms into each other. Use `0` or a
  hair positive. Tight tracking is a Latin display convention, not a universal one.
- *Uppercase* does not exist. `text-transform: uppercase` is a no-op on Hebrew and silently
  uppercases only the Latin words in a mixed string, which looks like a bug. Style eyebrows with
  weight, size, and color instead.
- *Wide letter-spaced small caps* likewise: replace with a heavier weight at a small size.
- *Line height* wants a touch more room than Latin, since Hebrew has no ascenders/descenders to
  create optical space. Around 1.1 for display, 1.6 to 1.7 for body.
- Hebrew has no italics in most faces; synthesised italics look broken. Emphasise with weight.

**Quotation marks:** Hebrew opens low and closes high, the reverse of English. In markup that means
`&rdquo;text&ldquo;` rather than `&ldquo;text&rdquo;`.

**Currency and numbers:** numerals stay left-to-right inside RTL text and the browser handles this
via bidi. Write `&#8362;240`. Use `font-variant-numeric: tabular-nums` wherever prices align in a
column.

---

## Content, not translation

Machine-flavoured Hebrew is instantly recognisable. Write it as a native speaker would market this
business, which usually means shorter than the English and less abstract.

- Names, places, and testimonials should be plausibly local. A testimonial signed by a foreign name
  in a Tel Aviv florist page reads as stock content.
- Delivery, hours, and service areas are load-bearing details on Israeli service sites. Use real
  local geography and a realistic working week (Sunday to Thursday, short Friday).
- Keep the brand name legible in Hebrew, whether transliterated or translated, and use it
  consistently in nav, footer, and title.
- When content is invented for a demo, say so once in the footer, plainly.

---

## Verification

Check specifically:

- `scrollWidth` equals viewport width at 390px, 768px, and 1440px.
- Nav sits on one line, with the logo on the right and links flowing right to left.
- Icons implying direction (arrows, chevrons) point the correct way.
- Mixed Hebrew/Latin strings such as emails and prices are not visually scrambled.
- Both themes still legible, since translation often shifts text over different parts of the media.
