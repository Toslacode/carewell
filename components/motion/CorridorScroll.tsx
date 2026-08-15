"use client";

import { useEffect, useRef } from "react";

/**
 * The scroll-scrubbed corridor — drawn, not filmed.
 *
 * This stands in for the supplied scroll clip and keeps the exact same
 * mechanics the real sequence will use, so swapping footage in later is a
 * component swap and nothing more:
 *
 *   · canvas backing store at display size × DPR, so it is sharp rather than
 *     a small buffer stretched across the viewport
 *   · no scroll listeners — an IntersectionObserver runs a rAF loop only while
 *     the section is near the viewport
 *   · position read from getBoundingClientRect inside the frame, so scrolling
 *     up reverses the walk for free
 *   · a lerp smooths fast flicks, with a snap so it settles
 *   · reduced motion collapses the runway and draws one still
 *
 * The scene is a one-point-perspective ward corridor: the camera walks forward
 * past lit doorways and comes to rest facing a closed door — which is the
 * frame the room-selection screen opens on.
 */

/* ---- world ---------------------------------------------------------------
   Camera sits at the origin looking down +z. Everything is projected with a
   single focal length, which is all a one-point corridor needs.              */
const HALF_W = 1.45; // corridor half-width
const FLOOR_Y = 1.15;
const CEIL_Y = -1.55;
const DOOR_TOP = -0.72;
const Z_END = 27; // far wall
/** Near edge of each doorway. Spacing and depth are sized so a door reads as a
 *  door — roughly a third of the bay it sits in — rather than as a wall panel. */
const DOOR_SLOTS = [3.6, 6.8, 10, 13.2, 16.4, 19.6, 22.8];
const DOOR_DEPTH = 1.15;
/** The walk stops just short of the far door, framing it the way the
 *  room-selection screen opens. */
const WALK = 25.1;

export interface DoorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** The walk is finished at this point; the door ahead opens on its own. Short
 *  of 1 so it fires while the reader is still moving, not after they stop. */
const ARRIVE_AT = 0.975;

export function CorridorScroll({
  label,
  className,
  onArrive,
}: {
  /** Describes what unfolds, for screen readers. The canvas carries no text. */
  label: string;
  className?: string;
  /** Called once, when the walk reaches the door. `rect` is where the drawn
   *  door sits on screen, so a DOM door can take over exactly on top of it. */
  onArrive?: (rect: DoorRect | null) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let shown = 0;
    let running = false;
    let raf = 0;
    let arrived = false;
    /** Where the far door sits on screen in CSS pixels. */
    let doorRect: DoorRect | null = null;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas!.clientWidth * dpr);
      const h = Math.round(canvas!.clientHeight * dpr);
      if (w === canvas!.width && h === canvas!.height) return;
      canvas!.width = w;
      canvas!.height = h;
      draw(shown);
    }

    function draw(t: number) {
      const W = canvas!.width;
      const H = canvas!.height;
      if (!W || !H) return;

      const camZ = t * WALK;
      const cx = W / 2;
      // Eye line slightly above centre — a corridor viewed from standing
      // height, not from the floor.
      const cy = H * 0.47;
      const f = H * 0.62;

      /** Screen position of a world point, or null once it is behind us. */
      const px = (x: number, z: number) => cx + (x * f) / z;
      const py = (y: number, z: number) => cy + (y * f) / z;

      const quad = (
        pts: Array<[number, number]>,
        fill: string | CanvasGradient,
      ) => {
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i += 1) ctx!.lineTo(pts[i][0], pts[i][1]);
        ctx!.closePath();
        ctx!.fillStyle = fill;
        ctx!.fill();
      };

      // Ground: the warm haze at the vanishing point reads as light spilling
      // from the room at the end, which is where the walk is heading.
      const bg = ctx!.createRadialGradient(cx, cy, 0, cx, cy, H * 0.9);
      bg.addColorStop(0, "#FFFCF5");
      bg.addColorStop(0.45, "#F6EFE4");
      bg.addColorStop(1, "#EDE4D6");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, W, H);

      // ---- far wall + the door the walk ends on ----
      const zEnd = Math.max(0.6, Z_END - camZ);
      const eL = px(-HALF_W, zEnd);
      const eR = px(HALF_W, zEnd);
      const eT = py(CEIL_Y, zEnd);
      const eB = py(FLOOR_Y, zEnd);
      quad(
        [
          [eL, eT],
          [eR, eT],
          [eR, eB],
          [eL, eB],
        ],
        "#F3ECE0",
      );

      const dW = 0.5;
      const dL = px(-dW, zEnd);
      const dR = px(dW, zEnd);
      const dT = py(DOOR_TOP, zEnd);
      // frame reveal
      quad(
        [
          [px(-dW - 0.09, zEnd), py(DOOR_TOP - 0.09, zEnd)],
          [px(dW + 0.09, zEnd), py(DOOR_TOP - 0.09, zEnd)],
          [px(dW + 0.09, zEnd), eB],
          [px(-dW - 0.09, zEnd), eB],
        ],
        "#E4DACA",
      );
      const slab = ctx!.createLinearGradient(dL, dT, dR, eB);
      slab.addColorStop(0, "#D6B98F");
      slab.addColorStop(0.55, "#C9A87C");
      slab.addColorStop(1, "#B99669");
      quad(
        [
          [dL, dT],
          [dR, dT],
          [dR, eB],
          [dL, eB],
        ],
        slab,
      );
      // Recorded in CSS pixels for the hand-off to the DOM door.
      const scale = canvas!.clientWidth / W;
      doorRect = {
        left: dL * scale,
        top: dT * scale,
        width: (dR - dL) * scale,
        height: (eB - dT) * scale,
      };

      // handle, only once it is large enough to read
      const handleW = (dR - dL) * 0.13;
      if (handleW > 2) {
        ctx!.fillStyle = "#3A3A38";
        const hy = dT + (eB - dT) * 0.52;
        ctx!.fillRect(dR - handleW * 2.1, hy, handleW, Math.max(1, handleW * 0.3));
      }

      // ---- side walls, drawn far to near so nearer surfaces overdraw ----
      for (let i = DOOR_SLOTS.length - 1; i >= 0; i -= 1) {
        const za = DOOR_SLOTS[i] - camZ;
        const zb = za + DOOR_DEPTH;
        if (zb <= 0.6) continue; // fully behind the camera
        const zn = Math.max(0.6, za);
        const zf = Math.max(0.7, zb);

        const depth = 1 - Math.min(1, zn / Z_END);
        const wall = `rgba(250,246,238,${0.55 + depth * 0.45})`;

        for (const side of [-1, 1] as const) {
          const x = HALF_W * side;
          const nT = py(CEIL_Y, zn);
          const nB = py(FLOOR_Y, zn);
          const fT = py(CEIL_Y, zf);
          const fB = py(FLOOR_Y, zf);
          const nX = px(x, zn);
          const fX = px(x, zf);

          quad(
            [
              [nX, nT],
              [fX, fT],
              [fX, fB],
              [nX, nB],
            ],
            wall,
          );

          // doorway: recessed frame, then the slab
          const dnT = py(DOOR_TOP, zn);
          const dfT = py(DOOR_TOP, zf);
          quad(
            [
              [nX, dnT],
              [fX, dfT],
              [fX, fB],
              [nX, nB],
            ],
            "#E6DCCC",
          );

          const inset = 0.1;
          const inN = Math.max(0.6, zn + inset);
          const inF = Math.max(0.7, zf - inset);
          const g = ctx!.createLinearGradient(px(x, inN), 0, px(x, inF), 0);
          const lit = side < 0 ? 1 : 0.92;
          g.addColorStop(0, `rgba(214,185,143,${lit})`);
          g.addColorStop(1, `rgba(185,150,105,${lit})`);
          quad(
            [
              [px(x, inN), py(DOOR_TOP + 0.05, inN)],
              [px(x, inF), py(DOOR_TOP + 0.05, inF)],
              [px(x, inF), py(FLOOR_Y, inF)],
              [px(x, inN), py(FLOOR_Y, inN)],
            ],
            g,
          );

          // ceiling downlight above the doorway
          const lx = px(x * 0.72, (zn + zf) / 2);
          const ly = py(CEIL_Y + 0.04, (zn + zf) / 2);
          const r = Math.max(2, (f / ((zn + zf) / 2)) * 0.11);
          const glow = ctx!.createRadialGradient(lx, ly, 0, lx, ly, r * 3);
          glow.addColorStop(0, "rgba(255,246,222,.95)");
          glow.addColorStop(1, "rgba(255,246,222,0)");
          ctx!.fillStyle = glow;
          ctx!.beginPath();
          ctx!.arc(lx, ly, r * 3, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // ---- floor and ceiling, as one long quad each ----
      const zNear = 0.75;
      const zFar = Math.max(1, Z_END - camZ);
      const floorGrad = ctx!.createLinearGradient(0, py(FLOOR_Y, zFar), 0, H);
      floorGrad.addColorStop(0, "#EFE7DA");
      floorGrad.addColorStop(1, "#E4D9C7");
      quad(
        [
          [px(-HALF_W, zFar), py(FLOOR_Y, zFar)],
          [px(HALF_W, zFar), py(FLOOR_Y, zFar)],
          [px(HALF_W, zNear), py(FLOOR_Y, zNear)],
          [px(-HALF_W, zNear), py(FLOOR_Y, zNear)],
        ],
        floorGrad,
      );
      quad(
        [
          [px(-HALF_W, zFar), py(CEIL_Y, zFar)],
          [px(HALF_W, zFar), py(CEIL_Y, zFar)],
          [px(HALF_W, zNear), py(CEIL_Y, zNear)],
          [px(-HALF_W, zNear), py(CEIL_Y, zNear)],
        ],
        "#FCF9F3",
      );

      // Vignette, so the corridor sits inside the page rather than on it.
      const vig = ctx!.createRadialGradient(cx, cy, H * 0.3, cx, cy, H * 0.95);
      vig.addColorStop(0, "rgba(247,241,232,0)");
      vig.addColorStop(1, "rgba(238,229,215,.55)");
      ctx!.fillStyle = vig;
      ctx!.fillRect(0, 0, W, H);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    if (reduce) {
      shown = 0.72;
      draw(shown);
      return () => ro.disconnect();
    }

    function progress() {
      const rect = section!.getBoundingClientRect();
      const runway = rect.height - window.innerHeight;
      if (runway <= 0) return 0;
      return Math.max(0, Math.min(1, -rect.top / runway));
    }

    function tick() {
      const target = progress();
      shown += (target - shown) * 0.12;
      if (Math.abs(target - shown) < 0.0015) shown = target;
      draw(shown);

      // Reaching the end of the corridor IS the transition. The reader walked
      // up to the door; the door opens. Making them press a button to do what
      // the walk was already doing breaks the illusion the sequence buys.
      if (!arrived && target >= ARRIVE_AT && arriveRef.current) {
        arrived = true;
        running = false;
        cancelAnimationFrame(raf);
        const box = canvas!.getBoundingClientRect();
        arriveRef.current(
          doorRect && {
            left: box.left + doorRect.left,
            top: box.top + doorRect.top,
            width: doorRect.width,
            height: doorRect.height,
          },
        );
        return;
      }

      if (running) raf = requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !running) {
            running = true;
            raf = requestAnimationFrame(tick);
          } else if (!entry.isIntersecting && running) {
            running = false;
            cancelAnimationFrame(raf);
          }
        }
      },
      { rootMargin: "40% 0px 40% 0px" },
    );
    io.observe(section);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      running = false;
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label={label}
      className={className}
      style={{ position: "relative", height: "300vh" }}
    >
      <div className="sticky top-0 h-[100dvh] overflow-hidden bg-page">
        <canvas ref={canvasRef} className="block h-full w-full" />
        {/* masks the scene into the cream ground at both edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "linear-gradient(to bottom, var(--page) 0%, transparent 14%)",
              "linear-gradient(to top, var(--page) 0%, transparent 14%)",
            ].join(","),
          }}
        />
      </div>
    </section>
  );
}
