"use client";

import { useEffect, useRef } from "react";

/**
 * A rolling level meter.
 *
 * Its only job is to answer "is this thing hearing me?" at a glance, so it
 * shows real input level rather than a decorative animation — a flat line
 * means a flat microphone, which is exactly what a doctor needs to notice
 * before talking for four minutes into a muted headset.
 */
export function Waveform({
  level,
  active,
  className,
}: {
  /** Current input level, 0–1. */
  level: number;
  active: boolean;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<number[]>([]);
  const levelRef = useRef(level);
  const activeRef = useRef(active);

  levelRef.current = level;
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (w !== canvas!.width || h !== canvas!.height) {
        canvas!.width = w;
        canvas!.height = h;
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    function draw(now: number) {
      // ~30fps is plenty for a level meter and leaves the main thread alone.
      if (now - last > 33) {
        last = now;
        history.current.push(activeRef.current ? levelRef.current : 0);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const barWidth = 3 * dpr;
        const gap = 2 * dpr;
        const bars = Math.floor(canvas!.width / (barWidth + gap));
        if (history.current.length > bars) {
          history.current = history.current.slice(-bars);
        }

        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        const mid = canvas!.height / 2;
        const styles = getComputedStyle(canvas!);
        ctx!.fillStyle = activeRef.current
          ? styles.getPropertyValue("--navy").trim() || "#1b3a5c"
          : styles.getPropertyValue("--border-strong").trim() || "#d9cfc0";

        history.current.forEach((value, i) => {
          const h = Math.max(2 * dpr, value * canvas!.height * 0.88);
          const x = i * (barWidth + gap);
          ctx!.beginPath();
          ctx!.roundRect(x, mid - h / 2, barWidth, h, barWidth / 2);
          ctx!.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    }

    if (reduce) {
      // No animation loop under reduced motion — a single flat baseline, with
      // the numeric state carried by the label beside it.
      resize();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.fillStyle = "#d9cfc0";
      ctx.fillRect(0, canvas.height / 2 - dpr, canvas.width, 2 * dpr);
      return () => ro.disconnect();
    }

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
