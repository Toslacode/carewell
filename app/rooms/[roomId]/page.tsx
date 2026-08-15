"use client";

import { use } from "react";
import { AppFooter, AppHeader } from "@/components/layout/AppHeader";
import { PatientCard } from "@/components/patients/PatientCard";
import { Card, EmptyState } from "@/components/ui/primitives";
import {
  IconClipboard,
  IconDoor,
  IconHeart,
  IconUser,
} from "@/components/ui/icons";
import { patientCount } from "@/lib/labels";
import { summariseRoom, useWard } from "@/lib/store/ward-store";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Screen 2 — inside a room.
 *
 * Three summary tiles answer "what does this room need from me", then one
 * large card per patient. Nothing else: the doctor is standing in the doorway.
 */
export default function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const { getRoom, roomPatients, patients } = useWard();
  const room = getRoom(roomId);

  if (!room) {
    return (
      <>
        <AppHeader back={{ href: "/rooms", label: "חזרה לחדרים" }} />
        <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
          <div className="mx-auto max-w-ward">
            <EmptyState
              icon={<IconDoor className="h-8 w-8" />}
              title="החדר לא נמצא"
              hint="ייתכן שהחדר הוסר מהמחלקה או שהקישור שגוי."
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  const list = roomPatients(roomId);
  const summary = summariseRoom(room, patients);
  const unavailable = room.status === "unavailable";

  return (
    <>
      <AppHeader back={{ href: "/rooms", label: "חזרה לחדרים" }} />

      <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-ward">
          <div className="mb-5">
            <h1 className="text-[32px] font-bold tracking-tight text-navy-deep sm:text-[38px]">
              חדר <span className="tnum">{room.number}</span>
            </h1>
            <p className="mt-1 text-[15px] text-ink-muted">
              {unavailable ? (room.note ?? "אינו פעיל") : patientCount(list.length)}
            </p>
          </div>

          {!unavailable && (
            <ul className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <SummaryTile
                icon={<IconUser className="h-5 w-5" />}
                label="מספר מטופלים"
                index={0}
                value={summary.patients}
              />
              <SummaryTile
                icon={<IconClipboard className="h-5 w-5" />}
                label="משימות פתוחות"
                index={1}
                value={summary.openTasks}
                emphasis={summary.urgentTasks > 0 ? "urgent" : undefined}
                note={
                  summary.urgentTasks > 0
                    ? `${summary.urgentTasks} דחופות`
                    : undefined
                }
              />
              <SummaryTile
                icon={<IconHeart className="h-5 w-5" />}
                label="שחרורים אפשריים"
                index={2}
                value={summary.possibleDischarges}
              />
            </ul>
          )}

          {unavailable ? (
            <EmptyState
              icon={<IconDoor className="h-8 w-8" />}
              title="החדר אינו פעיל"
              hint={
                room.note
                  ? `${room.note}. לא ניתן לשבץ מטופלים לחדר זה כרגע.`
                  : "לא ניתן לשבץ מטופלים לחדר זה כרגע."
              }
            />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<IconBedGlyph />}
              title="אין מטופלים בחדר"
              hint="החדר פנוי ומוכן לקליטה. מטופלים שישובצו יופיעו כאן."
            />
          ) : (
            <ul className="flex flex-col gap-3 sm:gap-4">
              {list.map((patient, i) => (
                <Reveal as="li" key={patient.id} index={i + 3}>
                  <PatientCard patient={patient} />
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </main>

      <AppFooter />
    </>
  );
}

function IconBedGlyph() {
  return <IconClipboard className="h-8 w-8" />;
}

function SummaryTile({
  icon,
  label,
  value,
  note,
  emphasis,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note?: string;
  emphasis?: "urgent";
  index?: number;
}) {
  return (
    <Reveal as="li" index={index} variant="pop">
      <Card className="flex items-center gap-4 px-5 py-4 transition-shadow duration-300 hover:shadow-lift">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-card-sunken text-ink-muted">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] text-ink-muted">{label}</span>
          <span className="flex items-baseline gap-2">
            <span
              className={[
                "tnum text-[30px] font-bold leading-tight",
                emphasis === "urgent" ? "text-urgent" : "text-navy-deep",
              ].join(" ")}
            >
              {value}
            </span>
            {note && (
              <span className="text-[12px] font-semibold text-urgent">
                <span aria-hidden="true">▲ </span>
                {note}
              </span>
            )}
          </span>
        </span>
      </Card>
    </Reveal>
  );
}
