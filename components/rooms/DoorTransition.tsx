"use client";

import { useEffect, useRef, useState } from "react";
import { DoorSlab } from "@/components/rooms/Door";
import { DOOR_VIDEO } from "@/lib/assets";
import type { Room } from "@/lib/schemas/clinical";

/**
 * Entering a room.
 *
 * The clicked door is cloned at its exact on-screen position, flown toward the
 * viewer, swung open on its hinge, and walked through as the light from the
 * room floods past. Four beats, ~820ms end to end: cinematic, but a doctor
 * triggers this fifteen times a morning, so it never becomes a cutscene.
 *
 * Scale, perspective, mask and light only — no WebGL, nothing that has to warm
 * up before the first click of the day. When a door clip is supplied it plays
 * in place of the CSS swing with the selected room number composited on top,
 * so one generic clip serves all fifteen rooms.
 */

export interface DoorOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Stage = "zoom" | "open" | "through" | "flood";

export function DoorTransition({
  room,
  origin,
  onDone,
}: {
  room: Room;
  origin: DoorOrigin;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("zoom");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage("open"), 230));
    // The push through the doorway begins while the slab is still swinging —
    // waiting for it to finish is what makes this kind of transition drag.
    timers.push(setTimeout(() => setStage("through"), 470));
    timers.push(setTimeout(() => setStage("flood"), 660));
    timers.push(setTimeout(onDone, 820));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  // The clone grows to a door-shaped box centred in the viewport rather than
  // filling it — a door that fills a 16:9 screen stops reading as a door.
  const targetHeight = Math.min(window.innerHeight * 0.92, 860);
  const targetWidth = targetHeight * 0.8;

  const zoomed = stage !== "zoom";
  // Final beat: the camera moves through the doorway rather than the door
  // simply fading, which is what sells the walk.
  const through = stage === "through" || stage === "flood";

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-page"
      role="presentation"
      aria-hidden="true"
      style={{ perspective: "1200px" }}
    >
      <div
        className="absolute transition-all duration-[560ms] ease-[cubic-bezier(.3,.7,.25,1)]"
        style={{
          ...(zoomed
            ? {
                top: (window.innerHeight - targetHeight) / 2,
                left: (window.innerWidth - targetWidth) / 2,
                width: targetWidth,
                height: targetHeight,
              }
            : {
                top: origin.top,
                left: origin.left,
                width: origin.width,
                height: origin.height,
              }),
          transform: through ? "scale(2.6)" : "scale(1)",
          transformOrigin: "center center",
          transitionDuration: through ? "360ms" : "560ms",
          opacity: stage === "flood" ? 0 : 1,
        }}
      >
        {DOOR_VIDEO ? (
          <>
            <video
              ref={videoRef}
              className="h-full w-full rounded-card object-cover"
              src={DOOR_VIDEO}
              autoPlay
              muted
              playsInline
              preload="auto"
            />
            <span className="pointer-events-none absolute inset-x-0 top-[18%] text-center text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-none text-[#FDFAF4] [text-shadow:0_1px_3px_rgba(90,68,38,.35)]">
              {room.number}
            </span>
          </>
        ) : (
          <DoorSlab
            number={room.number}
            open={stage !== "zoom"}
            className="h-full rounded-card"
          />
        )}
      </div>

      {/* The light from the room, arriving as the slab clears and blowing out
          as the camera crosses the threshold. */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-[300ms]"
        style={{
          opacity: stage === "flood" ? 1 : stage === "through" ? 0.5 : 0,
          background:
            "radial-gradient(circle at 50% 48%, #FFFEFA 0%, #FBF5EA 42%, rgba(247,241,232,0) 76%)",
        }}
      />
    </div>
  );
}
