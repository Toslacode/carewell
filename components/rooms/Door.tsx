"use client";

import { cn } from "@/lib/utils/cn";
import type { Room } from "@/lib/schemas/clinical";
import type { RoomSummary } from "@/lib/store/ward-store";

/**
 * A door in a modern hospital corridor — a recessed frame in a pale wall, a
 * light oak slab, a dark neutral lever, a downlight above, bumper rails at
 * hip height. Drawn entirely in CSS so it stays sharp at any size and the
 * room number can live in the DOM as real text.
 *
 * Explicitly not: a card with a number on it, dark stained wood, ornate
 * panelling, or a brass handle.
 */

export function DoorSlab({
  number,
  open = false,
  dim = false,
  className,
}: {
  number: number;
  /** Swings the slab on its hinge — used by the entry transition. */
  open?: boolean;
  dim?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative aspect-[4/5] w-full overflow-hidden", className)}
      style={{ perspective: "900px" }}
    >
      {/* wall */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#FCFAF6_0%,#F4EFE7_100%)]" />

      {/* downlight wash on the wall above the frame */}
      <div
        className="absolute inset-x-0 top-0 h-[38%] opacity-70"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(255,246,228,.95) 0%, rgba(255,246,228,0) 70%)",
        }}
      />

      {/* bumper rails */}
      <div className="absolute inset-x-0 bottom-[16%] flex justify-between px-[3%]">
        <span className="h-[7px] w-[22%] rounded-[2px] bg-[#CFC6B8]" />
        <span className="h-[7px] w-[22%] rounded-[2px] bg-[#CFC6B8]" />
      </div>

      {/* signage plaque, inline-start side */}
      <div className="absolute start-[5%] top-[26%] h-[13%] w-[11%] rounded-[3px] border border-[#E2D9CB] bg-[#FBF7F0] shadow-[0_1px_1px_rgba(90,74,52,.07)]">
        <span className="absolute inset-[22%] rounded-[1px] border border-[#DDD3C3]" />
      </div>

      {/* recessed frame */}
      <div className="absolute inset-x-[16%] top-[8%] bottom-0 rounded-t-[6px] bg-[#E4DACA] shadow-[inset_0_2px_5px_rgba(90,74,52,.16)]">
        {/* ceiling downlight fixture */}
        <span className="absolute left-1/2 top-[1.5%] h-[2.6%] w-[34%] -translate-x-1/2 rounded-full bg-[#FFF8E8] shadow-[0_0_10px_3px_rgba(255,240,205,.85)]" />

        {/* the slab */}
        <div
          className={cn(
            "absolute inset-x-[6%] bottom-0 top-[6%] rounded-t-[4px]",
            "transition-transform duration-[620ms] ease-[cubic-bezier(.32,.72,.32,1)]",
          )}
          style={{
            transformOrigin: "left center",
            transform: open ? "rotateY(-74deg)" : "rotateY(0deg)",
            backgroundColor: "var(--oak)",
            backgroundImage: [
              // vertical grain
              "repeating-linear-gradient(90deg, rgba(255,255,255,.055) 0 2px, rgba(0,0,0,.028) 2px 5px)",
              // soft sheen across the face
              "linear-gradient(100deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 42%, rgba(0,0,0,.06) 100%)",
            ].join(","),
            boxShadow:
              "inset 0 0 0 1px var(--oak-edge), inset 0 12px 22px -14px rgba(0,0,0,.3)",
            filter: dim ? "saturate(.72) brightness(.985)" : undefined,
          }}
        >
          <span className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[14%]">
            <span className="select-none text-[clamp(2rem,7vw,3.6rem)] font-semibold leading-none text-[#FDFAF4] [text-shadow:0_1px_2px_rgba(90,68,38,.28)]">
              {number}
            </span>
          </span>

          {/* Lever handle, inline-end side. Sits a little higher than a real
              door's would so it survives the crop on the room-selection grid —
              without the handle the slab stops reading as a door at all. */}
          <span className="absolute end-[9%] top-[45%] h-[7px] w-[24%] rounded-[2px] bg-handle shadow-[0_1px_1px_rgba(0,0,0,.28)]" />
          <span className="absolute end-[9%] top-[41%] h-[15px] w-[7px] rounded-[2px] bg-handle/90" />
        </div>

        {/* the lit room revealed behind the slab as it swings */}
        <div
          className="absolute inset-x-[6%] bottom-0 top-[6%] -z-10 rounded-t-[4px]"
          style={{
            background:
              "linear-gradient(180deg,#FFFDF8 0%,#FBF4E8 55%,#F3E9D8 100%)",
          }}
        />
      </div>
    </div>
  );
}

export function DoorTile({
  room,
  summary,
  selected,
  onSelect,
}: {
  room: Room;
  summary: RoomSummary;
  selected: boolean;
  onSelect: (room: Room) => void;
}) {
  const unavailable = room.status === "unavailable";
  const empty = room.status === "empty";

  // The accessible name carries everything the visual conveys, in one string,
  // so a screen-reader user gets the same at-a-glance summary.
  const description = unavailable
    ? `חדר ${room.number}, ${room.note ?? "אינו פעיל"}`
    : empty
      ? `חדר ${room.number}, פנוי`
      : [
          `חדר ${room.number}`,
          `${summary.patients} מטופלים`,
          summary.openTasks > 0 ? `${summary.openTasks} משימות פתוחות` : null,
          summary.urgentTasks > 0 ? `${summary.urgentTasks} דחופות` : null,
          summary.possibleDischarges > 0
            ? `${summary.possibleDischarges} שחרורים אפשריים`
            : null,
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => onSelect(room)}
      aria-label={description}
      data-room={room.number}
      className={cn(
        // w-full/h-full are load-bearing: a <button> has intrinsic form-control
        // sizing, so it shrinks to its caption text inside a grid cell rather
        // than filling it — which made every door a different size.
        "group relative flex h-full w-full flex-col overflow-hidden rounded-card border bg-card text-start",
        "transition-[transform,box-shadow,border-color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-page",
        unavailable
          ? "cursor-not-allowed border-line opacity-55"
          : "border-line shadow-card hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
        selected && "border-navy shadow-lift",
      )}
    >
      {/* The door is cropped rather than scaled: a full-height door at this
          column width would push the third row off a 1440×900 screen, and the
          whole point of this screen is that the ward is scannable in seconds.
          Cropping keeps the door's real proportions and shows it from the
          lintel down past the handle, which is what the eye needs. */}
      <span className="relative block aspect-[5/4] w-full overflow-hidden">
        <span className="absolute inset-x-0 top-0 block">
          <DoorSlab number={room.number} dim={unavailable || empty} />
        </span>
      </span>

      {/* signage strip — secondary information, deliberately subordinate */}
      <span className="flex min-h-[42px] flex-1 items-center justify-between gap-2 border-t border-line px-3.5 py-2">
        <span className="text-[13px] font-medium text-ink-muted">
          {unavailable
            ? (room.note ?? "אינו פעיל")
            : empty
              ? "פנוי"
              : `${summary.patients} מטופלים`}
        </span>

        {!unavailable && !empty && (
          <span className="flex items-center gap-1.5">
            {summary.urgentTasks > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-chip border border-urgent-line bg-urgent-bg px-1.5 py-0.5 text-[11px] font-semibold text-urgent"
                title={`${summary.urgentTasks} משימות דחופות`}
              >
                <span aria-hidden="true">▲</span>
                {summary.urgentTasks}
              </span>
            )}
            {summary.possibleDischarges > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-chip border border-info-line bg-info-bg px-1.5 py-0.5 text-[11px] font-semibold text-info"
                title={`${summary.possibleDischarges} שחרורים אפשריים`}
              >
                <span aria-hidden="true">◆</span>
                {summary.possibleDischarges}
              </span>
            )}
            {summary.openTasks > 0 &&
              summary.urgentTasks === 0 &&
              summary.possibleDischarges === 0 && (
                <span className="rounded-chip border border-line-strong bg-page-deep px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">
                  {summary.openTasks}
                </span>
              )}
          </span>
        )}
      </span>
    </button>
  );
}
