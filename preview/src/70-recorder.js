/* ===========================================================================
   The round recorder — ported from components/recording/RecordingBar.tsx.

   התחל סבב → הקלטה → תמלול בזמן אמת → AI ממיין → סקירת טיוטה → עריכה → אישור סבב

   Two rules shape everything here. Nothing it produces enters the record before
   ״אישור סבב״. And it never claims to be transcribing when it isn't — every
   failure mode has its own visible state rather than a silent stall.

   In this embedded preview the browser-engine option is offered exactly as the
   application offers it, and if the sandbox refuses microphone access the real
   error state appears. The scripted engine is the default here and is labelled
   as scripted wherever it shows, because a demo that looks like live
   transcription but isn't would be exactly the dishonesty this product cannot
   afford.
   =========================================================================== */

/** How long after speech settles before the transcript is sent for structuring.
 *  Long enough not to fire mid-sentence, short enough that the doctor sees the
 *  record fill in while they're still at the bedside. */
const EXTRACT_DEBOUNCE_MS = 2200;

const rec = {
  phase: "idle", // idle | preparing | ready | recording | paused | structuring | review | failed
  patientId: null,
  engineId: "demo",
  seconds: 0,
  level: 0,
  finalText: "",
  partialText: "",
  error: null,
  aiNote: null,
  aiEngine: null,
  provider: null,
  /** Folded down to a compact strip so it stops covering the record. */
  folded: false,
  clock: null,
  debounce: null,
  waveRaf: 0,
};

/* ------------------------------------------------------------- providers --*/

const SCRIPT = [
  { text: "היה לו חום 39 בלילה", delay: 1400 },
  { text: "לחץ דם 105 על 65", delay: 1800 },
  { text: "עדיין משתעל", delay: 1500 },
  { text: "ברקע סוכרת ויתר לחץ דם", delay: 2000 },
  { text: "גר לבד והבת שלו עוזרת לו", delay: 2200 },
  { text: "נעשה צילום חזה היום ונחזור על ספירת דם", delay: 2400 },
  { text: "כנראה דלקת ריאות", delay: 1600 },
  { text: "אם יהיה שיפור אולי נוכל לשחרר מחר", delay: 2200 },
];

class DemoProvider {
  constructor() {
    this.id = "demo";
    this.label = "הדגמה מוקלטת מראש";
    this.description = "טקסט קבוע מראש להדגמה ללא מיקרופון. אינו מתמלל דיבור אמיתי.";
    this.onDevice = true;
    this.events = {};
    this.timers = [];
    this.levelTimer = 0;
    this.index = 0;
    this.paused = false;
  }
  isSupported() {
    return true;
  }
  async prepare(events) {
    this.events = events;
    this.index = 0;
    events.onStatus && events.onStatus("ready");
  }
  async start() {
    this.paused = false;
    this.events.onStatus && this.events.onStatus("recording");
    this.animateLevel();
    this.queueNext();
  }
  queueNext() {
    if (this.paused || this.index >= SCRIPT.length) return;
    const line = SCRIPT[this.index];
    const timer = setTimeout(() => {
      if (this.paused) return;
      // A partial first, then the settled line — the same shape a real engine
      // produces, so the UI is exercised identically.
      this.events.onPartial && this.events.onPartial(line.text.slice(0, Math.ceil(line.text.length / 2)));
      const settle = setTimeout(() => {
        if (this.paused) return;
        this.events.onFinal && this.events.onFinal(line.text);
        this.index += 1;
        this.queueNext();
      }, 420);
      this.timers.push(settle);
    }, line.delay);
    this.timers.push(timer);
  }
  animateLevel() {
    let t = 0;
    const step = () => {
      t += 0.1;
      const level = this.paused ? 0 : 0.25 + Math.abs(Math.sin(t * 1.7)) * 0.4 + Math.random() * 0.12;
      this.events.onLevel && this.events.onLevel(Math.min(1, level));
      this.levelTimer = requestAnimationFrame(step);
    };
    step();
  }
  pause() {
    this.paused = true;
    this.clearTimers();
    this.events.onLevel && this.events.onLevel(0);
    this.events.onStatus && this.events.onStatus("paused");
  }
  resume() {
    this.paused = false;
    this.events.onStatus && this.events.onStatus("recording");
    this.queueNext();
  }
  async stop() {
    this.paused = true;
    this.clearTimers();
    cancelAnimationFrame(this.levelTimer);
    this.events.onLevel && this.events.onLevel(0);
    this.events.onStatus && this.events.onStatus("ready");
  }
  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  dispose() {
    this.clearTimers();
    cancelAnimationFrame(this.levelTimer);
  }
}

const speechCtor = () =>
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition || null : null;

/** The audio is processed by the browser vendor's service, not on this device.
 *  That is stated plainly in the engine picker rather than buried, because it
 *  is exactly the property that would disqualify it for real patients. */
class WebSpeechProvider {
  constructor() {
    this.id = "web-speech";
    this.label = "מנוע דפדפן";
    this.description = "תמלול עברית מהיר וללא הורדה. השמע מעובד בשירות של הדפדפן ולא במכשיר.";
    this.onDevice = false;
    this.events = {};
    this.recognition = null;
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.raf = 0;
    this.running = false;
    this.paused = false;
    this.restarting = false;
  }
  isSupported() {
    return speechCtor() !== null;
  }
  async prepare(events) {
    this.events = events;
    const Ctor = speechCtor();
    if (!Ctor) {
      events.onError &&
        events.onError({
          code: "unsupported",
          message: "הדפדפן הזה אינו תומך בתמלול חי. בחרו מנוע אחר.",
          retryable: false,
        });
      events.onStatus && events.onStatus("error");
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      events.onError && events.onError(micError(err));
      events.onStatus && events.onStatus("error");
      return;
    }
    this.meter();

    const r = new Ctor();
    r.lang = "he-IL";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const res = e.results[i];
        if (res.isFinal) this.events.onFinal && this.events.onFinal(res[0].transcript.trim());
        else interim += res[0].transcript;
      }
      if (interim) this.events.onPartial && this.events.onPartial(interim.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      this.events.onError &&
        this.events.onError({
          code: e.error === "not-allowed" ? "permission-denied" : "unknown",
          message:
            e.error === "not-allowed"
              ? "הגישה למיקרופון נחסמה. יש לאשר גישה בהגדרות הדפדפן ולנסות שוב."
              : "התמלול נעצר. נסו שוב.",
          retryable: true,
        });
      this.events.onStatus && this.events.onStatus("error");
    };
    // Chrome ends the session after a silence; restart so a round can run as
    // long as the doctor is in the room.
    r.onend = () => {
      if (this.running && !this.paused) {
        this.restarting = true;
        try {
          r.start();
        } catch {
          /* already starting */
        }
      }
    };
    this.recognition = r;
    events.onStatus && events.onStatus("ready");
  }
  meter() {
    if (!this.stream) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);
    const buf = new Uint8Array(this.analyser.fftSize);
    const step = () => {
      this.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      this.events.onLevel && this.events.onLevel(Math.min(1, rms * 4));
      this.raf = requestAnimationFrame(step);
    };
    step();
  }
  async start() {
    if (!this.recognition) return;
    this.running = true;
    this.paused = false;
    try {
      this.recognition.start();
    } catch {
      /* already running */
    }
    this.events.onStatus && this.events.onStatus("recording");
  }
  pause() {
    this.paused = true;
    this.recognition && this.recognition.stop();
    this.events.onStatus && this.events.onStatus("paused");
  }
  resume() {
    this.paused = false;
    try {
      this.recognition && this.recognition.start();
    } catch {
      /* already running */
    }
    this.events.onStatus && this.events.onStatus("recording");
  }
  async stop() {
    this.running = false;
    this.paused = true;
    this.recognition && this.recognition.stop();
    this.events.onStatus && this.events.onStatus("ready");
  }
  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    try {
      this.recognition && this.recognition.abort();
    } catch {
      /* ignore */
    }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) this.ctx.close();
    this.recognition = null;
    this.stream = null;
    this.ctx = null;
  }
}

function micError(err) {
  const name = (err && err.name) || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      code: "permission-denied",
      message: "הגישה למיקרופון נחסמה. יש לאשר גישה בהגדרות הדפדפן ולנסות שוב.",
      retryable: true,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { code: "no-microphone", message: "לא נמצא מיקרופון מחובר. חברו מיקרופון ונסו שוב.", retryable: true };
  }
  if (name === "NotReadableError") {
    return { code: "no-microphone", message: "המיקרופון תפוס על ידי יישום אחר. סגרו אותו ונסו שוב.", retryable: true };
  }
  return { code: "unknown", message: "לא ניתן להפעיל את המיקרופון. נסו שוב.", retryable: true };
}

function createProvider(id) {
  return id === "web-speech" ? new WebSpeechProvider() : new DemoProvider();
}

function listEngines() {
  return [new WebSpeechProvider(), new DemoProvider()].map((p) => {
    const option = {
      id: p.id,
      label: p.label,
      description: p.description,
      onDevice: p.onDevice,
      supported: p.isSupported(),
    };
    p.dispose && p.dispose();
    return option;
  });
}

/* ------------------------------------------------------------------- bar --*/

function stateLabel(phase) {
  switch (phase) {
    case "preparing": return "מתחבר למיקרופון…";
    case "ready": return "מוכן להקלטה";
    case "recording": return "מקליט…";
    case "paused": return "מושהה";
    case "structuring": return "מסדר את המידע…";
    case "review": return "טיוטה לסקירה";
    case "failed": return "ההקלטה נעצרה";
    default: return "מוכן להקלטה";
  }
}

function formatClock(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function recordingBar(p) {
  const phase = rec.patientId === p.id ? rec.phase : "idle";
  const isDraft = p.draftClinicalData !== null;
  const engines = listEngines();
  const engine = engines.find((e) => e.id === rec.engineId);
  const transcript = [rec.finalText, rec.partialText].filter(Boolean).join(" ");

  // Folded: the bar shrinks to the mic, the state and the way back out, and
  // gives the record underneath it back to the reader. Nothing about the round
  // pauses — the timer runs, the transcript keeps accumulating, and the AI
  // keeps filling the sections the reader can now see.
  if (rec.folded) {
    return `<div class="rec-wrap" id="rec-wrap">
      <section class="rec folded ${phase}" aria-label="הקלטת סבב — מכווץ">
        <div class="strip">
          <button class="mic${phase === "recording" ? " on" : phase === "paused" ? " paused" : ""}"
            data-rec="${phase === "recording" ? "pause" : phase === "paused" ? "resume" : "begin"}"
            ${phase === "preparing" || phase === "structuring" ? "disabled" : ""}
            aria-label="${phase === "recording" ? "השהיית ההקלטה" : phase === "paused" ? "המשך ההקלטה" : "התחלת סבב מוקלט"}">
            ${I.mic(iconStyle(20))}
            ${phase === "recording" ? `<span class="ring ring-1" aria-hidden="true"></span><span class="ring ring-2" aria-hidden="true"></span>` : ""}
          </button>
          <div class="state">
            <p class="t">${esc(stateLabel(phase))}</p>
            ${phase === "recording" || phase === "paused" ? `<p class="s tnum">${formatClock(rec.seconds)}</p>` : ""}
          </div>
          ${phase === "recording" || phase === "paused" ? `<button class="btn quiet sm" data-rec="stop">${I.stop(iconStyle(16))}סיום</button>` : ""}
          ${phase === "review" || isDraft ? `<button class="btn primary sm" data-rec="approve">${I.check(iconStyle(16))}אישור סבב</button>` : ""}
          <button class="fold-btn" data-rec="unfold" aria-label="הרחבת סרגל ההקלטה" title="הרחבה">
            ${I.chevronUp(iconStyle(18))}
          </button>
        </div>
      </section>
    </div>`;
  }

  const notices =
    rec.error || rec.aiNote
      ? `<div class="notices">
          ${
            rec.error
              ? `<p class="notice ${rec.error.code === "no-audio" ? "warn" : "err"}" role="alert">${I.alert(iconStyle(16))}<span>${esc(rec.error.message)}</span>${
                  rec.error.retryable && phase === "failed" ? `<button data-rec="begin">נסו שוב</button>` : ""
                }</p>`
              : ""
          }
          ${rec.aiNote ? `<p class="notice info">${I.sparkle(iconStyle(16))}${esc(rec.aiNote)}</p>` : ""}
        </div>`
      : "";

  let controls = "";
  if (phase === "idle" || phase === "failed") {
    controls = `
      <div class="engine-wrap">
        <button class="engine-btn" data-rec="engines" aria-expanded="${state.enginePickerOpen}">מנוע תמלול${I.chevronDown(iconStyle(16))}</button>
        ${
          state.enginePickerOpen
            ? `<ul class="engine-menu">${engines
                .map(
                  (e) => `<li><button class="${e.id === rec.engineId ? "on" : ""}" ${e.supported ? `data-engine="${e.id}"` : "disabled"}>
                    <span class="name">${esc(e.label)}${e.id === rec.engineId ? I.check('style="width:16px;height:16px;color:var(--navy)"') : ""}
                      <span class="tag" style="${
                        e.onDevice
                          ? "border-color:var(--stable-line);background:var(--stable-bg);color:var(--stable)"
                          : "border-color:var(--attention-line);background:var(--attention-bg);color:var(--attention)"
                      }">${e.onDevice ? "על המכשיר" : "שירות חיצוני"}</span>
                    </span>
                    <span class="desc">${esc(e.supported ? e.description : "אינו נתמך בדפדפן הזה.")}</span>
                  </button></li>`,
                )
                .join("")}</ul>`
            : ""
        }
      </div>
      <button class="btn primary lg" data-rec="begin">${I.mic(iconStyle(18))}התחל סבב</button>`;
  } else if (phase === "recording" || phase === "paused") {
    controls = `
      <button class="btn quiet" data-rec="${phase === "recording" ? "pause" : "resume"}">${I.pause(iconStyle(18))}${phase === "recording" ? "השהיה" : "המשך"}</button>
      <button class="btn quiet" data-rec="stop">${I.stop(iconStyle(18))}סיום</button>`;
  } else if (phase === "structuring") {
    controls = `<span class="working">${I.sparkle('class="rec-dot" style="width:18px;height:18px"')}ה־AI ממיין את המידע…<span class="bar scanning" aria-hidden="true"></span></span>`;
  }

  if (phase === "review" || (isDraft && (phase === "idle" || phase === "failed"))) {
    controls += `
      <button class="icon-btn danger" aria-label="ביטול הטיוטה" title="ביטול הטיוטה" data-rec="cancel">${I.trash(iconStyle(18))}</button>
      <button class="btn quiet" data-rec="begin">${I.mic(iconStyle(18))}המשך הקלטה</button>
      <button class="btn primary lg" data-rec="approve">${I.check(iconStyle(18))}אישור סבב</button>`;
  }

  return `<div class="rec-wrap" id="rec-wrap">
    <section class="rec ${phase}" aria-label="הקלטת סבב">
      ${notices}
      <div class="strip">
        <div class="mic-block">
          <button class="mic${phase === "recording" ? " on" : phase === "paused" ? " paused" : ""}"
            data-rec="${phase === "recording" ? "pause" : phase === "paused" ? "resume" : "begin"}"
            ${phase === "preparing" || phase === "structuring" ? "disabled" : ""}
            aria-label="${phase === "recording" ? "השהיית ההקלטה" : phase === "paused" ? "המשך ההקלטה" : "התחלת סבב מוקלט"}">
            ${I.mic(iconStyle(24))}
            ${phase === "recording" ? `<span class="ring ring-1" aria-hidden="true"></span><span class="ring ring-2" aria-hidden="true"></span>` : ""}
          </button>
          <div class="state">
            <p class="t">${esc(stateLabel(phase))}</p>
            <p class="s tnum">${phase === "idle" || phase === "failed" ? esc(engine ? engine.label : "") : formatClock(rec.seconds)}</p>
          </div>
        </div>

        <div class="wave"><canvas id="rec-wave"></canvas></div>

        <div class="said">
          <p aria-live="polite">${
            transcript
              ? `${esc(rec.finalText)}${rec.partialText ? ` <span class="muted">${esc(rec.partialText)}</span>` : ""}`
              : `<span class="muted">${phase === "idle" ? "לחצו כדי להתחיל סבב מוקלט" : "ממתין לדיבור…"}</span>`
          }</p>
        </div>

        <div class="controls">${controls}</div>

        <button class="fold-btn" data-rec="fold" aria-label="כיווץ סרגל ההקלטה" title="כיווץ">
          ${I.chevronDown(iconStyle(18))}
        </button>
      </div>

      ${
        phase === "review" || isDraft
          ? `<p class="draft-strip">${I.sparkle(iconStyle(16))}טיוטת AI — יש לעבור על המידע לפני אישור.${
              rec.aiEngine ? `<span class="who">· ${esc(rec.aiEngine)}</span>` : ""
            }</p>`
          : ""
      }
    </section>
  </div>`;
}

/* ---------------------------------------------------------------- runtime -*/

function refreshRecorder() {
  const node = document.getElementById("rec-wrap");
  const p = getPatient(state.patientId);
  if (!node || !p) return;
  node.outerHTML = recordingBar(p);
}

function refreshRecord() {
  const grid = document.querySelector(".patient-grid");
  const p = getPatient(state.patientId);
  if (!grid || !p) return;
  grid.innerHTML = clinicalRecord(p, false) + operationalColumn(p);
  armReveals(grid);
  focusEditor();
}

function focusEditor() {
  const input = document.querySelector('input[data-editor="1"]');
  if (!input) return;
  input.focus();
  input.select();
}

/** The waveform: bars driven by the live level, flat when nothing is running. */
function mountRecorder() {
  if (rec.waveRaf) return;
  const bars = 48;
  const history = new Array(bars).fill(0);
  let last = 0;

  const step = (now) => {
    rec.waveRaf = requestAnimationFrame(step);
    const canvas = document.getElementById("rec-wave");
    if (!canvas) return;
    if (now - last < 33) return;
    last = now;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx || !w || !h) return;

    const active = rec.phase === "recording";
    history.shift();
    history.push(active ? rec.level : 0);

    ctx.clearRect(0, 0, w, h);
    const bw = w / bars;
    for (let i = 0; i < bars; i += 1) {
      const v = history[i];
      const bh = Math.max(2 * dpr, v * h * 0.86);
      const x = i * bw;
      ctx.fillStyle = active ? "rgba(153,58,52,.62)" : "rgba(168,158,142,.42)";
      ctx.fillRect(x + bw * 0.28, (h - bh) / 2, bw * 0.44, bh);
    }
  };
  rec.waveRaf = requestAnimationFrame(step);
}

/* ------------------------------------------------------------ round flow --*/

function runExtraction() {
  const transcript = rec.finalText.trim();
  const p = getPatient(rec.patientId);
  if (!transcript || !p) return;

  const extraction = extractByRules(transcript);
  applyExtractionTo(p, extraction);
  rec.aiEngine = "מנוע כללים מקומי";
  // In the application the fallback announces itself; here it is always the
  // fallback, so it always says so.
  rec.aiNote = "אין מפתח API בתצוגה המוטמעת — המידע סודר במנוע הכללים העברי המקומי.";
  refreshRecord();
  refreshRecorder();
}

function scheduleExtraction() {
  clearTimeout(rec.debounce);
  rec.debounce = setTimeout(runExtraction, EXTRACT_DEBOUNCE_MS);
}

function teardownProvider() {
  if (rec.provider) rec.provider.dispose();
  rec.provider = null;
  clearTimeout(rec.debounce);
  clearInterval(rec.clock);
  rec.clock = null;
}

async function beginRound() {
  const p = getPatient(state.patientId);
  if (!p) return;

  teardownProvider();
  rec.patientId = p.id;
  rec.error = null;
  rec.aiNote = null;
  rec.seconds = 0;
  rec.finalText = "";
  rec.partialText = "";
  rec.phase = "preparing";
  startRound(p.id);
  refreshRecord();
  refreshRecorder();

  const provider = createProvider(rec.engineId);
  rec.provider = provider;

  await provider.prepare({
    onStatus: (status) => {
      if (status === "recording") rec.phase = "recording";
      else if (status === "paused") rec.phase = "paused";
      else if (status === "error") rec.phase = "failed";
      refreshRecorder();
    },
    onError: (err) => {
      rec.error = err;
      if (err.code !== "no-audio") rec.phase = "failed";
      refreshRecorder();
    },
    onLevel: (v) => {
      rec.level = v;
    },
    onPartial: (text) => {
      rec.partialText = text;
      refreshRecorder();
    },
    onFinal: (text) => {
      rec.partialText = "";
      // One line per settled utterance — see the note in normalise(). It reads
      // identically: the transcript is rendered in a paragraph, where the
      // newline collapses back to a space.
      rec.finalText = `${rec.finalText}\n${text}`.trim();
      p.lastTranscript = rec.finalText;
      refreshRecorder();
      scheduleExtraction();
    },
  });

  if (rec.provider !== provider) return; // superseded
  if (rec.phase === "failed") return;

  await provider.start();
  clearInterval(rec.clock);
  rec.clock = setInterval(() => {
    if (rec.phase !== "recording") return;
    rec.seconds += 1;
    refreshRecorder();
  }, 1000);
}

async function stopRound() {
  clearTimeout(rec.debounce);
  rec.phase = "structuring";
  refreshRecord();
  refreshRecorder();
  if (rec.provider) {
    await rec.provider.stop();
    rec.provider.dispose();
    rec.provider = null;
  }
  clearInterval(rec.clock);
  // A visible beat for the structuring pass, matching the application's own
  // round trip to the API.
  setTimeout(() => {
    runExtraction();
    rec.phase = "review";
    refreshRecord();
    refreshRecorder();
  }, 900);
}

function cancelRound() {
  teardownProvider();
  const p = getPatient(state.patientId);
  if (p) discardRound(p.id);
  Object.assign(rec, {
    phase: "idle", seconds: 0, finalText: "", partialText: "",
    error: null, aiNote: null, aiEngine: null, level: 0,
  });
  refreshRecord();
  refreshRecorder();
}

/** The review gate. */
function confirmRound() {
  teardownProvider();
  const p = getPatient(state.patientId);
  if (p) approveRound(p.id);
  Object.assign(rec, {
    phase: "idle", seconds: 0, finalText: "", partialText: "",
    error: null, aiNote: null, aiEngine: null, level: 0,
  });
  render();
}
