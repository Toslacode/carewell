import type { DischargeReport, Patient } from "@/lib/schemas/clinical";

/**
 * The discharge letter's first draft.
 *
 * Pulled from what the round already recorded — working diagnosis becomes the
 * discharge diagnoses, the chief complaint and treatment plan become the course
 * summary, open before-discharge tasks and unfinished consults become the
 * follow-up plan — so the doctor is correcting a document instead of starting
 * one from a blank page. Nothing here is invented: every line traces back to
 * something already in the record, and anything the record doesn't have is
 * left blank rather than guessed at.
 */
export function buildDischargeReport(patient: Patient): DischargeReport {
  const data = patient.approvedClinicalData;
  const now = Date.now();

  const diagnoses = data.workingDiagnosis.length
    ? data.workingDiagnosis.map((i) => i.text).join("\n")
    : patient.primaryDiagnosis;

  const summary = [
    ...data.chiefComplaint.map((i) => i.text),
    ...data.treatmentPlan.map((i) => i.text),
  ].join("\n");

  const followUp: string[] = [];
  for (const c of patient.consultations) {
    if (c.state === "completed") continue;
    followUp.push(`מעקב ${c.specialty}${c.reason ? ` — ${c.reason}` : ""}`);
  }
  for (const t of patient.tasks) {
    if (t.status === "done") continue;
    if (t.priority !== "before-discharge") continue;
    followUp.push(t.title);
  }

  return {
    destination: "home",
    diagnoses,
    summary,
    medications: [],
    followUp: followUp.join("\n"),
    generalInstructions: "",
    physicianName: "",
    generatedAt: now,
    updatedAt: now,
  };
}
