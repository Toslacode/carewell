"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppFooter } from "@/components/layout/TopBar";
import { DoorTile } from "@/components/rooms/Door";
import {
  type DoorOrigin,
  DoorTransition,
} from "@/components/rooms/DoorTransition";
import { summariseRoom, useWard } from "@/lib/store/ward-store";
import type { Room } from "@/lib/schemas/clinical";
import { IconClipboard } from "@/components/ui/icons";
import { Reveal } from "@/components/motion/Reveal";

export default function RoomsPage() {
  const router = useRouter();
  const { rooms, patients } = useWard();
  const [entering, setEntering] = useState<{
    room: Room;
    origin: DoorOrigin;
  } | null>(null);

  const enterRoom = useCallback(
    (room: Room) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        router.push(`/rooms/${room.id}`);
        return;
      }
      const node = document.querySelector<HTMLElement>(
        `[data-room="${room.number}"]`,
      );
      if (!node) {
        router.push(`/rooms/${room.id}`);
        return;
      }
      const r = node.getBoundingClientRect();
      router.prefetch(`/rooms/${room.id}`);
      setEntering({
        room,
        origin: { top: r.top, left: r.left, width: r.width, height: r.height },
      });
    },
    [router],
  );

  const totals = rooms.reduce(
    (acc, room) => {
      const s = summariseRoom(room, patients);
      acc.patients += s.patients;
      acc.openTasks += s.openTasks;
      acc.urgent += s.urgentTasks;
      acc.discharges += s.possibleDischarges;
      return acc;
    },
    { patients: 0, openTasks: 0, urgent: 0, discharges: 0 },
  );

  return (
    <>
      <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-ward">
          {/* Ward-level bar: the morning's shape in one line, plus the door
              into the department-wide task view. */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-card px-5 py-3.5 shadow-sm">
            <dl className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-ink-muted">מטופלים במחלקה</dt>
                <dd className="tnum text-[17px] font-semibold text-navy-deep">
                  {totals.patients}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-ink-muted">משימות פתוחות</dt>
                <dd className="tnum text-[17px] font-semibold text-navy-deep">
                  {totals.openTasks}
                </dd>
              </div>
              {totals.urgent > 0 && (
                <div className="flex items-baseline gap-2">
                  <dt className="text-ink-muted">דחופות</dt>
                  <dd className="tnum text-[17px] font-semibold text-urgent">
                    <span aria-hidden="true" className="text-[11px]">
                      ▲{" "}
                    </span>
                    {totals.urgent}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline gap-2">
                <dt className="text-ink-muted">שחרורים אפשריים</dt>
                <dd className="tnum text-[17px] font-semibold text-info">
                  {totals.discharges}
                </dd>
              </div>
            </dl>

            <Link
              href="/tasks"
              className="inline-flex items-center gap-2 rounded-chip border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-page-deep"
            >
              <IconClipboard className="h-[18px] w-[18px] text-ink-muted" />
              כל המשימות
            </Link>
          </div>

          {/* 5 / 5 / 5 on desktop, degrading to 3 and then 2 across. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {rooms.map((room, i) => (
              <Reveal as="li" key={room.id} index={i} variant="pop">
                <DoorTile
                  room={room}
                  summary={summariseRoom(room, patients)}
                  selected={entering?.room.id === room.id}
                  onSelect={enterRoom}
                />
              </Reveal>
            ))}
          </ul>
        </div>
      </main>

      <AppFooter />

      {entering && (
        <DoorTransition
          number={entering.room.number}
          origin={entering.origin}
          onDone={() => router.push(`/rooms/${entering.room.id}`)}
        />
      )}
    </>
  );
}
