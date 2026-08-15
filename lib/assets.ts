/**
 * Optional media manifest.
 *
 * The application is built to run correctly with none of these present — every
 * consumer has a designed fallback, so the prototype is demonstrable before the
 * footage exists. When a file lands in public/assets, set its path here and the
 * corresponding experience upgrades from the fallback to the real asset. No
 * other code needs to change.
 *
 * Paths are public URLs, not filesystem paths.
 */

/** Full CLARIO branding artwork, used exactly as supplied — the identity is
 *  never redrawn at this size. Serves as the opening hero's still state and as
 *  the poster frame once a hero clip exists. */
export const BRANDING_IMAGE: string | null =
  "/assets/branding/clario-branding.png";

/** Opening hero clip — autoplay, muted, inline, looping, no controls.
 *  Shown whole rather than cropped: the clip carries the identity, and cropping
 *  it to fill an arbitrary viewport would cut the mark. The surrounding area is
 *  the same cream the clip sits on, so there is no letterbox to see.
 *  Fallback: a still cream field with the branding artwork centred. */
export const HERO_VIDEO_MP4: string | null = "/assets/opening/clario-opening.mp4";
export const HERO_VIDEO_WEBM: string | null = null;
/** Deliberately null while the clip is a different aspect ratio from the
 *  branding board — a poster in the wrong ratio letterboxes inside the stage,
 *  and the board carries its own call to action, which would appear twice for
 *  the moment before the first frame decodes. The stage is painted in the
 *  opening's cream instead, so there is nothing to flash. */
export const HERO_POSTER: string | null = null;

/** Scroll-scrubbed sequence. `SCROLL_FRAME_COUNT` frames named
 *  frame-000.webp … in SCROLL_FRAME_DIR, drawn to a canvas by scroll progress.
 *  Fallback: the scroll section collapses and the opening goes straight to the
 *  entry action, rather than showing an empty sticky viewport. */
export const SCROLL_FRAME_DIR: string | null = null;
export const SCROLL_FRAME_COUNT = 0;

/** Door-opening clip, reused for every room with the number composited on.
 *  Fallback: the CSS door swings on its hinge — see DoorTransition. */
export const DOOR_VIDEO: string | null = null;

export const hasHeroVideo = () => Boolean(HERO_VIDEO_MP4 || HERO_VIDEO_WEBM);
export const hasScrollSequence = () =>
  Boolean(SCROLL_FRAME_DIR) && SCROLL_FRAME_COUNT > 1;
