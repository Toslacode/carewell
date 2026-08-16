"use client";

import { useState } from "react";
import Link from "next/link";
import type { Patient } from "@/lib/schemas/clinical";
import { PATIENT_STATUS, taskCount } from "@/lib/labels";
import { StatusPill } from "@/components/ui/primitives";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PatientForm } from "@/components/patients/PatientForm";
import { DischargeReportDialog } from "@/components/patients/DischargeReportDialog";
import {
  IconArrowBack,
  IconBed,
  IconChevron,
  IconClipboard,
  IconDocument,
  IconHeart,
  IconPencil,
  IconTrash,
} from "@/components/ui/icons";
import { openTaskCount, useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";

/**
 * One patient, as a single large target.
 *
 * This replaces a row on a printed ward sheet, so it carries exactly what that
 * sheet carried — bed, name, age, ID, HMO, diagnosis — plus the two things the
 * paper could never show: current status and how much is still open.
 *
 * Almost the whole card opens the patient: on a tablet held in one hand during
 * a round, a small "open" button would be the wrong target. The link is an
 * overlay stretched behind the content rather than a wrapper around it,
 * because the card also carries its own controls, and a button nested inside a
 * link is neither valid HTML nor reliably operable.
 */
export function PatientCard({
  patient,
  compact = false,
}: {
  patient: Patient;
  /** The discharged listing: same identity, none of the ward workflow. */
  compact?: boolean;
}) {
  const { getRoom, roomPatients, updatePatientDetails, readmitPatient, deletePatient } =
    useWard();
  const [editing, setEditing] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);

  const status = PATIENT_STATUS[patient.status];
  const open = openTaskCount(patient);
  const hasDraft = patient.draftClinicalData !== null;
  const roomNumber = getRoom(patient.roomId)?.number ?? 0;

  const takenBeds = roomPatients(patient.roomId)
    .filter((p) => p.id !== patient.id)
    .map((p) => p.bed);

  const dialogs = (
    <>
      {editing && (
        <PatientForm
          mode="edit"
          patient={patient}
          roomNumber={roomNumber}
          takenBeds={takenBeds}
          onClose={() => setEditing(false)}
          onSubmit={(details) => {
            updatePatientDetails(patient.id, details);
            setEditing(false);
          }}
        />
      )}
      {dischargeOpen && (
        <DischargeReportDialog patient={patient} onClose={() => setDischargeOpen(false)} />
      )}
    </>
  );

  if (compact) {
    return (
      <>
        <div className="relative flex flex-wrap items-center gap-3 rounded-card border border-line bg-card/70 px-4 py-3">
          <Link
            href={`/patients/${patient.id}`}
            className="absolute inset-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-page"
          >
            <span className="sr-only">פתיחת הרשומה של {patient.name}</span>
          </Link>

          <span className="tnum pointer-events-none flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card-sunken text-[13px] font-semibold text-ink-muted">
            {patient.bed}
          </span>
          <span className="pointer-events-none min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-navy-deep">
              {patient.name}
            </span>
            <span className="block truncate text-[12px] text-ink-muted">
              {patient.primaryDiagnosis || "ללא אבחנה רשומה"}
            </span>
          </span>

          <span className="relative z-10 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setDischargeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-page-deep"
            >
              <IconDocument className="h-[15px] w-[15px] text-ink-muted" />
              דוח שחרור
            </button>
            <button
              type="button"
              onClick={() => readmitPatient(patient.id)}
              className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-page-deep"
            >
              <IconArrowBack className="h-[15px] w-[15px] text-ink-muted" />
              ביטול שחרור
            </button>
            <ConfirmButton
              label="מחיקה"
              question="למחוק לצמיתות?"
              confirmLabel="מחיקה"
              icon={<IconTrash className="h-[15px] w-[15px]" />}
              onConfirm={() => deletePatient(patient.id)}
              className="px-2.5 py-1.5 text-[12px]"
            />
          </span>
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex overflow-hidden rounded-card border border-line bg-card shadow-card",
          "transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)]",
          "hover:-translate-y-1 hover:border-line-strong hover:shadow-lift focus-within:border-line-strong",
        )}
      >
        {/* The card's link, stretched behind the content. Anything that is not
            itself a control opens the patient. */}
        <Link
          href={`/patients/${patient.id}`}
          className="absolute inset-0 z-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-page"
        >
          <span className="sr-only">פתיחת {patient.name}</span>
        </Link>

        {/* bed chip */}
        <div className="pointer-events-none flex w-[92px] shrink-0 flex-col items-center justify-center gap-2 border-e border-line bg-card-sunken px-2 py-6 sm:w-[104px]">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink-muted">
            <IconBed className="h-5 w-5" />
          </span>
          <span className="text-center text-[13px] font-semibold text-ink">
            מיטה <span className="tnum">{patient.bed}</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="pointer-events-none flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h3 className="text-[19px] font-bold tracking-tight text-navy-deep sm:text-[21px]">
                {patient.name}
              </h3>
              {hasDraft && (
                <span className="rounded-chip border border-info-line bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info">
                  טיוטה פתוחה
                </span>
              )}
            </div>

            <dl className="pointer-events-none mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-4">
              <Field label="גיל" value={String(patient.age)} tnum />
              <Field label="ת״ז" value={patient.idNumber || "—"} tnum />
              <Field label="קופה" value={patient.hmo} />
              <Field
                label="אבחנה עיקרית"
                value={patient.primaryDiagnosis || "—"}
                className="col-span-2 sm:col-span-1"
              />
            </dl>

            {/* Managing the patient, as opposed to reading them. In the flow
                rather than floated over a corner: an overlay lands on whatever
                the card happens to put underneath it, and here that was the
                "open patient" chip. Quiet by default, full strength on hover
                or focus — but never hidden, because a finger has no hover. */}
            <div className="relative z-10 mt-3.5 flex flex-wrap items-center gap-1.5 opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:bg-page-deep"
              >
                <IconPencil className="h-[15px] w-[15px] text-ink-muted" />
                עריכת פרטים
              </button>
              {/* Opens the discharge letter rather than a yes/no chip:
                  reviewing it and pressing "אישור שחרור" inside is itself the
                  confirmation. */}
              <button
                type="button"
                onClick={() => setDischargeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-2.5 py-1 text-[12px] font-medium text-ink transition-colors hover:border-info-line hover:bg-info-bg hover:text-info"
              >
                <IconHeart className="h-[15px] w-[15px] text-ink-muted" />
                שחרור
              </button>
              <ConfirmButton
                label="מחיקה"
                question={`למחוק את ${patient.name} לצמיתות?`}
                confirmLabel="מחיקה"
                icon={<IconTrash className="h-[15px] w-[15px]" />}
                onConfirm={() => deletePatient(patient.id)}
                className="px-2.5 py-1 text-[12px]"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line pt-3 sm:w-[190px] sm:flex-col sm:items-end sm:justify-center sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
            <span className="pointer-events-none">
              <StatusPill descriptor={status} />
            </span>

            <span className="pointer-events-none flex items-center gap-1.5 text-[13px] text-ink-muted">
              <IconClipboard className="h-4 w-4" />
              {open === 0 ? "אין משימות פתוחות" : taskCount(open)}
            </span>

            <span className="pointer-events-none hidden items-center gap-1.5 rounded-chip border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors group-hover:bg-page-deep sm:inline-flex">
              פתיחת מטופל
              <IconChevron className="h-4 w-4 text-ink-muted transition-transform duration-300 group-hover:-translate-x-0.5" />
            </span>
          </div>
        </div>

      </div>

      {dialogs}
    </>
  );
}

function Field({
  label,
  value,
  tnum,
  className,
}: {
  label: string;
  value: string;
  tnum?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd
        className={cn("mt-0.5 truncate text-[14px] font-medium text-ink", tnum && "tnum")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
