import type {
  ConsultState,
  DischargeDestination,
  DischargeStatus,
  PatientStatus,
  TaskPriority,
  TaskStatus,
} from "@/lib/schemas/clinical";

/**
 * Every Hebrew string the UI renders for a domain value lives here, so a
 * status can never be labelled two different ways on two screens.
 *
 * `tone` maps to the semantic color set in globals.css. Color is never the
 * only carrier — each descriptor also has a label and a glyph, per the
 * accessibility rules.
 */

export type Tone = "stable" | "attention" | "urgent" | "info" | "neutral";

export interface Descriptor {
  label: string;
  tone: Tone;
  /** Shape carries the meaning when color can't — colorblindness, print,
   *  a glare-washed tablet screen in a corridor. */
  glyph: string;
}

export const PATIENT_STATUS: Record<PatientStatus, Descriptor> = {
  stable: { label: "יציב", tone: "stable", glyph: "●" },
  monitoring: { label: "במעקב", tone: "attention", glyph: "◐" },
  attention: { label: "דורש תשומת לב", tone: "urgent", glyph: "▲" },
  "discharge-possible": { label: "שחרור אפשרי", tone: "info", glyph: "◆" },
};

export const TASK_PRIORITY: Record<TaskPriority, Descriptor> = {
  urgent: { label: "דחוף", tone: "urgent", glyph: "▲" },
  today: { label: "היום", tone: "attention", glyph: "●" },
  scheduled: { label: "מתוזמן", tone: "info", glyph: "◷" },
  "before-discharge": { label: "לפני שחרור", tone: "stable", glyph: "◆" },
  unset: { label: "לא הוגדר", tone: "neutral", glyph: "○" },
};

/** Sort order for task lists: what needs doing first, first. */
export const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  today: 1,
  scheduled: 2,
  "before-discharge": 3,
  unset: 4,
};

export const TASK_STATUS: Record<TaskStatus, Descriptor> = {
  pending: { label: "ממתין", tone: "neutral", glyph: "○" },
  "in-progress": { label: "בביצוע", tone: "attention", glyph: "◐" },
  done: { label: "בוצע", tone: "stable", glyph: "✓" },
};

export const CONSULT_STATE: Record<ConsultState, Descriptor> = {
  required: { label: "נדרש", tone: "attention", glyph: "●" },
  ordered: { label: "הוזמן", tone: "info", glyph: "◷" },
  waiting: { label: "ממתין", tone: "neutral", glyph: "○" },
  completed: { label: "הושלם", tone: "stable", glyph: "✓" },
};

export const DISCHARGE_STATUS: Record<DischargeStatus, Descriptor> = {
  unplanned: { label: "לא מתוכנן", tone: "neutral", glyph: "○" },
  today: { label: "אפשרי היום", tone: "info", glyph: "◆" },
  tomorrow: { label: "אפשרי מחר", tone: "info", glyph: "◷" },
  unknown: { label: "לא ידוע", tone: "neutral", glyph: "○" },
};

/** Home leads the list because it is the common case — the two adverse
 *  outcomes sit last so neither is ever the accidental default. */
export const DISCHARGE_DESTINATION: Record<DischargeDestination, Descriptor> = {
  home: { label: "הביתה", tone: "stable", glyph: "○" },
  "other-hospital": { label: "בית חולים אחר", tone: "info", glyph: "◆" },
  institution: { label: "מוסד", tone: "info", glyph: "◆" },
  "left-against-advice": { label: "עזב על דעת עצמו", tone: "attention", glyph: "▲" },
  deceased: { label: "נפטר", tone: "urgent", glyph: "✕" },
};

export const DISCHARGE_DESTINATIONS: DischargeDestination[] = [
  "home",
  "other-hospital",
  "institution",
  "left-against-advice",
  "deceased",
];

/** The eight permanent clinical categories, in their permanent order. The UI
 *  renders every one of these on every patient, populated or not — a doctor
 *  scanning the page should find מדדים in the same place every time. */
export const CLINICAL_SECTIONS = [
  { key: "chiefComplaint", index: 1, title: "תלונה עיקרית" },
  { key: "pastMedicalHistory", index: 2, title: "מחלות רקע" },
  { key: "socialStatus", index: 3, title: "סטטוס סוציאלי" },
  { key: "vitals", index: 4, title: "מדדים" },
  { key: "tests", index: 5, title: "בדיקות" },
  { key: "workingDiagnosis", index: 6, title: "אבחנת עבודה" },
  { key: "treatmentPlan", index: 7, title: "תכנית טיפול" },
  { key: "other", index: 8, title: "אחר / הערות" },
] as const;

export const VITAL_LABELS = {
  temperature: { label: "חום", unit: "°C" },
  bloodPressure: { label: "לחץ דם", unit: "mmHg" },
  heartRate: { label: "דופק", unit: "bpm" },
  spo2: { label: "סטורציה", unit: "%" },
  respiratoryRate: { label: "קצב נשימה", unit: "/דק׳" },
} as const;

export const TEST_SUBSECTIONS = [
  { key: "physicalExam", title: "בדיקה גופנית" },
  { key: "labs", title: "מעבדה" },
  { key: "imaging", title: "הדמיה" },
  { key: "otherTests", title: "בדיקות נוספות" },
] as const;

export const TASK_CATEGORY: Record<string, string> = {
  imaging: "הדמיה",
  labs: "מעבדה",
  medication: "תרופות",
  consult: "ייעוץ",
  procedure: "פרוצדורה",
  other: "אחר",
};

/** Hebrew has no lightweight plural rule for these, so both forms are spelled
 *  out rather than concatenating a suffix. */
export function patientCount(n: number): string {
  if (n === 0) return "אין מטופלים";
  if (n === 1) return "מטופל אחד";
  return `${n} מטופלים`;
}

export function taskCount(n: number): string {
  if (n === 0) return "אין משימות פתוחות";
  if (n === 1) return "משימה פתוחה אחת";
  return `${n} משימות פתוחות`;
}
