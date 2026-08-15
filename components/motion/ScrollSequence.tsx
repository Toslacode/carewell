"use client";

import { useEffect, useRef } from "react";

/**
 * A frame sequence scrubbed by scroll position, drawn to a canvas.
 *
 * Mechanics follow the video-scroll-site reference, and the details are not
 * incidental — each one replaces a specific failure:
 *
 *   · Backing store sized to clientWidth × DPR. Without this the canvas renders
 *     into a small buffer that gets stretched, and the footage looks like a
 *     low-bitrate video rather than a resolution problem.
 *   · No scroll listeners. An IntersectionObserver starts a rAF loop while the
 *     section is near the viewport and cancels it when it leaves, so scrolling
 *     stays on the compositor.
 *   · Position is read from getBoundingClientRect inside the frame, so scrolling
 *     up reverses the sequence for free.
 *   · A lerp smooths fast flicks, with a snap so it settles exactly on a frame
 *     instead of drifting forever.
 *   · Under reduced motion the runway collapses and one still — the end state —
 *     is drawn. Nothing animates.
 */
export function ScrollSequence({
  dir,
  count,
  label,
  className,
}: {
  /** Public URL of the frame directory, no trailing slash. */
  dir: string;
  count: number;
  /** Describes what unfolds, for screen readers. The canvas has no text. */
  label: string;
  className?: string;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frameSrc = (i: number) =>
      `${dir}/frame-${String(i).padStart(3, "0")}.webp`;

    const frames: Array<HTMLImageElement | undefined> = new Array(count);
    let current = -1;
    let shown = 0;
    let running = false;
    let rafId = 0;

    function draw(value: number) {
      const i = Math.max(0, Math.min(count - 1, Math.round(value)));
      if (i === current) return;
      const img = frames[i];
      if (!img || !img.complete || !img.naturalWidth) return;
      current = i;
      const scale = Math.max(
        canvas!.width / img.naturalWidth,
        canvas!.height / img.naturalHeight,
      );
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      ctx!.drawImage(img, (canvas!.width - w) / 2, (canvas!.height - h) / 2, w, h);
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (w === canvas!.width && h === canvas!.height) return;
      canvas!.width = w;
      canvas!.height = h;
      current = -1; // buffer cleared — force the next draw through
      draw(shown);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    if (reduce) {
      const still = new Image();
      still.onload = () => {
        frames[count - 1] = still;
        shown = count - 1;
        draw(count - 1);
      };
      still.src = frameSrc(count - 1);
      return () => ro.disconnect();
    }

    let loaded = false;
    function load() {
      if (loaded) return;
      loaded = true;
      for (let i = 0; i < count; i += 1) {
        const img = new Image();
        if (i === 0) img.onload = () => draw(0);
        img.src = frameSrc(i);
        frames[i] = img;
      }
    }

    function progress() {
      const rect = section!.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      if (runway <= 0) return 0;
      return Math.max(0, Math.min(1, -rect.top / runway));
    }

    function tick() {
      const target = progress() * (count - 1);
      shown += (target - shown) * 0.2;
      if (Math.abs(target - shown) < 0.4) shown = target;
      draw(shown);
      if (running) rafId = requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            load();
            if (!running) {
              running = true;
              rafId = requestAnimationFrame(tick);
            }
          } else if (running) {
            running = false;
            cancelAnimationFrame(rafId);
          }
        }
      },
      { rootMargin: "60% 0px 60% 0px" },
    );
    io.observe(section);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(rafId);
      running = false;
    };
  }, [dir, count]);

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={className}
      style={{ position: "relative", height: "320vh" }}
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-page-deep">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/* masks the footage into the cream ground at both edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "linear-gradient(to bottom, var(--page) 0%, transparent 16%)",
              "linear-gradient(to top, var(--page) 0%, transparent 16%)",
            ].join(","),
          }}
        />
      </div>
    </section>
  );
}
