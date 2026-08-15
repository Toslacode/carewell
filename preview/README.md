# In-browser preview

`carewell-preview.html` is the whole CAREWELL flow in one self-contained file:
open it from a chat, a link, or a double-click — no clone, no install, no server.

```
node preview/build.mjs      # rebuilds carewell-preview.html from src/
```

## What it is

A port of the application in `../app` and `../components` to plain HTML, CSS and
JavaScript, so it can run with no build step and no network. It uses the same
design tokens, the same component anatomy, the same Hebrew strings and the same
motion vocabulary, and it carries the real logic rather than a mock of it:

| Behaviour | Ported from |
| --- | --- |
| Deterministic Hebrew extractor | `lib/ai/rules.ts` → `src/20-extract.js` |
| Priority derived in code from spoken timing | `lib/schemas/clinical.ts` → `src/20-extract.js` |
| Draft merge, never removes, dedupes by text | `lib/store/ward-store.tsx` → `src/30-store.js` |
| The ״אישור סבב״ review gate | `lib/store/ward-store.tsx` → `src/30-store.js` |
| Scroll-scrubbed corridor | `components/motion/CorridorScroll.tsx` → `src/50-corridor.js` |
| Fictitious ward, 15 rooms / 17 patients | `lib/demo-data/ward.ts` → `src/10-data.js` |
| Ward assistant retrieval engine | `lib/ai/ward-assistant.ts` → `src/25-assistant.js` |
| Night mode, motion switch | `app/globals.css` + `lib/store/prefs.tsx` |

## What it is not

**The AI here is only the fallback engine.** The application calls the Claude API
first, server-side, whenever `ANTHROPIC_API_KEY` is set, and drops to the Hebrew
rule extractor when there is no key, no network, or a response that fails
validation. A static file has no server and therefore no key — so the preview
always runs the fallback, and says so in the recorder every time it structures
anything. No API key is present in this file, and none can be.

**The assistant answers from the record, not from a model.** In the application
the question also goes to Claude server-side, which chooses *which patients*
answer it and writes the summary line — the quotes and the links are still built
from the chart either way, so a hallucinated name has nowhere to enter. With no
key the panel runs the retrieval engine alone and says so.

**The microphone may not be reachable.** The browser engine is offered exactly as
the application offers it; if the embedding page has not granted microphone
access, the real permission-denied state appears rather than a silent stall. The
scripted engine is the default here and is labelled as scripted wherever it
shows. It replays a fixed transcript — it does not transcribe speech.

For live transcription against a real microphone, and for Claude as the
structuring engine, run the Next.js application itself.

## Data

Every name, ID number and clinical detail is invented. The ID numbers
deliberately fail the Israeli teudat-zehut check digit so this data can never be
mistaken for a real record.

## Assets

The font subsets (`public/assets/fonts`) and the branding artwork
(`public/assets/branding`) are inlined as data URIs at build time, because the
embedding sandbox blocks every external request. The artwork is re-encoded to
WebP at 1600px — visually identical at the sizes it is shown, ~50 KB instead of
~1.3 MB.
