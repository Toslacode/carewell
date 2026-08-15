"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CarewellMark, CarewellWordmark } from "@/components/branding/CarewellLockup";
import { ScrollSequence } from "@/components/motion/ScrollSequence";
import { CorridorScroll } from "@/components/motion/CorridorScroll";
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
  const [leaving, setLeaving] = useState(false);

  const enterWard = useCallback(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      router.push("/rooms");
      return;
    }
    router.prefetch("/rooms");
    setLeaving(true);
    window.setTimeout(() => router.push("/rooms"), 560);
  }, [router]);

  // With artwork but no footage, the artwork *is* the hero — the entry action
  // sits below it rather than on top of a redundant vector lockup.
  const showArtworkOnly = !hasHeroVideo() && Boolean(BRANDING_IMAGE);

  return (
    <main id="main" className="bg-page">
      <section className="relative isolate grid min-h-[100dvh] place-items-center overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-page">
          {hasHeroVideo() ? (
            <video
              className="h-full w-full object-cover"
              style={{ filter: "saturate(.82) contrast(1.03)" }}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={HERO_POSTER ?? BRANDING_IMAGE ?? undefined}
            >
              {/* WebM first: a browser without H.264 skips the mp4 and would
                  otherwise render nothing at all. */}
              {HERO_VIDEO_WEBM && <source src={HERO_VIDEO_WEBM} type="video/webm" />}
              {HERO_VIDEO_MP4 && <source src={HERO_VIDEO_MP4} type="video/mp4" />}
            </video>
          ) : (
            <>
              {/* Ambient ground: two cream fields on long, mutually prime
                  cycles, so the drift never resolves into a visible loop. */}
              <div
                aria-hidden="true"
                className="drift-a absolute inset-[-12%]"
                style={{
                  background:
                    "radial-gradient(46% 42% at 74% 16%, #FFFDF8 0%, rgba(255,253,248,0) 68%)",
                }}
              />
              <div
                aria-hidden="true"
                className="drift-b absolute inset-[-12%]"
                style={{
                  background:
                    "radial-gradient(52% 46% at 18% 84%, #F1E6D6 0%, rgba(241,230,214,0) 66%)",
                }}
              />
              {BRANDING_IMAGE && (
                <div className="absolute inset-0 overflow-hidden">
                  {/* The artwork already carries the mark, wordmark and
                      tagline, so it is shown whole rather than cropped behind
                      a second copy drawn in vector. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BRANDING_IMAGE}
                    alt="CAREWELL — טיפול אנושי. כל יום."
                    className="breathe h-full w-full object-contain"
                  />
                  <div
                    aria-hidden="true"
                    className="sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.65) 50%, rgba(255,255,255,0) 100%)",
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* Legibility layer + fade into the page ground, so there is no seam
              between the hero and the page. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: [
                "linear-gradient(to bottom, var(--page) 0%, transparent 18%)",
                "linear-gradient(to top, var(--page) 0%, transparent 20%)",
                hasHeroVideo() ? "rgba(247,241,232,.42)" : "transparent",
              ].join(","),
            }}
          />
        </div>

        <div
          className={[
            "flex flex-col items-center px-6 text-center transition-all duration-[560ms] ease-out",
            // The artwork is letterboxed by object-contain, so the action is
            // anchored to the viewport bottom rather than offset from centre —
            // margin maths against an unknown letterbox lands it on the
            // artwork's own tagline at some window sizes.
            showArtworkOnly ? "absolute inset-x-0 bottom-[6vh]" : "relative",
            leaving ? "scale-[0.92] opacity-0 blur-[2px]" : "scale-100 opacity-100",
          ].join(" ")}
        >
          {!showArtworkOnly && (
            <>
              <CarewellMark className="rise h-20 w-20 text-navy sm:h-24 sm:w-24" />
              <CarewellWordmark className="rise mt-5 text-[clamp(2.6rem,9vw,5rem)]" />
              <p className="rise mt-5 text-[13px] tracking-[0.3em] text-ink-muted sm:text-sm">
                טיפול אנושי. כל יום.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={enterWard}
            style={{ ["--d" as string]: 3 }}
            className={[
              "rise group relative overflow-hidden rounded-chip bg-navy px-8 py-3.5 text-[15px] font-semibold text-on-navy shadow-card",
              "transition-[transform,box-shadow,background-color] duration-300",
              "hover:-translate-y-0.5 hover:bg-navy-deep hover:shadow-lift active:translate-y-0",
              showArtworkOnly ? "mt-0" : "mt-12",
            ].join(" ")}
          >
            <span className="relative z-10">כניסה למחלקה</span>
            {/* light passing under the cursor, not a colour change */}
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-gradient-to-l from-transparent via-white/18 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
          </button>

          <span
            aria-hidden="true"
            className="rise mt-7 flex h-9 w-[22px] items-start justify-center rounded-full border border-line-strong p-1.5"
            style={{ ["--d" as string]: 4 }}
          >
            <span className="h-1.5 w-1 rounded-full bg-ink-decor motion-safe:animate-bounce" />
          </span>
        </div>
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
        <CorridorScroll label="מעבר במסדרון המחלקה עד לדלת החדר" />
      )}

      {/* The handoff: the walk ends facing a door, and the ward opens. */}
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
