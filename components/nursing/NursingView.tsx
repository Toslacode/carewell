"use client";

import { useMemo, useState } from "react";
import type {
  NursingOutputEntry,
  NursingOutputType,
  Patient,
  VitalSet,
} from "@/lib/schemas/clinical";
import { latestVitalSet } from "@/lib/schemas/clinical";
import { OUTPUT_LABELS, OUTPUT_ORDER, RESIDUAL_CONTEXT, VITAL_LABELS } from "@/lib/labels";
import { useWard } from "@/lib/store/ward-store";
import { fullWhen, shortWhen } from "@/lib/utils/when";
import { cn } from "@/lib/utils/cn";
import { NursingEntryDialog } from "@/components/nursing/NursingEntryDialog";
import { IconButton, PanelHeader } from "@/components/ui/primitives";
import {
  IconChevronDown,
  IconDocument,
  IconFlask,
  IconPlus,
  IconTrash,
  IconVitals,
} from "@/components/ui/icons";

/**
 * The nursing side of the same patient.
 *
 * Not a second application and not a second record — the same patient, shown
 * the way the job needs it. A round is a reading task, so the doctor's view is
 * an overview; observations are an entry task, so this one is a short column
 * of current values with one button under the thumb.
 *
 * Deliberately fewer elements than the doctor's view: latest values only,
 * history one tap away, and the metadata that matters for accountability —
 * who entered a reading — held back until someone opens the history and asks.
 */
export function NursingView({ patient }: { patient: Patient }) {
  const [entering, setEntering] = useState(false);
  const latest = latestVitalSet(patient);

  return (
    <>
      <div className="mx-auto flex max-w-[820px] flex-col gap-4">
        <VitalsPanel patient={patient} latest={latest} />
        <OutputPanel patient={patient} />
        <NotesPanel patient={patient} />

        {/* The one primary action, and the last thing on the page so a thumb
            finds it without reaching. */}
        <button
          type="button"
          onClick={() => setEntering(true)}
          className={cn(
            "inline-flex items-center justify-center gap-2 self-center rounded-chip bg-navy px-7 py-3.5",
            "text-[15px] font-semibold text-on-navy shadow-card transition-colors hover:bg-navy-deep",
          )}
        >
          <IconPlus className="h-[18px] w-[18px]" />
          הזנה חדשה
        </button>
      </div>

      {entering && (
        <NursingEntryDialog patient={patient} onClose={() => setEntering(false)} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ vitals */

const VITAL_KEYS = [
  "temperature",
  "bloodPressure",
  "heartRate",
  "spo2",
  "respiratoryRate",
] as const;

/** The set as five short strings, in the order the ward reads them. */
function vitalCells(set: VitalSet): Array<{ key: string; label: string; value: string }> {
  return [
    { key: "temperature", label: VITAL_LABELS.temperature.label, value: set.temperature !== undefined ? `${set.temperature}°` : "—" },
    {
      key: "bloodPressure",
      label: VITAL_LABELS.bloodPressure.label,
      value:
        set.systolicBP !== undefined && set.diastolicBP !== undefined
          ? `${set.systolicBP}/${set.diastolicBP}`
          : "—",
    },
    { key: "heartRate", label: VITAL_LABELS.heartRate.label, value: set.heartRate !== undefined ? String(set.heartRate) : "—" },
    { key: "spo2", label: VITAL_LABELS.spo2.label, value: set.spo2 !== undefined ? `${set.spo2}%` : "—" },
    { key: "respiratoryRate", label: VITAL_LABELS.respiratoryRate.label, value: set.respiratoryRate !== undefined ? String(set.respiratoryRate) : "—" },
  ];
}

function VitalsPanel({ patient, latest }: { patient: Patient; latest: VitalSet | null }) {
  const [openHistory, setOpenHistory] = useState(false);
  const history = useMemo(
    () => [...(patient.vitalSets ?? [])].sort((a, b) => b.measuredAt - a.measuredAt),
    [patient.vitalSets],
  );

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconVitals className="h-[18px] w-[18px]" />}
        title="מדדים"
        trailing={
          latest ? (
            // The set's shared time, stated once. Five copies of it would say
            // these were five separate visits.
            <span className="tnum text-[15px] font-semibold text-navy-deep">
              {shortWhen(latest.measuredAt)}
            </span>
          ) : undefined
        }
      />

      {latest ? (
        <>
          <ul className="grid grid-cols-3 gap-2.5 px-4 py-4 sm:grid-cols-5 sm:px-5">
            {vitalCells(latest).map((cell) => (
              <li key={cell.key} className="min-w-0">
                <span className="block truncate text-[12px] text-ink-muted">
                  {cell.label}
                </span>
                <span
                  className={cn(
                    "tnum mt-0.5 block text-[21px] font-semibold leading-tight",
                    cell.value === "—" ? "text-ink-decor" : "text-navy-deep",
                  )}
                >
                  {cell.value}
                </span>
              </li>
            ))}
          </ul>

          {history.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setOpenHistory((v) => !v)}
                aria-expanded={openHistory}
                className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep/60 hover:text-navy"
              >
                היסטוריית מדדים
                <span className="tnum text-ink-decor">({history.length})</span>
                <IconChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    openHistory && "rotate-180",
                  )}
                />
              </button>

              {openHistory && (
                <ul className="flex flex-col divide-y divide-line border-t border-line">
                  {history.map((set) => (
                    <li key={set.id} className="px-4 py-3 sm:px-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="tnum text-[14px] font-semibold text-navy-deep">
                          {shortWhen(set.measuredAt)}
                        </span>
                        <span className="truncate text-[12px] text-ink-muted">
                          {set.enteredBy}
                        </span>
                      </div>
                      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {vitalCells(set)
                          .filter((c) => c.value !== "—")
                          .map((c) => (
                            <li key={c.key} className="text-[13px] text-ink">
                              <span className="text-ink-muted">{c.label} </span>
                              <span className="tnum font-medium">{c.value}</span>
                            </li>
                          ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <p className="px-5 py-5 text-[14px] text-ink-muted">
          טרם נמדדו מדדים. ״הזנה חדשה״ רושמת סט מדידות אחד.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ output */

function OutputPanel({ patient }: { patient: Patient }) {
  const { deleteNursingOutput } = useWard();
  const [openType, setOpenType] = useState<NursingOutputType | null>(null);

  const byType = useMemo(() => {
    const map = new Map<NursingOutputType, NursingOutputEntry[]>();
    for (const type of OUTPUT_ORDER) map.set(type, []);
    for (const entry of patient.nursingOutputs ?? []) {
      map.get(entry.type)?.push(entry);
    }
    for (const list of map.values()) list.sort((a, b) => b.measuredAt - a.measuredAt);
    return map;
  }, [patient.nursingOutputs]);

  const any = (patient.nursingOutputs ?? []).length > 0;

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconFlask className="h-[18px] w-[18px]" />}
        title="מאזן והפרשות"
      />

      {any ? (
        <ul className="flex flex-col divide-y divide-line">
          {OUTPUT_ORDER.map((type) => {
            const list = byType.get(type) ?? [];
            if (list.length === 0) return null;
            const [newest, ...rest] = list;
            const open = openType === type;
            const meta = OUTPUT_LABELS[type];

            return (
              <li key={type}>
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-1 text-[14px] text-ink-muted">
                    {meta.short}
                  </span>
                  <span className="tnum shrink-0 text-[16px] font-semibold text-navy-deep">
                    {formatValue(newest)}
                  </span>
                  <span className="tnum shrink-0 text-[13px] text-ink-muted">
                    · {shortWhen(newest.measuredAt)}
                  </span>
                  {rest.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpenType(open ? null : type)}
                      aria-expanded={open}
                      aria-label={`היסטוריית ${meta.short}`}
                      className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
                    >
                      <IconChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                  )}
                </div>

                {/* The newest reading carries its own context and note under
                    the number, where they qualify it rather than crowd it. */}
                {(newest.note || newest.context) && (
                  <p className="-mt-1 px-4 pb-2.5 text-[12px] text-ink-muted sm:px-5">
                    {newest.context && RESIDUAL_CONTEXT[newest.context]}
                    {newest.context && newest.note && " · "}
                    {newest.note}
                  </p>
                )}

                {open && (
                  <ul className="flex flex-col divide-y divide-line border-t border-line bg-page-deep/30">
                    {rest.map((entry) => (
                      <li
                        key={entry.id}
                        className="group/out flex items-center gap-3 px-4 py-2.5 sm:px-5"
                      >
                        <span className="tnum shrink-0 text-[14px] font-medium text-ink">
                          {formatValue(entry)}
                        </span>
                        <span className="tnum shrink-0 text-[12px] text-ink-muted">
                          {shortWhen(entry.measuredAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">
                          {entry.context && RESIDUAL_CONTEXT[entry.context]}
                          {entry.context && entry.note && " · "}
                          {entry.note}
                        </span>
                        <span
                          title={`${entry.enteredBy} · ${fullWhen(entry.measuredAt)}`}
                          className="hidden shrink-0 truncate text-[12px] text-ink-decor sm:block"
                        >
                          {entry.enteredBy}
                        </span>
                        <span className="shrink-0 opacity-45 transition-opacity focus-within:opacity-100 group-hover/out:opacity-100">
                          <IconButton
                            label={`מחיקת רישום ${meta.short}`}
                            onClick={() => deleteNursingOutput(patient.id, entry.id)}
                            className="h-7 w-7 hover:bg-urgent-bg hover:text-urgent"
                          >
                            <IconTrash className="h-[14px] w-[14px]" />
                          </IconButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-5 text-[14px] text-ink-muted">טרם תועדו הפרשות.</p>
      )}
    </section>
  );
}

function formatValue(entry: NursingOutputEntry): string {
  if (entry.value === undefined) return "—";
  return entry.unit ? `${entry.value} ${entry.unit}` : String(entry.value);
}

/* ------------------------------------------------------------------- notes */

function NotesPanel({ patient }: { patient: Patient }) {
  const { deleteNursingNote } = useWard();
  const notes = useMemo(
    () => [...(patient.nursingNotes ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [patient.nursingNotes],
  );

  return (
    <section className="overflow-hidden rounded-card border border-line bg-card shadow-card">
      <PanelHeader
        icon={<IconDocument className="h-[18px] w-[18px]" />}
        title="הערה סיעודית"
      />
      {notes.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-ink-muted">טרם נכתבה הערה סיעודית.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {notes.map((entry) => (
            <li key={entry.id} className="group/note px-4 py-3 sm:px-5">
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                {entry.text}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="tnum text-[12px] text-ink-muted">
                  {shortWhen(entry.createdAt)}
                </span>
                <span className="truncate text-[12px] text-ink-muted">
                  · {entry.enteredBy}
                </span>
                <span className="ms-auto shrink-0 opacity-45 transition-opacity focus-within:opacity-100 group-hover/note:opacity-100">
                  <IconButton
                    label="מחיקת ההערה"
                    onClick={() => deleteNursingNote(patient.id, entry.id)}
                    className="h-7 w-7 hover:bg-urgent-bg hover:text-urgent"
                  >
                    <IconTrash className="h-[14px] w-[14px]" />
                  </IconButton>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
