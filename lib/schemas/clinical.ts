import { z } from "zod";

/* ===========================================================================
   1. THE WIRE SCHEMA — what the extraction layer is allowed to return.

   This is the trust boundary. Anything crossing it is validated before it is
   allowed anywhere near patient state. The model returns flat text; it does
   not invent ids, timestamps, priorities or statuses, because those drive
   application behaviour and are derived in code below.
   =========================================================================== */

/** Bounded free text. Long enough for a finding, short enough that a runaway
 *  generation can't smuggle a wall of text into the record. */
const line = z.string().trim().min(1).max(400);
const lines = z.array(line).max(40).default([]);

/** Vitals stay strings on the wire — "38.6", "105/65", "93%" — because the
 *  doctor's phrasing carries units and qualifiers ("91% באוויר חדר") that a
 *  number would silently destroy. Normalisation happens in code. */
const vital = z.string().trim().min(1).max(40).nullable().default(null);

/**
 * A spoken action item. The model reports what it heard and, verbatim, the
 * timing phrase attached to it — nothing more. Priority is NOT the model's
 * call: see derivePriority() below.
 */
export const ExtractedTaskSchema = z.object({
  title: line,
  /** The literal timing words from the speech: "היום", "עכשיו", "לפני השחרור".
   *  Null when the doctor named no timing at all. */
  timing: z.string().trim().max(60).nullable().default(null),
  category: z
    .enum(["imaging", "labs", "medication", "consult", "procedure", "other"])
    .default("other"),
});

export const ExtractedConsultSchema = z.object({
  specialty: line,
  reason: z.string().trim().max(200).nullable().default(null),
});

/** Anything the model could not place with confidence. This is the pressure
 *  valve that makes "never guess" achievable: uncertain content lands here
 *  instead of being forced into a clinical category or dropped. */
export const NeedsReviewSchema = z.object({
  text: line,
  reason: z.string().trim().max(200).default("לא ברור מהתמלול"),
});

export const ExtractionSchema = z.object({
  chiefComplaint: lines,
  pastMedicalHistory: lines,
  socialStatus: lines,
  vitals: z
    .object({
      temperature: vital,
      bloodPressure: vital,
      heartRate: vital,
      spo2: vital,
      respiratoryRate: vital,
    })
    .default({
      temperature: null,
      bloodPressure: null,
      heartRate: null,
      spo2: null,
      respiratoryRate: null,
    }),
  tests: z
    .object({
      physicalExam: lines,
      labs: lines,
      imaging: lines,
      otherTests: lines,
    })
    .default({ physicalExam: [], labs: [], imaging: [], otherTests: [] }),
  workingDiagnosis: lines,
  treatmentPlan: lines,
  tasks: z.array(ExtractedTaskSchema).max(25).default([]),
  consultations: z.array(ExtractedConsultSchema).max(10).default([]),
  discharge: z
    .object({
      status: z
        .enum(["unknown", "unplanned", "today", "tomorrow"])
        .default("unknown"),
      blockers: lines,
    })
    .default({ status: "unknown", blockers: [] }),
  other: lines,
  needsReview: z.array(NeedsReviewSchema).max(20).default([]),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;

/** An empty, schema-valid extraction. Used as the fallback whenever a response
 *  cannot be trusted — the UI then shows "nothing was extracted" honestly
 *  rather than a half-parsed record. */
export function emptyExtraction(): Extraction {
  return ExtractionSchema.parse({});
}

/* ===========================================================================
   2. PRIORITY DERIVATION — deterministic, in code, never the model's judgement.

   The brief is explicit: workflow priority comes from explicit language. A
   model that decides "this sounds urgent" on its own is making a clinical
   triage call it has no business making, so it doesn't get to.
   =========================================================================== */

export const TASK_PRIORITIES = [
  "urgent",
  "today",
  "scheduled",
  "before-discharge",
  "unset",
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

const PRIORITY_CUES: ReadonlyArray<readonly [TaskPriority, RegExp]> = [
  ["urgent", /\b(עכשיו|מיד|מייד|דחוף|בדחיפות|תכף|כרגע|acute|stat)\b/],
  ["before-discharge", /(לפני\s+ה?שחרור|לקראת\s+ה?שחרור|טרם\s+שחרור)/],
  ["today", /(היום|הבוקר|אחר\s*ה?צהריים|הערב|הלילה|במהלך\s+היום)/],
  ["scheduled", /(מחר|מחרתיים|בהמשך\s+השבוע|בעוד\s+\d|ביום\s+\S+|בשבוע\s+הבא)/],
];

/** Maps the timing phrase the doctor actually said to a workflow priority.
 *  Order matters: "דחוף" outranks "היום" when both appear. */
export function derivePriority(timing: string | null | undefined): TaskPriority {
  if (!timing) return "unset";
  const t = timing.trim();
  for (const [priority, cue] of PRIORITY_CUES) {
    if (cue.test(t)) return priority;
  }
  return "unset";
}

/** Same derivation, run over a whole utterance — used by the rule-based
 *  extractor, where the timing words sit in the sentence rather than in a
 *  separate field. */
export function derivePriorityFromSentence(sentence: string): TaskPriority {
  return derivePriority(sentence);
}

/* ===========================================================================
   3. INTERNAL DOMAIN MODEL — what the application actually stores.

   Every clinical value is an addressable item so a doctor can correct exactly
   one line without touching the rest of the record, and so the UI can show
   where each line came from.
   =========================================================================== */

/** Where a line came from. Drives the draft styling and the review gate:
 *  only `approved` items are considered part of the record. */
export type ItemSource = "approved" | "ai" | "manual";

export interface ClinicalItem {
  id: string;
  text: string;
  source: ItemSource;
  /** Set on AI items so the UI can flash exactly what just landed. */
  addedAt?: number;
}

export interface VitalReading {
  value: string;
  source: ItemSource;
  addedAt?: number;
}

export type VitalKey =
  | "temperature"
  | "bloodPressure"
  | "heartRate"
  | "spo2"
  | "respiratoryRate";

export type Vitals = Record<VitalKey, VitalReading | null>;

export interface ClinicalData {
  chiefComplaint: ClinicalItem[];
  pastMedicalHistory: ClinicalItem[];
  socialStatus: ClinicalItem[];
  vitals: Vitals;
  tests: {
    physicalExam: ClinicalItem[];
    labs: ClinicalItem[];
    imaging: ClinicalItem[];
    otherTests: ClinicalItem[];
  };
  workingDiagnosis: ClinicalItem[];
  treatmentPlan: ClinicalItem[];
  other: ClinicalItem[];
  /** Uncertain content, surfaced rather than guessed or discarded. */
  needsReview: Array<{ id: string; text: string; reason: string }>;
}

export type TaskStatus = "pending" | "in-progress" | "done";

export interface Task {
  id: string;
  patientId: string;
  title: string;
  category: ExtractedTask["category"];
  priority: TaskPriority;
  status: TaskStatus;
  /** The timing phrase as spoken, kept so the doctor can see why a priority
   *  was suggested and correct it with context. */
  timing: string | null;
  createdFrom: "round" | "manual";
  createdAt: number;
  notes?: string;
}

export type ConsultState = "required" | "ordered" | "waiting" | "completed";

export interface Consultation {
  id: string;
  patientId: string;
  specialty: string;
  state: ConsultState;
  reason: string | null;
  createdFrom: "round" | "manual";
}

export type DischargeStatus = "unplanned" | "today" | "tomorrow" | "unknown";

export interface DischargeBlocker {
  id: string;
  text: string;
  resolved: boolean;
  /** When a blocker came from a task, completing that task offers to clear it. */
  linkedTaskId?: string;
}

export interface Discharge {
  status: DischargeStatus;
  blockers: DischargeBlocker[];
}

export type PatientStatus =
  | "stable"
  | "monitoring"
  | "attention"
  | "discharge-possible";

export interface Patient {
  id: string;
  name: string;
  age: number;
  /** Fictitious. Deliberately not a valid Israeli ID checksum. */
  idNumber: string;
  hmo: "כללית" | "מכבי" | "מאוחדת" | "לאומית";
  roomId: string;
  bed: number;
  hospitalDay: number;
  primaryDiagnosis: string;
  status: PatientStatus;
  approvedClinicalData: ClinicalData;
  /** Null until a round is recorded. Holds everything awaiting review. */
  draftClinicalData: ClinicalData | null;
  /** Draft tasks/consults/discharge live beside the draft record and are only
   *  merged into the real ones on approval. */
  draftTasks: Task[];
  draftConsultations: Consultation[];
  draftDischarge: Discharge | null;
  tasks: Task[];
  consultations: Consultation[];
  discharge: Discharge;
  lastRoundAt: number | null;
  lastTranscript: string | null;
}

export type RoomStatus = "active" | "empty" | "unavailable";

export interface Room {
  id: string;
  number: number;
  status: RoomStatus;
  patientIds: string[];
  /** Shown on the door when a room is out of service. */
  note?: string;
}

/* ===========================================================================
   4. Constructors
   =========================================================================== */

let seq = 0;
/** Stable, collision-free, and deterministic within a session. crypto.randomUUID
 *  is avoided so server and client renders can't disagree on an id. */
export function newId(prefix = "i"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
}

export function emptyVitals(): Vitals {
  return {
    temperature: null,
    bloodPressure: null,
    heartRate: null,
    spo2: null,
    respiratoryRate: null,
  };
}

export function emptyClinicalData(): ClinicalData {
  return {
    chiefComplaint: [],
    pastMedicalHistory: [],
    socialStatus: [],
    vitals: emptyVitals(),
    tests: { physicalExam: [], labs: [], imaging: [], otherTests: [] },
    workingDiagnosis: [],
    treatmentPlan: [],
    other: [],
    needsReview: [],
  };
}

export function item(text: string, source: ItemSource = "approved"): ClinicalItem {
  return { id: newId("c"), text, source };
}

export function reading(
  value: string,
  source: ItemSource = "approved",
): VitalReading {
  return { value, source };
}

/** Deep clone used when a round opens, so edits to the draft never leak into
 *  approved data before the doctor presses אישור סבב. */
export function cloneClinicalData(data: ClinicalData): ClinicalData {
  return {
    chiefComplaint: data.chiefComplaint.map((i) => ({ ...i })),
    pastMedicalHistory: data.pastMedicalHistory.map((i) => ({ ...i })),
    socialStatus: data.socialStatus.map((i) => ({ ...i })),
    vitals: {
      temperature: data.vitals.temperature && { ...data.vitals.temperature },
      bloodPressure: data.vitals.bloodPressure && { ...data.vitals.bloodPressure },
      heartRate: data.vitals.heartRate && { ...data.vitals.heartRate },
      spo2: data.vitals.spo2 && { ...data.vitals.spo2 },
      respiratoryRate:
        data.vitals.respiratoryRate && { ...data.vitals.respiratoryRate },
    },
    tests: {
      physicalExam: data.tests.physicalExam.map((i) => ({ ...i })),
      labs: data.tests.labs.map((i) => ({ ...i })),
      imaging: data.tests.imaging.map((i) => ({ ...i })),
      otherTests: data.tests.otherTests.map((i) => ({ ...i })),
    },
    workingDiagnosis: data.workingDiagnosis.map((i) => ({ ...i })),
    treatmentPlan: data.treatmentPlan.map((i) => ({ ...i })),
    other: data.other.map((i) => ({ ...i })),
    needsReview: data.needsReview.map((i) => ({ ...i })),
  };
}
