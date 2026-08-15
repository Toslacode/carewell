/**
 * The extraction contract given to the model.
 *
 * Two things are deliberately withheld from it:
 *
 *   · Priority. The model reports the timing words the doctor actually said and
 *     nothing else; derivePriority() turns those into 🔴/🟠/🟡/🟢/⚪ in code.
 *     A model deciding on its own that something "sounds urgent" is making a
 *     triage call, and that is not a call it gets to make here.
 *   · Anything it did not hear. There is no completion, no inference, no
 *     filling in of the obvious. An empty section is a correct answer.
 */

export const EXTRACTION_SYSTEM_PROMPT = `אתה שכבת מיון קליני עבור סבב רופאים במחלקה פנימית בישראל. אתה מקבל תמלול דיבור חופשי בעברית ומחזיר JSON מובנה בלבד.

## מה מותר לך

להעביר לשדות המתאימים רק מידע שנאמר במפורש בתמלול.

## מה אסור לך

- אל תמציא ערכים, אבחנות, מינונים או מדדים שלא נאמרו.
- אל תשלים מידע "מתבקש" מתוך הקשר רפואי. אם הרופא אמר "דלקת ריאות" ולא אמר צד — אל תוסיף צד.
- אל תדחוף פריט לקטגוריה קלינית כשאתה לא בטוח שהוא שייך לשם. פריט לא ברור עובר ל־needsReview עם הסבר קצר, או ל־other אם הוא ברור אך לא שייך לאף קטגוריה.
- אל תקבע דחיפות של משימות. אתה מדווח רק את מילות התזמון כפי שנאמרו.
- אל תתרגם מונחים קליניים באנגלית לעברית. WBC נשאר WBC.

## הקטגוריות

- chiefComplaint — תלונה או סימפטום נוכחי ("עדיין משתעל" → "שיעול מתמשך"). לא כולל מדדים.
- pastMedicalHistory — מחלות רקע בלבד, מה שנאמר אחרי "ברקע", "סובל מ", "ידוע כ".
- socialStatus — מגורים, תפקוד, תמיכה, עישון, אלכוהול.
- vitals — מחרוזות כפי שנאמרו, כולל יחידות והסתייגויות: "39°C", "105/65", "93% באוויר חדר". שדה שלא נמדד נשאר null.
- tests.physicalExam — ממצאי בדיקה גופנית.
- tests.labs / tests.imaging / tests.otherTests — בדיקות שנעשו או שתוכננו. בדיקה מתוכננת מסומנת "מתוכנן"/"מתוכננת", בדיקה חוזרת "חוזר"/"חוזרת".
- workingDiagnosis — הערכת הרופא. אם נאמרה בהסתייגות ("כנראה", "חשד ל") — שמור את ההסתייגות: "חשד לדלקת ריאות".
- treatmentPlan — הפעולות בניסוח של הרופא, כולל תזמון.
- tasks — פעולה אחת לכל פריט, ככותרת קצרה כפי שרופא היה כותב בדף הסבב ("צילום חזה", לא "נעשה צילום חזה היום"). השדה timing מכיל את מילות התזמון בדיוק כפי שנאמרו ("היום", "עכשיו", "מחר בבוקר", "לפני השחרור"), או null אם לא נאמר תזמון.
- consultations — התמחות מבוקשת בלבד.
- discharge.status — "today" / "tomorrow" / "unplanned" / "unknown". ברירת המחדל היא "unknown" — קבע ערך אחר רק אם נאמר משהו על שחרור.
- discharge.blockers — מה שמעכב שחרור.
- other — נאמר בבירור אך לא שייך לאף קטגוריה.
- needsReview — כל מה שלא הובן: ערך מספרי לא ברור, מילה חתוכה, סתירה. reason מסביר בעברית מה לא ברור.

## פורמט

החזר JSON תקין בלבד, ללא טקסט נוסף. מערך ריק הוא תשובה נכונה כשלא נאמר דבר בקטגוריה.`;

/**
 * Hand-written JSON Schema rather than one generated from the Zod schema.
 *
 * Structured outputs require every object to carry additionalProperties:false
 * and list every key in `required`, and they reject the constraint keywords the
 * internal schema uses (max lengths, defaults). Writing the wire schema out
 * separately keeps the two concerns apart: this one constrains generation, and
 * ExtractionSchema in lib/schemas/clinical.ts stays the validation boundary
 * that every response is checked against regardless.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "chiefComplaint",
    "pastMedicalHistory",
    "socialStatus",
    "vitals",
    "tests",
    "workingDiagnosis",
    "treatmentPlan",
    "tasks",
    "consultations",
    "discharge",
    "other",
    "needsReview",
  ],
  properties: {
    chiefComplaint: { type: "array", items: { type: "string" } },
    pastMedicalHistory: { type: "array", items: { type: "string" } },
    socialStatus: { type: "array", items: { type: "string" } },
    vitals: {
      type: "object",
      additionalProperties: false,
      required: [
        "temperature",
        "bloodPressure",
        "heartRate",
        "spo2",
        "respiratoryRate",
      ],
      properties: {
        temperature: { type: ["string", "null"] },
        bloodPressure: { type: ["string", "null"] },
        heartRate: { type: ["string", "null"] },
        spo2: { type: ["string", "null"] },
        respiratoryRate: { type: ["string", "null"] },
      },
    },
    tests: {
      type: "object",
      additionalProperties: false,
      required: ["physicalExam", "labs", "imaging", "otherTests"],
      properties: {
        physicalExam: { type: "array", items: { type: "string" } },
        labs: { type: "array", items: { type: "string" } },
        imaging: { type: "array", items: { type: "string" } },
        otherTests: { type: "array", items: { type: "string" } },
      },
    },
    workingDiagnosis: { type: "array", items: { type: "string" } },
    treatmentPlan: { type: "array", items: { type: "string" } },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "timing", "category"],
        properties: {
          title: { type: "string" },
          timing: {
            type: ["string", "null"],
            description:
              "מילות התזמון כפי שנאמרו. אין להסיק דחיפות — רק לצטט.",
          },
          category: {
            type: "string",
            enum: [
              "imaging",
              "labs",
              "medication",
              "consult",
              "procedure",
              "other",
            ],
          },
        },
      },
    },
    consultations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["specialty", "reason"],
        properties: {
          specialty: { type: "string" },
          reason: { type: ["string", "null"] },
        },
      },
    },
    discharge: {
      type: "object",
      additionalProperties: false,
      required: ["status", "blockers"],
      properties: {
        status: {
          type: "string",
          enum: ["unknown", "unplanned", "today", "tomorrow"],
        },
        blockers: { type: "array", items: { type: "string" } },
      },
    },
    other: { type: "array", items: { type: "string" } },
    needsReview: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "reason"],
        properties: {
          text: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;
