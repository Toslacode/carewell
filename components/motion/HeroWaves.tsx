"use client";

/**
 * The waves at the edges of the opening.
 *
 * The branding artwork already carries faint concentric arcs in its corners.
 * These extend that language into motion: three nested arcs on each side, on
 * long mutually-prime cycles so the two sides never sync up and the loop never
 * resolves to the eye. They breathe in and out of the artwork's own cream
 * rather than sitting on top of it — the whole point is that the opening reads
 * as one moving surface, not a still with an animation layered over it.
 *
 * Drawn as SVG rather than canvas: three paths do not need a render loop, and
 * a vector stays crisp at any viewport without a DPR dance.
 */
export function HeroWaves() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <Side side="start" />
      <Side side="end" />
    </div>
  );
}

function Side({ side }: { side: "start" | "end" }) {
  const flip = side === "end";
  return (
    <svg
      viewBox="0 0 200 900"
      preserveAspectRatio="none"
      className={[
        "absolute inset-y-0 h-full w-[52vw] max-w-[620px] text-oak-pale",
        flip ? "end-0 scale-x-[-1]" : "start-0",
      ].join(" ")}
    >
      {WAVES.map((w, i) => (
        <path
          key={i}
          d={w.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={w.width}
          className={`hero-wave hero-wave-${i + (flip ? 3 : 0)}`}
          style={{ opacity: w.opacity }}
        />
      ))}
    </svg>
  );
}

/** Arcs sweeping out from the edge, matching the curvature already drawn into
 *  the artwork's lower-start corner. */
const WAVES = [
  { d: "M-40 900C60 720 20 520 90 340 140 208 120 96 60 0", width: 1.1, opacity: 0.2 },
  { d: "M-90 900C30 700 -20 500 60 300 120 152 96 60 24 -40", width: 0.9, opacity: 0.13 },
  { d: "M-150 880C0 690 -60 470 30 270 96 124 70 40 -10 -60", width: 0.8, opacity: 0.08 },
];
