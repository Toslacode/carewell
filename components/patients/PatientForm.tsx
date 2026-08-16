"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  type Patient,
  type PatientDetails,
  type PatientStatus,
  HMOS,
} from "@/lib/schemas/clinical";
import { PATIENT_STATUS } from "@/lib/labels";
import { cn } from "@/lib/utils/cn";
import { Button, StatusPill } from "@/components/ui/primitives";
import { IconClose } from "@/components/ui/icons";

/**
 * Admitting a patient, and correcting the details of one already admitted.
 *
 * The same form does both, because they are the same eight facts — a form that
 * only appears at admission leaves a typo in a name permanent, which is how a
 * ward ends up with two spellings of the same person.
 *
 * Only what a person types lives here. Nothing clinical: findings, plan and
 * tasks come from the round or from the record's own controls, and an
 * admission form that invited them would be the app inventing a history.
 */

const STATUSES: PatientStatus[] = [
  "stable",
  "monitoring",
  "attention",
  "discharge-possible",
];

/** Beds are numbered from one; a room with a bed 0 is a data-entry slip. */
function nextFreeBed(taken: number[]): number {
  for (let bed = 1; bed <= 12; bed += 1) {
    if (!taken.includes(bed)) return bed;
  }
  return taken.length + 1;
}

export function PatientForm({
  mode,
  roomNumber,
  patient,
  takenBeds,
  onSubmit,
  onClose,
}: {
  mode: "admit" | "edit";
  roomNumber: number;
  /** The patient being corrected. Absent when admitting. */
  patient?: Patient;
  /** Beds already occupied in this room — the patient's own bed excluded. */
  takenBeds: number[];
  onSubmit: (details: PatientDetails) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const firstField = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(patient?.name ?? "");
  const [age, setAge] = useState(patient ? String(patient.age) : "");
  const [idNumber, setIdNumber] = useState(patient?.idNumber ?? "");
  const [hmo, setHmo] = useState<Patient["hmo"]>(patient?.hmo ?? "כללית");
  const [bed, setBed] = useState(
    String(patient?.bed ?? nextFreeBed(takenBeds)),
  );
  const [hospitalDay, setHospitalDay] = useState(
    String(patient?.hospitalDay ?? 1),
  );
  const [diagnosis, setDiagnosis] = useState(patient?.primaryDiagnosis ?? "");
  const [status, setStatus] = useState<PatientStatus>(patient?.status ?? "stable");
  const [touched, setTouched] = useState(false);

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

  const bedNumber = Number(bed);
  const bedClash = Number.isFinite(bedNumber) && takenBeds.includes(bedNumber);
  // A name is the one field with no sensible default. Everything else can be
  // corrected later from the same form; a nameless patient cannot be found at
  // all, so it is the only thing that blocks the button.
  const nameMissing = name.trim().length === 0;
  const valid = !nameMissing && !bedClash && bedNumber > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      age: clampInt(age, 0, 120, 0),
      idNumber: idNumber.trim(),
      hmo,
      bed: bedNumber,
      hospitalDay: clampInt(hospitalDay, 1, 400, 1),
      primaryDiagnosis: diagnosis.trim(),
      status,
    });
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
        className="flex max-h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-panel border border-line bg-card shadow-lift sm:rounded-panel"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2
              id={`${uid}-title`}
              className="text-[18px] font-bold tracking-tight text-navy-deep"
            >
              {mode === "admit" ? "קליטת מטופל" : "עריכת פרטי מטופל"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              חדר <span className="tnum">{roomNumber}</span>
              {mode === "admit"
                ? " · פרטי הקבלה בלבד, ללא מידע קליני"
                : " · תיקון הפרטים המנהליים"}
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <Field
              label="שם מלא"
              className="col-span-2"
              error={touched && nameMissing ? "יש להזין שם" : undefined}
            >
              <input
                ref={firstField}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם פרטי ומשפחה"
                autoComplete="off"
                className={inputClass(touched && nameMissing)}
              />
            </Field>

            <Field label="גיל">
              <input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
                placeholder="—"
                className={cn(inputClass(false), "tnum")}
              />
            </Field>

            <Field label="ת״ז">
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                inputMode="numeric"
                placeholder="—"
                className={cn(inputClass(false), "tnum")}
              />
            </Field>

            {/* Bed and hospital day pair up: both single numbers, both about
                where the patient sits in the ward rather than who they are. */}
            <Field
              label="מיטה"
              error={bedClash ? "המיטה תפוסה בחדר זה" : undefined}
            >
              <input
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                inputMode="numeric"
                className={cn(inputClass(bedClash), "tnum")}
              />
            </Field>

            <Field label="יום אשפוז">
              <input
                value={hospitalDay}
                onChange={(e) => setHospitalDay(e.target.value)}
                inputMode="numeric"
                className={cn(inputClass(false), "tnum")}
              />
            </Field>

            {/* Chip rows take the full width: half a row makes them wrap, and a
                wrapped chip row leaves a dead gap beside whatever sits next
                to it. */}
            <Field label="קופת חולים" className="col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {HMOS.map((h) => (
                  <Chip key={h} active={h === hmo} onClick={() => setHmo(h)}>
                    {h}
                  </Chip>
                ))}
              </div>
            </Field>

            <Field label="אבחנה עיקרית" className="col-span-2">
              <input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="לדוגמה: אי־ספיקת לב"
                autoComplete="off"
                className={inputClass(false)}
              />
            </Field>

            <Field label="סטטוס" className="col-span-2">
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    aria-pressed={s === status}
                    className={cn(
                      "rounded-chip transition-shadow",
                      s === status &&
                        "ring-2 ring-navy ring-offset-2 ring-offset-card",
                    )}
                  >
                    <StatusPill descriptor={PATIENT_STATUS[s]} size="sm" />
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          {/* Never disabled: a dead button explains nothing. Pressing it with
              something missing is what surfaces the reason. */}
          <Button type="submit" variant="primary">
            {mode === "admit" ? "קליטה למחלקה" : "שמירת שינויים"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function inputClass(invalid: boolean): string {
  return cn(
    "w-full rounded-md border bg-card-raised px-3 py-2 text-[14px] text-ink outline-none transition-colors",
    invalid
      ? "border-attention focus:border-attention"
      : "border-line-strong focus:border-navy",
  );
}

function clampInt(raw: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function Field({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[12px] font-medium text-ink-muted">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[12px] text-attention">{error}</span>
      )}
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-chip border px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "border-navy bg-navy text-on-navy"
          : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
      )}
    >
      {children}
    </button>
  );
}
