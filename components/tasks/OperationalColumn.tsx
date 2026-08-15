"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Consultation, Patient, Task } from "@/lib/schemas/clinical";
import { TASK_PRIORITIES } from "@/lib/schemas/clinical";
import {
  CONSULT_STATE,
  DISCHARGE_STATUS,
  PRIORITY_RANK,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/labels";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import { CountBadge, PanelHeader, StatusPill } from "@/components/ui/primitives";
import { InlineInput } from "@/components/clinical/EditableList";
import { IconButton } from "@/components/ui/primitives";
import {
  IconAlert,
  IconCheck,
  IconChevron,
  IconClose,
  IconClipboard,
  IconHeart,
  IconPencil,
  IconPlus,
  IconSparkle,
  IconStethoscope,
  IconTrash,
  IconUsers,
} from "@/components/ui/icons";

/**
 * The operational column: what the round produced, as opposed to what it
 * recorded. Sits beside the clinical record on desktop and below it on tablet.
 */
export function OperationalColumn({ patient }: { patient: Patient }) {
  const isDraft = patient.draftClinicalData !== null;
  const tasks = isDraft ? patient.draftTasks : patient.tasks;
  const consults = isDraft ? patient.draftConsultations : patient.consultations;
  const discharge = (isDraft ? patient.draftDischarge : patient.discharge) ??
    patient.discharge;

  return (
    <div className="flex flex-col gap-4">
      <TasksPanel patient={patient} tasks={tasks} />
      <ConsultsPanel patient={patient} consults={consults} />
      <DischargePanel patient={patient} discharge={discharge} tasks={tasks} />
      <DraftStatusPanel patient={patient} />
    </div>
  );
}

/* ------------------------------------------------------------------- tasks */

function TasksPanel({ patient, tasks }: { patient: Patient; tasks: Task[] }) {
  const { addTask } = useWard();
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if ((a.status === "done") !== (b.status === "done")) {
          return a.status === "done" ? 1 : -1;
        }
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      }),
    [tasks],
  );

  const open = tasks.filter((t) => t.status !== "done").length;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconClipboard className="h-[18px] w-[18px]" />}
        title="משימות"
        trailing={
          <CountBadge tone={open > 0 ? "attention" : "neutral"}>
            {open === 0 ? "אין פתוחות" : `${open} פתוחות`}
          </CountBadge>
        }
      />

      {sorted.length === 0 && !adding ? (
        <p className="px-5 py-5 text-[14px] text-ink-muted">
          לא נוצרו משימות עבור מטופל זה.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {sorted.map((task) => (
            <TaskRow key={task.id} patient={patient} task={task} />
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-2.5">
        {adding ? (
          <InlineInput
            initial=""
            placeholder="משימה חדשה…"
            onCancel={() => setAdding(false)}
            onSave={(text) => {
              // A manually typed task has no spoken timing to derive from, so
              // it starts explicitly undefined rather than being guessed at.
              addTask(patient.id, text, "unset");
              setAdding(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
          >
            <IconPlus className="h-4 w-4" />
            הוספת משימה
          </button>
        )}
      </div>
    </section>
  );
}

function TaskRow({ patient, task }: { patient: Patient; task: Task }) {
  const { setTaskStatus, setTaskPriority, editTaskTitle, deleteTask } = useWard();
  const [editing, setEditing] = useState(false);
  const [pickingPriority, setPickingPriority] = useState(false);
  const done = task.status === "done";

  const nextStatus =
    task.status === "pending"
      ? "in-progress"
      : task.status === "in-progress"
        ? "done"
        : "pending";

  return (
    <li
      onDoubleClick={() => setEditing(true)}
      className={cn("group/task px-4 py-3", done && "opacity-65")}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setTaskStatus(patient.id, task.id, nextStatus)}
          aria-label={`שינוי סטטוס — כרגע ${TASK_STATUS[task.status].label}`}
          title={`${TASK_STATUS[task.status].label} — לחצו לשינוי`}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-stable bg-stable text-white"
              : task.status === "in-progress"
                ? "border-attention bg-attention-bg text-attention"
                : "border-line-strong bg-card hover:border-navy",
          )}
        >
          {done ? (
            <IconCheck className="h-3 w-3" />
          ) : task.status === "in-progress" ? (
            <span aria-hidden="true" className="text-[9px] leading-none">
              ◐
            </span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          {editing ? (
            <InlineInput
              initial={task.title}
              onCancel={() => setEditing(false)}
              onSave={(text) => {
                editTaskTitle(patient.id, task.id, text);
                setEditing(false);
              }}
            />
          ) : (
            <p
              className={cn(
                "text-[14px] font-medium text-ink",
                done && "line-through decoration-ink-muted/50",
              )}
            >
              {task.title}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-[12px] text-ink-muted">
              {TASK_STATUS[task.status].label}
            </span>
            {task.timing && (
              <span className="text-[12px] text-ink-muted">· {task.timing}</span>
            )}
            {task.createdFrom === "round" && (
              <span className="text-[12px] text-ink-muted">· מהסבב</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setPickingPriority((v) => !v)}
            aria-expanded={pickingPriority}
            aria-label={`עדיפות: ${TASK_PRIORITY[task.priority].label} — לחצו לשינוי`}
          >
            <StatusPill descriptor={TASK_PRIORITY[task.priority]} size="sm" />
          </button>
          <span className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/task:opacity-100">
            <IconButton label="עריכה" onClick={() => setEditing(true)} className="h-7 w-7">
              <IconPencil className="h-[15px] w-[15px]" />
            </IconButton>
            <IconButton
              label="מחיקה"
              onClick={() => deleteTask(patient.id, task.id)}
              className="h-7 w-7 hover:text-urgent"
            >
              <IconTrash className="h-[15px] w-[15px]" />
            </IconButton>
          </span>
        </div>
      </div>

      {pickingPriority && (
        <div className="mt-2 flex flex-wrap gap-1.5 rounded-md border border-line bg-page-deep/60 p-2">
          {TASK_PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setTaskPriority(patient.id, task.id, p);
                setPickingPriority(false);
              }}
              className={cn(
                "rounded-chip transition-transform",
                p === task.priority && "ring-2 ring-navy ring-offset-1 ring-offset-page-deep",
              )}
            >
              <StatusPill descriptor={TASK_PRIORITY[p]} size="sm" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------- consults */

const CONSULT_STATES: Consultation["state"][] = [
  "required",
  "ordered",
  "waiting",
  "completed",
];

/** The specialties a ward round actually calls, in the order it calls them.
 *  Not a closed list — anything not here is typed in, because a ward that
 *  cannot order the consult it needs will write it in a task instead and the
 *  panel stops meaning anything. */
const SPECIALTIES = [
  "קרדיולוגיה",
  "ריאות",
  "נפרולוגיה",
  "גסטרואנטרולוגיה",
  "נוירולוגיה",
  "אנדוקרינולוגיה",
  "זיהומיות",
  "כירורגיה",
  "אורתופדיה",
  "אורולוגיה",
  "המטולוגיה",
  "אונקולוגיה",
  "פיזיותרפיה",
  "ריפוי בעיסוק",
  "תזונה",
  "עבודה סוציאלית",
];

function ConsultsPanel({
  patient,
  consults,
}: {
  patient: Patient;
  consults: Consultation[];
}) {
  const { setConsultState, addConsult, deleteConsult } = useWard();
  const [adding, setAdding] = useState(false);
  const pending = consults.filter((c) => c.state !== "completed").length;
  const taken = new Set(consults.map((c) => c.specialty));

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconStethoscope className="h-[18px] w-[18px]" />}
        title="ייעוצים"
        trailing={
          <CountBadge tone={pending > 0 ? "attention" : "neutral"}>
            {pending === 0 ? "אין ממתינים" : `${pending} ממתינים`}
          </CountBadge>
        }
      />

      {consults.length === 0 && !adding ? (
        <p className="px-5 py-5 text-[14px] text-ink-muted">לא הוזמנו ייעוצים.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {consults.map((consult) => (
            <li key={consult.id} className="group/consult px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-ink">
                    {consult.specialty}
                  </span>
                  {consult.reason && (
                    <span className="mt-0.5 block text-[12px] text-ink-muted">
                      {consult.reason}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <StatusPill descriptor={CONSULT_STATE[consult.state]} size="sm" />
                  <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/consult:opacity-100">
                    <IconButton
                      label={`מחיקת ייעוץ ${consult.specialty}`}
                      onClick={() => deleteConsult(patient.id, consult.id)}
                      className="h-7 w-7 hover:text-urgent"
                    >
                      <IconTrash className="h-[15px] w-[15px]" />
                    </IconButton>
                  </span>
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {CONSULT_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setConsultState(patient.id, consult.id, state)}
                    className={cn(
                      "rounded-chip border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      state === consult.state
                        ? "border-navy bg-navy text-on-navy"
                        : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
                    )}
                  >
                    {CONSULT_STATE[state].label}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-2.5">
        {adding ? (
          <SpecialtyPicker
            taken={taken}
            onCancel={() => setAdding(false)}
            onPick={(specialty) => {
              addConsult(patient.id, specialty);
              setAdding(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
          >
            <IconPlus className="h-4 w-4" />
            הוספת ייעוץ
          </button>
        )}
      </div>
    </section>
  );
}

/** Pick from the ward's usual specialties, or type one that is not on the list.
 *  Specialties already on this patient are shown as taken rather than hidden,
 *  so the list does not reshuffle between visits. */
function SpecialtyPicker({
  taken,
  onPick,
  onCancel,
}: {
  taken: Set<string>;
  onPick: (specialty: string) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <InlineInput
        initial=""
        placeholder="שם היועץ או התחום…"
        onCancel={onCancel}
        onSave={onPick}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-ink-muted">בחירת תחום</span>
        <IconButton label="ביטול" onClick={onCancel} className="h-7 w-7">
          <IconClose className="h-[15px] w-[15px]" />
        </IconButton>
      </div>
      <div className="flex max-h-[168px] flex-wrap gap-1.5 overflow-y-auto">
        {SPECIALTIES.map((specialty) => {
          const already = taken.has(specialty);
          return (
            <button
              key={specialty}
              type="button"
              disabled={already}
              title={already ? "כבר קיים אצל מטופל זה" : undefined}
              onClick={() => onPick(specialty)}
              className={cn(
                "rounded-chip border px-2.5 py-1 text-[12px] font-medium transition-colors",
                already
                  ? "cursor-not-allowed border-line bg-page-deep text-ink-decor"
                  : "border-line-strong bg-card text-ink hover:border-navy hover:bg-navy-wash",
              )}
            >
              {specialty}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className="inline-flex items-center gap-1 rounded-chip border border-dashed border-line-strong px-2.5 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
        >
          <IconPlus className="h-3.5 w-3.5" />
          אחר
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- discharge */

const DISCHARGE_OPTIONS: Patient["discharge"]["status"][] = [
  "unplanned",
  "today",
  "tomorrow",
];

/** A blocker is "cleared by" a task when their wording overlaps — the doctor
 *  said "ממתין ל-CT" and there is a CT task now marked done. The link is a
 *  suggestion, never automatic: clearing a discharge blocker is a clinical
 *  decision, so the app offers and the human confirms. */
function clearingTask(blockerText: string, tasks: Task[]): Task | undefined {
  const words = blockerText
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return tasks.find((t) => {
    if (t.status !== "done") return false;
    const title = t.title.toLowerCase();
    return words.some((w) => title.includes(w.toLowerCase()));
  });
}

function DischargePanel({
  patient,
  discharge,
  tasks,
}: {
  patient: Patient;
  discharge: Patient["discharge"];
  tasks: Task[];
}) {
  const { setDischargeStatus, toggleBlocker, addBlocker, deleteBlocker } = useWard();
  const [adding, setAdding] = useState(false);
  const openBlockers = discharge.blockers.filter((b) => !b.resolved);

  return (
    <>
      <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
        <PanelHeader
          icon={<IconHeart className="h-[18px] w-[18px]" />}
          title="שחרור"
        />
        <div className="px-4 py-3.5">
          <StatusPill descriptor={DISCHARGE_STATUS[discharge.status]} />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {DISCHARGE_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setDischargeStatus(patient.id, status)}
                className={cn(
                  "rounded-chip border px-2.5 py-1 text-[12px] font-medium transition-colors",
                  status === discharge.status
                    ? "border-navy bg-navy text-on-navy"
                    : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
                )}
              >
                {DISCHARGE_STATUS[status].label}
              </button>
            ))}
          </div>
          {discharge.status !== "unplanned" && openBlockers.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-[12px] text-attention">
              <IconAlert className="mt-px h-[14px] w-[14px] shrink-0" />
              {openBlockers.length} חסמים פתוחים מונעים שחרור בפועל
            </p>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
        <PanelHeader
          icon={<IconAlert className="h-[18px] w-[18px]" />}
          title="חסמים לשחרור"
          trailing={
            <CountBadge tone={openBlockers.length > 0 ? "attention" : "stable"}>
              {openBlockers.length === 0
                ? "אין חסמים"
                : `${openBlockers.length} פתוחים`}
            </CountBadge>
          }
        />
        {discharge.blockers.length === 0 && !adding ? (
          <p className="px-5 py-5 text-[14px] text-ink-muted">
            לא תועדו חסמים לשחרור.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {discharge.blockers.map((blocker) => {
              const cleared = !blocker.resolved
                ? clearingTask(blocker.text, tasks)
                : undefined;
              return (
                <li
                  key={blocker.id}
                  className="group/blocker flex items-start gap-2.5 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => toggleBlocker(patient.id, blocker.id)}
                    aria-label={
                      blocker.resolved
                        ? `סימון "${blocker.text}" כלא טופל`
                        : `סימון "${blocker.text}" כטופל`
                    }
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors",
                      blocker.resolved
                        ? "border-stable bg-stable text-white"
                        : cleared
                          ? "border-stable bg-stable-bg text-stable hover:bg-stable hover:text-white"
                          : "border-line-strong bg-card hover:border-navy",
                    )}
                  >
                    {blocker.resolved && <IconCheck className="h-3 w-3" />}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[14px] text-ink",
                        blocker.resolved && "text-ink-muted line-through",
                      )}
                    >
                      {blocker.text}
                    </span>
                    {cleared && (
                      <span className="mt-0.5 block text-[12px] text-stable">
                        ״{cleared.title}״ בוצעה — ניתן לסמן כטופל
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover/blocker:opacity-100">
                    <IconButton
                      label={`מחיקת החסם ״${blocker.text}״`}
                      onClick={() => deleteBlocker(patient.id, blocker.id)}
                      className="h-7 w-7 hover:text-urgent"
                    >
                      <IconTrash className="h-[15px] w-[15px]" />
                    </IconButton>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-t border-line px-4 py-2.5">
          {adding ? (
            <InlineInput
              initial=""
              placeholder="מה מעכב את השחרור…"
              onCancel={() => setAdding(false)}
              onSave={(text) => {
                addBlocker(patient.id, text);
                setAdding(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
            >
              <IconPlus className="h-4 w-4" />
              הוספת חסם
            </button>
          )}
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------- ai / draft */

function DraftStatusPanel({ patient }: { patient: Patient }) {
  const isDraft = patient.draftClinicalData !== null;
  const reviewCount = (patient.draftClinicalData ?? patient.approvedClinicalData)
    .needsReview.length;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-card border shadow-card",
        isDraft ? "border-info-line bg-info-bg/45" : "border-line bg-card",
      )}
    >
      <PanelHeader
        icon={<IconSparkle className="h-[18px] w-[18px]" />}
        title="סטטוס טיוטה"
      />
      <div className="px-5 py-4">
        {isDraft ? (
          <>
            <p className="text-[14px] font-semibold text-info">טיוטת AI</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              יש לעבור על המידע לפני אישור. שום פריט אינו נשמר ברשומה עד לחיצה על
              ״אישור סבב״.
            </p>
            {reviewCount > 0 && (
              <p className="mt-2 text-[13px] font-medium text-attention">
                {reviewCount} פריטים מסומנים כדורשים בדיקה
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-[14px] font-semibold text-ink">אין טיוטה פתוחה</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              {patient.lastRoundAt
                ? `הסבב האחרון אושר ב־${new Date(patient.lastRoundAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}.`
                : "טרם בוצע סבב מוקלט עבור מטופל זה."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ small export */

export function PatientTasksLink() {
  return (
    <Link
      href="/tasks"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-navy transition-colors hover:text-navy-deep"
    >
      כל המשימות במחלקה
      <IconChevron className="h-4 w-4" />
    </Link>
  );
}

export { IconUsers };
