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
  /**
   * Demographics spoken in passing — "משה בן 52".
   *
   * Kept apart from the clinical categories because it proposes a change to
   * the patient's identity rather than adding to their record, and it is
   * applied only on approval, never silently.
   *
   * There is deliberately no attendingDoctor here. A name in a round note
   * ("הרופא שטיפל בו זה יוסי") is almost always a report about the past, not
   * an instruction to reassign the ward doctor, and getting that wrong
   * misattributes responsibility for a patient. Such mentions go to
   * needsReview instead.
   */
  demographics: z
    .object({ age: z.number().int().min(0).max(120).nullable().default(null) })
    .default({ age: null }),
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

/**
 * Hebrew boundary guards. JavaScript's `\b` is defined over ASCII word
 * characters, so `\bעכשיו\b` never matches — the boundary it looks for cannot
 * exist next to a Hebrew letter. These lookarounds are the working equivalent
 * and are used anywhere a Hebrew term must not match inside a longer word.
 */
const HB = "(?<![\\u0590-\\u05FF])";
const HA = "(?![\\u0590-\\u05FF])";

const PRIORITY_CUES: ReadonlyArray<readonly [TaskPriority, RegExp]> = [
  [
    "urgent",
    new RegExp(`${HB}(עכשיו|מיד|מייד|דחוף|בדחיפות|תכף|כרגע)${HA}|\\b(acute|stat)\\b`),
  ],
  ["before-discharge", /(לפני\s+ה?שחרור|לקראת\s+ה?שחרור|טרם\s+שחרור)/],
  [
    "today",
    new RegExp(`${HB}(היום|הבוקר|הערב|הלילה)${HA}|אחר\\s*ה?צהריים|במהלך\\s+היום`),
  ],
  [
    "scheduled",
    new RegExp(
      `${HB}(מחר|מחרתיים)${HA}|בהמשך\\s+השבוע|בעוד\\s+\\d|ביום\\s+\\S+|בשבוע\\s+הבא`,
    ),
  ],
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

/* ------------------------------------------------------ nursing observation */

/**
 * One set of vitals, measured together.
 *
 * The unit is the observation session, not the individual number. A nurse at
 * a bedside takes a temperature, a pressure and a pulse within the same
 * minute, and five separately timestamped values would misrepresent that as
 * five visits — and make it impossible to say which pressure went with which
 * fever. So one timestamp covers the set.
 *
 * Every field is optional because not every round of observations captures
 * everything, and a form that demands all five gets filled with guesses.
 */
export interface VitalSet {
  id: string;
  measuredAt: number;
  enteredBy: string;
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  spo2?: number;
  respiratoryRate?: number;
}

export type NursingOutputType =
  | "urine-output"
  | "bladder-residual"
  | "urine-drainage"
  | "bowel-movement";

/** Whether a bladder residual was taken before or after the patient voided —
 *  the same number means different things either side of that. */
export type ResidualContext = "before-voiding" | "after-voiding";

export interface NursingOutputEntry {
  id: string;
  type: NursingOutputType;
  /** Millilitres, or a count for bowel movements. */
  value?: number;
  unit?: string;
  measuredAt: number;
  enteredBy: string;
  note?: string;
  context?: ResidualContext;
}

export interface NursingNote {
  id: string;
  text: string;
  createdAt: number;
  enteredBy: string;
}

/** Fictitious, like every other name in this prototype. */
export const NURSING_STAFF: ReadonlyArray<string> = [
  "אחות דנה לוי",
  "אחות רות אביב",
  "אח עומר נחום",
  "אחות סיגל ברק",
];

/** The most recent set of observations, or null before any were taken. */
export function latestVitalSet(patient: Patient): VitalSet | null {
  const sets = patient.vitalSets ?? [];
  if (sets.length === 0) return null;
  return sets.reduce((newest, s) => (s.measuredAt > newest.measuredAt ? s : newest));
}

/**
 * How a measured number is written into the clinical record's vitals field.
 *
 * Matches the strings the record already holds, so a nurse's entry and a
 * dictated one are indistinguishable to every screen that reads them. Units
 * that the field label already carries are left off; the percent sign is kept
 * because the record's own values carry it ("94% באוויר חדר").
 */
export function formatVital(set: VitalSet, key: VitalKey): string | null {
  switch (key) {
    case "temperature":
      return set.temperature === undefined ? null : String(set.temperature);
    case "bloodPressure":
      return set.systolicBP === undefined || set.diastolicBP === undefined
        ? null
        : `${set.systolicBP}/${set.diastolicBP}`;
    case "heartRate":
      return set.heartRate === undefined ? null : String(set.heartRate);
    case "spo2":
      return set.spo2 === undefined ? null : `${set.spo2}%`;
    case "respiratoryRate":
      return set.respiratoryRate === undefined ? null : String(set.respiratoryRate);
  }
}

/** True when the set carries no measurement at all — nothing worth saving. */
export function isEmptyVitalSet(set: Partial<VitalSet>): boolean {
  return (
    set.temperature === undefined &&
    set.systolicBP === undefined &&
    set.diastolicBP === undefined &&
    set.heartRate === undefined &&
    set.spo2 === undefined &&
    set.respiratoryRate === undefined
  );
}

/* -------------------------------------------------------- what a round was */

/**
 * The round exactly as it was captured, before anything was sorted.
 *
 * Structured fields are an interpretation; this is the evidence behind them.
 * A doctor reviewing a decision three days later needs to read what was
 * actually said or written, not a tidied summary of it — so both sources are
 * kept verbatim and kept apart, and neither is ever replaced by the extracted
 * record.
 */
export interface RoundSource {
  id: string;
  at: number;
  /** What the microphone heard. Null when the round was written, not spoken. */
  transcript: string | null;
  /** What the doctor typed. Null when the round was spoken, not written. */
  note: string | null;
}

/* ------------------------------------------------------------ the letter */

/** Where the patient is going. Mirrors the ward's own discharge form: home is
 *  the common case and sits first, the two adverse outcomes sit last so they
 *  are never the accidental default. */
export type DischargeDestination =
  | "home"
  | "other-hospital"
  | "institution"
  | "left-against-advice"
  | "deceased";

export interface DischargeMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
}

/**
 * The discharge letter. Generated as a pre-filled draft the moment a doctor
 * chooses to discharge, then reviewed and corrected by hand before anything
 * is final — the same "AI drafts, a human approves" shape as a recorded
 * round, applied to the one document that leaves the ward with the patient.
 *
 * Free text rather than structured lists for diagnoses, the course summary
 * and the follow-up plan: a discharge letter is prose a doctor writes, not a
 * form a doctor fills in field by field, and forcing it into bullet rows here
 * would fight the way it actually gets written.
 */
export interface DischargeReport {
  destination: DischargeDestination;
  diagnoses: string;
  summary: string;
  medications: DischargeMedication[];
  followUp: string;
  generalInstructions: string;
  physicianName: string;
  generatedAt: number;
  updatedAt: number;
}

export function newDischargeMedication(): DischargeMedication {
  return { id: newId("m"), name: "", dosage: "", frequency: "", route: "", duration: "" };
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
  /**
   * The ward doctor responsible for this patient.
   *
   * Set by a person and changed by a person. A doctor's name appearing inside
   * a round note is not evidence that they have taken over the patient, so
   * extraction never writes here — see ExtractionSchema.demographics.
   */
  attendingDoctor: string;
  status: PatientStatus;
  approvedClinicalData: ClinicalData;
  /** Null until a round is recorded. Holds everything awaiting review. */
  draftClinicalData: ClinicalData | null;
  /** Draft tasks/consults/discharge live beside the draft record and are only
   *  merged into the real ones on approval. */
  draftTasks: Task[];
  draftConsultations: Consultation[];
  draftDischarge: Discharge | null;
  /** Demographic changes the open round proposes. Applied on approval only. */
  draftDemographics: { age: number | null } | null;
  tasks: Task[];
  consultations: Consultation[];
  discharge: Discharge;
  lastRoundAt: number | null;
  lastTranscript: string | null;
  /** The free-text note typed during the open round, kept verbatim beside the
   *  transcript rather than merged into it — two sources, two records. */
  roundNote: string | null;
  /** Every approved round's raw input, newest last. This is the audit trail
   *  the structured record is an interpretation of. */
  rounds: RoundSource[];
  /**
   * Nursing observations, oldest first.
   *
   * The record's `vitals` field holds the current value of each vital and is
   * what every screen reads; this is the history of how those values were
   * arrived at — who measured, when, and which readings belonged to the same
   * bedside visit. Recording a set updates both, so the doctor's view shows
   * the newest numbers without knowing anything about nursing.
   */
  vitalSets: VitalSet[];
  nursingOutputs: NursingOutputEntry[];
  nursingNotes: NursingNote[];
  /**
   * When the patient actually left the ward.
   *
   * Discharging is not deleting. The bed is freed and the patient drops out of
   * the room, the ward counts and the task sweep — but the record survives,
   * because a round that happened happened, and a discharge entered by mistake
   * has to be reversible. Deleting is the separate, explicit act of saying the
   * record should never have existed at all.
   */
  dischargedAt?: number | null;
  /** The discharge letter. Set the moment discharge is first opened, and
   *  editable indefinitely after — a report is not sealed by the act of
   *  sending the patient home. */
  dischargeReport?: DischargeReport | null;
}

/** The fields a human types on the admission form, as opposed to the ones the
 *  app derives from the round. */
export interface PatientDetails {
  name: string;
  age: number;
  idNumber: string;
  hmo: Patient["hmo"];
  bed: number;
  hospitalDay: number;
  primaryDiagnosis: string;
  attendingDoctor: string;
  status: PatientStatus;
}

/** The ward's roster, for the picker. Fictitious, like every other name in
 *  this prototype. Not a closed list — a name can always be typed. */
export const WARD_DOCTORS: ReadonlyArray<string> = [
  'ד"ר יוסי כהן',
  'ד"ר מיכל ברנע',
  'ד"ר אבי שרון',
  'ד"ר נועה גלעדי',
  'ד"ר רון אלמוג',
];

export const HMOS: ReadonlyArray<Patient["hmo"]> = [
  "כללית",
  "מכבי",
  "מאוחדת",
  "לאומית",
];

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

/**
 * A patient admitted from the ward UI rather than seeded.
 *
 * Everything clinical starts empty on purpose. A newly admitted patient has no
 * findings, no plan and no tasks until somebody records a round or types them
 * in — pre-filling any of it would be the app inventing a record.
 */
export function newPatient(details: PatientDetails, roomId: string): Patient {
  return {
    id: newId("p"),
    name: details.name,
    age: details.age,
    idNumber: details.idNumber,
    hmo: details.hmo,
    roomId,
    bed: details.bed,
    hospitalDay: details.hospitalDay,
    primaryDiagnosis: details.primaryDiagnosis,
    attendingDoctor: details.attendingDoctor,
    status: details.status,
    approvedClinicalData: emptyClinicalData(),
    draftClinicalData: null,
    draftTasks: [],
    draftConsultations: [],
    draftDischarge: null,
    draftDemographics: null,
    tasks: [],
    consultations: [],
    discharge: { status: "unplanned", blockers: [] },
    lastRoundAt: null,
    lastTranscript: null,
    roundNote: null,
    rounds: [],
    vitalSets: [],
    nursingOutputs: [],
    nursingNotes: [],
    dischargedAt: null,
    dischargeReport: null,
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
