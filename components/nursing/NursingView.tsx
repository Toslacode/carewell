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
import { InlineInput } from "@/components/clinical/EditableList";
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
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setEntering(true)}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-chip bg-navy px-7 py-3.5",
              "text-[15px] font-semibold text-on-navy shadow-card transition-colors hover:bg-navy-deep",
            )}
          >
            <IconPlus className="h-[18px] w-[18px]" />
            הזנה חדשה
          </button>
          {/* Double-click leaves no mark on the screen, so it is said once for
              the whole view rather than hinted at on every value. */}
          <p className="text-[12px] text-ink-muted">
            לתיקון ערך שכבר נרשם — לחיצה כפולה עליו
          </p>
        </div>
      </div>

      {entering && (
        <NursingEntryDialog patient={patient} onClose={() => setEntering(false)} />
      )}
    </>
  );
}

/* ---------------------------------------------------------- editing in place */

/**
 * Anything already recorded can be corrected where it sits: double-click the
 * value and type over it.
 *
 * Double rather than single, deliberately. These are numbers a nurse reads far
 * more often than they change, usually while holding a tablet one-handed, and
 * a single tap would put a temperature into an editor every time somebody
 * glanced at it. The second tap is the difference between reading and writing.
 *
 * `touch-action: manipulation` matters here: without it a browser waits to see
 * whether a double-tap was meant as zoom, and the gesture either lags or turns
 * into a zoom instead of an edit.
 */
function Editable({
  value,
  onSave,
  label,
  className,
  editorClassName,
  ltr,
  children,
}: {
  /** What goes into the input when editing opens. */
  value: string;
  onSave: (next: string) => void;
  /** Names the thing being edited, for the tooltip and screen readers. */
  label: string;
  className?: string;
  editorClassName?: string;
  ltr?: boolean;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <span className={cn("block", editorClassName)}>
        <InlineInput
          initial={value}
          ltr={ltr}
          onCancel={() => setEditing(false)}
          onSave={(next) => {
            onSave(next);
            setEditing(false);
          }}
        />
      </span>
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => {
        // The keyboard has no double-click; Enter is the equivalent commitment.
        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title={`${label} — לחיצה כפולה לעריכה`}
      aria-label={`${label} — לחיצה כפולה לעריכה`}
      className={cn(
        "block cursor-text rounded-md transition-colors [touch-action:manipulation]",
        "hover:bg-page-deep/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/50",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ vitals */

/**
 * What a typed correction means for each vital.
 *
 * Returns null for anything that isn't a reading, and the caller then leaves
 * the stored value alone — a slip of the thumb must not erase a measurement.
 * An emptied field is handled the same way by the editor itself, which treats
 * a blank submission as a cancel, so there is no path here that silently
 * blanks a vital; removing one is a deliberate act done from the entry it
 * belongs to.
 */
function parseVitalCell(key: string, raw: string): Partial<VitalSet> | null {
  const text = raw.trim().replace(",", ".");

  if (key === "bloodPressure") {
    if (!text) return { systolicBP: undefined, diastolicBP: undefined };
    const m = text.match(/^(\d{2,3})\s*[/\\]\s*(\d{2,3})$/);
    if (!m) return null; // not a pressure — keep what was there
    return { systolicBP: Number(m[1]), diastolicBP: Number(m[2]) };
  }

  const field = key as "temperature" | "heartRate" | "spo2" | "respiratoryRate";
  if (!text) return { [field]: undefined };
  const n = Number(text.replace(/[°%]/g, ""));
  if (!Number.isFinite(n)) return null;
  return { [field]: n };
}

/** The set as five short strings, in the order the ward reads them. */
function vitalCells(
  set: VitalSet,
): Array<{ key: string; label: string; value: string; raw: string }> {
  const bp =
    set.systolicBP !== undefined && set.diastolicBP !== undefined
      ? `${set.systolicBP}/${set.diastolicBP}`
      : "";
  return [
    {
      key: "temperature",
      label: VITAL_LABELS.temperature.label,
      value: set.temperature !== undefined ? `${set.temperature}°` : "—",
      raw: set.temperature !== undefined ? String(set.temperature) : "",
    },
    {
      key: "bloodPressure",
      label: VITAL_LABELS.bloodPressure.label,
      value: bp || "—",
      raw: bp,
    },
    {
      key: "heartRate",
      label: VITAL_LABELS.heartRate.label,
      value: set.heartRate !== undefined ? String(set.heartRate) : "—",
      raw: set.heartRate !== undefined ? String(set.heartRate) : "",
    },
    {
      key: "spo2",
      label: VITAL_LABELS.spo2.label,
      value: set.spo2 !== undefined ? `${set.spo2}%` : "—",
      raw: set.spo2 !== undefined ? String(set.spo2) : "",
    },
    {
      key: "respiratoryRate",
      label: VITAL_LABELS.respiratoryRate.label,
      value: set.respiratoryRate !== undefined ? String(set.respiratoryRate) : "—",
      raw: set.respiratoryRate !== undefined ? String(set.respiratoryRate) : "",
    },
  ];
}

function VitalsPanel({ patient, latest }: { patient: Patient; latest: VitalSet | null }) {
  const { updateVitalSet } = useWard();
  const [openHistory, setOpenHistory] = useState(false);
  const history = useMemo(
    () => [...(patient.vitalSets ?? [])].sort((a, b) => b.measuredAt - a.measuredAt),
    [patient.vitalSets],
  );

  const editCell = (setId: string, key: string, raw: string) => {
    const patch = parseVitalCell(key, raw);
    // Unparseable input leaves the reading alone rather than blanking it —
    // a slip of the thumb should not erase a measurement.
    if (patch) updateVitalSet(patient.id, setId, patch);
  };

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
                <Editable
                  label={cell.label}
                  value={cell.raw}
                  ltr={cell.key === "bloodPressure"}
                  onSave={(next) => editCell(latest.id, cell.key, next)}
                  className="-mx-1 mt-0.5 px-1"
                  editorClassName="mt-0.5"
                >
                  <span
                    className={cn(
                      "tnum block text-[21px] font-semibold leading-tight",
                      cell.value === "—" ? "text-ink-decor" : "text-navy-deep",
                    )}
                  >
                    {cell.value}
                  </span>
                </Editable>
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
                      {/* Editable here too: a number mistyped four hours ago
                          is still wrong, and the fix belongs where it is
                          noticed. Only the newest set moves the record's
                          current values — the store decides that. */}
                      <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                        {vitalCells(set)
                          .filter((c) => c.value !== "—")
                          .map((c) => (
                            <li key={c.key} className="text-[13px] text-ink">
                              <span className="text-ink-muted">{c.label} </span>
                              <Editable
                                label={`${c.label} · ${shortWhen(set.measuredAt)}`}
                                value={c.raw}
                                ltr={c.key === "bloodPressure"}
                                onSave={(next) => editCell(set.id, c.key, next)}
                                className="-mx-1 inline-block px-1 align-middle"
                                editorClassName="inline-block w-[132px] align-middle"
                              >
                                <span className="tnum font-medium">{c.value}</span>
                              </Editable>
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

/** A typed correction to an output reading. Empty or unparseable is refused
 *  rather than turned into a zero, which would read as a real measurement. */
function editOutputValue(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function OutputPanel({ patient }: { patient: Patient }) {
  const { deleteNursingOutput, updateNursingOutput } = useWard();
  const [openType, setOpenType] = useState<NursingOutputType | null>(null);

  const editValue = (entryId: string, raw: string) => {
    const value = editOutputValue(raw);
    if (value !== null) updateNursingOutput(patient.id, entryId, { value });
  };

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
                  <Editable
                    label={meta.short}
                    value={newest.value !== undefined ? String(newest.value) : ""}
                    onSave={(next) => editValue(newest.id, next)}
                    className="-mx-1 shrink-0 px-1"
                    editorClassName="w-[132px]"
                  >
                    <span className="tnum text-[16px] font-semibold text-navy-deep">
                      {formatValue(newest)}
                    </span>
                  </Editable>
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
                        <Editable
                          label={`${meta.short} · ${shortWhen(entry.measuredAt)}`}
                          value={entry.value !== undefined ? String(entry.value) : ""}
                          onSave={(next) => editValue(entry.id, next)}
                          className="-mx-1 shrink-0 px-1"
                          editorClassName="w-[124px]"
                        >
                          <span className="tnum text-[14px] font-medium text-ink">
                            {formatValue(entry)}
                          </span>
                        </Editable>
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
  const { deleteNursingNote, updateNursingNote } = useWard();
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
              <Editable
                label="הערה סיעודית"
                value={entry.text}
                onSave={(next) => updateNursingNote(patient.id, entry.id, next)}
                className="-mx-1 px-1"
              >
                <span className="block whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                  {entry.text}
                </span>
              </Editable>
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
