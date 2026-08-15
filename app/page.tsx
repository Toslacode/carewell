"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CarewellMark, CarewellWordmark } from "@/components/branding/CarewellLockup";
import { ScrollSequence } from "@/components/motion/ScrollSequence";
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
 * Two moments before any application UI: a full-bleed video hero holding the
 * identity, then a scroll-scrubbed sequence the visitor drives. It ends by
 * dissolving the branding into the ward rather than navigating away from a
 * marketing page — the opening is the front of the product, not a site in
 * front of it.
 *
 * Every media asset here is optional. With nothing supplied the hero renders
 * as a still cream field with the identity centred and the scroll runway is
 * omitted entirely, so the opening is demonstrable before the footage exists.
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
    window.setTimeout(() => router.push("/rooms"), 520);
  }, [router]);

  return (
    <main id="main" className="bg-page">
      <section className="relative isolate grid min-h-[100dvh] place-items-center overflow-hidden">
        {/* backdrop */}
        <div className="absolute inset-0 -z-10 bg-page-deep">
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
          ) : BRANDING_IMAGE ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={BRANDING_IMAGE}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            // Fallback ground: the cream field of the identity, with the same
            // soft contour language as the artwork.
            <div
              className="h-full w-full"
              style={{
                background: [
                  "radial-gradient(120% 90% at 78% 8%, #FBF5EC 0%, rgba(251,245,236,0) 55%)",
                  "radial-gradient(90% 70% at 12% 92%, #F3EADC 0%, rgba(243,234,220,0) 60%)",
                  "linear-gradient(160deg, #FAF4EB 0%, #F4ECE0 100%)",
                ].join(","),
              }}
            />
          )}

          {/* Legibility layer + fade into the page ground, so there is no seam
              between footage and page. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background: [
                "linear-gradient(to bottom, var(--page) 0%, transparent 22%)",
                "linear-gradient(to top, var(--page) 0%, transparent 26%)",
                hasHeroVideo() ? "rgba(247,241,232,.42)" : "transparent",
              ].join(","),
            }}
          />
        </div>

        {/* identity */}
        <div
          className={[
            "flex flex-col items-center px-6 text-center transition-all duration-500 ease-out",
            leaving ? "scale-90 opacity-0" : "scale-100 opacity-100",
          ].join(" ")}
        >
          <CarewellMark className="rise h-20 w-20 text-navy sm:h-24 sm:w-24" />
          <CarewellWordmark className="rise mt-5 text-[clamp(2.6rem,9vw,5rem)]" />
          <p className="rise mt-5 text-[13px] tracking-[0.3em] text-ink-muted sm:text-sm">
            טיפול אנושי. כל יום.
          </p>

          <button
            type="button"
            onClick={enterWard}
            style={{ ["--d" as string]: 3 }}
            className="rise mt-12 rounded-chip bg-navy px-8 py-3.5 text-[15px] font-semibold text-on-navy shadow-card transition-colors hover:bg-navy-deep"
          >
            כניסה למחלקה
          </button>

          {hasScrollSequence() && (
            <p className="rise mt-10 text-[12px] text-ink-muted" aria-hidden="true">
              גללו להמשך
            </p>
          )}
        </div>
      </section>

      {hasScrollSequence() && SCROLL_FRAME_DIR && (
        <>
          <ScrollSequence
            dir={SCROLL_FRAME_DIR}
            count={SCROLL_FRAME_COUNT}
            label="מעבר במסדרון המחלקה עד לדלת החדר"
          />
          {/* The handoff: the sequence ends facing a door, and the ward opens. */}
          <section className="grid min-h-[60vh] place-items-center px-6 text-center">
            <div>
              <p className="text-[15px] text-ink-muted">מחלקה פנימית ב׳</p>
              <h2 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-bold tracking-tight text-navy-deep">
                בחירת חדר
              </h2>
              <button
                type="button"
                onClick={enterWard}
                className="mt-8 rounded-chip bg-navy px-8 py-3.5 text-[15px] font-semibold text-on-navy shadow-card transition-colors hover:bg-navy-deep"
              >
                כניסה למחלקה
              </button>
            </div>
          </section>
        </>
      )}

      {/* the cream wash the branding dissolves into on the way to the ward */}
      <div
        aria-hidden="true"
        className={[
          "pointer-events-none fixed inset-0 z-40 bg-page transition-opacity duration-500",
          leaving ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />
    </main>
  );
}
