"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { DischargeMedication, DischargeReport, Patient } from "@/lib/schemas/clinical";
import { newDischargeMedication } from "@/lib/schemas/clinical";
import { DISCHARGE_DESTINATION, DISCHARGE_DESTINATIONS } from "@/lib/labels";
import { buildDischargeReport } from "@/lib/discharge/report";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/primitives";
import { IconClose, IconDocument, IconPlus, IconTrash } from "@/components/ui/icons";

/**
 * The discharge letter: drafted the moment discharge is opened, then reviewed
 * and corrected by hand — the same "the app drafts, a doctor approves" shape
 * as a recorded round, applied to the one document that leaves the ward with
 * the patient.
 *
 * This dialog does two different jobs depending on whether the patient has
 * already left. Before discharge, reviewing the letter and pressing "אישור
 * שחרור" IS the confirmation — there is no separate "are you sure", because a
 * doctor reading their own discharge summary is a stronger check than a yes/no
 * chip. After discharge, the same letter stays open for correction; the primary
 * action just saves it, since the patient has already gone.
 */
export function DischargeReportDialog({
  patient,
  onClose,
  onDischarged,
}: {
  patient: Patient;
  onClose: () => void;
  onDischarged?: () => void;
}) {
  const uid = useId();
  const { getRoom, saveDischargeReport, dischargePatient } = useWard();
  const room = getRoom(patient.roomId);
  const alreadyDischarged = Boolean(patient.dischargedAt);

  const [report, setReport] = useState<DischargeReport>(
    () => patient.dischargeReport ?? buildDischargeReport(patient),
  );
  const firstField = useRef<HTMLTextAreaElement | null>(null);

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

  const set = <K extends keyof DischargeReport>(key: K, value: DischargeReport[K]) =>
    setReport((r) => ({ ...r, [key]: value }));

  const setMed = (id: string, patch: Partial<DischargeMedication>) =>
    setReport((r) => ({
      ...r,
      medications: r.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));

  const submit = () => {
    const final = { ...report, updatedAt: Date.now() };
    saveDischargeReport(patient.id, final);
    // onDischarged fires only on the transition into "discharged" — editing an
    // already-discharged patient's letter is a save, not a discharge, and
    // should not trigger whatever the caller does on leaving the ward (e.g.
    // navigating back to the room).
    if (!alreadyDischarged) {
      dischargePatient(patient.id);
      onDischarged?.();
    }
    onClose();
  };

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/28 p-0 backdrop-blur-[3px] sm:items-center sm:p-6 print:hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="flex max-h-[94dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-panel border border-line bg-card shadow-lift sm:rounded-panel"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-wash text-navy">
              <IconDocument className="h-[16px] w-[16px]" />
            </span>
            <div>
              <h2 id={`${uid}-title`} className="text-[18px] font-bold tracking-tight text-navy-deep">
                דוח שחרור — {patient.name}
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-muted">
                מיטה <span className="tnum">{patient.bed}</span>, חדר{" "}
                <span className="tnum">{room?.number ?? "—"}</span> · יום אשפוז{" "}
                <span className="tnum">{patient.hospitalDay}</span> ·{" "}
                {patient.primaryDiagnosis || "ללא אבחנת קבלה"}
              </p>
            </div>
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
          <div className="flex flex-col gap-4">
            <Field label="יעד שחרור">
              <div className="flex flex-wrap gap-1.5">
                {DISCHARGE_DESTINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("destination", d)}
                    aria-pressed={d === report.destination}
                    className={cn(
                      "rounded-chip border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                      d === report.destination
                        ? "border-navy bg-navy text-on-navy"
                        : "border-line-strong bg-card text-ink-muted hover:bg-page-deep",
                    )}
                  >
                    {DISCHARGE_DESTINATION[d].label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="אבחנות בשחרור">
              <textarea
                ref={firstField}
                value={report.diagnoses}
                onChange={(e) => set("diagnoses", e.target.value)}
                rows={2}
                placeholder="אבחנה בשורה"
                className={textareaClass}
              />
            </Field>

            <Field label="סיכום מהלך האשפוז">
              <textarea
                value={report.summary}
                onChange={(e) => set("summary", e.target.value)}
                rows={4}
                placeholder="תלונת הקבלה, מהלך הטיפול והתגובה אליו"
                className={textareaClass}
              />
            </Field>

            <MedicationsField
              medications={report.medications}
              onAdd={() =>
                setReport((r) => ({
                  ...r,
                  medications: [...r.medications, newDischargeMedication()],
                }))
              }
              onChange={setMed}
              onRemove={(id) =>
                setReport((r) => ({
                  ...r,
                  medications: r.medications.filter((m) => m.id !== id),
                }))
              }
            />

            <Field label="המלצות להמשך טיפול ומעקב">
              <textarea
                value={report.followUp}
                onChange={(e) => set("followUp", e.target.value)}
                rows={3}
                placeholder="מעקב מרפאה, בדיקות להשלמה, ייעוצים"
                className={textareaClass}
              />
            </Field>

            <Field label="הנחיות כלליות">
              <textarea
                value={report.generalInstructions}
                onChange={(e) => set("generalInstructions", e.target.value)}
                rows={2}
                placeholder="על כל החמרה במצב יש לפנות מיד לעזרה רפואית מתאימה"
                className={textareaClass}
              />
            </Field>

            <Field label="שם הרופא המשחרר">
              <input
                value={report.physicianName}
                onChange={(e) => set("physicianName", e.target.value)}
                placeholder="שם מלא"
                autoComplete="off"
                className="w-full max-w-xs rounded-md border border-line-strong bg-card-raised px-3 py-2 text-[14px] text-ink outline-none transition-colors focus:border-navy"
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-page-deep"
          >
            <IconDocument className="h-4 w-4 text-ink-muted" />
            הדפסה
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              {alreadyDischarged ? "סגירה" : "ביטול"}
            </Button>
            <Button variant="primary" onClick={submit}>
              {alreadyDischarged ? "שמירת שינויים" : "אישור שחרור"}
            </Button>
          </div>
        </div>
      </div>

    </div>

    {/* Rendered only for print, and only as much of the letter as a printed
        page needs — no chrome, no buttons, no editing affordances. Kept
        outside the dialog's own `print:hidden` wrapper on purpose: nesting it
        inside would hide it too, and a position:fixed ancestor can also get
        clipped by print pagination in some browsers. */}
    <PrintableReport patient={patient} room={room?.number} report={report} />
    </>
  );
}

function PrintableReport({
  patient,
  room,
  report,
}: {
  patient: Patient;
  room: number | undefined;
  report: DischargeReport;
}) {
  const generated = new Date(report.updatedAt || Date.now()).toLocaleString("he-IL", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="discharge-print" dir="rtl">
      <h1>דוח שחרור</h1>
      <p className="meta">
        {patient.name} · גיל {patient.age} · ת״ז {patient.idNumber || "—"} · {patient.hmo}
        <br />
        מיטה {patient.bed}, חדר {room ?? "—"} · יום אשפוז {patient.hospitalDay} ·{" "}
        {patient.primaryDiagnosis || "ללא אבחנת קבלה"}
        <br />
        יעד שחרור: {DISCHARGE_DESTINATION[report.destination].label}
      </p>

      <Section title="אבחנות בשחרור" text={report.diagnoses} />
      <Section title="סיכום מהלך האשפוז" text={report.summary} />

      {report.medications.length > 0 && (
        <>
          <h2>תרופות בשחרור</h2>
          <table>
            <thead>
              <tr>
                <th>שם התרופה</th>
                <th>מינון</th>
                <th>תדירות</th>
                <th>אופן מתן</th>
                <th>משך טיפול</th>
              </tr>
            </thead>
            <tbody>
              {report.medications.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.dosage}</td>
                  <td>{m.frequency}</td>
                  <td>{m.route}</td>
                  <td>{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <Section title="המלצות להמשך טיפול ומעקב" text={report.followUp} />
      <Section title="הנחיות כלליות" text={report.generalInstructions} />

      <p className="sign">
        {report.physicianName && <>שם הרופא המשחרר: {report.physicianName}</>}
        <br />
        הופק: {generated}
      </p>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <>
      <h2>{title}</h2>
      <p>{text}</p>
    </>
  );
}

function MedicationsField({
  medications,
  onAdd,
  onChange,
  onRemove,
}: {
  medications: DischargeMedication[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<DischargeMedication>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Field label="תרופות בשחרור">
      {medications.length > 0 && (
        <div className="mb-2 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-page-deep/50 text-start text-[11px] text-ink-muted">
                <th className="px-2 py-1.5 text-start font-medium">שם התרופה</th>
                <th className="px-2 py-1.5 text-start font-medium">מינון</th>
                <th className="px-2 py-1.5 text-start font-medium">תדירות</th>
                <th className="px-2 py-1.5 text-start font-medium">אופן מתן</th>
                <th className="px-2 py-1.5 text-start font-medium">משך טיפול</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {medications.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-b-0">
                  <MedCell value={m.name} onChange={(v) => onChange(m.id, { name: v })} placeholder="שם" />
                  <MedCell value={m.dosage} onChange={(v) => onChange(m.id, { dosage: v })} placeholder="מינון" />
                  <MedCell
                    value={m.frequency}
                    onChange={(v) => onChange(m.id, { frequency: v })}
                    placeholder="פעמים ביום"
                  />
                  <MedCell value={m.route} onChange={(v) => onChange(m.id, { route: v })} placeholder="פומי" />
                  <MedCell
                    value={m.duration}
                    onChange={(v) => onChange(m.id, { duration: v })}
                    placeholder="ימים"
                  />
                  <td className="px-1">
                    <button
                      type="button"
                      onClick={() => onRemove(m.id)}
                      aria-label={`מחיקת ${m.name || "שורת תרופה"}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-urgent-bg hover:text-urgent"
                    >
                      <IconTrash className="h-[14px] w-[14px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[13px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
      >
        <IconPlus className="h-4 w-4" />
        הוספת תרופה
      </button>
    </Field>
  );
}

function MedCell({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <td className="px-1 py-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-[84px] rounded border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none transition-colors focus:border-navy focus:bg-card-raised"
      />
    </td>
  );
}

const textareaClass =
  "w-full resize-y rounded-md border border-line-strong bg-card-raised px-3 py-2 text-[14px] leading-relaxed text-ink outline-none transition-colors focus:border-navy";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
