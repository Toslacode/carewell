"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  NursingOutputEntry,
  NursingOutputType,
  Patient,
  ResidualContext,
  VitalSet,
} from "@/lib/schemas/clinical";
import { NURSING_STAFF } from "@/lib/schemas/clinical";
import {
  OUTPUT_LABELS,
  OUTPUT_ORDER,
  RESIDUAL_CONTEXT,
  VITAL_LABELS,
} from "@/lib/labels";
import { useWard } from "@/lib/store/ward-store";
import { fromLocalInput, toLocalInput } from "@/lib/utils/when";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/primitives";
import { IconClose } from "@/components/ui/icons";

/**
 * One nursing entry.
 *
 * Built for a nurse standing at a bedside holding a tablet, so it is a short
 * list of large fields rather than a grid: every input is thumb-sized, every
 * label sits above its own field, and nothing is required. A nurse who only
 * took a temperature fills one box and saves.
 *
 * The blood pressure pair and the vitals timestamp are the two places where
 * the shape matters. Systolic and diastolic are one reading split across two
 * boxes, and the whole set shares a single time — because that is what a set
 * of observations is.
 */

interface VitalsDraft {
  temperature: string;
  systolicBP: string;
  diastolicBP: string;
  heartRate: string;
  spo2: string;
  respiratoryRate: string;
}

const EMPTY_VITALS: VitalsDraft = {
  temperature: "",
  systolicBP: "",
  diastolicBP: "",
  heartRate: "",
  spo2: "",
  respiratoryRate: "",
};

type OutputDraft = Record<NursingOutputType, string>;

const EMPTY_OUTPUTS: OutputDraft = {
  "urine-output": "",
  "bladder-residual": "",
  "urine-drainage": "",
  "bowel-movement": "",
};

const num = (raw: string): number | undefined => {
  const clean = raw.trim().replace(",", ".");
  if (!clean) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
};

export function NursingEntryDialog({
  patient,
  onClose,
}: {
  patient: Patient;
  onClose: () => void;
}) {
  const uid = useId();
  const { recordNursingEntry } = useWard();
  const firstField = useRef<HTMLInputElement | null>(null);

  const [vitals, setVitals] = useState<VitalsDraft>(EMPTY_VITALS);
  const [outputs, setOutputs] = useState<OutputDraft>(EMPTY_OUTPUTS);
  const [residualContext, setResidualContext] = useState<ResidualContext | null>(null);
  const [outputNote, setOutputNote] = useState("");
  const [note, setNote] = useState("");
  const [at, setAt] = useState(() => toLocalInput(Date.now()));
  const [enteredBy, setEnteredBy] = useState(NURSING_STAFF[0]);

  useEffect(() => {
    firstField.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const vitalsGiven = Object.values(vitals).some((v) => v.trim());
  const outputsGiven = Object.values(outputs).some((v) => v.trim());
  const canSave = vitalsGiven || outputsGiven || note.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const measuredAt = fromLocalInput(at);

    const set: Omit<VitalSet, "id" | "measuredAt" | "enteredBy"> = {
      temperature: num(vitals.temperature),
      systolicBP: num(vitals.systolicBP),
      diastolicBP: num(vitals.diastolicBP),
      heartRate: num(vitals.heartRate),
      spo2: num(vitals.spo2),
      respiratoryRate: num(vitals.respiratoryRate),
    };

    const entries: Array<Omit<NursingOutputEntry, "id" | "enteredBy">> = [];
    for (const type of OUTPUT_ORDER) {
      const value = num(outputs[type]);
      if (value === undefined) continue;
      entries.push({
        type,
        value,
        unit: OUTPUT_LABELS[type].unit || undefined,
        measuredAt,
        note: outputNote.trim() || undefined,
        context: type === "bladder-residual" ? residualContext ?? undefined : undefined,
      });
    }

    recordNursingEntry(patient.id, {
      vitals: vitalsGiven ? set : undefined,
      measuredAt,
      outputs: entries,
      note,
      enteredBy,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/28 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        onSubmit={submit}
        className="flex max-h-[94dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-panel border border-line bg-card shadow-lift sm:rounded-panel"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2
              id={`${uid}-title`}
              className="text-[18px] font-bold tracking-tight text-navy-deep"
            >
              הזנה חדשה
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              {patient.name} · מלאו רק את מה שנמדד
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="-me-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-page-deep hover:text-ink"
          >
            <IconClose className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-5">
            {/* One time for the whole entry: the vitals below are a single set
                of observations, not five independent readings. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="מועד המדידה">
                <input
                  type="datetime-local"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                  className={fieldClass}
                />
              </Field>
              <Field label="הוזן על ידי">
                <select
                  value={enteredBy}
                  onChange={(e) => setEnteredBy(e.target.value)}
                  className={fieldClass}
                >
                  {NURSING_STAFF.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Group title="מדדים" hint="כל המדדים כאן נרשמים כמדידה אחת">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label={`${VITAL_LABELS.temperature.label} (°C)`}>
                  <input
                    ref={firstField}
                    inputMode="decimal"
                    value={vitals.temperature}
                    onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                    placeholder="36.8"
                    className={cn(fieldClass, "tnum")}
                  />
                </Field>

                {/* Two boxes, one reading — kept adjacent and separated by a
                    slash so it reads the way it is written on a chart. */}
                <Field label="לחץ דם" className="col-span-2 sm:col-span-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      inputMode="numeric"
                      value={vitals.systolicBP}
                      onChange={(e) =>
                        setVitals({ ...vitals, systolicBP: e.target.value })
                      }
                      placeholder="120"
                      aria-label="לחץ דם סיסטולי"
                      className={cn(fieldClass, "tnum text-center")}
                    />
                    <span aria-hidden="true" className="text-[16px] text-ink-decor">
                      /
                    </span>
                    <input
                      inputMode="numeric"
                      value={vitals.diastolicBP}
                      onChange={(e) =>
                        setVitals({ ...vitals, diastolicBP: e.target.value })
                      }
                      placeholder="80"
                      aria-label="לחץ דם דיאסטולי"
                      className={cn(fieldClass, "tnum text-center")}
                    />
                  </div>
                </Field>

                <Field label={VITAL_LABELS.heartRate.label}>
                  <input
                    inputMode="numeric"
                    value={vitals.heartRate}
                    onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                    placeholder="72"
                    className={cn(fieldClass, "tnum")}
                  />
                </Field>
                <Field label={`${VITAL_LABELS.spo2.label} (%)`}>
                  <input
                    inputMode="numeric"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                    placeholder="98"
                    className={cn(fieldClass, "tnum")}
                  />
                </Field>
                <Field label={VITAL_LABELS.respiratoryRate.label}>
                  <input
                    inputMode="numeric"
                    value={vitals.respiratoryRate}
                    onChange={(e) =>
                      setVitals({ ...vitals, respiratoryRate: e.target.value })
                    }
                    placeholder="16"
                    className={cn(fieldClass, "tnum")}
                  />
                </Field>
              </div>
            </Group>

            <Group title="מאזן והפרשות">
              <div className="grid grid-cols-2 gap-3">
                {OUTPUT_ORDER.map((type) => {
                  const meta = OUTPUT_LABELS[type];
                  const bowel = type === "bowel-movement";
                  return (
                    <Field
                      key={type}
                      label={meta.unit ? `${meta.short} (${meta.unit})` : `${meta.short} (מספר)`}
                    >
                      <input
                        inputMode="numeric"
                        value={outputs[type]}
                        onChange={(e) =>
                          setOutputs({ ...outputs, [type]: e.target.value })
                        }
                        placeholder={bowel ? "1" : "350"}
                        className={cn(fieldClass, "tnum")}
                      />
                    </Field>
                  );
                })}
              </div>

              {/* Only asked once a residual was actually entered — the same
                  number means different things either side of voiding. */}
              {outputs["bladder-residual"].trim() && (
                <div className="mt-3">
                  <span className="mb-1.5 block text-[12px] font-medium text-ink-muted">
                    שארית שתן — הקשר (רשות)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(RESIDUAL_CONTEXT) as ResidualContext[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={residualContext === c}
                        onClick={() =>
                          setResidualContext(residualContext === c ? null : c)
                        }
                        className={cn(
                          "rounded-chip border px-3 py-1.5 text-[13px] font-medium transition-colors",
                          residualContext === c
                            ? "border-navy bg-navy text-on-navy"
                            : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
                        )}
                      >
                        {RESIDUAL_CONTEXT[c]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(outputsGiven || outputNote) && (
                <div className="mt-3">
                  <Field label="הערה להפרשות (רשות)">
                    <input
                      value={outputNote}
                      onChange={(e) => setOutputNote(e.target.value)}
                      placeholder="לדוגמה: שתן עכור"
                      className={fieldClass}
                    />
                  </Field>
                </div>
              )}
            </Group>

            <Group title="הערה סיעודית">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="המטופל ישב בכורסה, אכל חצי ארוחה, מתנייד בעזרת הליכון."
                className={cn(fieldClass, "resize-y leading-relaxed")}
              />
            </Group>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" variant="primary" disabled={!canSave}>
            שמירה
          </Button>
        </div>
      </form>
    </div>
  );
}

const fieldClass =
  "w-full min-w-0 rounded-md border border-line-strong bg-card-raised px-3 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-decor focus:border-navy";

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 text-[14px] font-semibold text-navy-deep">
        {title}
        {hint && <span className="text-[12px] font-normal text-ink-muted">{hint}</span>}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[12px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
