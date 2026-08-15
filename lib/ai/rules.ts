import {
  type Extraction,
  ExtractionSchema,
  emptyExtraction,
} from "@/lib/schemas/clinical";

/**
 * A deterministic Hebrew clinical extractor.
 *
 * This is the fallback whenever the Claude API is unavailable — no key, no
 * network, or a response that fails validation — and it is also what makes the
 * prototype demonstrable on a stage with no connectivity and reproducible
 * between runs.
 *
 * It is deliberately conservative. It recognises the phrasings doctors actually
 * use on a round and leaves everything else alone: a fragment it cannot place
 * goes to needsReview rather than being pushed into a clinical category on a
 * guess. Under-extracting is a nuisance; mis-filing a clinical finding is not.
 */

/* ------------------------------------------------------------- normalising */

function normalise(raw: string): string {
  return raw
    .replace(/[֑-ׇ]/g, "") // niqqud / cantillation
    .replace(/[״"]/g, '"')
    .replace(/[׳']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hebrew boundary guards — JavaScript's `\b` is ASCII-only and never matches
 * beside a Hebrew letter, which silently breaks any `\bחום\b`-shaped pattern.
 */
const HB = "(?<![\\u0590-\\u05FF])";
const HA = "(?![\\u0590-\\u05FF])";
const heb = (body: string, flags?: string) =>
  new RegExp(`${HB}(?:${body})${HA}`, flags);

/** Verbs that start a new action when carrying a vav prefix: "נעשה צילום חזה
 *  ונחזור על ספירת דם" is two orders, not one. */
const VAV_ACTION =
  /\s+(?=ו(?:נעשה|נבצע|נשלח|נזמין|נחזור|נתחיל|נמשיך|נוסיף|נפסיק|נשקול|נוריד|נעלה)(?![֐-׿]))/;

export interface Clause {
  text: string;
  /** Timing named anywhere in the surrounding sentence. Splitting a compound
   *  order must not strip the timing from its later halves — "נעשה צילום חזה
   *  היום ונחזור על ספירת דם" schedules both for today. Carrying the phrase
   *  across is grammar, not a clinical judgement, so it is safe to do. */
  sentenceTiming: string | null;
}

const TIMING_RE = heb(
  "עכשיו|מיד|מייד|בדחיפות|דחוף|היום|הבוקר|הערב|הלילה|מחר\\s*בבוקר|מחר|מחרתיים|בהמשך\\s*השבוע",
);
const TIMING_PHRASE_RE = /לפני\s*ה?שחרור|אחר\s*ה?צהריים/;

function timingIn(text: string): string | null {
  return text.match(TIMING_PHRASE_RE)?.[0] ?? text.match(TIMING_RE)?.[0] ?? null;
}

/** Splits speech into clauses. Doctors dictate in runs without punctuation, so
 *  conjunctions that reliably start a new statement are cut points too. */
function clauses(text: string): Clause[] {
  const sentences = text
    .split(/[.;!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: Clause[] = [];
  for (const sentence of sentences) {
    const sentenceTiming = timingIn(sentence);
    const parts = sentence
      .split(/[,]+|\s+(?=אבל\s|ובנוסף\s|בנוסף\s|וכן\s)/)
      .flatMap((p) => p.split(VAV_ACTION))
      .map((p) => p.trim())
      .filter((p) => p.length > 1);
    for (const text of parts) out.push({ text, sentenceTiming });
  }
  return out;
}

const has = (text: string, re: RegExp) => re.test(text);

/* ------------------------------------------------------------------ vitals */

function extractVitals(text: string, out: Extraction) {
  const temp = text.match(
    /(?<![֐-׿])חום\s*(?:של\s*|היה\s*|הגיע\s*ל\s*)?(\d{2}(?:[.,]\d)?)/,
  );
  if (temp) out.vitals.temperature = `${temp[1].replace(",", ".")}°C`;

  const bp = text.match(
    /לחץ\s*ה?דם\s*(?:הוא\s*|היה\s*|של\s*)?(\d{2,3})\s*(?:על|\/|\\)\s*(\d{2,3})/,
  );
  if (bp) out.vitals.bloodPressure = `${bp[1]}/${bp[2]}`;

  const hr = text.match(
    /(?<![֐-׿])דופק\s*(?:של\s*|הוא\s*|היה\s*)?(\d{2,3})/,
  );
  if (hr) out.vitals.heartRate = hr[1];

  const spo2 = text.match(
    /(?:סטורציה|סאטורציה|ריווי\s*חמצן|סאט)\s*(?:של\s*|הוא\s*|היא\s*)?(\d{2,3})\s*%?/,
  );
  if (spo2) {
    const roomAir = has(text, /באוויר\s*חדר|ללא\s*חמצן/);
    out.vitals.spo2 = `${spo2[1]}%${roomAir ? " באוויר חדר" : ""}`;
  }

  const rr = text.match(
    /(?:קצב\s*נשימה|קצב\s*נשימות|נשימות\s*ל?דקה)\s*(?:של\s*|הוא\s*)?(\d{1,2})/,
  );
  if (rr) out.vitals.respiratoryRate = rr[1];
}

/* -------------------------------------------------------- past medical hx  */

const CONDITIONS: Array<[RegExp, string]> = [
  [/סוכרת|סכרת/, "סוכרת"],
  [/יתר\s*לחץ\s*דם|לחץ\s*דם\s*גבוה|יל"?ד/, "יתר לחץ דם"],
  [/\bCOPD\b|קופ"?ד|מחלת\s*ריאות\s*חסימתית/i, "COPD"],
  [/אסתמה|אסטמה/, "אסתמה"],
  [/אי\s*ספיקת\s*לב/, "אי ספיקת לב"],
  [/אי\s*ספיקת\s*כליות|מחלת\s*כליות\s*כרונית/, "מחלת כליות כרונית"],
  [/פרפור\s*פרוזדורים|פרפור\s*עליות/, "פרפור פרוזדורים"],
  [/דיסליפידמיה|היפרליפידמיה|כולסטרול\s*גבוה/, "דיסליפידמיה"],
  [/היפותירואידיזם|תת\s*פעילות\s*של\s*בלוטת\s*התריס/, "היפותירואידיזם"],
  [/דמנציה|אלצהיימר/, "דמנציה"],
  [/אוסטאופורוזיס|בריחת\s*סידן/, "אוסטאופורוזיס"],
  [/השמנה|עודף\s*משקל/, "השמנה"],
  [/שבץ|אירוע\s*מוחי|CVA/i, "אירוע מוחי בעבר"],
  [/אוטם\s*שריר\s*הלב|התקף\s*לב|MI\b/i, "מחלת לב איסכמית"],
  [/דיכאון/, "דיכאון"],
  [/אנמיה/, "אנמיה"],
];

const HISTORY_CUE =
  /ברקע|רקע\s*של|סובל\s*מ|סובלת\s*מ|ידוע\s*(?:כ|על)|היסטוריה\s*של|מוכר\s*עם/;

function extractHistory(clause: string, out: Extraction) {
  if (!has(clause, HISTORY_CUE)) return;
  for (const [pattern, label] of CONDITIONS) {
    if (pattern.test(clause)) out.pastMedicalHistory.push(label);
  }
}

/* ----------------------------------------------------------------- social  */

const SOCIAL_RULES: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  [/גר\s*לבד|גרה\s*לבד|חי\s*לבד/, "גר לבד"],
  [/גר\s*עם\s*(אשתו|בעלה|בתו|בנו|משפחתו|בת\s*זוגו|בן\s*זוגה)/, (m) => `גר עם ${m[1]}`],
  [
    /(?:ה?בת|בתו)\s*(?:שלו|שלה)?\s*(?:עוזרת|מסייעת|מטפלת)/,
    "בתו מסייעת לו",
  ],
  [/(?:ה?בן|בנו)\s*(?:שלו|שלה)?\s*(?:עוזר|מסייע|מטפל)/, "בנו מסייע לו"],
  [/עצמאי\s*(?:בתפקודי|ב)?|עצמאית\s*(?:בתפקודי|ב)?/, "עצמאי בתפקודי יום יום"],
  [/נעזר\s*ב?מטפל|מטפלת\s*צמודה|עובד\s*זר/, "נעזר במטפל"],
  [/מעשן|מעשנת/, "מעשן"],
  [/לא\s*מעשן|לא\s*מעשנת|הפסיק\s*לעשן/, "לא מעשן"],
  [/שותה\s*אלכוהול|צריכת\s*אלכוהול/, "צריכת אלכוהול"],
  [/בית\s*אבות|מוסד\s*סיעודי|דיור\s*מוגן/, "מתגורר במסגרת סיעודית"],
  [/תמיכה\s*משפחתית|משפחה\s*תומכת/, "תמיכה משפחתית"],
  [/מרותק\s*למיטה|מרותקת\s*למיטה/, "מרותק למיטה"],
];

function extractSocial(clause: string, out: Extraction) {
  for (const [pattern, label] of SOCIAL_RULES) {
    const m = clause.match(pattern);
    if (m) out.socialStatus.push(typeof label === "function" ? label(m) : label);
  }
}

/* ---------------------------------------------------------------- symptoms */

const SYMPTOMS: Array<[RegExp, string]> = [
  [/משתעל|משתעלת|שיעול/, "שיעול מתמשך"],
  [/קוצר\s*נשימה|קשה\s*לו\s*לנשום|מתנשם/, "קוצר נשימה"],
  [/כאב\s*בחזה|כאבים\s*בחזה/, "כאב בחזה"],
  [/כאב\s*בטן|כאבי\s*בטן/, "כאב בטן"],
  [/כאב\s*ראש|כאבי\s*ראש/, "כאב ראש"],
  [/בחילה|בחילות|הקאות/, "בחילות"],
  [/סחרחורת|סחרחורות/, "סחרחורות"],
  [/חולשה|תשישות/, "חולשה כללית"],
  [/בלבול|מבולבל|מבולבלת/, "בלבול"],
  [/בצקות|נפיחות\s*ברגליים/, "בצקות"],
  [/צריבה\s*ב?מתן\s*שתן|שריפה\s*בהשתנה/, "צריבה במתן שתן"],
];

const RESOLVED_CUE = /חלף|נעלם|הסתדר|ללא\s|אין\s|שיפור\s*ב/;

function extractSymptoms(clause: string, out: Extraction) {
  // "עדיין משתעל" and "כבר לא משתעל" are opposite claims; only the first is a
  // current complaint, so a negation nearby suppresses the match.
  if (has(clause, /\bלא\s|אינו\s|אינה\s/) && !has(clause, /עדיין|ממשיך|נמשך/)) {
    return;
  }
  if (has(clause, RESOLVED_CUE) && !has(clause, /עדיין|ממשיך/)) return;

  for (const [pattern, label] of SYMPTOMS) {
    if (pattern.test(clause)) out.chiefComplaint.push(label);
  }
}

/* ------------------------------------------------------------------- tests */

const IMAGING = /צילום\s*חזה|צילום|\bCT\b|סי\s*טי|סיטי|\bMRI\b|אם\s*אר\s*איי|אולטרסאונד|\bUS\b|דופלר|אקו(?:\s*לב)?|מיפוי|MRCP/i;
const LABS =
  /ספירת\s*דם|כימיה|תפקודי\s*כבד|תפקודי\s*כליה|קריאטינין|אלקטרוליטים|\bCRP\b|תרבית|גזים\s*בדם|\bINR\b|המוגלובין|נתרן|אשלגן|סוכר\s*בדם|ליפאז|בילירובין|\bBNP\b|טרופונין/i;
const OTHER_TESTS =
  /\bECG\b|אק"?ג|אקג|הולטר|ספירומטריה|בדיקת\s*בליעה|בדיקה\s*נוירולוגית|קרקעית\s*עין/i;

const EXAM_CUE =
  /בבדיקה|בבדיקה\s*גופנית|בהאזנה|נשמע|נשמעים|במישוש|רגישות\s*ב|חרחורים|צפצופים|אוושה/;

const PLAN_CUE =
  /נעשה|נבצע|נשלח|נזמין|נחזור\s*על|נמשיך|נתחיל|נוסיף|נוריד|נפסיק|יש\s*לבצע|יש\s*לשלוח|צריך\s*ל|לבצע|לשלוח|להזמין|נשקול/;

const REPEAT_CUE = /נחזור\s*על|חוזר|חוזרת|שוב|בשנית/;

/** Pulls the test name out of an action clause, dropping the verb and timing so
 *  the resulting task title is what a doctor would write on the sheet. */
function testPhrase(clause: string): string | null {
  const cleaned = clause
    .replace(
      /^(?:אז\s*)?ו?(?:נעשה|נבצע|נשלח|נזמין|נחזור\s*על|יש\s*לבצע|יש\s*לשלוח|צריך\s*לבצע|צריך\s*לשלוח|לבצע|לשלוח|להזמין|נשקול)\s*/,
      "",
    )
    .replace(
      /\s*(?:(?<![֐-׿])(?:עכשיו|מיד|מייד|בדחיפות|היום|הבוקר|הערב|הלילה|מחר\s*בבוקר|מחר|מחרתיים)(?![֐-׿])|לפני\s*ה?שחרור|בהמשך\s*השבוע)\s*/g,
      " ",
    )
    .replace(/^ו/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 1 ? cleaned : null;
}

function categoryOf(phrase: string): "imaging" | "labs" | "consult" | "other" {
  if (IMAGING.test(phrase)) return "imaging";
  if (LABS.test(phrase)) return "labs";
  return "other";
}

function extractTestsAndPlan({ text: clause, sentenceTiming }: Clause, out: Extraction) {
  if (has(clause, EXAM_CUE)) {
    out.tests.physicalExam.push(clause.replace(/^בבדיקה\s*(?:גופנית\s*)?/, "").trim());
    return;
  }

  if (!has(clause, PLAN_CUE)) return;

  const phrase = testPhrase(clause);
  if (!phrase) return;

  const timing = sentenceTiming;
  const repeat = has(clause, REPEAT_CUE);

  if (IMAGING.test(phrase)) {
    out.tests.imaging.push(repeat ? `${phrase} חוזר` : `${phrase} מתוכנן`);
  } else if (LABS.test(phrase)) {
    out.tests.labs.push(repeat ? `${phrase} חוזרת` : `${phrase} מתוכננת`);
  } else if (OTHER_TESTS.test(phrase)) {
    out.tests.otherTests.push(repeat ? `${phrase} חוזר` : `${phrase} מתוכנן`);
  }

  // The plan keeps the doctor's own phrasing including timing; the task is the
  // bare actionable noun.
  out.treatmentPlan.push(timing ? `${phrase} ${timing}` : phrase);

  if (IMAGING.test(phrase) || LABS.test(phrase) || OTHER_TESTS.test(phrase)) {
    out.tasks.push({ title: phrase, timing, category: categoryOf(phrase) });
  } else {
    out.tasks.push({ title: phrase, timing, category: "other" });
  }
}

/* ------------------------------------------------------- working diagnosis */

const DIAGNOSIS_CUE =
  /כנראה|ככל\s*הנראה|חשד\s*ל|נראה\s*כמו|מדובר\s*ב|האבחנה\s*היא|אבחנה\s*מבדלת|להערכתי/;

function extractDiagnosis(clause: string, out: Extraction) {
  if (!has(clause, DIAGNOSIS_CUE)) return;
  const phrase = clause
    .replace(
      /^.*?(?:כנראה|ככל\s*הנראה|חשד\s*ל|נראה\s*כמו|מדובר\s*ב|האבחנה\s*היא|להערכתי)\s*/,
      "",
    )
    .trim();
  if (phrase.length < 2) return;
  // Hedged speech becomes an explicitly hedged diagnosis, not a firm one.
  const hedged = has(clause, /כנראה|ככל\s*הנראה|חשד\s*ל|נראה\s*כמו|להערכתי/);
  out.workingDiagnosis.push(hedged ? `חשד ל${phrase}` : phrase);
}

/* -------------------------------------------------------------- treatment  */

const MED_CUE =
  /נתחיל|ניתן|נמשיך|נפסיק|נוריד|נעלה|מינון|אנטיביוטיקה|סטרואידים|משתן|פוסיד|אינהלציות|נוזלים|חמצן/;

function extractTreatment(clause: string, out: Extraction) {
  if (!has(clause, MED_CUE)) return;
  if (has(clause, PLAN_CUE) && (IMAGING.test(clause) || LABS.test(clause))) return;
  const phrase = clause.replace(/^(?:אז\s*)?/, "").trim();
  if (phrase.length > 1) out.treatmentPlan.push(phrase);
}

/* ------------------------------------------------------------- consultants */

const SPECIALTIES: Array<[RegExp, string]> = [
  [/קרדיולוג|קרדיולוגיה|רופא\s*לב/, "קרדיולוגיה"],
  [/ריאות|פולמונולוג|ריאתי/, "ריאות"],
  [/נפרולוג|נפרולוגיה|כליות/, "נפרולוגיה"],
  [/פיזיותרפי/, "פיזיותרפיה"],
  [/עבודה\s*סוציאלית|עו"?ס|עובדת\s*סוציאלית/, "עבודה סוציאלית"],
  [/גסטרו|גסטרואנטרולוג/, "גסטרואנטרולוגיה"],
  [/נוירולוג/, "נוירולוגיה"],
  [/כירורג/, "כירורגיה"],
  [/אנדוקרינולוג|סוכרת\s*יועץ/, "אנדוקרינולוגיה"],
  [/זיהומיות|זיהומולוג/, "זיהומיות"],
  [/תזונאי|דיאטנית/, "תזונה"],
  [/ריפוי\s*בעיסוק/, "ריפוי בעיסוק"],
];

const CONSULT_CUE = /ייעוץ|יעוץ|נזמין|נבקש|להזמין|נתייעץ|יבוא\s*לראות|הערכת/;

function extractConsults({ text: clause, sentenceTiming }: Clause, out: Extraction) {
  if (!has(clause, CONSULT_CUE)) return;
  for (const [pattern, specialty] of SPECIALTIES) {
    if (pattern.test(clause)) {
      out.consultations.push({ specialty, reason: null });
      out.tasks.push({
        title: `ייעוץ ${specialty}`,
        timing: sentenceTiming,
        category: "consult",
      });
    }
  }
}

/* --------------------------------------------------------------- discharge */

function extractDischarge(clause: string, out: Extraction) {
  if (!has(clause, /שחרור|לשחרר|משחררים|הביתה/)) return;

  if (has(clause, /לא\s*משחררים|לא\s*לשחרר|אין\s*שחרור|רחוק\s*משחרור/)) {
    out.discharge.status = "unplanned";
  } else if (has(clause, /מחר|מחרתיים/)) {
    out.discharge.status = "tomorrow";
  } else if (has(clause, /היום|עכשיו|הבוקר/)) {
    out.discharge.status = "today";
  }

  // "ממתין ל-X", "לפני השחרור צריך X" — the thing standing in the way.
  const blocker = clause.match(
    /(?:ממתין|ממתינים|מחכים)\s*ל[־\s]*(.+?)(?:$|\s+(?:ואז|אחר\s*כך))/,
  );
  if (blocker?.[1]) out.discharge.blockers.push(`ממתין ל${blocker[1].trim()}`);

  if (has(clause, /אם\s*יהיה\s*שיפור|בהתאם\s*לשיפור|תלוי\s*ב/)) {
    out.discharge.blockers.push("שיפור קליני");
  }
}

/* ------------------------------------------------------------- uncertainty */

/** A lab or vital named next to something that isn't a parseable number. This
 *  is the case where guessing is genuinely dangerous, so it is flagged instead. */
function extractUncertain(clause: string, out: Extraction) {
  const namedValue = clause.match(
    /(קריאטינין|נתרן|אשלגן|המוגלובין|סוכר|לחץ\s*דם|חום|דופק|סטורציה)\s*(?:הוא|היה|של)?\s*([^\s]{0,12})/,
  );
  if (!namedValue) return;
  const value = namedValue[2] ?? "";
  if (/\d/.test(value)) return; // a number was found — nothing uncertain here
  if (!value || /^(תקין|תקינה|בסדר|יציב|טוב|נמוך|גבוה|ירד|עלה)/.test(value)) return;

  out.needsReview.push({
    text: clause,
    reason: `ערך ${namedValue[1]} לא ברור בתמלול`,
  });
}

/* -------------------------------------------------------------------- main */

export function extractByRules(transcript: string): Extraction {
  const out = emptyExtraction();
  const text = normalise(transcript);
  if (!text) return out;

  extractVitals(text, out);

  for (const clause of clauses(text)) {
    extractHistory(clause.text, out);
    extractSocial(clause.text, out);
    extractSymptoms(clause.text, out);
    extractTestsAndPlan(clause, out);
    extractDiagnosis(clause.text, out);
    extractTreatment(clause.text, out);
    extractConsults(clause, out);
    extractDischarge(clause.text, out);
    extractUncertain(clause.text, out);
  }

  // Within-run dedupe; the store dedupes against existing record content too.
  const uniq = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim())));
  out.chiefComplaint = uniq(out.chiefComplaint);
  out.pastMedicalHistory = uniq(out.pastMedicalHistory);
  out.socialStatus = uniq(out.socialStatus);
  out.workingDiagnosis = uniq(out.workingDiagnosis);
  out.treatmentPlan = uniq(out.treatmentPlan);
  out.other = uniq(out.other);
  out.tests.physicalExam = uniq(out.tests.physicalExam);
  out.tests.labs = uniq(out.tests.labs);
  out.tests.imaging = uniq(out.tests.imaging);
  out.tests.otherTests = uniq(out.tests.otherTests);
  out.discharge.blockers = uniq(out.discharge.blockers);

  const seenTasks = new Set<string>();
  out.tasks = out.tasks.filter((t) => {
    const key = t.title.trim().toLowerCase();
    if (seenTasks.has(key)) return false;
    seenTasks.add(key);
    return true;
  });

  const seenConsults = new Set<string>();
  out.consultations = out.consultations.filter((c) => {
    if (seenConsults.has(c.specialty)) return false;
    seenConsults.add(c.specialty);
    return true;
  });

  // Round-trip through the schema so the fallback is held to exactly the same
  // contract as the model — same trust boundary, no exceptions.
  return ExtractionSchema.parse(out);
}
