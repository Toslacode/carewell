"use client";

import { useState, type ReactNode } from "react";
import type { ClinicalData, Patient, VitalKey } from "@/lib/schemas/clinical";
import { formatVital, latestVitalSet } from "@/lib/schemas/clinical";
import { shortWhen } from "@/lib/utils/when";
import { TEST_SUBSECTIONS, VITAL_LABELS } from "@/lib/labels";
import { type ListPath, useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import {
  EditableList,
  InlineInput,
  isFresh,
} from "@/components/clinical/EditableList";
import { IconButton } from "@/components/ui/primitives";
import { Reveal } from "@/components/motion/Reveal";
import {
  IconAlert,
  IconChat,
  IconChevronDown,
  IconDocument,
  IconFlask,
  IconPencil,
  IconStethoscope,
  IconTrash,
  IconUsers,
  IconVitals,
} from "@/components/ui/icons";

/**
 * The clinical record — eight permanent categories, always present, always in
 * the same order, populated or not. A doctor scanning for מדדים finds it in
 * the same place on every patient, every morning; that predictability is worth
 * more than collapsing empty sections would save.
 */
export function ClinicalRecord({
  patient,
  structuring = false,
}: {
  patient: Patient;
  /** True while the AI is rewriting the draft — drives the scan sweep. */
  structuring?: boolean;
}) {
  const isDraft = patient.draftClinicalData !== null;
  const data = patient.draftClinicalData ?? patient.approvedClinicalData;

  return (
    <div className="flex flex-col gap-4">
      {data.needsReview.length > 0 && (
        <NeedsReviewPanel patient={patient} data={data} />
      )}

      <div
        className={cn(
          "overflow-hidden rounded-card border bg-card shadow-card transition-colors duration-500",
          structuring ? "scanning border-info-line" : "border-line",
        )}
      >
        <Section
          index={1}
          title="תלונה עיקרית"
          icon={<IconChat className="h-[18px] w-[18px]" />}
        >
          <List patient={patient} path="chiefComplaint" items={data.chiefComplaint} empty="לא תועדה תלונה עיקרית" />
        </Section>

        <Section
          index={2}
          title="מחלות רקע"
          icon={<IconDocument className="h-[18px] w-[18px]" />}
        >
          <List
            patient={patient}
            path="pastMedicalHistory"
            items={data.pastMedicalHistory}
            empty="לא תועדו מחלות רקע"
          />
        </Section>

        <Section
          index={3}
          title="סטטוס סוציאלי"
          icon={<IconUsers className="h-[18px] w-[18px]" />}
        >
          <List
            patient={patient}
            path="socialStatus"
            items={data.socialStatus}
            empty="לא תועד מידע סוציאלי"
          />
        </Section>

        <Section
          index={4}
          title="מדדים"
          icon={<IconVitals className="h-[18px] w-[18px]" />}
        >
          <VitalsGrid patient={patient} data={data} />
        </Section>

        <Section
          index={5}
          title="בדיקות"
          icon={<IconFlask className="h-[18px] w-[18px]" />}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            {TEST_SUBSECTIONS.map((sub) => (
              <div key={sub.key}>
                <h4 className="mb-1.5 text-[13px] font-semibold text-navy-deep">
                  {sub.title}
                </h4>
                <List
                  patient={patient}
                  path={`tests.${sub.key}` as ListPath}
                  items={data.tests[sub.key]}
                  empty="—"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          index={6}
          title="אבחנת עבודה"
          icon={<IconStethoscope className="h-[18px] w-[18px]" />}
          // Visually distinct from the primary diagnosis in the header strip:
          // that one is the admission label, this one is what the treating
          // doctor currently believes, and they are not the same claim.
          className="bg-navy-wash/45"
        >
          <List
            patient={patient}
            path="workingDiagnosis"
            items={data.workingDiagnosis}
            empty="טרם נקבעה אבחנת עבודה"
          />
        </Section>

        <Section
          index={7}
          title="תכנית טיפול"
          icon={<IconDocument className="h-[18px] w-[18px]" />}
        >
          <List
            patient={patient}
            path="treatmentPlan"
            items={data.treatmentPlan}
            empty="לא הוגדרה תכנית טיפול"
          />
        </Section>

        <Section
          index={8}
          title="אחר / הערות"
          icon={<IconDocument className="h-[18px] w-[18px]" />}
          last
        >
          <List
            patient={patient}
            path="other"
            items={data.other}
            empty="אין הערות"
            addLabel="הוספת הערה"
          />
        </Section>
      </div>

      {isDraft && (
        <p className="px-1 text-[12px] text-ink-muted">
          שינויים נשמרים בטיוטה בלבד. המידע ייכנס לרשומה רק לאחר אישור הסבב.
        </p>
      )}
    </div>
  );
}

function Section({
  index,
  title,
  icon,
  children,
  className,
  last,
}: {
  index: number;
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  last?: boolean;
}) {
  return (
    <Reveal
      as="section"
      index={index}
      className={cn(
        "flex flex-col gap-2 px-4 py-4 sm:flex-row sm:gap-6 sm:px-6 sm:py-5",
        !last && "border-b border-line",
        className,
      )}
    >
      <h3 className="flex shrink-0 items-center gap-2.5 sm:w-[176px]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-card-sunken text-navy-soft">
          {icon}
        </span>
        <span className="text-[15px] font-semibold text-navy-deep">
          <span className="tnum">{index}.</span> {title}
        </span>
      </h3>
      <div className="min-w-0 flex-1">{children}</div>
    </Reveal>
  );
}

function List({
  patient,
  path,
  items,
  empty,
  addLabel,
}: {
  patient: Patient;
  path: ListPath;
  items: ClinicalData["chiefComplaint"];
  empty: string;
  addLabel?: string;
}) {
  const { editItem, deleteItem, addItem } = useWard();
  return (
    <EditableList
      items={items}
      emptyLabel={empty}
      addLabel={addLabel}
      onEdit={(id, text) => editItem(patient.id, path, id, text)}
      onDelete={(id) => deleteItem(patient.id, path, id)}
      onAdd={(text) => addItem(patient.id, path, text)}
    />
  );
}

/* ------------------------------------------------------------------ vitals */

const VITAL_ORDER: VitalKey[] = [
  "temperature",
  "bloodPressure",
  "heartRate",
  "spo2",
  "respiratoryRate",
];

function VitalsGrid({ patient, data }: { patient: Patient; data: ClinicalData }) {
  const [openHistory, setOpenHistory] = useState(false);
  // The grid itself is unchanged — it reads the record's vitals as it always
  // has, which is exactly what a nursing entry writes into. All that is added
  // is when the newest set was measured, because five numbers with no time on
  // them cannot be told apart from five numbers taken hours ago.
  const latest = latestVitalSet(patient);
  const history = [...(patient.vitalSets ?? [])].sort(
    (a, b) => b.measuredAt - a.measuredAt,
  );

  return (
    <div className="flex flex-col gap-2.5">
      {latest && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[12px] text-ink-muted">
            נמדד ב־
            <span className="tnum font-semibold text-navy-deep">
              {shortWhen(latest.measuredAt)}
            </span>
            <span className="ms-2 text-ink-decor">{latest.enteredBy}</span>
          </p>
          {history.length > 1 && (
            <button
              type="button"
              onClick={() => setOpenHistory((v) => !v)}
              aria-expanded={openHistory}
              className="inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-page-deep hover:text-navy"
            >
              היסטוריית מדדים
              <IconChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  openHistory && "rotate-180",
                )}
              />
            </button>
          )}
        </div>
      )}

      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {VITAL_ORDER.map((key) => (
          <VitalCard key={key} patient={patient} vkey={key} reading={data.vitals[key]} />
        ))}
      </ul>

      {openHistory && (
        <ul className="flex flex-col divide-y divide-line rounded-[12px] border border-line bg-card-sunken/50">
          {history.map((set) => (
            <li key={set.id} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="tnum text-[13px] font-semibold text-navy-deep">
                  {shortWhen(set.measuredAt)}
                </span>
                <span className="truncate text-[12px] text-ink-decor">
                  {set.enteredBy}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink">
                {VITAL_ORDER.map((key) => {
                  const value = formatVital(set, key);
                  if (value === null) return null;
                  return (
                    <span key={key}>
                      <span className="text-ink-muted">{VITAL_LABELS[key].label} </span>
                      <span className="tnum font-medium">{value}</span>
                    </span>
                  );
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VitalCard({
  patient,
  vkey,
  reading,
}: {
  patient: Patient;
  vkey: VitalKey;
  reading: ClinicalData["vitals"][VitalKey];
}) {
  const { setVital } = useWard();
  const [editing, setEditing] = useState(false);
  const meta = VITAL_LABELS[vkey];
  const fresh = isFresh(reading?.addedAt);

  return (
    <li
      className={cn(
        "group/vital relative rounded-[12px] border bg-card-raised px-3 py-2.5",
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-sm",
        reading ? "border-line" : "border-dashed border-line-strong",
        fresh && "settle",
      )}
    >
      <span className="flex items-center justify-between gap-1">
        <span className="text-[12px] text-ink-muted">{meta.label}</span>
        <span className="opacity-40 transition-opacity focus-within:opacity-100 group-hover/vital:opacity-100">
          <IconButton
            label={`עריכת ${meta.label}`}
            onClick={() => setEditing(true)}
            className="h-6 w-6"
          >
            <IconPencil className="h-[13px] w-[13px]" />
          </IconButton>
        </span>
      </span>

      {editing ? (
        <InlineInput
          initial={reading?.value ?? ""}
          placeholder={meta.unit}
          onCancel={() => setEditing(false)}
          onSave={(text) => {
            setVital(patient.id, vkey, text);
            setEditing(false);
          }}
        />
      ) : (
        // The reading is the target — a measured value and an empty slot both
        // open on one tap, so correcting a mis-heard temperature is the same
        // gesture as entering one for the first time.
        <button
          type="button"
          onClick={() => setEditing(true)}
          title={`עריכת ${meta.label}`}
          className="mt-0.5 -mx-1 block w-[calc(100%+8px)] rounded-md px-1 text-start transition-colors hover:bg-page-deep/60"
        >
          {reading ? (
            <span className="tnum text-[19px] font-semibold leading-tight text-navy-deep">
              {reading.value}
            </span>
          ) : (
            <span className="text-[15px] text-ink-muted">לא נמדד</span>
          )}
        </button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------ needs review */

/**
 * The uncertainty surface.
 *
 * When the transcript or the extractor is not confident, the content lands
 * here — visible, labelled, and attributable — instead of being guessed into a
 * clinical category or silently dropped. Both of those failures are worse than
 * an unresolved flag.
 */
function NeedsReviewPanel({
  patient,
  data,
}: {
  patient: Patient;
  data: ClinicalData;
}) {
  const { dismissReview, moveReviewToOther } = useWard();

  return (
    <section className="overflow-hidden rounded-card border border-attention-line bg-attention-bg/55">
      <h3 className="flex items-center gap-2 border-b border-attention-line px-5 py-3 text-[14px] font-semibold text-attention">
        <IconAlert className="h-[18px] w-[18px]" />
        דורש בדיקה
        <span className="tnum rounded-chip border border-attention-line bg-attention-bg px-2 py-0.5 text-[11px]">
          {data.needsReview.length}
        </span>
      </h3>
      <ul className="flex flex-col divide-y divide-attention-line/60">
        {data.needsReview.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 px-5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] text-ink">{entry.text}</span>
              <span className="mt-0.5 block text-[12px] text-attention">
                {entry.reason}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => moveReviewToOther(patient.id, entry.id)}
                className="rounded-chip border border-attention-line bg-card px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-page-deep"
              >
                העברה להערות
              </button>
              <IconButton
                label="מחיקה"
                onClick={() => dismissReview(patient.id, entry.id)}
                className="h-7 w-7 hover:text-urgent"
              >
                <IconTrash className="h-[15px] w-[15px]" />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
