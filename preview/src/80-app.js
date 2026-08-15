/* ===========================================================================
   Wiring.

   One delegated click handler for the whole application, plus keyboard handling
   for the inline editors. Every mutation goes through the store functions in
   30-store.js, so the draft/approve boundary holds no matter which control was
   pressed.
   =========================================================================== */

function commitEditor(input) {
  const target = state.editing;
  if (!target || !input) return;
  const text = input.value.trim();
  const p = getPatient(state.patientId);
  state.editing = null;
  if (!p) return;

  if (text) {
    if (target.kind === "item") editItem(p, target.path, target.id, text);
    else if (target.kind === "add") addItem(p, target.path, text);
    else if (target.kind === "vital") setVital(p, target.key, text);
    else if (target.kind === "task") {
      const t = activeTasks(p).find((x) => x.id === target.id);
      if (t) t.title = text;
    } else if (target.kind === "addTask") {
      // A manually typed task has no spoken timing to derive from, so it starts
      // explicitly undefined rather than being guessed at.
      activeTasks(p).push({
        id: nid("t"),
        patientId: p.id,
        title: text,
        category: "other",
        priority: "unset",
        status: "pending",
        timing: null,
        createdFrom: "manual",
        addedAt: Date.now(),
      });
    }
  } else if (target.kind === "vital") {
    setVital(p, target.key, "");
  }

  refreshRecord();
}

function cancelEditor() {
  state.editing = null;
  refreshRecord();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (state.assistantOpen) {
      state.assistantOpen = false;
      refreshAssistant();
      return;
    }
    if (state.settingsOpen) {
      state.settingsOpen = false;
      refreshUtility();
      return;
    }
  }

  const ask = e.target.closest && e.target.closest("#assistant-input");
  if (ask) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = ask.value;
      ask.value = "";
      submitQuestion(value);
    }
    return;
  }

  const input = e.target.closest && e.target.closest('input[data-editor="1"]');
  if (!input) return;
  if (e.key === "Enter") {
    e.preventDefault();
    commitEditor(input);
  }
  if (e.key === "Escape") {
    e.preventDefault();
    cancelEditor();
  }
});

/**
 * Double-click to edit.
 *
 * The pencil is the discoverable path; this is the fast one. A doctor correcting
 * a mis-heard creatinine mid-round should be able to hit the number itself
 * rather than aim for a 15px icon that only appears on hover.
 */
document.addEventListener("dblclick", (e) => {
  const p = getPatient(state.patientId);
  if (!p) return;

  const line = e.target.closest && e.target.closest(".item");
  if (line) {
    const row = line.querySelector("[data-edit-item]");
    if (row) {
      state.editing = {
        kind: "item",
        path: row.getAttribute("data-path"),
        id: row.getAttribute("data-edit-item"),
      };
      refreshRecord();
      return;
    }
  }

  const vital = e.target.closest && e.target.closest(".vital");
  if (vital) {
    const key = vital.querySelector("[data-edit-vital]");
    if (key) {
      state.editing = { kind: "vital", key: key.getAttribute("data-edit-vital") };
      refreshRecord();
      return;
    }
  }

  const task = e.target.closest && e.target.closest(".task-row .title");
  if (task) {
    const row = task.closest("li").querySelector("[data-edit-task]");
    if (row) {
      state.editing = { kind: "task", id: row.getAttribute("data-edit-task") };
      refreshRecord();
    }
  }
});

// Save on blur, unless the blur was caused by pressing the save button itself.
document.addEventListener(
  "blur",
  (e) => {
    const input = e.target;
    if (!input.matches || !input.matches('input[data-editor="1"]')) return;
    setTimeout(() => {
      if (state.editing && document.activeElement !== input) commitEditor(input);
    }, 120);
  },
  true,
);

document.addEventListener("click", (e) => {
  const t = e.target;
  const hit = (attr) => {
    const node = t.closest(`[${attr}]`);
    return node ? node.getAttribute(attr) : null;
  };

  /* --------------------------------------------------- settings + assistant */
  const settings = hit("data-settings");
  if (settings) {
    if (settings === "toggle") state.settingsOpen = !state.settingsOpen;
    if (settings === "restart") {
      // A demo that cannot be put back is a demo you only get to run once.
      const fresh = buildDemoWard();
      ward.rooms = fresh.rooms;
      ward.patients = fresh.patients;
      state.settingsOpen = false;
      state.chat = [];
      cancelRound();
      go("rooms");
      return;
    }
    if (settings === "logout") {
      state.settingsOpen = false;
      state.assistantOpen = false;
      cancelRound();
      go("open");
      return;
    }
    refreshUtility();
    return;
  }

  const pref = hit("data-pref");
  if (pref) {
    if (pref === "theme") prefs.theme = prefs.theme === "dark" ? "light" : "dark";
    if (pref === "motion") prefs.calmMotion = !prefs.calmMotion;
    applyPrefs();
    refreshUtility();
    return;
  }

  if (state.settingsOpen && !t.closest(".utility")) {
    state.settingsOpen = false;
    refreshUtility();
  }

  const assistant = hit("data-assistant");
  if (assistant) {
    if (assistant === "open") {
      state.assistantOpen = true;
      state.settingsOpen = false;
      refreshUtility();
      refreshAssistant();
    } else if (assistant === "close") {
      state.assistantOpen = false;
      refreshAssistant();
    } else if (assistant === "send") {
      const input = document.getElementById("assistant-input");
      if (input) {
        const value = input.value;
        input.value = "";
        submitQuestion(value);
      }
    }
    return;
  }

  const suggested = hit("data-ask");
  if (suggested) {
    submitQuestion(suggested);
    return;
  }

  if (t.closest("[data-close-assistant]")) {
    state.assistantOpen = false;
  }

  /* ------------------------------------------------------------ navigation */
  if (t.closest("[data-enter]")) {
    enterWard();
    return;
  }
  const goTo = hit("data-go");
  if (goTo) {
    if (goTo.startsWith("room:")) go("room", goTo.slice(5));
    else go(goTo);
    return;
  }
  const roomNode = t.closest("[data-room]");
  if (roomNode) {
    enterRoom(roomNode.getAttribute("data-room"), Number(roomNode.getAttribute("data-room-number")), roomNode);
    return;
  }
  const patientId = hit("data-patient");
  if (patientId && !t.closest("[data-board-status]")) {
    go("patient", patientId);
    return;
  }
  const filter = hit("data-filter");
  if (filter) {
    state.taskFilter = filter;
    render();
    return;
  }

  const p = getPatient(state.patientId);

  /* --------------------------------------------------------------- editors */
  if (t.closest("[data-save]")) {
    commitEditor(document.querySelector('input[data-editor="1"]'));
    return;
  }
  const editItemId = hit("data-edit-item");
  if (editItemId) {
    state.editing = { kind: "item", path: t.closest("[data-path]").getAttribute("data-path"), id: editItemId };
    refreshRecord();
    return;
  }
  const delItemId = hit("data-del-item");
  if (delItemId && p) {
    deleteItem(p, t.closest("[data-path]").getAttribute("data-path"), delItemId);
    refreshRecord();
    return;
  }
  const addPath = hit("data-add-item");
  if (addPath) {
    state.editing = { kind: "add", path: addPath };
    refreshRecord();
    return;
  }
  const vitalKey = hit("data-edit-vital");
  if (vitalKey) {
    state.editing = { kind: "vital", key: vitalKey };
    refreshRecord();
    return;
  }

  /* ----------------------------------------------------------------- tasks */
  const statusId = hit("data-task-status");
  if (statusId && p) {
    const task = activeTasks(p).find((x) => x.id === statusId);
    if (task) {
      task.status =
        task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
    }
    refreshRecord();
    return;
  }
  const priorityId = hit("data-task-priority");
  if (priorityId) {
    state.pickingPriority = state.pickingPriority === priorityId ? null : priorityId;
    refreshRecord();
    return;
  }
  const setPriorityId = hit("data-set-priority");
  if (setPriorityId && p) {
    const task = activeTasks(p).find((x) => x.id === setPriorityId);
    if (task) task.priority = t.closest("[data-priority]").getAttribute("data-priority");
    state.pickingPriority = null;
    refreshRecord();
    return;
  }
  const editTaskId = hit("data-edit-task");
  if (editTaskId) {
    state.editing = { kind: "task", id: editTaskId };
    refreshRecord();
    return;
  }
  const delTaskId = hit("data-del-task");
  if (delTaskId && p) {
    if (p.draftClinicalData) p.draftTasks = p.draftTasks.filter((x) => x.id !== delTaskId);
    else p.tasks = p.tasks.filter((x) => x.id !== delTaskId);
    refreshRecord();
    return;
  }
  if (t.closest("[data-add-task]")) {
    state.editing = { kind: "addTask" };
    refreshRecord();
    return;
  }

  /* -------------------------------------------- consults, discharge, review */
  const consultId = hit("data-consult");
  if (consultId && p) {
    const c = activeConsults(p).find((x) => x.id === consultId);
    if (c) c.state = t.closest("[data-state]").getAttribute("data-state");
    refreshRecord();
    return;
  }
  const dischargeStatus = hit("data-discharge");
  if (dischargeStatus && p) {
    activeDischarge(p).status = dischargeStatus;
    refreshRecord();
    return;
  }
  const blockerId = hit("data-blocker");
  if (blockerId && p) {
    const b = activeDischarge(p).blockers.find((x) => x.id === blockerId);
    if (b) b.resolved = !b.resolved;
    refreshRecord();
    return;
  }
  const reviewMove = hit("data-review-move");
  if (reviewMove && p) {
    moveReviewToOther(p, reviewMove);
    refreshRecord();
    return;
  }
  const reviewDrop = hit("data-review-drop");
  if (reviewDrop && p) {
    dismissReview(p, reviewDrop);
    refreshRecord();
    return;
  }

  /* -------------------------------------------------------------- task board */
  const boardId = hit("data-board-status");
  if (boardId) {
    const owner = getPatient(t.closest("[data-board-patient]").getAttribute("data-board-patient"));
    if (owner) {
      const task = activeTasks(owner).find((x) => x.id === boardId);
      if (task) {
        task.status =
          task.status === "pending" ? "in-progress" : task.status === "in-progress" ? "done" : "pending";
      }
    }
    render();
    return;
  }

  /* -------------------------------------------------------------- recorder */
  const action = hit("data-rec");
  if (action) {
    if (action === "begin") void beginRound();
    else if (action === "pause") rec.provider && rec.provider.pause();
    else if (action === "resume") rec.provider && rec.provider.resume();
    else if (action === "stop") void stopRound();
    else if (action === "cancel") cancelRound();
    else if (action === "approve") confirmRound();
    else if (action === "fold" || action === "unfold") {
      rec.folded = action === "fold";
      refreshRecorder();
    } else if (action === "engines") {
      state.enginePickerOpen = !state.enginePickerOpen;
      refreshRecorder();
    }
    return;
  }
  const engineId = hit("data-engine");
  if (engineId) {
    rec.engineId = engineId;
    state.enginePickerOpen = false;
    refreshRecorder();
    return;
  }
  if (state.enginePickerOpen && !t.closest(".engine-wrap")) {
    state.enginePickerOpen = false;
    refreshRecorder();
  }
});

// The page is Hebrew RTL whether this file is published as an artifact (where
// the document shell is supplied) or opened straight from disk.
document.documentElement.setAttribute("dir", "rtl");
document.documentElement.setAttribute("lang", "he");

loadPrefs();
render();
