"use client";

import { use } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { ClinicalRecord } from "@/components/clinical/ClinicalRecord";
import { OperationalColumn } from "@/components/tasks/OperationalColumn";
import { RecordingBar } from "@/components/recording/RecordingBar";
import { EmptyState, StatusPill } from "@/components/ui/primitives";
import { IconUser } from "@/components/ui/icons";
import { PATIENT_STATUS } from "@/lib/labels";
import { openTaskCount, useWard } from "@/lib/store/ward-store";

/**
 * Screen 3 — the patient.
 *
 * Clinical record on the reading side, operational column beside it on
 * desktop and stacked beneath on tablet, and the recorder pinned to the
 * bottom throughout.
 */
export default function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = use(params);
  const { getPatient, getRoom } = useWard();
  const patient = getPatient(patientId);

  if (!patient) {
    return (
      <>
        <AppHeader back={{ href: "/rooms", label: "חזרה לחדרים" }} />
        <main id="main" className="px-4 pb-4 pt-6 sm:px-6">
          <div className="mx-auto max-w-ward">
            <EmptyState
              icon={<IconUser className="h-8 w-8" />}
              title="המטופל לא נמצא"
              hint="ייתכן שהמטופל שוחרר או שהקישור שגוי."
            />
          </div>
        </main>
      </>
    );
  }

  const room = getRoom(patient.roomId);
  const status = PATIENT_STATUS[patient.status];
  const open = openTaskCount(patient);

  return (
    <>
      <AppHeader
        back={{
          href: `/rooms/${patient.roomId}`,
          label: `חזרה לחדר ${room?.number ?? ""}`.trim(),
        }}
      />

      <main id="main" className="px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-ward">
          {/* name + status */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-[30px] font-bold tracking-tight text-navy-deep sm:text-[36px]">
              {patient.name}
            </h1>
            <StatusPill descriptor={status} />
            <p className="w-full text-[14px] text-ink-muted">
              מיטה <span className="tnum">{patient.bed}</span>, חדר{" "}
              <span className="tnum">{room?.number ?? "—"}</span>
            </p>
          </div>

          {/* demographic strip — the printed ward sheet, digitised */}
          <dl className="mb-4 grid grid-cols-2 gap-x-5 gap-y-3 rounded-card border border-line bg-card px-5 py-4 shadow-card sm:grid-cols-3 lg:grid-cols-6">
            <HeaderField label="גיל" value={String(patient.age)} tnum />
            <HeaderField label="ת״ז" value={patient.idNumber} tnum />
            <HeaderField label="קופה" value={patient.hmo} />
            <HeaderField
              label="אבחנה עיקרית"
              value={patient.primaryDiagnosis}
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
            <ClinicalRecord patient={patient} />
            <OperationalColumn patient={patient} />
          </div>

          {/* room for the sticky bar so the last panel is never covered */}
          <div className="h-28" aria-hidden="true" />
        </div>
      </main>

      <RecordingBar patient={patient} />
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
        className={[
          "mt-0.5 truncate text-[15px] font-semibold",
          tnum ? "tnum" : "",
          emphasis ? "text-attention" : "text-navy-deep",
        ].join(" ")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
