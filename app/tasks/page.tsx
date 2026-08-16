"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppFooter } from "@/components/layout/TopBar";
import { EmptyState, StatusPill } from "@/components/ui/primitives";
import {
  IconCheck,
  IconChevron,
  IconClipboard,
  IconHeart,
} from "@/components/ui/icons";
import {
  DISCHARGE_STATUS,
  PRIORITY_RANK,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/labels";
import type { Patient, Task } from "@/lib/schemas/clinical";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";

/**
 * Department-wide tasks.
 *
 * Deliberately not the entry point — the ward is navigated by room, and this
 * is the sweep you do once the round is done. It answers a different question:
 * not "what does this patient need" but "what is still open anywhere".
 */

const FILTERS = [
  { id: "all", label: "הכל" },
  { id: "urgent", label: "דחוף" },
  { id: "today", label: "היום" },
  { id: "pending", label: "ממתין" },
  { id: "done", label: "בוצע" },
  { id: "discharge", label: "שחרור" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

interface Row {
  task: Task;
  patient: Patient;
  roomNumber: number;
}

export default function TasksPage() {
  const { rooms, patients, setTaskStatus } = useWard();
  const [filter, setFilter] = useState<FilterId>("all");

  const rows = useMemo<Row[]>(() => {
    const byId = new Map(rooms.map((r) => [r.id, r.number]));
    return Object.values(patients)
      .filter((patient) => !patient.dischargedAt)
      .flatMap((patient) =>
        patient.tasks.map((task) => ({
          task,
          patient,
          roomNumber: byId.get(patient.roomId) ?? 0,
        })),
      )
      .sort((a, b) => {
        if ((a.task.status === "done") !== (b.task.status === "done")) {
          return a.task.status === "done" ? 1 : -1;
        }
        const p = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
        return p !== 0 ? p : a.roomNumber - b.roomNumber;
      });
  }, [patients, rooms]);

  const dischargeRows = useMemo(
    () =>
      Object.values(patients)
        .filter(
          (p) =>
            !p.dischargedAt &&
            (p.discharge.status === "today" || p.discharge.status === "tomorrow"),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "he")),
    [patients],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      urgent: rows.filter(
        (r) => r.task.priority === "urgent" && r.task.status !== "done",
      ).length,
      today: rows.filter(
        (r) => r.task.priority === "today" && r.task.status !== "done",
      ).length,
      pending: rows.filter((r) => r.task.status !== "done").length,
      done: rows.filter((r) => r.task.status === "done").length,
      discharge: dischargeRows.length,
    }),
    [rows, dischargeRows],
  );

  const visible = useMemo(() => {
    switch (filter) {
      case "urgent":
        return rows.filter(
          (r) => r.task.priority === "urgent" && r.task.status !== "done",
        );
      case "today":
        return rows.filter(
          (r) => r.task.priority === "today" && r.task.status !== "done",
        );
      case "pending":
        return rows.filter((r) => r.task.status !== "done");
      case "done":
        return rows.filter((r) => r.task.status === "done");
      default:
        return rows;
    }
  }, [rows, filter]);

  return (
    <>
      <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-ward">
          <h1 className="text-[32px] font-bold tracking-tight text-navy-deep sm:text-[38px]">
            משימות המחלקה
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            {counts.pending === 0
              ? "אין משימות פתוחות במחלקה"
              : `${counts.pending} משימות פתוחות`}
          </p>

          <div
            role="tablist"
            aria-label="סינון משימות"
            className="mt-5 flex flex-wrap gap-2"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-chip border px-4 py-2 text-[13px] font-semibold transition-colors",
                  filter === f.id
                    ? "border-navy bg-navy text-on-navy"
                    : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
                )}
              >
                {f.label}
                <span className="tnum opacity-70">{counts[f.id]}</span>
              </button>
            ))}
          </div>

          <div className="mt-5">
            {filter === "discharge" ? (
              dischargeRows.length === 0 ? (
                <EmptyState
                  icon={<IconHeart className="h-8 w-8" />}
                  title="אין שחרורים מתוכננים"
                  hint="מטופלים שיסומנו לשחרור היום או מחר יופיעו כאן."
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {dischargeRows.map((patient) => (
                    <DischargeRow key={patient.id} patient={patient} />
                  ))}
                </ul>
              )
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<IconClipboard className="h-8 w-8" />}
                title="אין משימות בתצוגה זו"
                hint="בחרו סינון אחר כדי לראות משימות נוספות."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {visible.map(({ task, patient, roomNumber }) => (
                  <li key={task.id}>
                    <div className="flex items-start gap-3 rounded-card border border-line bg-card px-4 py-3 shadow-sm">
                      <button
                        type="button"
                        onClick={() =>
                          setTaskStatus(
                            patient.id,
                            task.id,
                            task.status === "done" ? "pending" : "done",
                          )
                        }
                        aria-label={
                          task.status === "done"
                            ? `סימון "${task.title}" כממתין`
                            : `סימון "${task.title}" כבוצע`
                        }
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                          task.status === "done"
                            ? "border-stable bg-stable text-white"
                            : "border-line-strong bg-card hover:border-navy",
                        )}
                      >
                        {task.status === "done" && (
                          <IconCheck className="h-3 w-3" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[15px] font-medium text-ink",
                            task.status === "done" &&
                              "text-ink-muted line-through",
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-medium text-navy hover:underline"
                          >
                            {patient.name}
                          </Link>
                          <span>· חדר {roomNumber}</span>
                          <span>· מיטה {patient.bed}</span>
                          <span>· {TASK_STATUS[task.status].label}</span>
                          {task.timing && <span>· {task.timing}</span>}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <StatusPill
                          descriptor={TASK_PRIORITY[task.priority]}
                          size="sm"
                        />
                        <Link
                          href={`/patients/${patient.id}`}
                          aria-label={`פתיחת ${patient.name}`}
                          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
                        >
                          <IconChevron className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <AppFooter />
    </>
  );
}

function DischargeRow({ patient }: { patient: Patient }) {
  const openBlockers = patient.discharge.blockers.filter((b) => !b.resolved);
  return (
    <li>
      <Link
        href={`/patients/${patient.id}`}
        className="flex flex-col gap-2 rounded-card border border-line bg-card px-5 py-4 shadow-sm transition-colors hover:bg-page-deep/40 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-navy-deep">
            {patient.name}
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-muted">
            חדר <span className="tnum">{patient.roomId.replace("room-", "")}</span>
            , מיטה <span className="tnum">{patient.bed}</span> ·{" "}
            {patient.primaryDiagnosis}
          </span>
        </span>

        <StatusPill descriptor={DISCHARGE_STATUS[patient.discharge.status]} />

        <span className="text-[13px] text-ink-muted sm:w-[190px] sm:text-end">
          {openBlockers.length === 0 ? (
            <span className="font-medium text-stable">אין חסמים</span>
          ) : (
            <span className="font-medium text-attention">
              {openBlockers.length} חסמים פתוחים
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
