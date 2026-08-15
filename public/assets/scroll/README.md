# scroll/

Screen 0, moment 2 — the scroll-scrubbed sequence between the hero and the ward.
This is the asset the `video-scroll-site` skill needs.

Put here:
- One continuous transformation clip. 1080p+, 6–12s, subject roughly centered,
  no loops, no cuts, no camera whip. It becomes a timeline the doctor scrubs, so
  it needs a clear start state and a clear end state.

Best fit for CAREWELL: a slow push down a bright modern hospital corridor that
ends facing a closed patient-room door. That end frame hands off directly into
the 15-door room-selection screen, which is what makes the opening feel like one
continuous move into the ward instead of a marketing intro.

Build step extracts `frames/frame-NNN.webp` at source resolution; the app draws
them to a canvas driven by scroll progress. The source clip is not shipped.
