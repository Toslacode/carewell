"use client";

import { useEffect, useRef, useState } from "react";
import { DoorSlab } from "@/components/rooms/Door";
import { DOOR_VIDEO } from "@/lib/assets";
import type { Room } from "@/lib/schemas/clinical";

/**
 * Entering a room.
 *
 * The clicked door is cloned at its exact on-screen position, flown toward the
 * viewer, and swung open on its hinge before the room screen takes over. The
 * whole move is ~720ms: cinematic, but a doctor does this fifteen times a
 * morning, so it never gets to feel like a cutscene.
 *
 * Scale, perspective and mask only — no WebGL, no physics, nothing that has to
 * warm up before the first click of the day.
 *
 * When a door-opening clip is supplied it plays in place of the CSS swing; the
 * selected room number stays composited on top either way, so one generic clip
 * serves all fifteen rooms.
 */

export interface DoorOrigin {
  top: number;
  left: number;
  width: number;
  height: number;
}

type Stage = "zoom" | "open" | "flood";

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
    timers.push(setTimeout(() => setStage("open"), 240));
    timers.push(setTimeout(() => setStage("flood"), 560));
    timers.push(setTimeout(onDone, 760));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  // The clone grows to a door-shaped box centred in the viewport rather than
  // filling it — a door that fills a 16:9 screen stops reading as a door.
  const targetHeight = Math.min(window.innerHeight * 0.92, 860);
  const targetWidth = targetHeight * 0.8;

  const zoomed = stage !== "zoom";

  return (
    <div
      className="fixed inset-0 z-50 bg-page"
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="absolute transition-all duration-[520ms] ease-[cubic-bezier(.3,.7,.25,1)]"
        style={
          zoomed
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
              }
        }
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

      {/* the light from the room, flooding out as the door clears */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,#FFFEFA_0%,#FBF5EA_45%,rgba(247,241,232,0)_78%)] transition-opacity duration-[240ms]"
        style={{ opacity: stage === "flood" ? 1 : 0 }}
      />
    </div>
  );
}
