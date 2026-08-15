"use client";

import Link from "next/link";
import type { Patient } from "@/lib/schemas/clinical";
import { PATIENT_STATUS, taskCount } from "@/lib/labels";
import { StatusPill } from "@/components/ui/primitives";
import { IconBed, IconChevron, IconClipboard } from "@/components/ui/icons";
import { openTaskCount } from "@/lib/store/ward-store";

/**
 * One patient, as a single large target.
 *
 * This replaces a row on a printed ward sheet, so it carries exactly what that
 * sheet carried — bed, name, age, ID, HMO, diagnosis — plus the two things the
 * paper could never show: current status and how much is still open.
 *
 * The whole card is the link. On a tablet held in one hand during a round,
 * a small "open" button would be the wrong target.
 */
export function PatientCard({ patient }: { patient: Patient }) {
  const status = PATIENT_STATUS[patient.status];
  const open = openTaskCount(patient);
  const hasDraft = patient.draftClinicalData !== null;

  return (
    <Link
      href={`/patients/${patient.id}`}
      className="group flex overflow-hidden rounded-card border border-line bg-card shadow-card transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-1 hover:border-line-strong hover:shadow-lift active:translate-y-0 active:duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 focus-visible:ring-offset-page"
    >
      {/* bed chip */}
      <div className="flex w-[92px] shrink-0 flex-col items-center justify-center gap-2 border-e border-line bg-card-sunken px-2 py-6 sm:w-[104px]">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-card text-ink-muted">
          <IconBed className="h-5 w-5" />
        </span>
        <span className="text-center text-[13px] font-semibold text-ink">
          מיטה <span className="tnum">{patient.bed}</span>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-[19px] font-bold tracking-tight text-navy-deep sm:text-[21px]">
              {patient.name}
            </h3>
            {hasDraft && (
              <span className="rounded-chip border border-info-line bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info">
                טיוטה פתוחה
              </span>
            )}
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-4">
            <Field label="גיל" value={String(patient.age)} tnum />
            <Field label="ת״ז" value={patient.idNumber} tnum />
            <Field label="קופה" value={patient.hmo} />
            <Field
              label="אבחנה עיקרית"
              value={patient.primaryDiagnosis}
              className="col-span-2 sm:col-span-1"
            />
          </dl>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line pt-3 sm:w-[190px] sm:flex-col sm:items-end sm:justify-center sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0">
          <StatusPill descriptor={status} />

          <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <IconClipboard className="h-4 w-4" />
            {open === 0 ? "אין משימות פתוחות" : taskCount(open)}
          </span>

          <span className="hidden items-center gap-1.5 rounded-chip border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink transition-colors group-hover:bg-page-deep sm:inline-flex">
            פתיחת מטופל
            <IconChevron className="h-4 w-4 text-ink-muted transition-transform duration-300 group-hover:-translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
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
        className={[
          "mt-0.5 truncate text-[14px] font-medium text-ink",
          tnum ? "tnum" : "",
        ].join(" ")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
