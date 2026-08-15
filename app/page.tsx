"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroWaves } from "@/components/motion/HeroWaves";
import { ScrollSequence } from "@/components/motion/ScrollSequence";
import { type DoorRect, CorridorScroll } from "@/components/motion/CorridorScroll";
import { DoorTransition } from "@/components/rooms/DoorTransition";
import { usePrefs } from "@/lib/store/prefs";
import {
  BRANDING_IMAGE,
  HERO_POSTER,
  HERO_VIDEO_MP4,
  HERO_VIDEO_WEBM,
  SCROLL_FRAME_COUNT,
  SCROLL_FRAME_DIR,
  hasHeroVideo,
  hasScrollSequence,
} from "@/lib/assets";

/**
 * Screen 0 — the opening.
 *
 * Two moments before any application UI: a full-bleed hero holding the
 * identity, then a scroll-driven sequence the visitor walks. It ends by
 * dissolving the branding into the ward rather than navigating away from a
 * marketing page — the opening is the front of the product, not a site in
 * front of it.
 *
 * Neither moment waits on footage. With no hero clip the backdrop is two
 * slow-drifting cream fields with a specular pass over the artwork; with no
 * scroll clip the sequence is a corridor drawn to canvas and scrubbed by the
 * same scroll mechanics the real footage will use. Supplying either asset
 * swaps that one moment and leaves the rest of the screen untouched.
 */
export default function OpeningPage() {
  const router = useRouter();
  const { calm } = usePrefs();
  const [leaving, setLeaving] = useState(false);
  const [doorway, setDoorway] = useState<DoorRect | null>(null);
  /** A browser with no decoder for the supplied clip gets the branding board
   *  rather than an empty cream rectangle with a button floating in it. */
  const [clipFailed, setClipFailed] = useState(false);
  const useClip = hasHeroVideo() && !clipFailed;

  /**
   * The end of the walk. The reader has just spent three viewport-heights
   * walking up to a closed door; the door opens and they step through. The rect
   * is where the drawn door sits on screen, so the DOM door placed on top of it
   * makes the hand-off from canvas to CSS invisible.
   */
  const arriveAtDoor = useCallback(
    (rect: DoorRect | null) => {
      if (calm || !rect || rect.width < 8) {
        router.push("/rooms");
        return;
      }
      router.prefetch("/rooms");
      setDoorway(rect);
    },
    [calm, router],
  );

  const enterWard = useCallback(() => {
    if (calm) {
      router.push("/rooms");
      return;
    }
    router.prefetch("/rooms");
    setLeaving(true);
    window.setTimeout(() => router.push("/rooms"), 560);
  }, [calm, router]);

  // With artwork but no footage, the artwork *is* the hero — the entry action
  // sits below it rather than on top of a redundant vector lockup.
  const showArtworkOnly = !hasHeroVideo() && Boolean(BRANDING_IMAGE);

  return (
    <main id="main" className="bg-page">
      <section className="hero-section relative isolate grid min-h-[100dvh] place-items-center overflow-hidden">
        {/* Ambient ground behind the stage: two cream fields on long, mutually
            prime cycles, and the edge waves that carry the artwork's own arcs
            into motion. */}
        <div className="absolute inset-0 -z-10">
          <div
            aria-hidden="true"
            className="hero-field-a drift-a absolute inset-[-12%]"
            style={{
              background:
                "radial-gradient(46% 42% at 74% 16%, #FFFDF8 0%, rgba(255,253,248,0) 68%)",
            }}
          />
          <div
            aria-hidden="true"
            className="hero-field-b drift-b absolute inset-[-12%]"
            style={{
              background:
                "radial-gradient(52% 46% at 18% 84%, #EFE0CE 0%, rgba(239,224,206,0) 66%)",
            }}
          />
          <HeroWaves />
        </div>

        {/* The stage is locked to the asset's own aspect ratio: the opening is
            shown whole — never cropped, never stretched — and the cream around
            it is the page's own ground rather than a letterbox. */}
        <div
          className={[
            "hero-stage transition-all duration-[560ms] ease-out",
            useClip ? "is-video" : "",
            leaving ? "scale-[0.94] opacity-0 blur-[2px]" : "scale-100 opacity-100",
          ].join(" ")}
        >
          {useClip && (
            <video
              className="hero-video"
              autoPlay
              muted
              loop
              playsInline
              // No controls, and none summoned by a long-press either: this is
              // the front door of the application, not an embedded player.
              controls={false}
              disablePictureInPicture
              controlsList="nodownload noplaybackrate noremoteplayback"
              preload="auto"
              // Poster only when one is supplied for this clip. The branding
              // board is deliberately not used as a stand-in: it is a different
              // aspect ratio and draws its own call to action, which would show
              // twice for the moment before the first frame decodes. The stage
              // is painted cream instead, so there is nothing to flash.
              poster={HERO_POSTER ?? undefined}
              aria-label="CLARIO — Turn rounds into action."
              onError={() => setClipFailed(true)}
            >
              {/* WebM first: a browser without H.264 skips the mp4 and would
                  otherwise render nothing at all. */}
              {HERO_VIDEO_WEBM && <source src={HERO_VIDEO_WEBM} type="video/webm" />}
              {HERO_VIDEO_MP4 && <source src={HERO_VIDEO_MP4} type="video/mp4" />}
            </video>
          )}

          {BRANDING_IMAGE && !useClip && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRANDING_IMAGE}
                alt="CLARIO — Turn rounds into action."
                className="hero-art breathe"
              />
              <span
                aria-hidden="true"
                className="hero-glare sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 50%, rgba(255,255,255,0) 100%)",
                }}
              />
            </>
          )}

          {useClip ? (
            // The clip draws its own call to action, so the whole opening is
            // the target rather than a second button sitting under the first.
            <button type="button" onClick={enterWard} className="hero-enter">
              <span className="sr-only">כניסה למחלקה</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={enterWard}
              className="hero-cta group overflow-hidden rounded-chip bg-navy text-[15px] font-semibold text-on-navy shadow-card transition-[box-shadow,background-color] duration-300 hover:bg-navy-deep hover:shadow-lift"
            >
              כניסה למחלקה
            </button>
          )}
        </div>

        {/* fade into the page ground, so there is no seam below the stage */}
        <div aria-hidden="true" className="hero-fade pointer-events-none absolute inset-0" />

        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[3vh] mx-auto flex h-9 w-[22px] items-start justify-center rounded-full border border-line-strong p-1.5"
        >
          <span className="h-1.5 w-1 rounded-full bg-ink-decor motion-safe:animate-bounce" />
        </span>
      </section>

      {/* Moment two. Real frames when they exist; the drawn corridor until then
          — same scroll contract either way. */}
      {hasScrollSequence() && SCROLL_FRAME_DIR ? (
        <ScrollSequence
          dir={SCROLL_FRAME_DIR}
          count={SCROLL_FRAME_COUNT}
          label="מעבר במסדרון המחלקה עד לדלת החדר"
        />
      ) : (
        <CorridorScroll
          label="מעבר במסדרון המחלקה עד לדלת החדר"
          onArrive={arriveAtDoor}
        />
      )}

      {/* With motion suppressed the corridor is a single still and never
          reaches its own end, so the way through has to be a control. */}
      {calm && (
      <section className="grid min-h-[62vh] place-items-center px-6 text-center">
        <div
          className={[
            "transition-all duration-[560ms] ease-out",
            leaving ? "scale-[0.92] opacity-0" : "scale-100 opacity-100",
          ].join(" ")}
        >
          <p className="text-[15px] text-ink-muted">מחלקה פנימית ב׳</p>
          <h2 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight text-navy-deep">
            בחירת חדר
          </h2>
          <button
            type="button"
            onClick={enterWard}
            className="group relative mt-8 overflow-hidden rounded-chip bg-navy px-8 py-3.5 text-[15px] font-semibold text-on-navy shadow-card transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-navy-deep hover:shadow-lift"
          >
            <span className="relative z-10">כניסה למחלקה</span>
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </button>
        </div>
      </section>
      )}

      {doorway && (
        <DoorTransition
          number={null}
          origin={doorway}
          onDone={() => router.push("/rooms")}
        />
      )}

      {/* the cream wash the branding dissolves into on the way to the ward */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none fixed inset-0 z-40 bg-page transition-opacity duration-[560ms]",
          leaving ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
    </main>
  );
}
