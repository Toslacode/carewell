"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ClinicalData,
  type ClinicalItem,
  type Consultation,
  type DischargeReport,
  type DischargeStatus,
  type Extraction,
  type Patient,
  type PatientDetails,
  type PatientStatus,
  type Room,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type VitalKey,
  cloneClinicalData,
  derivePriority,
  newId,
  newPatient,
} from "@/lib/schemas/clinical";
import { type WardData, buildDemoWard } from "@/lib/demo-data/ward";

/* ===========================================================================
   Addressing a single line in the record.

   Editing is per-item by design: a doctor correcting one misheard value should
   never have to retype a section.
   =========================================================================== */

export type ListPath =
  | "chiefComplaint"
  | "pastMedicalHistory"
  | "socialStatus"
  | "workingDiagnosis"
  | "treatmentPlan"
  | "other"
  | "tests.physicalExam"
  | "tests.labs"
  | "tests.imaging"
  | "tests.otherTests";

function readList(data: ClinicalData, path: ListPath): ClinicalItem[] {
  if (path.startsWith("tests.")) {
    const key = path.slice(6) as keyof ClinicalData["tests"];
    return data.tests[key];
  }
  return data[path as Exclude<ListPath, `tests.${string}`>] as ClinicalItem[];
}

function writeList(
  data: ClinicalData,
  path: ListPath,
  items: ClinicalItem[],
): ClinicalData {
  if (path.startsWith("tests.")) {
    const key = path.slice(6) as keyof ClinicalData["tests"];
    return { ...data, tests: { ...data.tests, [key]: items } };
  }
  return { ...data, [path]: items };
}

/* ===========================================================================
   Merging an extraction into the working draft.

   Two rules make this safe to run repeatedly while the doctor is still
   talking:
     1. Nothing is ever removed. The AI only adds.
     2. Text already present in the section is not added again — the same
        sentence re-arriving in a later partial transcript must not duplicate
        the line.
   =========================================================================== */

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function mergeInto(
  existing: ClinicalItem[],
  incoming: string[],
  stamp: number,
): { items: ClinicalItem[]; added: number } {
  const seen = new Set(existing.map((i) => norm(i.text)));
  const fresh: ClinicalItem[] = [];
  for (const text of incoming) {
    const key = norm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push({ id: newId("c"), text: text.trim(), source: "ai", addedAt: stamp });
  }
  return { items: fresh.length ? [...existing, ...fresh] : existing, added: fresh.length };
}

export interface MergeResult {
  data: ClinicalData;
  tasks: Task[];
  consultations: Consultation[];
  discharge: Patient["discharge"];
  /** Section paths that gained content, so the UI can scroll to / flash them. */
  touched: string[];
}

function applyExtractionTo(
  patient: Patient,
  base: ClinicalData,
  baseTasks: Task[],
  baseConsults: Consultation[],
  baseDischarge: Patient["discharge"],
  extraction: Extraction,
): MergeResult {
  const stamp = Date.now();
  const touched: string[] = [];
  let data = base;

  const lists: Array<[ListPath, string[]]> = [
    ["chiefComplaint", extraction.chiefComplaint],
    ["pastMedicalHistory", extraction.pastMedicalHistory],
    ["socialStatus", extraction.socialStatus],
    ["tests.physicalExam", extraction.tests.physicalExam],
    ["tests.labs", extraction.tests.labs],
    ["tests.imaging", extraction.tests.imaging],
    ["tests.otherTests", extraction.tests.otherTests],
    ["workingDiagnosis", extraction.workingDiagnosis],
    ["treatmentPlan", extraction.treatmentPlan],
    ["other", extraction.other],
  ];

  for (const [path, incoming] of lists) {
    const { items, added } = mergeInto(readList(data, path), incoming, stamp);
    if (added > 0) {
      data = writeList(data, path, items);
      touched.push(path);
    }
  }

  // Vitals overwrite rather than accumulate: the latest spoken value for a
  // vital IS the current value, and a stack of temperatures helps nobody.
  const vitals = { ...data.vitals };
  let vitalsTouched = false;
  for (const key of Object.keys(extraction.vitals) as VitalKey[]) {
    const value = extraction.vitals[key];
    if (!value) continue;
    if (vitals[key]?.value === value) continue;
    vitals[key] = { value, source: "ai", addedAt: stamp };
    vitalsTouched = true;
  }
  if (vitalsTouched) {
    data = { ...data, vitals };
    touched.push("vitals");
  }

  // Uncertain content — surfaced, never guessed at and never dropped.
  const reviewSeen = new Set(data.needsReview.map((r) => norm(r.text)));
  const freshReview = extraction.needsReview
    .filter((r) => !reviewSeen.has(norm(r.text)))
    .map((r) => ({ id: newId("r"), text: r.text, reason: r.reason }));
  if (freshReview.length) {
    data = { ...data, needsReview: [...data.needsReview, ...freshReview] };
    touched.push("needsReview");
  }

  // Tasks. Priority comes from derivePriority() — code, not the model.
  const taskSeen = new Set(baseTasks.map((t) => norm(t.title)));
  const freshTasks: Task[] = [];
  for (const t of extraction.tasks) {
    if (taskSeen.has(norm(t.title))) continue;
    taskSeen.add(norm(t.title));
    freshTasks.push({
      id: newId("t"),
      patientId: patient.id,
      title: t.title,
      category: t.category,
      priority: derivePriority(t.timing),
      status: "pending",
      timing: t.timing,
      createdFrom: "round",
      createdAt: stamp,
    });
  }
  if (freshTasks.length) touched.push("tasks");

  const consultSeen = new Set(baseConsults.map((c) => norm(c.specialty)));
  const freshConsults: Consultation[] = [];
  for (const c of extraction.consultations) {
    if (consultSeen.has(norm(c.specialty))) continue;
    consultSeen.add(norm(c.specialty));
    freshConsults.push({
      id: newId("k"),
      patientId: patient.id,
      specialty: c.specialty,
      state: "required",
      reason: c.reason,
      createdFrom: "round",
    });
  }
  if (freshConsults.length) touched.push("consultations");

  let discharge = baseDischarge;
  if (extraction.discharge.status !== "unknown") {
    discharge = { ...discharge, status: extraction.discharge.status };
    touched.push("discharge");
  }
  const blockerSeen = new Set(discharge.blockers.map((b) => norm(b.text)));
  const freshBlockers = extraction.discharge.blockers
    .filter((b) => !blockerSeen.has(norm(b)))
    .map((text) => ({ id: newId("b"), text, resolved: false }));
  if (freshBlockers.length) {
    discharge = { ...discharge, blockers: [...discharge.blockers, ...freshBlockers] };
    if (!touched.includes("discharge")) touched.push("discharge");
  }

  return {
    data,
    tasks: freshTasks.length ? [...baseTasks, ...freshTasks] : baseTasks,
    consultations: freshConsults.length
      ? [...baseConsults, ...freshConsults]
      : baseConsults,
    discharge,
    touched,
  };
}

/* ===========================================================================
   Store
   =========================================================================== */

const STORAGE_KEY = "clario.ward.v1";

interface WardContextValue {
  rooms: Room[];
  patients: Record<string, Patient>;
  hydrated: boolean;

  getRoom: (roomId: string) => Room | undefined;
  getPatient: (patientId: string) => Patient | undefined;
  /** Patients currently occupying beds in the room. Excludes the discharged. */
  roomPatients: (roomId: string) => Patient[];
  /** Patients discharged from the room, newest first. */
  roomDischarged: (roomId: string) => Patient[];

  admitPatient: (roomId: string, details: PatientDetails) => string | null;
  updatePatientDetails: (patientId: string, details: PatientDetails) => void;
  dischargePatient: (patientId: string) => void;
  readmitPatient: (patientId: string) => void;
  deletePatient: (patientId: string) => void;
  saveDischargeReport: (patientId: string, report: DischargeReport) => void;

  startRound: (patientId: string) => void;
  applyExtraction: (patientId: string, extraction: Extraction) => string[];
  discardRound: (patientId: string) => void;
  approveRound: (patientId: string) => void;
  setTranscript: (patientId: string, transcript: string) => void;

  editItem: (patientId: string, path: ListPath, itemId: string, text: string) => void;
  deleteItem: (patientId: string, path: ListPath, itemId: string) => void;
  addItem: (patientId: string, path: ListPath, text: string) => void;
  setVital: (patientId: string, key: VitalKey, value: string | null) => void;
  dismissReview: (patientId: string, reviewId: string) => void;
  moveReviewToOther: (patientId: string, reviewId: string) => void;

  setTaskStatus: (patientId: string, taskId: string, status: TaskStatus) => void;
  setTaskPriority: (patientId: string, taskId: string, priority: TaskPriority) => void;
  editTaskTitle: (patientId: string, taskId: string, title: string) => void;
  deleteTask: (patientId: string, taskId: string) => void;
  addTask: (patientId: string, title: string, priority: TaskPriority) => void;

  setConsultState: (patientId: string, consultId: string, state: Consultation["state"]) => void;
  addConsult: (patientId: string, specialty: string, reason?: string | null) => void;
  editConsult: (patientId: string, consultId: string, specialty: string) => void;
  deleteConsult: (patientId: string, consultId: string) => void;
  addBlocker: (patientId: string, text: string) => void;
  editBlocker: (patientId: string, blockerId: string, text: string) => void;
  deleteBlocker: (patientId: string, blockerId: string) => void;
  setDischargeStatus: (patientId: string, status: DischargeStatus) => void;
  toggleBlocker: (patientId: string, blockerId: string) => void;

  resetWard: () => void;
}

const WardContext = createContext<WardContextValue | null>(null);

export function WardProvider({ children }: { children: React.ReactNode }) {
  const [ward, setWard] = useState<WardData>(() => buildDemoWard());
  const [hydrated, setHydrated] = useState(false);

  // Persisted demo state is restored after mount, never during render, so the
  // server and client agree on the first paint.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WardData;
        if (parsed?.rooms?.length && parsed?.patients) setWard(parsed);
      }
    } catch {
      // A corrupt or unreadable entry is not worth failing the app over —
      // the demo ward is a perfectly good starting point.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ward));
    } catch {
      // Quota or private-mode failure. State stays in memory for the session.
    }
  }, [ward, hydrated]);

  const update = useCallback(
    (patientId: string, fn: (p: Patient) => Patient) => {
      setWard((prev) => {
        const patient = prev.patients[patientId];
        if (!patient) return prev;
        return {
          ...prev,
          patients: { ...prev.patients, [patientId]: fn(patient) },
        };
      });
    },
    [],
  );

  /* ------------------------------------------------------ patient lifecycle */

  /** Admit a patient into a room. Returns the new id, or null if the room is
   *  gone or out of service — a bed in a closed room is not a bed. */
  const admitPatient = useCallback(
    (roomId: string, details: PatientDetails): string | null => {
      const patient = newPatient(details, roomId);
      let admitted = false;
      setWard((prev) => {
        const room = prev.rooms.find((r) => r.id === roomId);
        if (!room || room.status === "unavailable") return prev;
        admitted = true;
        return {
          rooms: prev.rooms.map((r) =>
            r.id === roomId
              ? { ...r, status: "active", patientIds: [...r.patientIds, patient.id] }
              : r,
          ),
          patients: { ...prev.patients, [patient.id]: patient },
        };
      });
      return admitted ? patient.id : null;
    },
    [],
  );

  const updatePatientDetails = useCallback(
    (patientId: string, details: PatientDetails) => {
      update(patientId, (p) => ({
        ...p,
        name: details.name.trim() || p.name,
        age: details.age,
        idNumber: details.idNumber.trim(),
        hmo: details.hmo,
        bed: details.bed,
        hospitalDay: details.hospitalDay,
        primaryDiagnosis: details.primaryDiagnosis.trim(),
        status: details.status,
      }));
    },
    [update],
  );

  /** The patient leaves. The bed is freed and the room stops counting them;
   *  the record stays, so this can be undone and so a finished round is not
   *  erased by the act of sending someone home. */
  const dischargePatient = useCallback(
    (patientId: string) => {
      setWard((prev) => {
        const patient = prev.patients[patientId];
        if (!patient || patient.dischargedAt) return prev;
        return {
          rooms: prev.rooms.map((r) => {
            if (r.id !== patient.roomId) return r;
            const patientIds = r.patientIds.filter((id) => id !== patientId);
            return {
              ...r,
              patientIds,
              status: r.status === "unavailable"
                ? r.status
                : patientIds.length > 0
                  ? "active"
                  : "empty",
            };
          }),
          patients: {
            ...prev.patients,
            [patientId]: { ...patient, dischargedAt: Date.now() },
          },
        };
      });
    },
    [],
  );

  /** Undo a discharge — the patient goes back into the same bed. */
  const readmitPatient = useCallback(
    (patientId: string) => {
      setWard((prev) => {
        const patient = prev.patients[patientId];
        if (!patient || !patient.dischargedAt) return prev;
        const room = prev.rooms.find((r) => r.id === patient.roomId);
        if (!room || room.status === "unavailable") return prev;
        return {
          rooms: prev.rooms.map((r) =>
            r.id === patient.roomId
              ? {
                  ...r,
                  status: "active",
                  patientIds: r.patientIds.includes(patientId)
                    ? r.patientIds
                    : [...r.patientIds, patientId],
                }
              : r,
          ),
          patients: {
            ...prev.patients,
            [patientId]: { ...patient, dischargedAt: null },
          },
        };
      });
    },
    [],
  );

  /** Erase the record entirely — for one entered by mistake. Distinct from
   *  discharge, and irreversible, which is why the UI asks twice. */
  const deletePatient = useCallback((patientId: string) => {
    setWard((prev) => {
      const patient = prev.patients[patientId];
      if (!patient) return prev;
      const patients = { ...prev.patients };
      delete patients[patientId];
      return {
        rooms: prev.rooms.map((r) => {
          if (r.id !== patient.roomId) return r;
          const patientIds = r.patientIds.filter((id) => id !== patientId);
          return {
            ...r,
            patientIds,
            status: r.status === "unavailable"
              ? r.status
              : patientIds.length > 0
                ? "active"
                : "empty",
          };
        }),
        patients,
      };
    });
  }, []);

  /** Not part of the round's draft/approved split — a discharge letter isn't
   *  clinical findings under review, it's a document being written, and it
   *  stays editable exactly as long as the patient's record does. */
  const saveDischargeReport = useCallback(
    (patientId: string, report: DischargeReport) => {
      update(patientId, (p) => ({ ...p, dischargeReport: report }));
    },
    [update],
  );

  /** Draft edits target draftClinicalData when a round is open, and approved
   *  data otherwise — so the same edit controls work before and after a round
   *  without the doctor having to think about which mode they're in. */
  const editData = useCallback(
    (patientId: string, fn: (d: ClinicalData) => ClinicalData) => {
      update(patientId, (p) =>
        p.draftClinicalData
          ? { ...p, draftClinicalData: fn(p.draftClinicalData) }
          : { ...p, approvedClinicalData: fn(p.approvedClinicalData) },
      );
    },
    [update],
  );

  const startRound = useCallback(
    (patientId: string) => {
      update(patientId, (p) =>
        p.draftClinicalData
          ? p
          : {
              ...p,
              draftClinicalData: cloneClinicalData(p.approvedClinicalData),
              draftTasks: p.tasks.map((t) => ({ ...t })),
              draftConsultations: p.consultations.map((c) => ({ ...c })),
              draftDischarge: {
                status: p.discharge.status,
                blockers: p.discharge.blockers.map((b) => ({ ...b })),
              },
              lastTranscript: "",
            },
      );
    },
    [update],
  );

  const applyExtraction = useCallback(
    (patientId: string, extraction: Extraction): string[] => {
      let touched: string[] = [];
      setWard((prev) => {
        const p = prev.patients[patientId];
        if (!p || !p.draftClinicalData || !p.draftDischarge) return prev;
        const result = applyExtractionTo(
          p,
          p.draftClinicalData,
          p.draftTasks,
          p.draftConsultations,
          p.draftDischarge,
          extraction,
        );
        touched = result.touched;
        if (touched.length === 0) return prev;
        return {
          ...prev,
          patients: {
            ...prev.patients,
            [patientId]: {
              ...p,
              draftClinicalData: result.data,
              draftTasks: result.tasks,
              draftConsultations: result.consultations,
              draftDischarge: result.discharge,
            },
          },
        };
      });
      return touched;
    },
    [],
  );

  const discardRound = useCallback(
    (patientId: string) => {
      update(patientId, (p) => ({
        ...p,
        draftClinicalData: null,
        draftTasks: [],
        draftConsultations: [],
        draftDischarge: null,
        lastTranscript: null,
      }));
    },
    [update],
  );

  /** The review gate. Everything the AI produced has been sitting in the draft
   *  marked as such; this is the only path by which it becomes the record. */
  const approveRound = useCallback(
    (patientId: string) => {
      update(patientId, (p) => {
        if (!p.draftClinicalData || !p.draftDischarge) return p;

        const promote = (items: ClinicalItem[]) =>
          items.map((i) => ({ id: i.id, text: i.text, source: "approved" as const }));

        const d = p.draftClinicalData;
        const approved: ClinicalData = {
          chiefComplaint: promote(d.chiefComplaint),
          pastMedicalHistory: promote(d.pastMedicalHistory),
          socialStatus: promote(d.socialStatus),
          vitals: Object.fromEntries(
            Object.entries(d.vitals).map(([k, v]) => [
              k,
              v ? { value: v.value, source: "approved" as const } : null,
            ]),
          ) as ClinicalData["vitals"],
          tests: {
            physicalExam: promote(d.tests.physicalExam),
            labs: promote(d.tests.labs),
            imaging: promote(d.tests.imaging),
            otherTests: promote(d.tests.otherTests),
          },
          workingDiagnosis: promote(d.workingDiagnosis),
          treatmentPlan: promote(d.treatmentPlan),
          other: promote(d.other),
          // Unresolved uncertainty survives approval. It is a standing flag,
          // not something the approve button is allowed to sweep away.
          needsReview: d.needsReview.map((r) => ({ ...r })),
        };

        const tasks = p.draftTasks.map((t) => ({ ...t, createdFrom: t.createdFrom }));
        const openUrgent = tasks.some(
          (t) => t.priority === "urgent" && t.status !== "done",
        );
        const discharge = p.draftDischarge;

        // Patient status follows the approved picture, but an explicit
        // "attention" set by a human is never downgraded automatically.
        let status: PatientStatus = p.status;
        if (discharge.status === "today" || discharge.status === "tomorrow") {
          status = discharge.blockers.some((b) => !b.resolved)
            ? "monitoring"
            : "discharge-possible";
        }
        if (openUrgent) status = "attention";

        return {
          ...p,
          approvedClinicalData: approved,
          draftClinicalData: null,
          tasks,
          draftTasks: [],
          consultations: p.draftConsultations.map((c) => ({ ...c })),
          draftConsultations: [],
          discharge: {
            status: discharge.status,
            blockers: discharge.blockers.map((b) => ({ ...b })),
          },
          draftDischarge: null,
          status,
          lastRoundAt: Date.now(),
        };
      });
    },
    [update],
  );

  const setTranscript = useCallback(
    (patientId: string, transcript: string) => {
      update(patientId, (p) => ({ ...p, lastTranscript: transcript }));
    },
    [update],
  );

  const editItem = useCallback(
    (patientId: string, path: ListPath, itemId: string, text: string) => {
      editData(patientId, (d) =>
        writeList(
          d,
          path,
          readList(d, path).map((i) =>
            i.id === itemId ? { ...i, text, source: "manual", addedAt: undefined } : i,
          ),
        ),
      );
    },
    [editData],
  );

  const deleteItem = useCallback(
    (patientId: string, path: ListPath, itemId: string) => {
      editData(patientId, (d) =>
        writeList(
          d,
          path,
          readList(d, path).filter((i) => i.id !== itemId),
        ),
      );
    },
    [editData],
  );

  const addItem = useCallback(
    (patientId: string, path: ListPath, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      editData(patientId, (d) =>
        writeList(d, path, [
          ...readList(d, path),
          { id: newId("c"), text: clean, source: "manual" },
        ]),
      );
    },
    [editData],
  );

  const setVital = useCallback(
    (patientId: string, key: VitalKey, value: string | null) => {
      editData(patientId, (d) => ({
        ...d,
        vitals: {
          ...d.vitals,
          [key]: value?.trim() ? { value: value.trim(), source: "manual" } : null,
        },
      }));
    },
    [editData],
  );

  const dismissReview = useCallback(
    (patientId: string, reviewId: string) => {
      editData(patientId, (d) => ({
        ...d,
        needsReview: d.needsReview.filter((r) => r.id !== reviewId),
      }));
    },
    [editData],
  );

  /** Accept an uncertain fragment as a free-text note rather than discarding
   *  it — the "put it somewhere honest" escape hatch. */
  const moveReviewToOther = useCallback(
    (patientId: string, reviewId: string) => {
      editData(patientId, (d) => {
        const entry = d.needsReview.find((r) => r.id === reviewId);
        if (!entry) return d;
        return {
          ...d,
          other: [...d.other, { id: newId("c"), text: entry.text, source: "manual" }],
          needsReview: d.needsReview.filter((r) => r.id !== reviewId),
        };
      });
    },
    [editData],
  );

  const mapTasks = useCallback(
    (patientId: string, fn: (tasks: Task[]) => Task[]) => {
      update(patientId, (p) =>
        p.draftClinicalData
          ? { ...p, draftTasks: fn(p.draftTasks) }
          : { ...p, tasks: fn(p.tasks) },
      );
    },
    [update],
  );

  const setTaskStatus = useCallback(
    (patientId: string, taskId: string, status: TaskStatus) => {
      mapTasks(patientId, (tasks) =>
        tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
    },
    [mapTasks],
  );

  const setTaskPriority = useCallback(
    (patientId: string, taskId: string, priority: TaskPriority) => {
      mapTasks(patientId, (tasks) =>
        tasks.map((t) => (t.id === taskId ? { ...t, priority } : t)),
      );
    },
    [mapTasks],
  );

  const editTaskTitle = useCallback(
    (patientId: string, taskId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      mapTasks(patientId, (tasks) =>
        tasks.map((t) => (t.id === taskId ? { ...t, title: clean } : t)),
      );
    },
    [mapTasks],
  );

  const deleteTask = useCallback(
    (patientId: string, taskId: string) => {
      mapTasks(patientId, (tasks) => tasks.filter((t) => t.id !== taskId));
    },
    [mapTasks],
  );

  const addTask = useCallback(
    (patientId: string, title: string, priority: TaskPriority) => {
      const clean = title.trim();
      if (!clean) return;
      mapTasks(patientId, (tasks) => [
        ...tasks,
        {
          id: newId("t"),
          patientId,
          title: clean,
          category: "other",
          priority,
          status: "pending",
          timing: null,
          createdFrom: "manual",
          createdAt: Date.now(),
        },
      ]);
    },
    [mapTasks],
  );

  const setConsultState = useCallback(
    (patientId: string, consultId: string, state: Consultation["state"]) => {
      update(patientId, (p) => {
        const apply = (list: Consultation[]) =>
          list.map((c) => (c.id === consultId ? { ...c, state } : c));
        return p.draftClinicalData
          ? { ...p, draftConsultations: apply(p.draftConsultations) }
          : { ...p, consultations: apply(p.consultations) };
      });
    },
    [update],
  );

  /** A consult ordered mid-round. It starts as "נדרש" — ordering it is a
   *  separate act from having asked for it, and the panel makes that step
   *  explicit rather than assuming it. */
  const addConsult = useCallback(
    (patientId: string, specialty: string, reason: string | null = null) => {
      const clean = specialty.trim();
      if (!clean) return;
      update(patientId, (p) => {
        const entry: Consultation = {
          id: newId("k"),
          patientId,
          specialty: clean,
          state: "required",
          reason: reason?.trim() || null,
          createdFrom: "manual",
        };
        return p.draftClinicalData
          ? { ...p, draftConsultations: [...p.draftConsultations, entry] }
          : { ...p, consultations: [...p.consultations, entry] };
      });
    },
    [update],
  );

  const editConsult = useCallback(
    (patientId: string, consultId: string, specialty: string) => {
      const clean = specialty.trim();
      if (!clean) return;
      update(patientId, (p) => {
        const apply = (list: Consultation[]) =>
          list.map((c) => (c.id === consultId ? { ...c, specialty: clean } : c));
        return p.draftClinicalData
          ? { ...p, draftConsultations: apply(p.draftConsultations) }
          : { ...p, consultations: apply(p.consultations) };
      });
    },
    [update],
  );

  const deleteConsult = useCallback(
    (patientId: string, consultId: string) => {
      update(patientId, (p) => {
        const drop = (list: Consultation[]) => list.filter((c) => c.id !== consultId);
        return p.draftClinicalData
          ? { ...p, draftConsultations: drop(p.draftConsultations) }
          : { ...p, consultations: drop(p.consultations) };
      });
    },
    [update],
  );

  const addBlocker = useCallback(
    (patientId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      update(patientId, (p) => {
        const add = (d: Patient["discharge"]) => ({
          ...d,
          blockers: [...d.blockers, { id: newId("b"), text: clean, resolved: false }],
        });
        return p.draftDischarge
          ? { ...p, draftDischarge: add(p.draftDischarge) }
          : { ...p, discharge: add(p.discharge) };
      });
    },
    [update],
  );

  const editBlocker = useCallback(
    (patientId: string, blockerId: string, text: string) => {
      const clean = text.trim();
      if (!clean) return;
      update(patientId, (p) => {
        const apply = (d: Patient["discharge"]) => ({
          ...d,
          blockers: d.blockers.map((b) =>
            b.id === blockerId ? { ...b, text: clean } : b,
          ),
        });
        return p.draftDischarge
          ? { ...p, draftDischarge: apply(p.draftDischarge) }
          : { ...p, discharge: apply(p.discharge) };
      });
    },
    [update],
  );

  const deleteBlocker = useCallback(
    (patientId: string, blockerId: string) => {
      update(patientId, (p) => {
        const drop = (d: Patient["discharge"]) => ({
          ...d,
          blockers: d.blockers.filter((b) => b.id !== blockerId),
        });
        return p.draftDischarge
          ? { ...p, draftDischarge: drop(p.draftDischarge) }
          : { ...p, discharge: drop(p.discharge) };
      });
    },
    [update],
  );

  const setDischargeStatus = useCallback(
    (patientId: string, status: DischargeStatus) => {
      update(patientId, (p) =>
        p.draftDischarge
          ? { ...p, draftDischarge: { ...p.draftDischarge, status } }
          : { ...p, discharge: { ...p.discharge, status } },
      );
    },
    [update],
  );

  const toggleBlocker = useCallback(
    (patientId: string, blockerId: string) => {
      update(patientId, (p) => {
        const flip = (d: Patient["discharge"]) => ({
          ...d,
          blockers: d.blockers.map((b) =>
            b.id === blockerId ? { ...b, resolved: !b.resolved } : b,
          ),
        });
        return p.draftDischarge
          ? { ...p, draftDischarge: flip(p.draftDischarge) }
          : { ...p, discharge: flip(p.discharge) };
      });
    },
    [update],
  );

  const resetWard = useCallback(() => {
    const fresh = buildDemoWard();
    setWard(fresh);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing useful to do */
    }
  }, []);

  const value = useMemo<WardContextValue>(
    () => ({
      rooms: ward.rooms,
      patients: ward.patients,
      hydrated,
      getRoom: (roomId) => ward.rooms.find((r) => r.id === roomId),
      getPatient: (patientId) => ward.patients[patientId],
      roomPatients: (roomId) => {
        const room = ward.rooms.find((r) => r.id === roomId);
        if (!room) return [];
        return room.patientIds
          .map((pid) => ward.patients[pid])
          .filter((p) => p && !p.dischargedAt)
          .sort((a, b) => a.bed - b.bed);
      },
      roomDischarged: (roomId) =>
        Object.values(ward.patients)
          .filter((p) => p.roomId === roomId && p.dischargedAt)
          .sort((a, b) => (b.dischargedAt ?? 0) - (a.dischargedAt ?? 0)),
      admitPatient,
      updatePatientDetails,
      dischargePatient,
      readmitPatient,
      deletePatient,
      saveDischargeReport,
      startRound,
      applyExtraction,
      discardRound,
      approveRound,
      setTranscript,
      editItem,
      deleteItem,
      addItem,
      setVital,
      dismissReview,
      moveReviewToOther,
      setTaskStatus,
      setTaskPriority,
      editTaskTitle,
      deleteTask,
      addTask,
      setConsultState,
      addConsult,
      editConsult,
      deleteConsult,
      addBlocker,
      editBlocker,
      deleteBlocker,
      setDischargeStatus,
      toggleBlocker,
      resetWard,
    }),
    [
      ward,
      hydrated,
      admitPatient,
      updatePatientDetails,
      dischargePatient,
      readmitPatient,
      deletePatient,
      saveDischargeReport,
      startRound,
      applyExtraction,
      discardRound,
      approveRound,
      setTranscript,
      editItem,
      deleteItem,
      addItem,
      setVital,
      dismissReview,
      moveReviewToOther,
      setTaskStatus,
      setTaskPriority,
      editTaskTitle,
      deleteTask,
      addTask,
      setConsultState,
      addConsult,
      editConsult,
      deleteConsult,
      addBlocker,
      editBlocker,
      deleteBlocker,
      setDischargeStatus,
      toggleBlocker,
      resetWard,
    ],
  );

  return <WardContext.Provider value={value}>{children}</WardContext.Provider>;
}

export function useWard(): WardContextValue {
  const ctx = useContext(WardContext);
  if (!ctx) throw new Error("useWard must be used inside <WardProvider>");
  return ctx;
}

/* ===========================================================================
   Derived views
   =========================================================================== */

export interface RoomSummary {
  patients: number;
  openTasks: number;
  urgentTasks: number;
  possibleDischarges: number;
  needsAttention: boolean;
}

export function summariseRoom(room: Room, patients: Record<string, Patient>): RoomSummary {
  const list = room.patientIds
    .map((id) => patients[id])
    .filter((p) => p && !p.dischargedAt);
  let openTasks = 0;
  let urgentTasks = 0;
  let possibleDischarges = 0;
  let needsAttention = false;

  for (const p of list) {
    for (const t of p.tasks) {
      if (t.status === "done") continue;
      openTasks += 1;
      if (t.priority === "urgent") urgentTasks += 1;
    }
    if (p.discharge.status === "today" || p.discharge.status === "tomorrow") {
      possibleDischarges += 1;
    }
    if (p.status === "attention") needsAttention = true;
  }

  return {
    patients: list.length,
    openTasks,
    urgentTasks,
    possibleDischarges,
    needsAttention: needsAttention || urgentTasks > 0,
  };
}

export function openTaskCount(patient: Patient): number {
  return patient.tasks.filter((t) => t.status !== "done").length;
}
