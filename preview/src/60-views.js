/* ===========================================================================
   Screens.

   0  opening      — branding hero, scroll-scrubbed corridor, handoff
   1  rooms        — fifteen doors, 5 / 5 / 5
   2  room         — three summary tiles, one large card per patient
   3  patient      — eight permanent clinical categories + operational column
   4  tasks        — the ward's open work, grouped by priority
   =========================================================================== */

const state = {
  screen: "open",
  roomId: null,
  patientId: null,
  /** Inline editing target, so a re-render never eats a half-typed correction. */
  editing: null,
  pickingPriority: null,
  enginePickerOpen: false,
  taskFilter: "all",
  /** Entrance animations play on arrival at a screen, not on every state
   *  change while the reader is already there — re-arming an observer would
   *  leave anything scrolled past stuck at opacity 0. */
  animate: true,
  settingsOpen: false,
  assistantOpen: false,
  /** Answered questions, newest last. Kept in memory only. */
  chat: [],
};

/* ------------------------------------------------------------ preferences */

const PREF_KEY = "clario.prefs.v1";

const prefs = { theme: "light", calmMotion: false };

function loadPrefs() {
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY) || "{}"));
  } catch {
    // A sandboxed frame may refuse storage entirely; defaults are fine.
  }
  applyPrefs();
}

function applyPrefs() {
  document.documentElement.setAttribute("data-theme", prefs.theme);
  document.documentElement.toggleAttribute("data-calm", prefs.calmMotion);
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Preference is still applied for this session.
  }
}

/** True when motion should be suppressed — either the OS asked, or the reader
 *  did through the settings menu. */
function calm() {
  return prefs.calmMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const app = document.getElementById("app");
let disposeCorridor = null;

function go(screen, arg) {
  if (disposeCorridor) {
    disposeCorridor();
    disposeCorridor = null;
  }
  state.editing = null;
  state.pickingPriority = null;
  state.enginePickerOpen = false;
  if (screen === "room") state.roomId = arg;
  if (screen === "patient") state.patientId = arg;
  state.screen = screen;
  state.animate = true;
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function render() {
  const html =
    state.screen === "open"
      ? viewOpen()
      : state.screen === "rooms"
        ? viewRooms()
        : state.screen === "room"
          ? viewRoom()
          : state.screen === "patient"
            ? viewPatient()
            : viewTasks();

  app.innerHTML = html + utilityBar() + settingsMenuHost() + assistantPanel();
  armReveals(app);
  state.animate = false;

  if (state.screen === "open") {
    const section = app.querySelector(".corridor");
    if (section) disposeCorridor = mountCorridor(section, arriveAtDoor);
  }
  if (state.screen === "patient") {
    mountRecorder();
    focusEditor();
  }
}

/* ----------------------------------------------------- utility + settings -*/

function utilityBar() {
  return `<div class="utility">
    <button class="u-btn" data-assistant="open" aria-label="עוזר המחלקה">
      ${I.assistant(iconStyle(18))}<span>עוזר המחלקה</span>
    </button>
    <span class="sep" aria-hidden="true"></span>
    <button class="u-btn icon-only${state.settingsOpen ? " on" : ""}" data-settings="toggle"
      aria-label="הגדרות" aria-expanded="${state.settingsOpen}" title="הגדרות">
      ${I.gear(iconStyle(18))}
    </button>
    ${state.settingsOpen ? settingsMenu() : ""}
  </div>`;
}

function settingsMenuHost() {
  return "";
}

function settingsMenu() {
  const night = prefs.theme === "dark";
  return `<div class="menu" role="menu">
    <div class="group">
      <p class="label">תצוגה</p>
      <button class="row" role="menuitemcheckbox" aria-checked="${night}" data-pref="theme">
        ${night ? I.moon(iconStyle(18)) : I.sun(iconStyle(18))}
        <span class="grow">מצב לילה<span class="hint">${night ? "פעיל — רקע כהה לסבב לילה" : "כבוי — תצוגת יום"}</span></span>
        <span class="switch${night ? " on" : ""}" aria-hidden="true"></span>
      </button>
      <button class="row" role="menuitemcheckbox" aria-checked="${prefs.calmMotion}" data-pref="motion">
        ${I.motion(iconStyle(18))}
        <span class="grow">הפחתת תנועה<span class="hint">${prefs.calmMotion ? "אנימציות מושבתות" : "אנימציות פעילות"}</span></span>
        <span class="switch${prefs.calmMotion ? " on" : ""}" aria-hidden="true"></span>
      </button>
    </div>
    <div class="group">
      <p class="label">חשבון</p>
      <button class="row" role="menuitem" data-settings="restart">
        ${I.back(iconStyle(18))}
        <span class="grow">איפוס נתוני ההדגמה<span class="hint">מחזיר את המחלקה למצב ההתחלתי</span></span>
      </button>
      <button class="row danger" role="menuitem" data-settings="logout">
        ${I.logout(iconStyle(18))}
        <span class="grow">התנתקות<span class="hint">חזרה למסך הפתיחה</span></span>
      </button>
    </div>
  </div>`;
}

/* --------------------------------------------------------------- assistant */

function assistantPanel() {
  if (!state.assistantOpen) return "";

  const log = state.chat.length
    ? state.chat
        .map(
          (turn) => `
        <p class="ask">${esc(turn.question)}</p>
        <div class="answer">
          <p class="headline">${esc(turn.answer.headline)}</p>
          ${turn.answer.note ? `<p class="note">${esc(turn.answer.note)}</p>` : ""}
          ${
            turn.answer.rows.length
              ? `<div class="hits">${turn.answer.rows
                  .map(
                    (r) => `<button class="hit" data-patient="${r.patient.id}" data-close-assistant="1">
                      <span class="grow" style="min-width:0;flex:1">
                        <span class="who">${esc(r.patient.name)}</span>
                        <span class="where"> · חדר ${getRoom(r.patient.roomId).number}, מיטה ${r.patient.bed} · ${esc(r.where)}</span>
                        <span class="quote">${highlight(r.quote, turn.answer.terms)}</span>
                      </span>
                      ${I.chevron(iconStyle(16))}
                    </button>`,
                  )
                  .join("")}</div>`
              : ""
          }
        </div>`,
        )
        .join("")
    : `<div class="answer">
        <p class="headline">שאלו על המחלקה — התשובה נשלפת מהרשומות עצמן.</p>
        <p class="note">כל תשובה מגיעה עם המטופלים והשורות שממנה חושבה, כדי שאפשר יהיה לבדוק אותה מול הרשומה.</p>
      </div>
      <div class="suggestions">${ASSISTANT_SUGGESTIONS.map(
        (s) => `<button data-ask="${esc(s)}">${esc(s)}</button>`,
      ).join("")}</div>`;

  return `<div class="scrim" data-assistant="close"></div>
  <aside class="assistant" aria-label="עוזר המחלקה">
    <div class="head">
      <span class="mark">${I.assistant(iconStyle(18))}</span>
      <h2>עוזר המחלקה</h2>
      <button class="icon-btn" data-assistant="close" aria-label="סגירה">${I.close(iconStyle(18))}</button>
    </div>
    <div class="log" id="assistant-log">${log}</div>
    <div class="compose">
      <input type="text" id="assistant-input" placeholder="למשל: כמה מטופלים מקבלים מורפיום" autocomplete="off" />
      <button class="send" data-assistant="send" aria-label="שליחה">${I.send(iconStyle(20))}</button>
    </div>
    <p class="source">התשובות נשלפות מהרשומות הטעונות באפליקציה — שמונה הקטגוריות, המשימות, הייעוצים והחסמים — ומצוטטות כלשונן. בתצוגה המוטמעת אין מפתח API, ולכן זהו חיפוש מקומי ולא מודל שפה. כל הנתונים בדיוניים.</p>
  </aside>`;
}

/** Marks the searched terms inside a quoted line, so the reason a patient came
 *  back is visible rather than asserted. */
function highlight(text, terms) {
  let out = esc(text);
  for (const t of terms || []) {
    if (t.length < 3) continue;
    out = out.replace(new RegExp(`([\\u0590-\\u05FFa-zA-Z0-9]*${escapeRe(esc(t))}[\\u0590-\\u05FFa-zA-Z0-9]*)`, "gi"), "<mark>$1</mark>");
  }
  return out;
}

function submitQuestion(text) {
  const question = (text || "").trim();
  if (!question) return;
  const answer = askWard(question);
  state.chat.push({ question, answer });
  refreshAssistant();
}

function refreshAssistant() {
  const old = app.querySelector(".assistant");
  const scrim = app.querySelector(".scrim");
  if (old) old.remove();
  if (scrim) scrim.remove();
  app.insertAdjacentHTML("beforeend", assistantPanel());
  const log = document.getElementById("assistant-log");
  if (log) log.scrollTop = log.scrollHeight;
  const input = document.getElementById("assistant-input");
  if (input) input.focus();
}

function refreshUtility() {
  const bar = app.querySelector(".utility");
  if (bar) bar.outerHTML = utilityBar();
}

/* -------------------------------------------------------------- screen 0 --*/

/** Arcs sweeping out from the edge, matching the curvature drawn into the
 *  artwork's own corners. */
const WAVES = [
  { d: "M-40 900C60 720 20 520 90 340 140 208 120 96 60 0", w: 1.1, o: 0.2 },
  { d: "M-90 900C30 700 -20 500 60 300 120 152 96 60 24 -40", w: 0.9, o: 0.13 },
  { d: "M-150 880C0 690 -60 470 30 270 96 124 70 40 -10 -60", w: 0.8, o: 0.08 },
];

function waveSide(side, offset) {
  const paths = WAVES.map(
    (w, i) =>
      `<path d="${w.d}" fill="none" stroke="currentColor" stroke-width="${w.w}" opacity="${w.o}" class="hero-wave hero-wave-${i + offset}"/>`,
  ).join("");
  return `<svg class="${side}" viewBox="0 0 200 900" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}

function viewOpen() {
  return `
  <main id="main">
    <section class="hero">
      <div class="ground">
        <!-- Ambient ground: two cream fields on long, mutually prime cycles,
             so the drift never resolves into a visible loop. -->
        <div class="field-a drift-a" aria-hidden="true"></div>
        <div class="field-b drift-b" aria-hidden="true"></div>
        <div class="waves" aria-hidden="true">${waveSide("start", 0)}${waveSide("end", 3)}</div>
      </div>

      <!-- The stage is locked to the artwork's aspect ratio, so the identity is
           never cropped and the live button sits exactly on the one the artwork
           draws. -->
      <div class="stage is-video" id="hero-stage">
        <!-- Autoplay, muted, inline, looping, no controls — the front door of
             the application, not an embedded player. A browser with no decoder
             for it falls back to the branding board rather than to an empty
             cream rectangle. -->
        <video class="hero-video" autoplay muted loop playsinline preload="auto"
               disablepictureinpicture controlslist="nodownload noplaybackrate noremoteplayback"
               aria-label="CLARIO — Turn rounds into action."
               onerror="this.closest('.stage').classList.add('no-clip')">
          <source src="__OPENING_CLIP__" type="video/mp4" />
        </video>
        <img class="fallback-art breathe" src="__BRANDING__" alt="CLARIO — Turn rounds into action." />
        <button class="enter-btn low" data-enter>
          <span style="position:relative;z-index:1">כניסה למחלקה</span>
          <span class="glint" aria-hidden="true"></span>
        </button>
      </div>

      <div class="fade" aria-hidden="true"></div>
      <span class="scroll-cue" aria-hidden="true"><span></span></span>
    </section>

    <!-- Moment two: the walk down the corridor. Drawn to canvas and scrubbed by
         the same scroll contract the supplied footage will use. -->
    <section class="corridor" aria-label="מעבר במסדרון המחלקה עד לדלת החדר">
      <div class="stick">
        <canvas></canvas>
        <div class="mask" aria-hidden="true"></div>
      </div>
    </section>

    ${
      // With motion suppressed the corridor is a single still and never reaches
      // its own end, so the way through has to be a control.
      calm()
        ? `<section class="handoff"><div id="handoff-inner">
            <p class="eyebrow">מחלקה פנימית ב׳</p>
            <h2>בחירת חדר</h2>
            <button class="btn primary lg" data-enter>כניסה למחלקה</button>
          </div></section>`
        : ""
    }

    <div class="wash" id="wash" aria-hidden="true"></div>
  </main>`;
}

/**
 * The end of the walk.
 *
 * The reader has just spent three viewport-heights walking up to a closed door;
 * the door opens and they step through. `rect` is where the drawn door sits on
 * screen, so the DOM door that takes over is placed exactly on top of it and
 * the hand-off from canvas to CSS is invisible.
 */
function arriveAtDoor(rect) {
  if (state.screen !== "open") return;
  if (calm() || !rect || rect.width < 8) {
    go("rooms");
    return;
  }

  const layer = document.createElement("div");
  layer.className = "door-transition";
  layer.setAttribute("role", "presentation");
  layer.setAttribute("aria-hidden", "true");
  // No number on this one: it is the door at the end of the corridor, not a
  // room the reader has chosen yet.
  layer.innerHTML = `<div class="flyer" style="top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px">${doorSlab(
    "",
    { style: "height:100%;aspect-ratio:auto" },
  )}</div><div class="flood"></div>`;
  app.appendChild(layer);

  const flyer = layer.querySelector(".flyer");
  const door = layer.querySelector(".door");
  const flood = layer.querySelector(".flood");

  const th = Math.min(window.innerHeight * 0.92, 860);
  const tw = th * 0.8;

  requestAnimationFrame(() => {
    flyer.style.top = `${(window.innerHeight - th) / 2}px`;
    flyer.style.left = `${(window.innerWidth - tw) / 2}px`;
    flyer.style.width = `${tw}px`;
    flyer.style.height = `${th}px`;
  });
  setTimeout(() => door.classList.add("open"), 380);
  setTimeout(() => {
    flyer.style.transitionDuration = "460ms";
    flyer.style.transform = "scale(2.9)";
    flood.style.opacity = "0.55";
  }, 700);
  setTimeout(() => {
    flyer.style.opacity = "0";
    flood.style.opacity = "1";
  }, 1020);
  setTimeout(() => {
    layer.remove();
    go("rooms");
  }, 1240);
}

/** The branding dissolves into the cream ground on the way to the ward, rather
 *  than the page simply swapping. */
function enterWard() {
  const reduced = calm();
  if (reduced) {
    go("rooms");
    return;
  }
  const wash = document.getElementById("wash");
  for (const id of ["hero-stage", "handoff-inner"]) {
    const node = document.getElementById(id);
    if (node) {
      node.style.transition = "transform 560ms ease-out, opacity 560ms ease-out, filter 560ms ease-out";
      node.style.transform = "scale(.92)";
      node.style.opacity = "0";
      node.style.filter = "blur(2px)";
    }
  }
  if (wash) wash.classList.add("on");
  setTimeout(() => go("rooms"), 560);
}

/* -------------------------------------------------------------- screen 1 --*/

function viewRooms() {
  const totals = ward.rooms.reduce(
    (acc, room) => {
      const s = summariseRoom(room);
      acc.patients += s.patients;
      acc.openTasks += s.openTasks;
      acc.urgent += s.urgentTasks;
      acc.discharges += s.possibleDischarges;
      return acc;
    },
    { patients: 0, openTasks: 0, urgent: 0, discharges: 0 },
  );

  const doors = ward.rooms
    .map((room, i) => `<li class="reveal pop" style="--d:${i}">${doorTile(room)}</li>`)
    .join("");

  return `
  ${header({ rule: "בחירת חדר" })}
  <main id="main"><div class="ward">
    <div class="ward-bar">
      <dl>
        <div><dt>מטופלים במחלקה</dt><dd class="tnum">${totals.patients}</dd></div>
        <div><dt>משימות פתוחות</dt><dd class="tnum">${totals.openTasks}</dd></div>
        ${totals.urgent > 0 ? `<div><dt>דחופות</dt><dd class="tnum urgent"><span aria-hidden="true" style="font-size:11px">▲ </span>${totals.urgent}</dd></div>` : ""}
        <div><dt>שחרורים אפשריים</dt><dd class="tnum info">${totals.discharges}</dd></div>
      </dl>
      <button class="link" data-go="tasks">${I.clipboard(iconStyle(18))}כל המשימות</button>
    </div>

    <ul class="door-grid">${doors}</ul>
  </div></main>
  ${footer()}`;
}

function doorTile(room) {
  const s = summariseRoom(room);
  const unavailable = room.status === "unavailable";
  const empty = room.status === "empty";

  const description = unavailable
    ? `חדר ${room.number}, ${room.note || "אינו פעיל"}`
    : empty
      ? `חדר ${room.number}, פנוי`
      : [
          `חדר ${room.number}`,
          `${s.patients} מטופלים`,
          s.openTasks > 0 ? `${s.openTasks} משימות פתוחות` : null,
          s.urgentTasks > 0 ? `${s.urgentTasks} דחופות` : null,
          s.possibleDischarges > 0 ? `${s.possibleDischarges} שחרורים אפשריים` : null,
        ]
          .filter(Boolean)
          .join(", ");

  const chips = unavailable || empty
    ? ""
    : `<span class="chips">
        ${s.urgentTasks > 0 ? `<span class="mini urgent" title="${s.urgentTasks} משימות דחופות"><span aria-hidden="true">▲</span>${s.urgentTasks}</span>` : ""}
        ${s.possibleDischarges > 0 ? `<span class="mini info" title="${s.possibleDischarges} שחרורים אפשריים"><span aria-hidden="true">◆</span>${s.possibleDischarges}</span>` : ""}
        ${s.openTasks > 0 && s.urgentTasks === 0 && s.possibleDischarges === 0 ? `<span class="mini">${s.openTasks}</span>` : ""}
      </span>`;

  return `<button class="door-tile" ${unavailable ? "disabled" : `data-room="${room.id}"`} data-room-number="${room.number}" aria-label="${esc(description)}">
    <span class="door-crop"><span>${doorSlab(room.number, { dim: unavailable || empty })}</span></span>
    <span class="door-strip">
      <span>${esc(unavailable ? room.note || "אינו פעיל" : empty ? "פנוי" : `${s.patients} מטופלים`)}</span>
      ${chips}
    </span>
  </button>`;
}

/**
 * Entering a room: the clicked door is cloned at its exact on-screen position,
 * flown toward the viewer, swung open on its hinge, and walked through as the
 * light from the room floods past. Four beats, ~820ms end to end.
 */
function enterRoom(roomId, number, node) {
  const reduced = calm();
  if (reduced || !node) {
    go("room", roomId);
    return;
  }
  const r = node.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "door-transition";
  layer.setAttribute("role", "presentation");
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `<div class="flyer" style="top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px">${doorSlab(
    number,
    { style: "height:100%;aspect-ratio:auto;border-radius:var(--radius-card)" },
  )}</div><div class="flood"></div>`;
  // Appended inside #app so the RTL direction (and therefore the door's lever
  // side) is inherited, and so the overlay works when this file is embedded.
  app.appendChild(layer);

  const flyer = layer.querySelector(".flyer");
  const door = layer.querySelector(".door");
  const flood = layer.querySelector(".flood");

  // A door that fills a 16:9 screen stops reading as a door, so the clone grows
  // to a door-shaped box centred in the viewport rather than filling it.
  const th = Math.min(window.innerHeight * 0.92, 860);
  const tw = th * 0.8;

  const timers = [];
  timers.push(
    setTimeout(() => {
      flyer.style.top = `${(window.innerHeight - th) / 2}px`;
      flyer.style.left = `${(window.innerWidth - tw) / 2}px`;
      flyer.style.width = `${tw}px`;
      flyer.style.height = `${th}px`;
      door.classList.add("open");
    }, 230),
  );
  // The push through the doorway begins while the slab is still swinging —
  // waiting for it to finish is what makes this kind of transition drag.
  timers.push(
    setTimeout(() => {
      flyer.style.transitionDuration = "360ms";
      flyer.style.transform = "scale(2.6)";
      flood.style.opacity = "0.5";
    }, 470),
  );
  timers.push(
    setTimeout(() => {
      flyer.style.opacity = "0";
      flood.style.opacity = "1";
    }, 660),
  );
  timers.push(
    setTimeout(() => {
      layer.remove();
      go("room", roomId);
    }, 820),
  );
}

/* -------------------------------------------------------------- screen 2 --*/

function viewRoom() {
  const room = getRoom(state.roomId);
  if (!room) {
    return `${header({ back: { to: "rooms", label: "חזרה לחדרים" } })}
      <main id="main"><div class="ward">${emptyState(I.door(iconStyle(32)), "החדר לא נמצא", "ייתכן שהחדר הוסר מהמחלקה או שהקישור שגוי.")}</div></main>${footer()}`;
  }

  const list = roomPatients(room.id);
  const s = summariseRoom(room);
  const unavailable = room.status === "unavailable";

  const tiles = unavailable
    ? ""
    : `<ul class="tiles">
        ${summaryTile(I.user(iconStyle(20)), "מספר מטופלים", s.patients, 0)}
        ${summaryTile(I.clipboard(iconStyle(20)), "משימות פתוחות", s.openTasks, 1, s.urgentTasks > 0 ? `${s.urgentTasks} דחופות` : null)}
        ${summaryTile(I.heart(iconStyle(20)), "שחרורים אפשריים", s.possibleDischarges, 2)}
      </ul>`;

  const body = unavailable
    ? emptyState(
        I.door(iconStyle(32)),
        "החדר אינו פעיל",
        room.note ? `${room.note}. לא ניתן לשבץ מטופלים לחדר זה כרגע.` : "לא ניתן לשבץ מטופלים לחדר זה כרגע.",
      )
    : list.length === 0
      ? emptyState(I.clipboard(iconStyle(32)), "אין מטופלים בחדר", "החדר פנוי ומוכן לקליטה. מטופלים שישובצו יופיעו כאן.")
      : `<ul class="patient-list">${list
          .map((p, i) => `<li class="reveal" style="--d:${i + 3}">${patientCard(p)}</li>`)
          .join("")}</ul>`;

  return `
  ${header({ back: { to: "rooms", label: "חזרה לחדרים" } })}
  <main id="main"><div class="ward">
    <div style="margin-bottom:20px">
      <h1 class="room-title">חדר <span class="tnum">${room.number}</span></h1>
      <p class="room-sub">${esc(unavailable ? room.note || "אינו פעיל" : patientCount(list.length))}</p>
    </div>
    ${tiles}
    ${body}
  </div></main>
  ${footer()}`;
}

function summaryTile(icon, label, value, index, note) {
  return `<li class="reveal pop" style="--d:${index}"><div class="card tile">
    <span class="icon">${icon}</span>
    <span style="min-width:0">
      <span class="label">${esc(label)}</span>
      <span style="display:flex;align-items:baseline;gap:8px">
        <span class="value tnum${note ? " urgent" : ""}">${value}</span>
        ${note ? `<span class="note"><span aria-hidden="true">▲ </span>${esc(note)}</span>` : ""}
      </span>
    </span>
  </div></li>`;
}

/** One patient, as a single large target: the whole card is the link. On a
 *  tablet held in one hand during a round, a small "open" button is the wrong
 *  target. */
function patientCard(p) {
  const status = PATIENT_STATUS[p.status];
  const open = openTaskCount(p);
  const hasDraft = p.draftClinicalData !== null;

  return `<button class="patient-card" data-patient="${p.id}">
    <span class="bed">
      <span class="ring">${I.bed(iconStyle(20))}</span>
      <span class="txt">מיטה <span class="tnum">${p.bed}</span></span>
    </span>
    <span class="body">
      <span style="min-width:0;flex:1">
        <span style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px">
          <h3>${esc(p.name)}</h3>
          ${hasDraft ? `<span class="draft-chip">טיוטה פתוחה</span>` : ""}
        </span>
        <dl class="fields">
          ${field("גיל", p.age, true)}
          ${field("ת״ז", p.idNumber, true)}
          ${field("קופה", p.hmo)}
          ${field("אבחנה עיקרית", p.primaryDiagnosis)}
        </dl>
      </span>
      <span class="side">
        ${pill(status)}
        <span class="tasks-line">${I.clipboard(iconStyle(16))}${esc(taskCount(open))}</span>
        <span class="open-cue">פתיחת מטופל${I.chevron(iconStyle(16))}</span>
      </span>
    </span>
  </button>`;
}

function field(label, value, tnum) {
  return `<div class="field"><dt>${esc(label)}</dt><dd class="${tnum ? "tnum" : ""}" title="${esc(value)}">${esc(value)}</dd></div>`;
}

/* -------------------------------------------------------------- screen 3 --*/

function viewPatient() {
  const p = getPatient(state.patientId);
  if (!p) {
    return `${header({ back: { to: "rooms", label: "חזרה לחדרים" } })}
      <main id="main"><div class="ward">${emptyState(I.user(iconStyle(32)), "המטופל לא נמצא", "ייתכן שהמטופל שוחרר או שהקישור שגוי.")}</div></main>`;
  }

  const room = getRoom(p.roomId);
  const open = openTaskCount(p);

  return `
  ${header({ back: { to: `room:${p.roomId}`, label: `חזרה לחדר ${room ? room.number : ""}`.trim() } })}
  <main id="main"><div class="ward">
    <div class="patient-head">
      <h1>${esc(p.name)}</h1>
      ${pill(PATIENT_STATUS[p.status])}
      <p class="where">מיטה <span class="tnum">${p.bed}</span>, חדר <span class="tnum">${room ? room.number : "—"}</span></p>
    </div>

    <dl class="demographics">
      ${dfield("גיל", p.age, true)}
      ${dfield("ת״ז", p.idNumber, true)}
      ${dfield("קופה", p.hmo)}
      ${dfield("אבחנה עיקרית", p.primaryDiagnosis)}
      ${dfield("יום אשפוז", p.hospitalDay, true)}
      ${dfield("משימות פתוחות", open, true, open > 0)}
    </dl>

    <div class="patient-grid">
      ${clinicalRecord(p, state.animate)}
      ${operationalColumn(p)}
    </div>

    <div style="height:112px" aria-hidden="true"></div>
  </div></main>
  ${recordingBar(p)}`;
}

function dfield(label, value, tnum, emph) {
  return `<div><dt>${esc(label)}</dt><dd class="${cx(tnum && "tnum", emph && "emph")}" title="${esc(value)}">${esc(value)}</dd></div>`;
}

/* ------------------------------------------------------- clinical record --*/

/**
 * Eight permanent categories, always present, always in the same order,
 * populated or not. A doctor scanning for מדדים finds it in the same place on
 * every patient, every morning; that predictability is worth more than
 * collapsing empty sections would save.
 */
function clinicalRecord(p, animate) {
  const isDraft = p.draftClinicalData !== null;
  const d = activeData(p);
  const structuring = rec.phase === "structuring" && rec.patientId === p.id;
  const s = (i, title, icon, body, extra) => section(i, title, icon, body, extra, animate);

  const sections = [
    s(1, "תלונה עיקרית", I.chat(iconStyle(18)), list(p, "chiefComplaint", d.chiefComplaint, "לא תועדה תלונה עיקרית")),
    s(2, "מחלות רקע", I.document(iconStyle(18)), list(p, "pastMedicalHistory", d.pastMedicalHistory, "לא תועדו מחלות רקע")),
    s(3, "סטטוס סוציאלי", I.users(iconStyle(18)), list(p, "socialStatus", d.socialStatus, "לא תועד מידע סוציאלי")),
    s(4, "מדדים", I.vitals(iconStyle(18)), vitalsGrid(p, d)),
    s(
      5,
      "בדיקות",
      I.flask(iconStyle(18)),
      `<div class="sub-grid">${TEST_SUBSECTIONS.map(
        (sub) => `<div><h4>${esc(sub.title)}</h4>${list(p, `tests.${sub.key}`, d.tests[sub.key], "—")}</div>`,
      ).join("")}</div>`,
    ),
    // Visually distinct from the primary diagnosis in the header strip: that
    // one is the admission label, this is what the treating doctor currently
    // believes, and they are not the same claim.
    s(6, "אבחנת עבודה", I.stethoscope(iconStyle(18)), list(p, "workingDiagnosis", d.workingDiagnosis, "טרם נקבעה אבחנת עבודה"), "dx"),
    s(7, "תכנית טיפול", I.document(iconStyle(18)), list(p, "treatmentPlan", d.treatmentPlan, "לא הוגדרה תכנית טיפול")),
    s(8, "אחר / הערות", I.document(iconStyle(18)), list(p, "other", d.other, "אין הערות", "הוספת הערה")),
  ].join("");

  return `<div style="display:flex;flex-direction:column;gap:16px">
    ${d.needsReview.length > 0 ? needsReviewPanel(p, d) : ""}
    <div class="record${structuring ? " scanning" : ""}">${sections}</div>
    ${isDraft ? `<p class="draft-note">שינויים נשמרים בטיוטה בלבד. המידע ייכנס לרשומה רק לאחר אישור הסבב.</p>` : ""}
  </div>`;
}

/** `animate` is false on every re-render after the first: the sections already
 *  exist on screen, and re-arming the reveal would leave anything currently
 *  above the viewport stuck at opacity 0 — an observer never fires for an
 *  element the reader has already scrolled past. */
function section(index, title, icon, body, extra, animate) {
  return `<section class="section${animate ? " reveal" : ""}${extra ? ` ${extra}` : ""}" style="--d:${index}">
    <h3><span class="badge">${icon}</span><span class="name"><span class="tnum">${index}.</span> ${esc(title)}</span></h3>
    <div class="body">${body}</div>
  </section>`;
}

/** A list of clinical lines, each independently editable. The unit of
 *  correction is the line, not the section. */
function list(p, path, items, empty, addLabel) {
  const editing = state.editing;
  const rows = items
    .map((entry) => {
      if (editing && editing.kind === "item" && editing.path === path && editing.id === entry.id) {
        return `<li>${inlineInput(entry.text, "", { kind: "item", path, id: entry.id })}</li>`;
      }
      const fresh = isFresh(entry.addedAt);
      return `<li class="item${entry.source === "ai" ? " ai" : ""}${fresh ? " reveal shown settle" : ""}">
        <span class="dot" aria-hidden="true"></span>
        <span class="text">${esc(entry.text)}${entry.source === "ai" ? `<span class="ai-tag" style="margin-inline-start:8px">טיוטת AI</span>` : ""}</span>
        <span class="tools">
          <button class="icon-btn sm" aria-label="עריכה" title="עריכה" data-edit-item="${entry.id}" data-path="${path}">${I.pencil(iconStyle(15))}</button>
          <button class="icon-btn sm danger" aria-label="מחיקה" title="מחיקה" data-del-item="${entry.id}" data-path="${path}">${I.trash(iconStyle(15))}</button>
        </span>
      </li>`;
    })
    .join("");

  const adding = editing && editing.kind === "add" && editing.path === path;

  return `<div class="items">
    ${items.length === 0 && !adding ? `<p class="empty-line">${esc(empty)}</p>` : ""}
    ${items.length > 0 ? `<ul class="items">${rows}</ul>` : ""}
    ${
      adding
        ? inlineInput("", "הוספת שורה…", { kind: "add", path })
        : `<button class="add-line" data-add-item="${path}">${I.plus(iconStyle(16))}${esc(addLabel || "הוספה")}</button>`
    }
  </div>`;
}

function inlineInput(value, placeholder, target) {
  return `<div class="inline-edit">
    <input type="text" value="${esc(value)}" placeholder="${esc(placeholder || "")}" data-editor="1" />
    <button class="icon-btn" aria-label="שמירה" title="שמירה" data-save="1" style="color:var(--stable)">${I.check(iconStyle(16))}</button>
  </div>`;
}

function vitalsGrid(p, d) {
  return `<ul class="vitals">${VITAL_ORDER.map((key) => vitalCard(p, key, d.vitals[key])).join("")}</ul>`;
}

function vitalCard(p, key, reading) {
  const meta = VITAL_LABELS[key];
  const editing = state.editing && state.editing.kind === "vital" && state.editing.key === key;
  const fresh = reading && isFresh(reading.addedAt);

  return `<li class="vital${reading ? "" : " unset"}${fresh ? " settle" : ""}">
    <span class="top">
      <span class="lbl">${esc(meta.label)}</span>
      <span class="tools"><button class="icon-btn sm" aria-label="עריכת ${esc(meta.label)}" data-edit-vital="${key}">${I.pencil(iconStyle(13))}</button></span>
    </span>
    ${
      editing
        ? inlineInput(reading ? reading.value : "", meta.unit, { kind: "vital", key })
        : reading
          ? `<span class="val tnum">${esc(reading.value)}</span>`
          : `<button class="none" data-edit-vital="${key}">לא נמדד</button>`
    }
  </li>`;
}

/**
 * The uncertainty surface. When the transcript or the extractor is not
 * confident, content lands here — visible, labelled and attributable — instead
 * of being guessed into a clinical category or silently dropped. Both of those
 * failures are worse than an unresolved flag.
 */
function needsReviewPanel(p, d) {
  return `<section class="review-panel">
    <h3>${I.alert(iconStyle(18))}דורש בדיקה<span class="pill sm tone-attention tnum">${d.needsReview.length}</span></h3>
    <ul>${d.needsReview
      .map(
        (entry) => `<li>
          <span style="min-width:0;flex:1">
            <span style="display:block;font-size:14px">${esc(entry.text)}</span>
            <span class="why">${esc(entry.reason)}</span>
          </span>
          <span style="display:flex;flex-shrink:0;align-items:center;gap:4px">
            <button class="move" data-review-move="${entry.id}">העברה להערות</button>
            <button class="icon-btn danger" aria-label="מחיקה" data-review-drop="${entry.id}">${I.trash(iconStyle(15))}</button>
          </span>
        </li>`,
      )
      .join("")}</ul>
  </section>`;
}

/* ---------------------------------------------------- operational column --*/

function operationalColumn(p) {
  return `<div class="ops">
    ${tasksPanel(p)}
    ${consultsPanel(p)}
    ${dischargePanel(p)}
    ${blockersPanel(p)}
    ${draftPanel(p)}
  </div>`;
}

function tasksPanel(p) {
  const tasks = activeTasks(p);
  const sorted = tasks.slice().sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  });
  const open = tasks.filter((t) => t.status !== "done").length;
  const adding = state.editing && state.editing.kind === "addTask";

  return `<section class="card">
    ${panelHead(I.clipboard(iconStyle(18)), "משימות", countBadge(open === 0 ? "אין פתוחות" : `${open} פתוחות`, open > 0 ? "attention" : "neutral"))}
    ${
      sorted.length === 0
        ? `<p class="none">לא נוצרו משימות עבור מטופל זה.</p>`
        : `<ul class="rows">${sorted.map((t) => taskRow(p, t)).join("")}</ul>`
    }
    <div class="foot">
      ${
        adding
          ? inlineInput("", "משימה חדשה…", { kind: "addTask" })
          : `<button class="add-line" data-add-task="1">${I.plus(iconStyle(16))}הוספת משימה</button>`
      }
    </div>
  </section>`;
}

function taskRow(p, t) {
  const done = t.status === "done";
  const editing = state.editing && state.editing.kind === "task" && state.editing.id === t.id;
  const picking = state.pickingPriority === t.id;
  const fresh = isFresh(t.addedAt);

  return `<li class="${fresh ? "reveal shown" : ""}">
    <div class="task-row${done ? " done" : ""}">
      <button class="check${done ? " done" : t.status === "in-progress" ? " doing" : ""}"
        data-task-status="${t.id}"
        aria-label="שינוי סטטוס — כרגע ${esc(TASK_STATUS[t.status].label)}"
        title="${esc(TASK_STATUS[t.status].label)} — לחצו לשינוי">
        ${done ? I.check('style="width:12px;height:12px"') : t.status === "in-progress" ? `<span aria-hidden="true">◐</span>` : ""}
      </button>
      <div style="min-width:0;flex:1">
        ${editing ? inlineInput(t.title, "", { kind: "task", id: t.id }) : `<p class="title">${esc(t.title)}</p>`}
        <div class="meta">
          <span>${esc(TASK_STATUS[t.status].label)}</span>
          ${t.timing ? `<span>· ${esc(t.timing)}</span>` : ""}
          ${t.createdFrom === "round" ? `<span>· מהסבב</span>` : ""}
        </div>
      </div>
      <div class="right">
        <button class="pill-btn" data-task-priority="${t.id}" aria-expanded="${picking}" aria-label="עדיפות: ${esc(TASK_PRIORITY[t.priority].label)} — לחצו לשינוי">${pill(TASK_PRIORITY[t.priority], "sm")}</button>
        <span class="tools">
          <button class="icon-btn sm" aria-label="עריכה" data-edit-task="${t.id}">${I.pencil(iconStyle(15))}</button>
          <button class="icon-btn sm danger" aria-label="מחיקה" data-del-task="${t.id}">${I.trash(iconStyle(15))}</button>
        </span>
      </div>
    </div>
    ${
      picking
        ? `<div class="priority-picker">${TASK_PRIORITIES.map(
            (pr) => `<button class="pill-btn${pr === t.priority ? " on" : ""}" data-set-priority="${t.id}" data-priority="${pr}">${pill(TASK_PRIORITY[pr], "sm")}</button>`,
          ).join("")}</div>`
        : ""
    }
  </li>`;
}

/** The specialties a ward round actually calls, in the order it calls them. Not
 *  a closed list — anything not here is typed in, because a ward that cannot
 *  order the consult it needs writes it into a task instead and the panel stops
 *  meaning anything. */
const CONSULT_SPECIALTIES = [
  "קרדיולוגיה", "ריאות", "נפרולוגיה", "גסטרואנטרולוגיה", "נוירולוגיה",
  "אנדוקרינולוגיה", "זיהומיות", "כירורגיה", "אורתופדיה", "אורולוגיה",
  "המטולוגיה", "אונקולוגיה", "פיזיותרפיה", "ריפוי בעיסוק", "תזונה",
  "עבודה סוציאלית",
];

function consultsPanel(p) {
  const consults = activeConsults(p);
  const pending = consults.filter((c) => c.state !== "completed").length;
  const picking = state.editing && state.editing.kind === "addConsult";
  const custom = state.editing && state.editing.kind === "customConsult";
  const taken = new Set(consults.map((c) => c.specialty));

  return `<section class="card">
    ${panelHead(I.stethoscope(iconStyle(18)), "ייעוצים", countBadge(pending === 0 ? "אין ממתינים" : `${pending} ממתינים`, pending > 0 ? "attention" : "neutral"))}
    ${
      consults.length === 0 && !picking && !custom
        ? `<p class="none">לא הוזמנו ייעוצים.</p>`
        : `<ul class="rows">${consults
            .map(
              (c) => `<li class="consult-row">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <span style="min-width:0">
                    <span style="display:block;font-size:14px;font-weight:500">${esc(c.specialty)}</span>
                    ${c.reason ? `<span style="display:block;margin-top:2px;font-size:12px;color:var(--ink-muted)">${esc(c.reason)}</span>` : ""}
                  </span>
                  <span style="display:flex;flex-shrink:0;align-items:center;gap:4px">
                    ${pill(CONSULT_STATE[c.state], "sm")}
                    <span class="tools">
                      <button class="icon-btn sm danger" data-del-consult="${c.id}" aria-label="מחיקת ייעוץ ${esc(c.specialty)}">${I.trash(iconStyle(15))}</button>
                    </span>
                  </span>
                </div>
                <div class="state-row">${CONSULT_STATES.map(
                  (st) => `<button class="state-btn${st === c.state ? " on" : ""}" data-consult="${c.id}" data-state="${st}">${esc(CONSULT_STATE[st].label)}</button>`,
                ).join("")}</div>
              </li>`,
            )
            .join("")}</ul>`
    }
    <div class="foot">
      ${
        custom
          ? inlineInput("", "שם היועץ או התחום…", { kind: "customConsult" })
          : picking
            ? specialtyPicker(taken)
            : `<button class="add-line" data-add-consult="1">${I.plus(iconStyle(16))}הוספת ייעוץ</button>`
      }
    </div>
  </section>`;
}

/** Specialties already on this patient are shown as taken rather than hidden,
 *  so the list does not reshuffle between visits. */
function specialtyPicker(taken) {
  return `<div class="picker">
    <div class="picker-head">
      <span>בחירת תחום</span>
      <button class="icon-btn sm" data-cancel-picker="1" aria-label="ביטול">${I.close(iconStyle(15))}</button>
    </div>
    <div class="picker-list">
      ${CONSULT_SPECIALTIES.map((sp) =>
        taken.has(sp)
          ? `<button class="chip-btn taken" disabled title="כבר קיים אצל מטופל זה">${esc(sp)}</button>`
          : `<button class="chip-btn" data-pick-consult="${esc(sp)}">${esc(sp)}</button>`,
      ).join("")}
      <button class="chip-btn other" data-custom-consult="1">${I.plus(iconStyle(14))}אחר</button>
    </div>
  </div>`;
}

function dischargePanel(p) {
  const d = activeDischarge(p);
  const openBlockers = d.blockers.filter((b) => !b.resolved);

  return `<section class="card">
    ${panelHead(I.heart(iconStyle(18)), "שחרור")}
    <div style="padding:14px 16px">
      ${pill(DISCHARGE_STATUS[d.status])}
      <div class="state-row">${DISCHARGE_OPTIONS.map(
        (s) => `<button class="state-btn${s === d.status ? " on" : ""}" data-discharge="${s}">${esc(DISCHARGE_STATUS[s].label)}</button>`,
      ).join("")}</div>
      ${
        d.status !== "unplanned" && openBlockers.length > 0
          ? `<p class="discharge-warn">${I.alert(iconStyle(14))}${openBlockers.length} חסמים פתוחים מונעים שחרור בפועל</p>`
          : ""
      }
    </div>
  </section>`;
}

/** A blocker is "cleared by" a task when their wording overlaps. The link is a
 *  suggestion, never automatic: clearing a discharge blocker is a clinical
 *  decision, so the app offers and the human confirms. */
function clearingTask(blockerText, tasks) {
  const words = blockerText
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  return tasks.find((t) => {
    if (t.status !== "done") return false;
    const title = t.title.toLowerCase();
    return words.some((w) => title.includes(w.toLowerCase()));
  });
}

function blockersPanel(p) {
  const d = activeDischarge(p);
  const tasks = activeTasks(p);
  const open = d.blockers.filter((b) => !b.resolved);

  return `<section class="card">
    ${panelHead(I.alert(iconStyle(18)), "חסמים לשחרור", countBadge(open.length === 0 ? "אין חסמים" : `${open.length} פתוחים`, open.length > 0 ? "attention" : "stable"))}
    ${
      d.blockers.length === 0 && !(state.editing && state.editing.kind === "addBlocker")
        ? `<p class="none">לא תועדו חסמים לשחרור.</p>`
        : `<ul class="rows">${d.blockers
            .map((b) => {
              const cleared = !b.resolved ? clearingTask(b.text, tasks) : undefined;
              return `<li class="blocker-row">
                <div style="display:flex;align-items:flex-start;gap:10px">
                  <button class="check sq${b.resolved ? " done" : cleared ? " ready" : ""}" data-blocker="${b.id}"
                    aria-label="${b.resolved ? `סימון "${esc(b.text)}" כלא טופל` : `סימון "${esc(b.text)}" כטופל`}">
                    ${b.resolved ? I.check('style="width:12px;height:12px"') : ""}
                  </button>
                  <span style="min-width:0;flex:1">
                    <span style="display:block;font-size:14px${b.resolved ? ";color:var(--ink-muted);text-decoration:line-through" : ""}">${esc(b.text)}</span>
                    ${cleared ? `<span class="blocker-hint">״${esc(cleared.title)}״ בוצעה — ניתן לסמן כטופל</span>` : ""}
                  </span>
                  <span class="tools">
                    <button class="icon-btn sm danger" data-del-blocker="${b.id}" aria-label="מחיקת החסם">${I.trash(iconStyle(15))}</button>
                  </span>
                </div>
              </li>`;
            })
            .join("")}</ul>`
    }
    <div class="foot">
      ${
        state.editing && state.editing.kind === "addBlocker"
          ? inlineInput("", "מה מעכב את השחרור…", { kind: "addBlocker" })
          : `<button class="add-line" data-add-blocker="1">${I.plus(iconStyle(16))}הוספת חסם</button>`
      }
    </div>
  </section>`;
}

function draftPanel(p) {
  const isDraft = p.draftClinicalData !== null;
  const reviewCount = activeData(p).needsReview.length;

  return `<section class="draft-panel${isDraft ? " on" : ""}">
    ${panelHead(I.sparkle(iconStyle(18)), "סטטוס טיוטה")}
    <div class="in">
      ${
        isDraft
          ? `<p class="h on">טיוטת AI</p>
             <p class="d">יש לעבור על המידע לפני אישור. שום פריט אינו נשמר ברשומה עד לחיצה על ״אישור סבב״.</p>
             ${reviewCount > 0 ? `<p class="r">${reviewCount} פריטים מסומנים כדורשים בדיקה</p>` : ""}`
          : `<p class="h">אין טיוטה פתוחה</p>
             <p class="d">${
               p.lastRoundAt
                 ? `הסבב האחרון אושר ב־${new Date(p.lastRoundAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}.`
                 : "טרם בוצע סבב מוקלט עבור מטופל זה."
             }</p>`
      }
    </div>
  </section>`;
}

/* -------------------------------------------------------------- screen 4 --*/

/**
 * Deliberately not the entry point — the ward is navigated by room, and this is
 * the sweep you do once the round is done. It answers a different question: not
 * "what does this patient need" but "what is still open anywhere".
 */
const TASK_FILTERS = [
  ["all", "הכל"],
  ["urgent", "דחוף"],
  ["today", "היום"],
  ["pending", "ממתין"],
  ["done", "בוצע"],
  ["discharge", "שחרור"],
];

function viewTasks() {
  const rows = [];
  for (const p of Object.values(ward.patients)) {
    for (const t of activeTasks(p)) {
      rows.push({ task: t, patient: p, roomNumber: getRoom(p.roomId).number });
    }
  }
  rows.sort((a, b) => {
    if ((a.task.status === "done") !== (b.task.status === "done")) return a.task.status === "done" ? 1 : -1;
    const p = PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
    return p !== 0 ? p : a.roomNumber - b.roomNumber;
  });

  const dischargeRows = Object.values(ward.patients)
    .filter((p) => {
      const d = activeDischarge(p);
      return d.status === "today" || d.status === "tomorrow";
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const counts = {
    all: rows.length,
    urgent: rows.filter((r) => r.task.priority === "urgent" && r.task.status !== "done").length,
    today: rows.filter((r) => r.task.priority === "today" && r.task.status !== "done").length,
    pending: rows.filter((r) => r.task.status !== "done").length,
    done: rows.filter((r) => r.task.status === "done").length,
    discharge: dischargeRows.length,
  };

  const f = state.taskFilter;
  const visible =
    f === "urgent"
      ? rows.filter((r) => r.task.priority === "urgent" && r.task.status !== "done")
      : f === "today"
        ? rows.filter((r) => r.task.priority === "today" && r.task.status !== "done")
        : f === "pending"
          ? rows.filter((r) => r.task.status !== "done")
          : f === "done"
            ? rows.filter((r) => r.task.status === "done")
            : rows;

  let body;
  if (f === "discharge") {
    body =
      dischargeRows.length === 0
        ? emptyState(I.heart(iconStyle(32)), "אין שחרורים מתוכננים", "מטופלים שיסומנו לשחרור היום או מחר יופיעו כאן.")
        : `<ul class="task-rows">${dischargeRows.map(dischargeRow).join("")}</ul>`;
  } else if (visible.length === 0) {
    body = emptyState(I.clipboard(iconStyle(32)), "אין משימות בתצוגה זו", "בחרו סינון אחר כדי לראות משימות נוספות.");
  } else {
    body = `<ul class="task-rows tight">${visible.map(taskBoardRow).join("")}</ul>`;
  }

  return `
  ${header({ back: { to: "rooms", label: "חזרה לחדרים" } })}
  <main id="main"><div class="ward">
    <h1 class="room-title">משימות המחלקה</h1>
    <p class="room-sub">${counts.pending === 0 ? "אין משימות פתוחות במחלקה" : `${counts.pending} משימות פתוחות`}</p>

    <div class="filters" role="tablist" aria-label="סינון משימות">${TASK_FILTERS.map(
      ([key, label]) =>
        `<button class="filter-chip${f === key ? " on" : ""}" role="tab" aria-selected="${f === key}" data-filter="${key}">${esc(label)}<span class="tnum" style="opacity:.7">${counts[key]}</span></button>`,
    ).join("")}</div>

    ${body}
  </div></main>
  ${footer()}`;
}

function taskBoardRow({ task, patient, roomNumber }) {
  const done = task.status === "done";
  return `<li><div class="board-row">
    <button class="check${done ? " done" : ""}" data-board-status="${task.id}" data-board-patient="${patient.id}"
      aria-label="${done ? `סימון "${esc(task.title)}" כממתין` : `סימון "${esc(task.title)}" כבוצע`}">
      ${done ? I.check('style="width:12px;height:12px"') : ""}
    </button>
    <div style="min-width:0;flex:1">
      <p class="title${done ? " done" : ""}">${esc(task.title)}</p>
      <p class="who">
        <button data-patient="${patient.id}">${esc(patient.name)}</button>
        <span>· חדר <span class="tnum">${roomNumber}</span></span>
        <span>· מיטה <span class="tnum">${patient.bed}</span></span>
        <span>· ${esc(TASK_STATUS[task.status].label)}</span>
        ${task.timing ? `<span>· ${esc(task.timing)}</span>` : ""}
      </p>
    </div>
    <div class="end">
      ${pill(TASK_PRIORITY[task.priority], "sm")}
      <button class="icon-btn sm" data-patient="${patient.id}" aria-label="פתיחת ${esc(patient.name)}">${I.chevron(iconStyle(16))}</button>
    </div>
  </div></li>`;
}

function dischargeRow(patient) {
  const d = activeDischarge(patient);
  const open = d.blockers.filter((b) => !b.resolved);
  return `<li><button class="board-row discharge-row" data-patient="${patient.id}">
    <span style="min-width:0;flex:1;text-align:start">
      <span style="display:block;font-size:16px;font-weight:600;color:var(--navy-deep)">${esc(patient.name)}</span>
      <span style="display:block;margin-top:2px;font-size:12px;color:var(--ink-muted)">חדר <span class="tnum">${getRoom(patient.roomId).number}</span>, מיטה <span class="tnum">${patient.bed}</span> · ${esc(patient.primaryDiagnosis)}</span>
    </span>
    ${pill(DISCHARGE_STATUS[d.status])}
    <span style="font-size:13px;font-weight:500;color:${open.length === 0 ? "var(--stable)" : "var(--attention)"}">
      ${open.length === 0 ? "אין חסמים" : `${open.length} חסמים פתוחים`}
    </span>
  </button></li>`;
}
