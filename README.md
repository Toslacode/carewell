# CAREWELL

An Internal Medicine ward round assistant. Hebrew-first, RTL, built for doctors
walking the ward — not a marketing site and not an EMR admin panel.

**All data in this repository is fictitious.** No real patient information is
used, stored, or required, and none ever should be.

## The model

```
מחלקה  →  חדר  →  מטופל  →  סבב מובנה  →  משימות
```

The doctor speaks during the round. Speech is transcribed live in Hebrew,
structured by an AI layer into fixed clinical categories, and turned into
tasks with a suggested priority. Nothing becomes final until the doctor
reviews it and presses `אישור סבב`.

## Status

Scaffolding only. Implementation begins once the motion assets land — see
**Assets** below.

## Stack

Next.js · TypeScript · Tailwind · Framer Motion · Zod

- **Transcription** — a `TranscriptionProvider` interface with three
  implementations: Web Speech API (`he-IL`, the default), local Whisper via
  transformers.js, and a scripted provider for offline demos.
- **AI structuring** — Claude API server-side when `ANTHROPIC_API_KEY` is
  present, with a deterministic Hebrew rule-based extractor as automatic
  fallback when the key is missing, the network is down, or a response fails
  Zod validation. Same user flow either way. The key never reaches the client.
- **Persistence** — local to the browser. There is no backend to speak of, by
  design.

## Assets

Each folder documents what belongs in it.

| Folder | Contents | Served |
|---|---|---|
| `public/assets/branding/` | CAREWELL identity, used directly | yes |
| `public/assets/opening/` | Screen 0 hero video | yes |
| `public/assets/scroll/` | scroll-scrub source → extracted frames | frames only |
| `public/assets/doors/` | door-opening transition | yes |
| `public/assets/fonts/` | Heebo variable subsets (SIL OFL) | yes |
| `design/references/` | reference screenshots | **no** — design only |

The three screen references are recreated as real components. They are never
displayed as application screens.

## Design

Warm cream ground, deep navy primary, light natural oak, muted semantic status
colors kept separate from the brand color. No gold anywhere. Apple-like
restraint over enterprise-hospital density.

Motion communicates navigation and state — entering a room, new extracted
information, a task changing status — and never decorates. Everything honors
`prefers-reduced-motion`.
