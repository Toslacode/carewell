/* ===========================================================================
   Ward store — ported from lib/store/ward-store.tsx.

   Two rules make the merge safe to run repeatedly while the doctor is still
   talking:
     1. Nothing is ever removed. The AI only adds.
     2. Text already present in a section is not added again.

   And one gate: nothing the AI produced is part of the record until
   ״אישור סבב״ promotes the draft.
   =========================================================================== */

const ward = buildDemoWard();

const norm = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();

function readList(data, path) {
  if (path.startsWith("tests.")) return data.tests[path.slice(6)];
  return data[path];
}

function writeList(data, path, items) {
  if (path.startsWith("tests.")) data.tests[path.slice(6)] = items;
  else data[path] = items;
}

function mergeInto(existing, incoming, stamp) {
  const seen = new Set(existing.map((i) => norm(i.text)));
  const fresh = [];
  for (const text of incoming) {
    const key = norm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push({ id: nid("c"), text: text.trim(), source: "ai", addedAt: stamp });
  }
  return { items: fresh.length ? existing.concat(fresh) : existing, added: fresh.length };
}

const LIST_PATHS = [
  ["chiefComplaint", "chiefComplaint"],
  ["pastMedicalHistory", "pastMedicalHistory"],
  ["socialStatus", "socialStatus"],
  ["tests.physicalExam", null],
  ["tests.labs", null],
  ["tests.imaging", null],
  ["tests.otherTests", null],
  ["workingDiagnosis", "workingDiagnosis"],
  ["treatmentPlan", "treatmentPlan"],
  ["other", "other"],
];

function incomingFor(extraction, path) {
  if (path.startsWith("tests.")) return extraction.tests[path.slice(6)];
  return extraction[path];
}

/** The whole merge, mutating the patient's draft in place. Returns the section
 *  paths that gained content so the UI can flash them. */
function applyExtractionTo(patient, extraction) {
  const stamp = Date.now();
  const touched = [];
  const data = patient.draftClinicalData;

  for (const [path] of LIST_PATHS) {
    const { items, added } = mergeInto(readList(data, path), incomingFor(extraction, path), stamp);
    if (added > 0) {
      writeList(data, path, items);
      touched.push(path);
    }
  }

  // Vitals overwrite rather than accumulate: the latest spoken value for a
  // vital IS the current value, and a stack of temperatures helps nobody.
  for (const key of VITAL_ORDER) {
    const value = extraction.vitals[key];
    if (!value) continue;
    if (data.vitals[key] && data.vitals[key].value === value) continue;
    data.vitals[key] = { value, source: "ai", addedAt: stamp };
    if (!touched.includes("vitals")) touched.push("vitals");
  }

  // Uncertain content — surfaced, never guessed at and never dropped.
  const reviewSeen = new Set(data.needsReview.map((r) => norm(r.text)));
  for (const r of extraction.needsReview) {
    if (reviewSeen.has(norm(r.text))) continue;
    reviewSeen.add(norm(r.text));
    data.needsReview.push({ id: nid("r"), text: r.text, reason: r.reason });
    if (!touched.includes("needsReview")) touched.push("needsReview");
  }

  // Tasks. Priority comes from derivePriority() — code, not the model.
  const taskSeen = new Set(patient.draftTasks.map((t) => norm(t.title)));
  for (const t of extraction.tasks) {
    if (taskSeen.has(norm(t.title))) continue;
    taskSeen.add(norm(t.title));
    patient.draftTasks.push({
      id: nid("t"),
      patientId: patient.id,
      title: t.title,
      category: t.category,
      priority: derivePriority(t.timing),
      status: "pending",
      timing: t.timing,
      createdFrom: "round",
      addedAt: stamp,
    });
    if (!touched.includes("tasks")) touched.push("tasks");
  }

  const consultSeen = new Set(patient.draftConsultations.map((c) => norm(c.specialty)));
  for (const c of extraction.consultations) {
    if (consultSeen.has(norm(c.specialty))) continue;
    consultSeen.add(norm(c.specialty));
    patient.draftConsultations.push({
      id: nid("k"),
      patientId: patient.id,
      specialty: c.specialty,
      state: "required",
      reason: c.reason,
      createdFrom: "round",
    });
    if (!touched.includes("consultations")) touched.push("consultations");
  }

  const discharge = patient.draftDischarge;
  if (extraction.discharge.status !== "unknown" && discharge.status !== extraction.discharge.status) {
    discharge.status = extraction.discharge.status;
    touched.push("discharge");
  }
  const blockerSeen = new Set(discharge.blockers.map((b) => norm(b.text)));
  for (const text of extraction.discharge.blockers) {
    if (blockerSeen.has(norm(text))) continue;
    blockerSeen.add(norm(text));
    discharge.blockers.push({ id: nid("b"), text, resolved: false });
    if (!touched.includes("discharge")) touched.push("discharge");
  }

  return touched;
}

/* ---------------------------------------------------------------- lifecycle */

function getPatient(id) {
  return ward.patients[id];
}
function getRoom(id) {
  return ward.rooms.find((r) => r.id === id);
}
function roomPatients(roomId) {
  const room = getRoom(roomId);
  if (!room) return [];
  return room.patientIds.map((id) => ward.patients[id]).filter(Boolean);
}

function openTaskCount(patient) {
  const tasks = patient.draftClinicalData ? patient.draftTasks : patient.tasks;
  return tasks.filter((t) => t.status !== "done").length;
}

function summariseRoom(room) {
  const list = room.patientIds.map((id) => ward.patients[id]).filter(Boolean);
  let openTasks = 0;
  let urgentTasks = 0;
  let possibleDischarges = 0;
  for (const p of list) {
    const tasks = p.draftClinicalData ? p.draftTasks : p.tasks;
    for (const t of tasks) {
      if (t.status === "done") continue;
      openTasks += 1;
      if (t.priority === "urgent") urgentTasks += 1;
    }
    const d = (p.draftClinicalData ? p.draftDischarge : p.discharge) ?? p.discharge;
    if (d.status === "today" || d.status === "tomorrow") possibleDischarges += 1;
  }
  return { patients: list.length, openTasks, urgentTasks, possibleDischarges };
}

/** Opens a draft. From here until approve or discard, every change lands in the
 *  draft copy and the record itself is untouched. */
function startRound(patientId) {
  const p = getPatient(patientId);
  if (!p) return;
  if (p.draftClinicalData) return;
  p.draftClinicalData = cloneClinicalData(p.approvedClinicalData);
  p.draftTasks = p.tasks.map((t) => ({ ...t }));
  p.draftConsultations = p.consultations.map((c) => ({ ...c }));
  p.draftDischarge = {
    status: p.discharge.status,
    blockers: p.discharge.blockers.map((b) => ({ ...b })),
  };
}

function discardRound(patientId) {
  const p = getPatient(patientId);
  if (!p) return;
  p.draftClinicalData = null;
  p.draftTasks = [];
  p.draftConsultations = [];
  p.draftDischarge = null;
  p.lastTranscript = null;
}

/** The review gate. Everything the AI produced has been sitting in the draft
 *  marked as such; this is the only path by which it becomes the record. */
function approveRound(patientId) {
  const p = getPatient(patientId);
  if (!p || !p.draftClinicalData || !p.draftDischarge) return;

  const promote = (items) => items.map((i) => ({ id: i.id, text: i.text, source: "approved" }));
  const d = p.draftClinicalData;

  const vitals = {};
  for (const key of VITAL_ORDER) {
    vitals[key] = d.vitals[key] ? { value: d.vitals[key].value, source: "approved" } : null;
  }

  p.approvedClinicalData = {
    chiefComplaint: promote(d.chiefComplaint),
    pastMedicalHistory: promote(d.pastMedicalHistory),
    socialStatus: promote(d.socialStatus),
    vitals,
    tests: {
      physicalExam: promote(d.tests.physicalExam),
      labs: promote(d.tests.labs),
      imaging: promote(d.tests.imaging),
      otherTests: promote(d.tests.otherTests),
    },
    workingDiagnosis: promote(d.workingDiagnosis),
    treatmentPlan: promote(d.treatmentPlan),
    other: promote(d.other),
    // Unresolved uncertainty survives approval. It is a standing flag, not
    // something the approve button is allowed to sweep away.
    needsReview: d.needsReview.map((r) => ({ ...r })),
  };

  p.tasks = p.draftTasks.map((t) => ({ ...t }));
  p.consultations = p.draftConsultations.map((c) => ({ ...c }));
  p.discharge = {
    status: p.draftDischarge.status,
    blockers: p.draftDischarge.blockers.map((b) => ({ ...b })),
  };

  const openUrgent = p.tasks.some((t) => t.priority === "urgent" && t.status !== "done");
  if (p.discharge.status === "today" || p.discharge.status === "tomorrow") {
    p.status = p.discharge.blockers.some((b) => !b.resolved) ? "monitoring" : "discharge-possible";
  }
  if (openUrgent) p.status = "attention";

  p.draftClinicalData = null;
  p.draftTasks = [];
  p.draftConsultations = [];
  p.draftDischarge = null;
  p.lastRoundAt = Date.now();
}

/* ----------------------------------------------------------- per-item edits */

function activeData(p) {
  return p.draftClinicalData ?? p.approvedClinicalData;
}
function activeTasks(p) {
  return p.draftClinicalData ? p.draftTasks : p.tasks;
}
function activeConsults(p) {
  return p.draftClinicalData ? p.draftConsultations : p.consultations;
}
function activeDischarge(p) {
  return (p.draftClinicalData ? p.draftDischarge : p.discharge) ?? p.discharge;
}

function editItem(p, path, id, text) {
  const list = readList(activeData(p), path);
  const found = list.find((i) => i.id === id);
  if (found) found.text = text.trim();
}
function deleteItem(p, path, id) {
  const data = activeData(p);
  writeList(data, path, readList(data, path).filter((i) => i.id !== id));
}
function addItem(p, path, text) {
  const t = text.trim();
  if (!t) return;
  readList(activeData(p), path).push({ id: nid("c"), text: t, source: "manual", addedAt: Date.now() });
}
function setVital(p, key, text) {
  const t = text.trim();
  activeData(p).vitals[key] = t ? { value: t, source: "manual", addedAt: Date.now() } : null;
}
function dismissReview(p, id) {
  const data = activeData(p);
  data.needsReview = data.needsReview.filter((r) => r.id !== id);
}
/** A consult ordered mid-round starts as "נדרש": ordering it is a separate act
 *  from having asked for it, and the panel makes that step explicit. */
function addConsult(p, specialty) {
  const clean = specialty.trim();
  if (!clean) return;
  activeConsults(p).push({
    id: nid("k"),
    patientId: p.id,
    specialty: clean,
    state: "required",
    reason: null,
    createdFrom: "manual",
  });
}
function deleteConsult(p, id) {
  if (p.draftClinicalData) p.draftConsultations = p.draftConsultations.filter((c) => c.id !== id);
  else p.consultations = p.consultations.filter((c) => c.id !== id);
}
function addBlocker(p, text) {
  const clean = text.trim();
  if (!clean) return;
  activeDischarge(p).blockers.push({ id: nid("b"), text: clean, resolved: false });
}
function deleteBlocker(p, id) {
  const d = activeDischarge(p);
  d.blockers = d.blockers.filter((b) => b.id !== id);
}

function moveReviewToOther(p, id) {
  const data = activeData(p);
  const entry = data.needsReview.find((r) => r.id === id);
  if (!entry) return;
  data.other.push({ id: nid("c"), text: entry.text, source: "manual", addedAt: Date.now() });
  data.needsReview = data.needsReview.filter((r) => r.id !== id);
}
