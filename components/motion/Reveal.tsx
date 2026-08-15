"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Entrance on first sight.
 *
 * An IntersectionObserver rather than a scroll listener, and it disconnects
 * after firing — a ward screen is opened and closed dozens of times a morning,
 * so nothing here is allowed to keep running once its job is done.
 *
 * Content is never gated on the observer: the element is in the DOM and
 * readable throughout, and under reduced motion the CSS resolves it to visible
 * immediately.
 */
export function Reveal({
  children,
  index = 0,
  variant = "rise",
  as: As = "div",
  className,
}: {
  children: ReactNode;
  /** Stagger position among siblings. */
  index?: number;
  variant?: "rise" | "pop";
  as?: "div" | "li" | "section";
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // Already on screen at mount (the common case for above-the-fold content):
    // show immediately rather than waiting a frame for the observer.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <As
      ref={ref as never}
      style={{ ["--d" as string]: index }}
      className={cn(
        variant === "pop" ? "reveal pop" : "reveal",
        shown && "shown",
        className,
      )}
    >
      {children}
    </As>
  );
}
