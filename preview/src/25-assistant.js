/* ===========================================================================
   עוזר המחלקה — questions answered from the ward's own data.

   This is a retrieval engine, not a language model. It searches the records
   that are actually loaded, counts what it finds, and answers with the patients
   it matched — name, room, bed and the line that matched — so every answer can
   be checked against the record it came from.

   That shape is deliberate. A ward assistant that paraphrases confidently and
   cites nothing is worse than no assistant at all: the one question a doctor
   asks it ("who is on morphine?") is exactly the question where a plausible
   wrong answer does harm. So it never writes a clinical sentence of its own —
   it quotes, counts, and links.

   In the application this same engine is the fallback, and the primary path
   sends the ward summary to Claude server-side. It matters that the fallback
   is the honest-by-construction one: when the model is unavailable, the
   assistant degrades to quoting the record rather than to guessing.
   =========================================================================== */

/** Words that carry no search signal in a Hebrew ward question. */
const STOPWORDS = new Set([
  "כמה", "מי", "מיהם", "מיהן", "אילו", "איזה", "איזו", "אלו", "מה", "האם", "יש",
  "לי", "לנו", "שלי", "את", "של", "עם", "או", "גם", "כל", "כלל", "הם", "הן",
  "הוא", "היא", "זה", "זאת", "לפי", "על", "אל", "כדי", "עכשיו", "כרגע", "היום",
  "מטופל", "מטופלת", "מטופלים", "מטופלות", "חולה", "חולים", "אנשים", "אדם",
  "במחלקה", "מחלקה", "בחדר", "חדר", "מיטה", "תראה", "תן", "הצג", "רשימה",
  "שלוקחים", "לוקחים", "לוקח", "לוקחת", "מקבלים", "מקבל", "מקבלת", "נמצאים",
  "נמצא", "יושבים", "שיש", "שהם", "שהן", "אשר", "עבור", "בבקשה", "תגיד",
  "כמות", "מספר", "סהכ", "בסך", "הכל", "צריך", "צריכים", "ליום", "כרגיל",
]);

/** Fixed questions the ward asks every morning, recognised before free search
 *  so they answer with the right shape rather than a keyword list. */
const INTENTS = [
  {
    id: "urgent",
    test: /דחוף|דחופ|בדחיפות|urgent/i,
    /** Vocabulary the intent already accounts for. A word outside both this and
     *  `test` means the question is about something else — "אילו מטופלים
     *  דחופים מקבלים מורפיום" is a morphine question, not a priority one. */
    absorbs: /^(משימ|פעול|פתוח|סגור|עכשיו|מיידי|נשאר)/,
    run: () => {
      const rows = allTasks().filter((r) => r.task.priority === "urgent" && r.task.status !== "done");
      return {
        headline:
          rows.length === 0
            ? "אין משימות דחופות פתוחות במחלקה."
            : `${rows.length} משימות דחופות פתוחות, אצל ${new Set(rows.map((r) => r.patient.id)).size} מטופלים.`,
        rows: rows.map((r) => ({ patient: r.patient, quote: r.task.title, where: "משימה דחופה" })),
      };
    },
  },
  {
    id: "discharge",
    test: /שחרור|לשחרר|משחרר|הביתה/,
    absorbs: /^(מתוכננ|צפוי|אפשר|מוכנ|היום|מחר|קרוב|רשימ)/,
    run: () => {
      const list = patientsList().filter((p) => {
        const d = activeDischarge(p);
        return d.status === "today" || d.status === "tomorrow";
      });
      return {
        headline:
          list.length === 0
            ? "אין שחרורים מתוכננים להיום או למחר."
            : `${list.length} מטופלים מסומנים לשחרור אפשרי היום או מחר.`,
        rows: list.map((p) => {
          const d = activeDischarge(p);
          const open = d.blockers.filter((b) => !b.resolved);
          return {
            patient: p,
            quote: `${DISCHARGE_STATUS[d.status].label} · ${open.length === 0 ? "אין חסמים" : `${open.length} חסמים פתוחים`}`,
            where: "שחרור",
          };
        }),
      };
    },
  },
  {
    id: "blockers",
    test: /חסם|חסמים|מעכב|תקוע/,
    absorbs: /^(פתוח|שחרור|נשאר|רשימ|לשחרור)/,
    run: () => {
      const rows = [];
      for (const p of patientsList()) {
        for (const b of activeDischarge(p).blockers) {
          if (!b.resolved) rows.push({ patient: p, quote: b.text, where: "חסם לשחרור" });
        }
      }
      return {
        headline:
          rows.length === 0
            ? "אין חסמי שחרור פתוחים במחלקה."
            : `${rows.length} חסמי שחרור פתוחים אצל ${new Set(rows.map((r) => r.patient.id)).size} מטופלים.`,
        rows,
      };
    },
  },
  {
    id: "consults",
    test: /ייעוץ|יעוץ|ייעוצים|יועץ|התייעצות/,
    absorbs: /^(ממתינ|פתוח|נדרש|הוזמנ|רשימ|הושלמ)/,
    run: () => {
      const rows = [];
      for (const p of patientsList()) {
        for (const c of activeConsults(p)) {
          if (c.state !== "completed") {
            rows.push({ patient: p, quote: `${c.specialty} — ${CONSULT_STATE[c.state].label}`, where: "ייעוץ" });
          }
        }
      }
      return {
        headline:
          rows.length === 0 ? "אין ייעוצים פתוחים." : `${rows.length} ייעוצים שטרם הושלמו.`,
        rows,
      };
    },
  },
  {
    id: "attention",
    test: /תשומת\s*לב|מצב\s*קשה|לא\s*יציב|מדאיג|החמרה/,
    absorbs: /^(תשומת|דורש|מצב|קשה|יציב|רשימ)/,
    run: () => {
      const list = patientsList().filter((p) => p.status === "attention");
      return {
        headline:
          list.length === 0
            ? "אין מטופלים המסומנים כדורשים תשומת לב."
            : `${list.length} מטופלים מסומנים כדורשים תשומת לב.`,
        rows: list.map((p) => ({ patient: p, quote: p.primaryDiagnosis, where: "אבחנה עיקרית" })),
      };
    },
  },
  {
    id: "beds",
    test: /פנוי|פנויים|מקום|תפוסה|מיטות/,
    absorbs: /^(חדר|חדרים|מיט|תפוס|מקום|אשפוז)/,
    run: () => {
      const empty = ward.rooms.filter((r) => r.status === "empty");
      const unavailable = ward.rooms.filter((r) => r.status === "unavailable");
      const total = patientsList().length;
      return {
        headline: `${total} מטופלים מאושפזים. ${empty.length} חדרים פנויים${
          unavailable.length ? `, ${unavailable.length} חדרים אינם פעילים` : ""
        }.`,
        rows: [],
        note: empty.length
          ? `חדרים פנויים: ${empty.map((r) => r.number).join(", ")}.`
          : null,
      };
    },
  },
];

function patientsList() {
  return Object.values(ward.patients);
}

function allTasks() {
  const rows = [];
  for (const p of patientsList()) {
    for (const task of activeTasks(p)) rows.push({ task, patient: p });
  }
  return rows;
}

/** Every line of a patient's record, tagged with the section it came from, so a
 *  match can say where it was found instead of just that it was. */
function searchableLines(p) {
  const d = activeData(p);
  const out = [
    { where: "אבחנה עיקרית", text: p.primaryDiagnosis },
    { where: "קופה", text: p.hmo },
  ];
  const push = (where, items) => items.forEach((i) => out.push({ where, text: i.text }));
  push("תלונה עיקרית", d.chiefComplaint);
  push("מחלות רקע", d.pastMedicalHistory);
  push("סטטוס סוציאלי", d.socialStatus);
  push("בדיקה גופנית", d.tests.physicalExam);
  push("מעבדה", d.tests.labs);
  push("הדמיה", d.tests.imaging);
  push("בדיקות נוספות", d.tests.otherTests);
  push("אבחנת עבודה", d.workingDiagnosis);
  push("תכנית טיפול", d.treatmentPlan);
  push("אחר / הערות", d.other);
  for (const t of activeTasks(p)) out.push({ where: "משימה", text: t.title });
  for (const c of activeConsults(p)) out.push({ where: "ייעוץ", text: c.specialty });
  for (const b of activeDischarge(p).blockers) out.push({ where: "חסם לשחרור", text: b.text });
  for (const key of VITAL_ORDER) {
    const v = d.vitals[key];
    if (v) out.push({ where: VITAL_LABELS[key].label, text: `${VITAL_LABELS[key].label} ${v.value}` });
  }
  return out;
}

/**
 * Hebrew prefixes attach to the noun, and they can be on either side of the
 * comparison: the question says "מסוכרת" while the record says "סוכרת", or the
 * question says "סוכרת" while the record says "בסוכרת". So a term is matched
 * against its own stripped form as well, in both directions.
 *
 * Only the leading side is ever loosened. A trailing letter makes a different
 * word — סוכר is sugar, סוכרת is diabetes — and matching across that would be
 * the same bug the extractor already had.
 */
const HE_PREFIX = /^[בהולכמש]{1,2}(?=[֐-׿]{3,})/;

function termVariants(term) {
  const base = term.toLowerCase();
  const stripped = base.replace(HE_PREFIX, "");
  return stripped !== base ? [base, stripped] : [base];
}

function termMatches(line, term) {
  const haystack = line.toLowerCase();
  for (const v of termVariants(term)) {
    if (haystack.includes(v)) return true;
    if (new RegExp(`(?:^|[^\\u0590-\\u05FFa-z0-9])[בהולכמש]{1,2}${escapeRe(v)}`, "i").test(haystack)) return true;
  }
  return false;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function terms(question) {
  return question
    .replace(/[?!.,;:״"׳']/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/**
 * Answers a question about the ward.
 * Returns { headline, rows, note, terms } — never prose the engine invented.
 */
function askWard(question) {
  const q = (question || "").trim();
  if (!q) return null;

  const words = terms(q);

  // A fixed intent wins only when every content word in the question belongs to
  // it. One word it cannot account for means the question is about something
  // else, and free search will do better.
  for (const intent of INTENTS) {
    if (!intent.test.test(q)) continue;
    const unaccounted = words.filter(
      (w) => !intent.test.test(w) && !(intent.absorbs && intent.absorbs.test(w)),
    );
    if (unaccounted.length === 0) return { ...intent.run(), terms: [], intent: intent.id };
  }

  if (words.length === 0) {
    return {
      headline: "לא זיהיתי מונח לחיפוש בשאלה.",
      rows: [],
      note: "אפשר לשאול למשל: כמה מטופלים מקבלים מורפיום · מי דחוף · אילו שחרורים מתוכננים · חסמים פתוחים.",
      terms: [],
    };
  }

  const matches = [];
  for (const p of patientsList()) {
    const hits = [];
    const covered = new Set();
    for (const line of searchableLines(p)) {
      const on = words.filter((w) => termMatches(line.text, w));
      if (on.length) {
        hits.push(line);
        on.forEach((w) => covered.add(w));
      }
    }
    if (hits.length) matches.push({ patient: p, hits, covered });
  }

  // Best-match, not any-match: a two-word question is answered by the patients
  // who satisfy the most of it. Falling back to OR would quietly widen "מי
  // סובל מסוכרת" into everyone whose record contains either word.
  const best = matches.reduce((m, r) => Math.max(m, r.covered.size), 0);
  const kept = matches.filter((m) => m.covered.size === best);
  kept.sort((a, b) => b.hits.length - a.hits.length || a.patient.name.localeCompare(b.patient.name, "he"));

  const matched = words.filter((w) => kept.some((m) => m.covered.has(w)));
  const label = (matched.length ? matched : words).join(" ");
  const dropped = words.filter((w) => !matched.includes(w));

  return {
    headline:
      kept.length === 0
        ? `לא נמצאו מטופלים שבמידע שלהם מופיע ״${words.join(" ")}״.`
        : `${kept.length} ${kept.length === 1 ? "מטופל" : "מטופלים"} עם ״${label}״ ברשומה.`,
    rows: kept.map((m) => ({ patient: m.patient, quote: m.hits[0].text, where: m.hits[0].where })),
    note:
      kept.length === 0
        ? "החיפוש עובר על כל שמונה הקטגוריות, המשימות, הייעוצים והחסמים. ייתכן שהמונח מנוסח אחרת ברשומה."
        : dropped.length
          ? `לא נמצאה התאמה ל־״${dropped.join(" ")}״ — התשובה מבוססת על שאר המונחים בשאלה.`
          : null,
    terms: matched.length ? matched : words,
  };
}

const ASSISTANT_SUGGESTIONS = [
  "כמה מטופלים מקבלים מורפיום",
  "מי מקבל צפטריאקסון",
  "אילו משימות דחופות פתוחות",
  "אילו שחרורים מתוכננים",
  "מי סובל מסוכרת",
];
