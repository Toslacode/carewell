"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClinicalRecord } from "@/components/clinical/ClinicalRecord";
import { OperationalColumn } from "@/components/tasks/OperationalColumn";
import { RecordingBar } from "@/components/recording/RecordingBar";
import { PatientForm } from "@/components/patients/PatientForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { EmptyState, StatusPill } from "@/components/ui/primitives";
import {
  IconArrowBack,
  IconHeart,
  IconPencil,
  IconTrash,
  IconUser,
} from "@/components/ui/icons";
import { PATIENT_STATUS } from "@/lib/labels";
import { openTaskCount, useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";

/**
 * Screen 3 — the patient.
 *
 * Clinical record on the reading side, operational column beside it on
 * desktop and stacked beneath on tablet, and the recorder pinned to the
 * bottom throughout. Navigation is the top bar's job: the room and the other
 * beds in it are one tap away up there, so this screen carries no chrome of
 * its own and opens straight on the name.
 */
export default function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const router = useRouter();
  const [structuring, setStructuring] = useState(false);
  const [editing, setEditing] = useState(false);
  const onPhaseChange = useCallback(
    (phase: string) => setStructuring(phase === "structuring"),
    [],
  );
  const {
    getPatient,
    getRoom,
    roomPatients,
    updatePatientDetails,
    dischargePatient,
    readmitPatient,
    deletePatient,
  } = useWard();
  const patient = getPatient(patientId);

  if (!patient) {
    return (
      <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-ward">
          <EmptyState
            icon={<IconUser className="h-8 w-8" />}
            title="המטופל לא נמצא"
            hint="ייתכן שהרשומה נמחקה או שהקישור שגוי."
            action={
              <Link
                href="/rooms"
                className="mt-1 inline-flex items-center gap-2 rounded-chip border border-line-strong bg-card px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-page-deep"
              >
                <IconArrowBack className="h-4 w-4" />
                חזרה לחדרים
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const room = getRoom(patient.roomId);
  const status = PATIENT_STATUS[patient.status];
  const open = openTaskCount(patient);
  const discharged = Boolean(patient.dischargedAt);
  const takenBeds = roomPatients(patient.roomId)
    .filter((p) => p.id !== patient.id)
    .map((p) => p.bed);

  return (
    <>
      <main id="main" className="px-4 pt-5 sm:px-6">
        <div className="mx-auto max-w-ward">
          {/* name and status, then what can be done to the record itself */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-[30px] font-bold tracking-tight text-navy-deep sm:text-[36px]">
              {patient.name}
            </h1>
            <StatusPill descriptor={status} />
            {discharged && (
              <span className="rounded-chip border border-info-line bg-info-bg px-3 py-1.5 text-[13px] font-semibold text-info">
                שוחרר
              </span>
            )}

            <div className="ms-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-page-deep"
              >
                <IconPencil className="h-4 w-4 text-ink-muted" />
                עריכת פרטים
              </button>

              {discharged ? (
                <button
                  type="button"
                  onClick={() => readmitPatient(patient.id)}
                  className="inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-page-deep"
                >
                  <IconArrowBack className="h-4 w-4 text-ink-muted" />
                  ביטול שחרור
                </button>
              ) : (
                <ConfirmButton
                  tone="info"
                  label="שחרור מטופל"
                  question="לשחרר את המטופל?"
                  confirmLabel="שחרור"
                  icon={<IconHeart className="h-4 w-4 text-ink-muted" />}
                  onConfirm={() => {
                    dischargePatient(patient.id);
                    router.push(`/rooms/${patient.roomId}`);
                  }}
                />
              )}

              <ConfirmButton
                label="מחיקה"
                question="למחוק את הרשומה לצמיתות?"
                confirmLabel="מחיקה"
                icon={<IconTrash className="h-4 w-4" />}
                onConfirm={() => {
                  deletePatient(patient.id);
                  router.push(`/rooms/${patient.roomId}`);
                }}
              />
            </div>

            <p className="w-full text-[14px] text-ink-muted">
              מיטה <span className="tnum">{patient.bed}</span>, חדר{" "}
              <span className="tnum">{room?.number ?? "—"}</span>
            </p>
          </div>

          {discharged && (
            <p className="mb-4 rounded-card border border-info-line bg-info-bg/50 px-5 py-3 text-[13px] leading-relaxed text-info">
              המטופל שוחרר מהמחלקה. הרשומה נשמרת לצפייה ולעריכה, אך המיטה פנויה
              והמטופל אינו נספר עוד במשימות המחלקה. ״ביטול שחרור״ מחזיר אותו
              לאותה מיטה.
            </p>
          )}

          {/* demographic strip — the printed ward sheet, digitised */}
          <dl className="mb-4 grid grid-cols-2 gap-x-5 gap-y-3 rounded-card border border-line bg-card px-5 py-4 shadow-card sm:grid-cols-3 lg:grid-cols-6">
            <HeaderField label="גיל" value={String(patient.age)} tnum />
            <HeaderField label="ת״ז" value={patient.idNumber || "—"} tnum />
            <HeaderField label="קופה" value={patient.hmo} />
            <HeaderField
              label="אבחנה עיקרית"
              value={patient.primaryDiagnosis || "—"}
              className="col-span-2 sm:col-span-1"
            />
            <HeaderField
              label="יום אשפוז"
              value={String(patient.hospitalDay)}
              tnum
            />
            <HeaderField
              label="משימות פתוחות"
              value={String(open)}
              tnum
              emphasis={open > 0}
            />
          </dl>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <ClinicalRecord patient={patient} structuring={structuring} />
            <OperationalColumn patient={patient} />
          </div>

          {/* room for the sticky bar so the last panel is never covered */}
          <div className="h-28" aria-hidden="true" />
        </div>
      </main>

      <RecordingBar patient={patient} onPhaseChange={onPhaseChange} />

      {editing && (
        <PatientForm
          mode="edit"
          patient={patient}
          roomNumber={room?.number ?? 0}
          takenBeds={takenBeds}
          onClose={() => setEditing(false)}
          onSubmit={(details) => {
            updatePatientDetails(patient.id, details);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function HeaderField({
  label,
  value,
  tnum,
  emphasis,
  className,
}: {
  label: string;
  value: string;
  tnum?: boolean;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[12px] text-ink-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 truncate text-[15px] font-semibold",
          tnum && "tnum",
          emphasis ? "text-attention" : "text-navy-deep",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
