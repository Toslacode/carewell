import type { Patient, Room } from "@/lib/schemas/clinical";
import {
  CONSULT_STATE,
  DISCHARGE_STATUS,
  VITAL_LABELS,
} from "@/lib/labels";

/**
 * עוזר המחלקה — questions answered from the ward's own data.
 *
 * A retrieval engine, not a language model. It searches the records that are
 * actually loaded, counts what it finds, and answers with the patients it
 * matched — name, room, bed, and the line that matched — so every answer can be
 * checked against the record it came from.
 *
 * That shape is deliberate. An assistant that paraphrases confidently and cites
 * nothing is worse than none at all: "who is on morphine?" is exactly the
 * question where a plausible wrong answer does harm. So it never writes a
 * clinical sentence of its own — it quotes, counts and links.
 *
 * When ANTHROPIC_API_KEY is set, /api/assistant lets Claude choose which
 * patients answer the question and write the one-line summary; the quotes and
 * the links are still assembled here, from the record. The model can be wrong
 * about relevance — it cannot invent a patient or a line of chart.
 */

export interface AssistantHit {
  patientId: string;
  /** Section the matching line came from — "מעבדה", "תכנית טיפול", … */
  where: string;
  quote: string;
}

export interface AssistantAnswer {
  headline: string;
  hits: AssistantHit[];
  note: string | null;
  /** Terms that actually matched, for highlighting inside the quotes. */
  terms: string[];
  engine: "rules" | "claude";
}

export interface WardSnapshot {
  rooms: Room[];
  patients: Record<string, Patient>;
}

/* --------------------------------------------------------------- vocabulary */

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

interface Intent {
  id: string;
  test: RegExp;
  /** Vocabulary the intent already accounts for. A content word outside both
   *  this and `test` means the question is about something else. */
  absorbs: RegExp;
  run: (w: WardSnapshot) => Omit<AssistantAnswer, "terms" | "engine">;
}

const INTENTS: Intent[] = [
  {
    id: "urgent",
    test: /דחוף|דחופ|בדחיפות|urgent/i,
    absorbs: /^(משימ|פעול|פתוח|סגור|עכשיו|מיידי|נשאר)/,
    run: (w) => {
      const rows = allTasks(w).filter(
        (r) => r.task.priority === "urgent" && r.task.status !== "done",
      );
      const people = new Set(rows.map((r) => r.patient.id)).size;
      return {
        headline:
          rows.length === 0
            ? "אין משימות דחופות פתוחות במחלקה."
            : `${rows.length} משימות דחופות פתוחות, אצל ${people} מטופלים.`,
        hits: rows.map((r) => ({
          patientId: r.patient.id,
          quote: r.task.title,
          where: "משימה דחופה",
        })),
        note: null,
      };
    },
  },
  {
    id: "discharge",
    test: /שחרור|לשחרר|משחרר|הביתה/,
    absorbs: /^(מתוכננ|צפוי|אפשר|מוכנ|היום|מחר|קרוב|רשימ)/,
    run: (w) => {
      const list = patients(w).filter((p) => {
        const d = discharge(p);
        return d.status === "today" || d.status === "tomorrow";
      });
      return {
        headline:
          list.length === 0
            ? "אין שחרורים מתוכננים להיום או למחר."
            : `${list.length} מטופלים מסומנים לשחרור אפשרי היום או מחר.`,
        hits: list.map((p) => {
          const d = discharge(p);
          const open = d.blockers.filter((b) => !b.resolved).length;
          return {
            patientId: p.id,
            where: "שחרור",
            quote: `${DISCHARGE_STATUS[d.status].label} · ${open === 0 ? "אין חסמים" : `${open} חסמים פתוחים`}`,
          };
        }),
        note: null,
      };
    },
  },
  {
    id: "blockers",
    test: /חסם|חסמים|מעכב|תקוע/,
    absorbs: /^(פתוח|שחרור|נשאר|רשימ|לשחרור)/,
    run: (w) => {
      const hits: AssistantHit[] = [];
      for (const p of patients(w)) {
        for (const b of discharge(p).blockers) {
          if (!b.resolved) {
            hits.push({ patientId: p.id, quote: b.text, where: "חסם לשחרור" });
          }
        }
      }
      const people = new Set(hits.map((h) => h.patientId)).size;
      return {
        headline:
          hits.length === 0
            ? "אין חסמי שחרור פתוחים במחלקה."
            : `${hits.length} חסמי שחרור פתוחים אצל ${people} מטופלים.`,
        hits,
        note: null,
      };
    },
  },
  {
    id: "consults",
    test: /ייעוץ|יעוץ|ייעוצים|יועץ|התייעצות/,
    absorbs: /^(ממתינ|פתוח|נדרש|הוזמנ|רשימ|הושלמ)/,
    run: (w) => {
      const hits: AssistantHit[] = [];
      for (const p of patients(w)) {
        for (const c of consults(p)) {
          if (c.state !== "completed") {
            hits.push({
              patientId: p.id,
              where: "ייעוץ",
              quote: `${c.specialty} — ${CONSULT_STATE[c.state].label}`,
            });
          }
        }
      }
      return {
        headline:
          hits.length === 0 ? "אין ייעוצים פתוחים." : `${hits.length} ייעוצים שטרם הושלמו.`,
        hits,
        note: null,
      };
    },
  },
  {
    id: "attention",
    test: /תשומת\s*לב|מצב\s*קשה|לא\s*יציב|מדאיג|החמרה/,
    absorbs: /^(תשומת|דורש|מצב|קשה|יציב|רשימ)/,
    run: (w) => {
      const list = patients(w).filter((p) => p.status === "attention");
      return {
        headline:
          list.length === 0
            ? "אין מטופלים המסומנים כדורשים תשומת לב."
            : `${list.length} מטופלים מסומנים כדורשים תשומת לב.`,
        hits: list.map((p) => ({
          patientId: p.id,
          quote: p.primaryDiagnosis,
          where: "אבחנה עיקרית",
        })),
        note: null,
      };
    },
  },
  {
    id: "beds",
    test: /פנוי|פנויים|מקום|תפוסה|מיטות/,
    absorbs: /^(חדר|חדרים|מיט|תפוס|מקום|אשפוז)/,
    run: (w) => {
      const empty = w.rooms.filter((r) => r.status === "empty");
      const unavailable = w.rooms.filter((r) => r.status === "unavailable");
      return {
        headline: `${patients(w).length} מטופלים מאושפזים. ${empty.length} חדרים פנויים${
          unavailable.length ? `, ${unavailable.length} חדרים אינם פעילים` : ""
        }.`,
        hits: [],
        note: empty.length
          ? `חדרים פנויים: ${empty.map((r) => r.number).join(", ")}.`
          : null,
      };
    },
  },
];

/* ------------------------------------------------------------------ reading */

const patients = (w: WardSnapshot) => Object.values(w.patients);
const data = (p: Patient) => p.draftClinicalData ?? p.approvedClinicalData;
const tasksOf = (p: Patient) => (p.draftClinicalData ? p.draftTasks : p.tasks);
const consults = (p: Patient) =>
  p.draftClinicalData ? p.draftConsultations : p.consultations;
const discharge = (p: Patient) =>
  (p.draftClinicalData ? p.draftDischarge : p.discharge) ?? p.discharge;

function allTasks(w: WardSnapshot) {
  return patients(w).flatMap((patient) =>
    tasksOf(patient).map((task) => ({ task, patient })),
  );
}

/** Every line of a patient's record, tagged with the section it came from, so a
 *  match can say where it was found instead of only that it was. */
export function searchableLines(p: Patient): Array<{ where: string; text: string }> {
  const d = data(p);
  const out: Array<{ where: string; text: string }> = [
    { where: "אבחנה עיקרית", text: p.primaryDiagnosis },
    { where: "קופה", text: p.hmo },
  ];
  const push = (where: string, items: { text: string }[]) =>
    items.forEach((i) => out.push({ where, text: i.text }));

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

  for (const t of tasksOf(p)) out.push({ where: "משימה", text: t.title });
  for (const c of consults(p)) out.push({ where: "ייעוץ", text: c.specialty });
  for (const b of discharge(p).blockers) out.push({ where: "חסם לשחרור", text: b.text });
  for (const [key, meta] of Object.entries(VITAL_LABELS)) {
    const v = d.vitals[key as keyof typeof d.vitals];
    if (v) out.push({ where: meta.label, text: `${meta.label} ${v.value}` });
  }
  return out;
}

/* ------------------------------------------------------------------ matching */

/**
 * Hebrew prefixes attach to the noun, and can be on either side of the
 * comparison: the question says "מסוכרת" while the record says "סוכרת", or the
 * question says "סוכרת" while the record says "בסוכרת".
 *
 * Only the leading side is ever loosened. A trailing letter makes a different
 * word — סוכר is sugar, סוכרת is diabetes — and matching across that would be
 * the same bug the extractor already had.
 */
const HE_PREFIX = /^[בהולכמש]{1,2}(?=[֐-׿]{3,})/;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function termVariants(term: string): string[] {
  const base = term.toLowerCase();
  const stripped = base.replace(HE_PREFIX, "");
  return stripped !== base ? [base, stripped] : [base];
}

export function termMatches(line: string, term: string): boolean {
  const haystack = line.toLowerCase();
  for (const v of termVariants(term)) {
    if (haystack.includes(v)) return true;
    const withPrefix = new RegExp(
      `(?:^|[^\\u0590-\\u05FFa-z0-9])[בהולכמש]{1,2}${escapeRe(v)}`,
      "i",
    );
    if (withPrefix.test(haystack)) return true;
  }
  return false;
}

export function questionTerms(question: string): string[] {
  return question
    .replace(/[?!.,;:״"׳']/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/* --------------------------------------------------------------------- main */

export function askWard(question: string, ward: WardSnapshot): AssistantAnswer {
  const q = question.trim();
  const words = questionTerms(q);

  // A fixed intent wins only when every content word belongs to it. One word it
  // cannot account for means the question is about something else, and free
  // search will do better.
  for (const intent of INTENTS) {
    if (!intent.test.test(q)) continue;
    const unaccounted = words.filter(
      (w) => !intent.test.test(w) && !intent.absorbs.test(w),
    );
    if (unaccounted.length === 0) {
      return { ...intent.run(ward), terms: [], engine: "rules" };
    }
  }

  if (words.length === 0) {
    return {
      headline: "לא זיהיתי מונח לחיפוש בשאלה.",
      hits: [],
      note: "אפשר לשאול למשל: כמה מטופלים מקבלים מורפיום · מי דחוף · אילו שחרורים מתוכננים · חסמים פתוחים.",
      terms: [],
      engine: "rules",
    };
  }

  const matches = [];
  for (const p of patients(ward)) {
    const hits: Array<{ where: string; text: string }> = [];
    const covered = new Set<string>();
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
  // who satisfy the most of it. Falling back to OR would quietly widen
  // "מי סובל מסוכרת" into everyone whose record contains either word.
  const best = matches.reduce((m, r) => Math.max(m, r.covered.size), 0);
  const kept = matches.filter((m) => m.covered.size === best);
  kept.sort(
    (a, b) =>
      b.hits.length - a.hits.length ||
      a.patient.name.localeCompare(b.patient.name, "he"),
  );

  const matched = words.filter((w) => kept.some((m) => m.covered.has(w)));
  const label = (matched.length ? matched : words).join(" ");
  const dropped = words.filter((w) => !matched.includes(w));

  return {
    headline:
      kept.length === 0
        ? `לא נמצאו מטופלים שבמידע שלהם מופיע ״${words.join(" ")}״.`
        : `${kept.length} ${kept.length === 1 ? "מטופל" : "מטופלים"} עם ״${label}״ ברשומה.`,
    hits: kept.map((m) => ({
      patientId: m.patient.id,
      quote: m.hits[0].text,
      where: m.hits[0].where,
    })),
    note:
      kept.length === 0
        ? "החיפוש עובר על כל שמונה הקטגוריות, המשימות, הייעוצים והחסמים. ייתכן שהמונח מנוסח אחרת ברשומה."
        : dropped.length
          ? `לא נמצאה התאמה ל־״${dropped.join(" ")}״ — התשובה מבוססת על שאר המונחים בשאלה.`
          : null,
    terms: matched.length ? matched : words,
    engine: "rules",
  };
}

/* ---------------------------------------------------------------- for Claude */

/**
 * The ward, flattened to the smallest thing a model needs to pick patients:
 * an id, who they are, and every line of their chart. No identifiers beyond the
 * fictitious demo ones, and no free text of ours — just the record.
 */
export function wardDigest(ward: WardSnapshot): string {
  const roomNumber = new Map(ward.rooms.map((r) => [r.id, r.number]));
  return patients(ward)
    .map((p) => {
      const lines = searchableLines(p)
        .map((l) => `  · [${l.where}] ${l.text}`)
        .join("\n");
      return `### ${p.id} | ${p.name} | חדר ${roomNumber.get(p.roomId) ?? "?"} מיטה ${p.bed} | גיל ${p.age}\n${lines}`;
    })
    .join("\n\n");
}

export const ASSISTANT_SUGGESTIONS = [
  "כמה מטופלים מקבלים מורפיום",
  "מי מקבל צפטריאקסון",
  "אילו משימות דחופות פתוחות",
  "אילו שחרורים מתוכננים",
  "מי סובל מסוכרת",
];
