import {
  type Consultation,
  type Discharge,
  type Patient,
  type Room,
  type Task,
  WARD_DOCTORS,
  emptyClinicalData,
  item,
  reading,
} from "@/lib/schemas/clinical";

/* ===========================================================================
   FICTITIOUS DEMONSTRATION DATA.

   Every name, ID number and clinical detail below is invented. The ID numbers
   are deliberately NOT valid Israeli teudat zehut — they fail the Luhn-style
   check digit on purpose, so this data can never be mistaken for real records
   or accidentally match a living person.

   No real patient information belongs in this repository, ever.
   =========================================================================== */

let n = 0;
const id = (p: string) => `${p}${(n += 1)}`;

interface Seed {
  name: string;
  age: number;
  idNumber: string;
  hmo: Patient["hmo"];
  bed: number;
  hospitalDay: number;
  primaryDiagnosis: string;
  status: Patient["status"];
  chief: string[];
  pmh: string[];
  social: string[];
  vitals: Partial<Record<keyof Patient["approvedClinicalData"]["vitals"], string>>;
  exam: string[];
  labs: string[];
  imaging: string[];
  otherTests?: string[];
  workingDx: string[];
  plan: string[];
  other?: string[];
  tasks: Array<{
    title: string;
    priority: Task["priority"];
    status: Task["status"];
    category: Task["category"];
    timing: string | null;
  }>;
  consults?: Array<{ specialty: string; state: Consultation["state"]; reason?: string }>;
  discharge: { status: Discharge["status"]; blockers: string[] };
}

const SEEDS: Record<number, Seed[]> = {
  1: [
    {
      name: "מרים אשכנזי",
      age: 78,
      idNumber: "312 884 771",
      hmo: "כללית",
      bed: 1,
      hospitalDay: 3,
      primaryDiagnosis: "אי ספיקת לב מחמירה",
      status: "monitoring",
      chief: ["קוצר נשימה במאמץ קל", "בצקות בגפיים תחתונות"],
      pmh: ["אי ספיקת לב סיסטולית EF 35%", "פרפור פרוזדורים", "יתר לחץ דם"],
      social: ["גרה עם בעלה", "עצמאית בתפקודי יום יום", "לא מעשנת"],
      vitals: {
        temperature: "36.8",
        bloodPressure: "138/82",
        heartRate: "88",
        spo2: "94% באוויר חדר",
        respiratoryRate: "20",
      },
      exam: ["חרחורים בבסיסי הריאות דו־צדדי", "בצקות פיטינג עד הברכיים"],
      labs: ["BNP 1240 pg/mL", "Creatinine 1.4 mg/dL", "K 4.1 mEq/L"],
      imaging: ["צילום חזה: גודש ריאתי קל"],
      otherTests: ["ECG: פרפור פרוזדורים, קצב חדרי 88"],
      workingDx: ["החמרה של אי ספיקת לב על רקע היענות נמוכה לטיפול"],
      plan: [
        "פוסיד 40 מ״ג IV פעמיים ביום",
        "מאזן נוזלים ושקילה יומית",
        "הגבלת נוזלים ל־1.5 ליטר ביום",
      ],
      tasks: [
        { title: "אקו לב", priority: "scheduled", status: "pending", category: "imaging", timing: "מחר" },
        { title: "מאזן נוזלים", priority: "today", status: "in-progress", category: "other", timing: "היום" },
      ],
      consults: [{ specialty: "קרדיולוגיה", state: "ordered", reason: "הערכת טיפול באי ספיקת לב" }],
      discharge: { status: "unplanned", blockers: ["ממתין לאקו לב", "איזון מאזן נוזלים"] },
    },
    {
      name: "יעקב בן־שמעון",
      age: 66,
      idNumber: "204 551 903",
      hmo: "מכבי",
      bed: 2,
      hospitalDay: 6,
      primaryDiagnosis: "צלוליטיס ברגל ימין",
      status: "stable",
      chief: ["אודם וכאב בשוק ימין"],
      pmh: ["סוכרת סוג 2", "השמנה", "אי ספיקת ורידים כרונית"],
      social: ["גר עם בת זוגו", "עובד כנהג", "מעשן חצי קופסה ביום"],
      vitals: {
        temperature: "37.1",
        bloodPressure: "126/74",
        heartRate: "78",
        spo2: "97%",
        respiratoryRate: "16",
      },
      exam: ["אודם מוגדר בשוק ימין, ללא פלוקטואציה", "דפקים פריפריים נמושים"],
      labs: ["WBC 9.2 x10⁹/L", "CRP 42 mg/L", "HbA1c 8.4%"],
      imaging: ["אולטרסאונד דופלר: ללא DVT"],
      workingDx: ["צלוליטיס, בתגובה טובה לאנטיביוטיקה"],
      plan: ["צפטריאקסון 1 גרם IV ליום", "הרמת הגף", "איזון סוכרת"],
      other: ["הוסבר על חשיבות הפסקת עישון"],
      tasks: [
        { title: "סימון גבולות האודם", priority: "today", status: "done", category: "other", timing: "היום" },
        { title: "ייעוץ סוכרת", priority: "before-discharge", status: "pending", category: "consult", timing: "לפני השחרור" },
      ],
      consults: [{ specialty: "אנדוקרינולוגיה", state: "required", reason: "איזון סוכרת לקוי" }],
      discharge: { status: "tomorrow", blockers: ["ייעוץ סוכרת"] },
    },
  ],

  2: [
    {
      name: "פאטמה זועבי",
      age: 54,
      idNumber: "398 210 447",
      hmo: "מאוחדת",
      bed: 1,
      hospitalDay: 2,
      primaryDiagnosis: "פיאלונפריטיס",
      status: "monitoring",
      chief: ["חום גבוה", "כאבי גב תחתון משמאל", "צריבה במתן שתן"],
      pmh: ["אבני כליה בעבר", "מיגרנות"],
      social: ["נשואה, אם לשלושה", "עצמאית לחלוטין", "לא מעשנת"],
      vitals: {
        temperature: "38.9",
        bloodPressure: "108/64",
        heartRate: "104",
        spo2: "97%",
        respiratoryRate: "18",
      },
      exam: ["רגישות בזווית הצלעו־חולייתית משמאל", "בטן רכה"],
      labs: ["WBC 16.4 x10⁹/L", "CRP 180 mg/L", "Creatinine 1.1 mg/dL"],
      imaging: ["US כליות: הרחבה קלה של אגן הכליה משמאל"],
      otherTests: ["תרבית שתן: נשלחה"],
      workingDx: ["פיאלונפריטיס חריפה משמאל"],
      plan: ["צפטריאקסון 1 גרם IV ליום", "נוזלים IV", "מעקב חום"],
      tasks: [
        { title: "תרבית שתן", priority: "urgent", status: "done", category: "labs", timing: "עכשיו" },
        { title: "ספירת דם חוזרת", priority: "scheduled", status: "pending", category: "labs", timing: "מחר בבוקר" },
      ],
      discharge: { status: "unplanned", blockers: ["ממתין לתשובת תרבית", "ירידת חום"] },
    },
  ],

  3: [
    {
      name: "אברהם לוינסון",
      age: 84,
      idNumber: "115 673 228",
      hmo: "כללית",
      bed: 1,
      hospitalDay: 9,
      primaryDiagnosis: "שבץ איסכמי",
      status: "attention",
      chief: ["חולשה בצד ימין", "קושי בדיבור"],
      pmh: ["יתר לחץ דם", "דיסליפידמיה", "פרפור פרוזדורים"],
      social: ["גר לבד", "בתו מגיעה יום יום", "היה עצמאי לפני האירוע"],
      vitals: {
        temperature: "37.4",
        bloodPressure: "156/88",
        heartRate: "82",
        spo2: "92% באוויר חדר",
        respiratoryRate: "22",
      },
      exam: ["המיפרזיס ימני 3/5", "דיסארתריה", "בליעה לא בטוחה"],
      labs: ["INR 1.8", "Na 133 mEq/L", "Hb 11.2 g/dL"],
      imaging: ["CT מוח: אוטם באזור MCA שמאל"],
      otherTests: ["בדיקת בליעה: הודגמה אספירציה שקטה"],
      workingDx: ["שבץ איסכמי MCA שמאל", "חשד לדלקת ריאות אספירציה"],
      plan: [
        "NPO, האכלה בזונדה",
        "אנטיביוטיקה אמפירית",
        "פיזיותרפיה יומית",
        "איזון לחץ דם",
      ],
      other: ["שיחה עם המשפחה על יעדי טיפול נקבעה"],
      tasks: [
        { title: "צילום חזה", priority: "urgent", status: "pending", category: "imaging", timing: "עכשיו" },
        { title: "הערכת פיזיותרפיה", priority: "today", status: "in-progress", category: "consult", timing: "היום" },
        { title: "שיחה עם המשפחה", priority: "today", status: "pending", category: "other", timing: "היום" },
      ],
      consults: [
        { specialty: "נוירולוגיה", state: "completed", reason: "הערכת שבץ" },
        { specialty: "פיזיותרפיה", state: "ordered", reason: "שיקום מוטורי" },
        { specialty: "עבודה סוציאלית", state: "required", reason: "תכנון המשך טיפול" },
      ],
      discharge: {
        status: "unplanned",
        blockers: ["הערכת פיזיותרפיה", "שיחה עם המשפחה", "הסדרת מסגרת שיקומית"],
      },
    },
    {
      name: "רחל דיין",
      age: 71,
      idNumber: "487 002 315",
      hmo: "לאומית",
      bed: 2,
      hospitalDay: 1,
      primaryDiagnosis: "אנמיה בבירור",
      status: "monitoring",
      chief: ["חולשה כללית", "סחרחורות"],
      pmh: ["היפותירואידיזם", "אוסטאופורוזיס"],
      social: ["גרה עם בתה", "נעזרת במטפלת שלוש פעמים בשבוע"],
      vitals: {
        temperature: "36.6",
        bloodPressure: "112/68",
        heartRate: "94",
        spo2: "96%",
        respiratoryRate: "17",
      },
      exam: ["חיוורון ניכר", "ללא דימום גלוי"],
      labs: ["Hb 7.8 g/dL", "MCV 72 fL", "פריטין 8 ng/mL"],
      imaging: [],
      workingDx: ["אנמיה מיקרוציטית, חשד לדימום כרוני ממערכת העיכול"],
      plan: ["מתן מנת דם", "ברזל IV", "בירור גסטרו"],
      tasks: [
        { title: "מנת דם", priority: "urgent", status: "in-progress", category: "medication", timing: "עכשיו" },
        { title: "דם סמוי בצואה", priority: "today", status: "pending", category: "labs", timing: "היום" },
      ],
      consults: [{ specialty: "גסטרואנטרולוגיה", state: "required", reason: "בירור אנמיה" }],
      discharge: { status: "unplanned", blockers: ["בירור מקור הדימום"] },
    },
  ],

  5: [
    {
      name: "סעיד אבו־ראס",
      age: 62,
      idNumber: "226 914 580",
      hmo: "מכבי",
      bed: 1,
      hospitalDay: 4,
      primaryDiagnosis: "החמרה של COPD",
      status: "monitoring",
      chief: ["קוצר נשימה מחמיר", "שיעול עם ליחה"],
      pmh: ["COPD", "יתר לחץ דם", "עישון 40 שנות קופסה"],
      social: ["גר עם משפחתו", "הפסיק לעשן לפני שנתיים", "עצמאי"],
      vitals: {
        temperature: "37.2",
        bloodPressure: "134/80",
        heartRate: "96",
        spo2: "89% באוויר חדר",
        respiratoryRate: "24",
      },
      exam: ["צפצופים אקספירטוריים מפושטים", "שימוש בשרירי עזר"],
      labs: ["גזים בדם: pH 7.35, pCO2 52", "WBC 11.1 x10⁹/L"],
      imaging: ["צילום חזה: היפראינפלציה, ללא תסנין"],
      workingDx: ["החמרה של COPD על רקע זיהומי"],
      plan: ["אינהלציות כל 4 שעות", "סטרואידים סיסטמיים", "חמצן לפי סטורציה"],
      tasks: [
        { title: "גזים בדם חוזרים", priority: "today", status: "pending", category: "labs", timing: "היום" },
        { title: "התאמת אינהלציות", priority: "before-discharge", status: "pending", category: "medication", timing: "לפני השחרור" },
      ],
      consults: [{ specialty: "ריאות", state: "waiting", reason: "התאמת טיפול כרוני" }],
      discharge: { status: "unplanned", blockers: ["ייצוב סטורציה", "ייעוץ ריאות"] },
    },
    {
      name: "אסתר מזרחי",
      age: 59,
      idNumber: "509 338 172",
      hmo: "כללית",
      bed: 2,
      hospitalDay: 2,
      primaryDiagnosis: "דלקת לבלב חריפה",
      status: "monitoring",
      chief: ["כאב בטן עליון מקרין לגב", "בחילות"],
      pmh: ["אבני מרה", "היפרליפידמיה"],
      social: ["גרושה, גרה לבד", "עובדת במשרה מלאה", "לא שותה אלכוהול"],
      vitals: {
        temperature: "37.8",
        bloodPressure: "118/72",
        heartRate: "98",
        spo2: "97%",
        respiratoryRate: "18",
      },
      exam: ["רגישות באפיגסטריום", "ללא סימני גירוי צפקי"],
      labs: ["ליפאז 890 U/L", "בילירובין 1.9 mg/dL", "CRP 96 mg/L"],
      imaging: ["US בטן: אבנים בכיס המרה, דרכי מרה תקינות"],
      workingDx: ["דלקת לבלב על רקע אבני מרה"],
      plan: ["צום", "נוזלים IV", "מורפיום 2 מ״ג IV לפי צורך"],
      tasks: [
        { title: "MRCP", priority: "scheduled", status: "pending", category: "imaging", timing: "מחר" },
        { title: "ליפאז חוזר", priority: "today", status: "pending", category: "labs", timing: "היום" },
      ],
      consults: [{ specialty: "כירורגיה", state: "ordered", reason: "הערכה לכריתת כיס מרה" }],
      discharge: { status: "unplanned", blockers: ["ממתין ל־MRCP", "החלטה כירורגית"] },
    },
  ],

  7: [
    {
      name: "דוד כהן",
      age: 72,
      idNumber: "184 226 907",
      hmo: "כללית",
      bed: 1,
      hospitalDay: 4,
      primaryDiagnosis: "דלקת ריאות נרכשת בקהילה",
      status: "stable",
      chief: ["חום", "שיעול", "קוצר נשימה"],
      pmh: ["יתר לחץ דם", "סוכרת סוג 2", "אוסטאוארתריטיס"],
      social: ["גר עם בתו", "לא מעשן", "עצמאי בתפקודי יום יום", "בגמלאות"],
      vitals: {
        temperature: "38.2",
        bloodPressure: "128/76",
        heartRate: "92",
        spo2: "93% באוויר חדר",
        respiratoryRate: "20",
      },
      exam: ["חרחורים בבסיס ריאה ימין", "ללא צפצופים"],
      labs: ["WBC 14.8 x10⁹/L", "CRP 128 mg/L", "Creatinine 1.1 mg/dL"],
      imaging: ["צילום חזה: תסנין באונה תחתונה ימנית"],
      otherTests: ["צביעת גרם בכיח: GPC בשרשראות"],
      workingDx: ["דלקת ריאות נרכשת בקהילה עם היפוקסמיה קלה"],
      plan: [
        "צפטריאקסון 2 גרם IV ליום",
        "אזיתרומיצין 500 מ״ג IV ליום",
        "חמצן בקנולה, יעד סטורציה מעל 92%",
        "עידוד ספירומטריה ויציאה מהמיטה",
      ],
      other: ["המשפחה עודכנה", "עידוד שתייה"],
      tasks: [
        { title: "צילום חזה חוזר", priority: "today", status: "pending", category: "imaging", timing: "היום" },
        { title: "ספירת דם חוזרת", priority: "today", status: "pending", category: "labs", timing: "היום" },
        { title: "מעקב סטורציה", priority: "urgent", status: "in-progress", category: "other", timing: "עכשיו" },
      ],
      consults: [{ specialty: "ריאות", state: "waiting", reason: "היפוקסמיה מתמשכת" }],
      discharge: { status: "tomorrow", blockers: ["ממתין לצילום חזה", "הערכה קלינית חוזרת"] },
    },
    {
      name: "לאה פרידמן",
      age: 65,
      idNumber: "731 920 448",
      hmo: "מכבי",
      bed: 2,
      hospitalDay: 2,
      primaryDiagnosis: "משבר יתר לחץ דם",
      status: "monitoring",
      chief: ["כאב ראש עורפי", "טשטוש ראייה"],
      pmh: ["יתר לחץ דם לא מאוזן", "מחלת כליות כרונית שלב 3"],
      social: ["גרה לבד", "בנה מסייע בקניות", "לא מעשנת"],
      vitals: {
        temperature: "36.9",
        bloodPressure: "182/104",
        heartRate: "76",
        spo2: "98%",
        respiratoryRate: "16",
      },
      exam: ["ללא חסר נוירולוגי מוקדי", "קרקעית עין: שינויים היפרטנסיביים"],
      labs: ["Creatinine 1.8 mg/dL", "Na 139 mEq/L", "K 4.4 mEq/L"],
      imaging: ["CT מוח: ללא דימום"],
      workingDx: ["משבר יתר לחץ דם ללא נזק לאיברי מטרה"],
      plan: ["הורדת לחץ דם הדרגתית", "מעקב תפקודי כליה", "התאמת טיפול קבוע"],
      tasks: [
        { title: "מעקב לחץ דם כל שעתיים", priority: "today", status: "in-progress", category: "other", timing: "היום" },
        { title: "תפקודי כליה", priority: "scheduled", status: "pending", category: "labs", timing: "מחר בבוקר" },
      ],
      consults: [{ specialty: "נפרולוגיה", state: "required", reason: "מחלת כליות כרונית והחמרה" }],
      discharge: { status: "unplanned", blockers: ["איזון לחץ דם", "ייעוץ נפרולוגיה"] },
    },
    {
      name: "יוסף אלמליח",
      age: 58,
      idNumber: "659 112 034",
      hmo: "מאוחדת",
      bed: 3,
      hospitalDay: 5,
      primaryDiagnosis: "החמרה של COPD",
      status: "discharge-possible",
      chief: ["שיפור ניכר בקוצר הנשימה"],
      pmh: ["COPD", "רפלוקס"],
      social: ["גר עם אשתו", "הפסיק לעשן לפני חמש שנים", "עצמאי"],
      vitals: {
        temperature: "36.7",
        bloodPressure: "122/70",
        heartRate: "74",
        spo2: "95% באוויר חדר",
        respiratoryRate: "16",
      },
      exam: ["אוורור סימטרי", "ללא צפצופים"],
      labs: ["WBC 7.4 x10⁹/L", "CRP 12 mg/L"],
      imaging: ["צילום חזה: ללא תסנין"],
      workingDx: ["החמרת COPD שהתייצבה"],
      plan: ["המשך אינהלציות", "הדרכה לפני שחרור"],
      other: ["מוכן לשחרור מבחינה קלינית"],
      tasks: [
        { title: "מכתב שחרור", priority: "before-discharge", status: "pending", category: "other", timing: "לפני השחרור" },
      ],
      discharge: { status: "today", blockers: [] },
    },
  ],

  8: [
    {
      name: "נורית שרון",
      age: 47,
      idNumber: "845 117 260",
      hmo: "לאומית",
      bed: 1,
      hospitalDay: 1,
      primaryDiagnosis: "כאבי בטן בבירור",
      status: "monitoring",
      chief: ["כאב בטן ימני תחתון", "בחילה"],
      pmh: ["ללא מחלות רקע משמעותיות"],
      social: ["נשואה, אם לשניים", "עצמאית", "לא מעשנת"],
      vitals: {
        temperature: "37.6",
        bloodPressure: "116/70",
        heartRate: "88",
        spo2: "99%",
        respiratoryRate: "16",
      },
      exam: ["רגישות ברביע ימני תחתון", "ללא סימן בלומברג"],
      labs: ["WBC 11.8 x10⁹/L", "CRP 34 mg/L", "בטא HCG שלילי"],
      imaging: ["US בטן: לא הודגם תוספתן"],
      workingDx: ["כאבי בטן בבירור, לשלול תוספתן"],
      plan: ["השגחה", "צום יחסי", "שיכוך כאבים"],
      tasks: [
        { title: "CT בטן", priority: "today", status: "pending", category: "imaging", timing: "היום" },
      ],
      consults: [{ specialty: "כירורגיה", state: "ordered", reason: "הערכת בטן חריפה" }],
      discharge: { status: "unplanned", blockers: ["ממתין ל-CT", "הערכה כירורגית"] },
    },
  ],

  9: [
    {
      name: "מנחם רוזנברג",
      age: 81,
      idNumber: "672 448 519",
      hmo: "כללית",
      bed: 1,
      hospitalDay: 12,
      primaryDiagnosis: "אלח דם ממקור שתן",
      status: "attention",
      chief: ["בלבול", "חולשה קשה"],
      pmh: ["דמנציה", "היפרפלזיה שפירה של הערמונית", "סוכרת"],
      social: ["מתגורר בבית אבות", "תלוי בעזרה מלאה", "אין בני משפחה קרובים"],
      vitals: {
        temperature: "38.4",
        bloodPressure: "96/58",
        heartRate: "112",
        spo2: "91% באוויר חדר",
        respiratoryRate: "26",
      },
      exam: ["מבולבל, לא מתמצא", "עור יבש", "קטטר קבוע"],
      labs: ["WBC 18.2 x10⁹/L", "לקטט 3.1 mmol/L", "Creatinine 2.2 mg/dL"],
      imaging: ["צילום חזה: ללא תסנין"],
      otherTests: ["תרבית דם: נשלחה", "תרבית שתן: חיובית ל-E. coli"],
      workingDx: ["אלח דם ממקור שתן עם פגיעה כלייתית חריפה"],
      plan: ["אנטיביוטיקה רחבת טווח", "נוזלים IV", "מעקב תפוקת שתן", "החלפת קטטר"],
      other: ["נדרשת שיחה על יעדי טיפול עם האפוטרופוס"],
      tasks: [
        { title: "החלפת קטטר", priority: "urgent", status: "pending", category: "procedure", timing: "עכשיו" },
        { title: "מעקב לקטט", priority: "urgent", status: "in-progress", category: "labs", timing: "עכשיו" },
        { title: "שיחה עם אפוטרופוס", priority: "today", status: "pending", category: "other", timing: "היום" },
      ],
      consults: [
        { specialty: "זיהומיות", state: "ordered", reason: "התאמת אנטיביוטיקה" },
        { specialty: "עבודה סוציאלית", state: "required", reason: "יעדי טיפול והמשך אשפוז" },
      ],
      discharge: { status: "unplanned", blockers: ["ייצוב המודינמי", "תשובות תרביות", "שיחה עם האפוטרופוס"] },
    },
    {
      name: "חנה ביטון",
      age: 69,
      idNumber: "930 551 807",
      hmo: "מכבי",
      bed: 2,
      hospitalDay: 3,
      primaryDiagnosis: "היפונתרמיה",
      status: "monitoring",
      chief: ["בלבול קל", "עייפות"],
      pmh: ["דיכאון", "יתר לחץ דם", "טיפול במשתנים"],
      social: ["גרה לבד", "שכנה מסייעת", "עצמאית ברוב התפקודים"],
      vitals: {
        temperature: "36.5",
        bloodPressure: "124/74",
        heartRate: "72",
        spo2: "98%",
        respiratoryRate: "15",
      },
      exam: ["ללא חסר נוירולוגי", "מצב נוזלים תקין למראה"],
      labs: ["Na 121 mEq/L", "אוסמולריות שתן 480", "TSH תקין"],
      imaging: [],
      workingDx: ["היפונתרמיה על רקע SIADH מול משתנים"],
      plan: ["הגבלת נוזלים", "הפסקת משתן", "תיקון איטי של נתרן"],
      tasks: [
        { title: "נתרן כל 6 שעות", priority: "today", status: "in-progress", category: "labs", timing: "היום" },
        { title: "עדכון טיפול תרופתי", priority: "before-discharge", status: "pending", category: "medication", timing: "לפני השחרור" },
      ],
      discharge: { status: "unplanned", blockers: ["תיקון נתרן"] },
    },
  ],

  11: [
    {
      name: "אליהו נחמיאס",
      age: 74,
      idNumber: "441 806 293",
      hmo: "מאוחדת",
      bed: 1,
      hospitalDay: 7,
      primaryDiagnosis: "פיברילציה פרוזדורית מהירה",
      status: "stable",
      chief: ["דפיקות לב"],
      pmh: ["פרפור פרוזדורים", "יתר לחץ דם", "היפותירואידיזם"],
      social: ["גר עם אשתו", "פעיל, הולך יום יום", "לא מעשן"],
      vitals: {
        temperature: "36.6",
        bloodPressure: "130/78",
        heartRate: "78",
        spo2: "97%",
        respiratoryRate: "16",
      },
      exam: ["קצב לא סדיר, בקצב מבוקר", "ללא סימני אי ספיקה"],
      labs: ["TSH 2.1", "INR 2.4", "K 4.0 mEq/L"],
      imaging: [],
      otherTests: ["ECG: פרפור פרוזדורים בקצב מבוקר"],
      workingDx: ["פרפור פרוזדורים מאוזן תחת טיפול"],
      plan: ["המשך נוגדי קרישה", "מעקב INR", "הדרכה לפני שחרור"],
      tasks: [
        { title: "מעקב INR", priority: "before-discharge", status: "pending", category: "labs", timing: "לפני השחרור" },
      ],
      discharge: { status: "tomorrow", blockers: ["INR יציב"] },
    },
  ],

  12: [
    {
      name: "ורד אזולאי",
      age: 52,
      idNumber: "308 774 615",
      hmo: "כללית",
      bed: 1,
      hospitalDay: 2,
      primaryDiagnosis: "התקף אסתמה",
      status: "monitoring",
      chief: ["קוצר נשימה", "צפצופים"],
      pmh: ["אסתמה", "אלרגיה עונתית"],
      social: ["נשואה", "עובדת כמורה", "לא מעשנת"],
      vitals: {
        temperature: "36.8",
        bloodPressure: "120/72",
        heartRate: "90",
        spo2: "94%",
        respiratoryRate: "20",
      },
      exam: ["צפצופים אקספירטוריים", "דיבור במשפטים מלאים"],
      labs: ["WBC 8.6 x10⁹/L", "אאוזינופילים 6%"],
      imaging: ["צילום חזה: תקין"],
      workingDx: ["התקף אסתמה בינוני בתגובה לטיפול"],
      plan: ["אינהלציות", "סטרואידים", "הדרכת שימוש במשאף"],
      tasks: [
        { title: "הדרכת משאף", priority: "before-discharge", status: "pending", category: "other", timing: "לפני השחרור" },
        { title: "ספירומטריה", priority: "scheduled", status: "pending", category: "otherTests" as never, timing: "מחר" },
      ],
      discharge: { status: "tomorrow", blockers: ["הדרכת משאף"] },
    },
    {
      name: "שמעון גרינברג",
      age: 77,
      idNumber: "556 231 940",
      hmo: "לאומית",
      bed: 2,
      hospitalDay: 15,
      primaryDiagnosis: "פצע לחץ מזוהם",
      status: "attention",
      chief: ["פצע בעכוז שאינו מחלים", "חום נמוך"],
      pmh: ["שבץ בעבר", "מרותק למיטה", "סוכרת"],
      social: ["מתגורר עם בנו", "תלוי בעזרה מלאה", "מטפלת צמודה"],
      vitals: {
        temperature: "37.9",
        bloodPressure: "110/66",
        heartRate: "94",
        spo2: "95%",
        respiratoryRate: "18",
      },
      exam: ["פצע לחץ דרגה 3 בעכוז, הפרשה מוגלתית", "ריח רע"],
      labs: ["WBC 13.4 x10⁹/L", "CRP 88 mg/L", "אלבומין 2.6 g/dL"],
      imaging: ["MRI אגן: ללא אוסטאומיאליטיס"],
      otherTests: ["תרבית מהפצע: נשלחה"],
      workingDx: ["פצע לחץ מזוהם", "תת־תזונה"],
      plan: ["טיפול מקומי יומי", "אנטיביוטיקה", "תוספי תזונה", "מזרן אוויר", "מורפיום לפני החלפת חבישה"],
      other: ["נדרשת הערכת המשך טיפול בקהילה"],
      tasks: [
        { title: "תרבית מהפצע", priority: "urgent", status: "done", category: "labs", timing: "עכשיו" },
        { title: "הערכת תזונאית", priority: "today", status: "pending", category: "consult", timing: "היום" },
        { title: "הסדרת מזרן אוויר", priority: "before-discharge", status: "pending", category: "other", timing: "לפני השחרור" },
      ],
      consults: [
        { specialty: "כירורגיה פלסטית", state: "ordered", reason: "הערכת פצע" },
        { specialty: "עבודה סוציאלית", state: "waiting", reason: "המשך טיפול בקהילה" },
      ],
      discharge: { status: "unplanned", blockers: ["ריפוי הפצע", "הסדרת טיפול בקהילה", "הערכת תזונאית"] },
    },
  ],

  14: [
    {
      name: "גבריאל סבן",
      age: 68,
      idNumber: "217 559 386",
      hmo: "מכבי",
      bed: 1,
      hospitalDay: 3,
      primaryDiagnosis: "דלקת ריאות",
      status: "stable",
      chief: ["שיעול יצרני", "חום"],
      pmh: ["יתר לחץ דם", "היפרפלזיה של הערמונית"],
      social: ["גר עם אשתו", "עצמאי", "מעשן לשעבר"],
      vitals: {
        temperature: "37.3",
        bloodPressure: "126/78",
        heartRate: "80",
        spo2: "96%",
        respiratoryRate: "17",
      },
      exam: ["חרחורים בבסיס שמאל"],
      labs: ["WBC 10.2 x10⁹/L", "CRP 54 mg/L"],
      imaging: ["צילום חזה: תסנין בבסיס שמאל"],
      workingDx: ["דלקת ריאות בתגובה טובה לטיפול"],
      plan: ["המשך אנטיביוטיקה", "מעבר לטיפול פומי"],
      tasks: [
        { title: "מעבר לאנטיביוטיקה פומית", priority: "today", status: "pending", category: "medication", timing: "היום" },
      ],
      discharge: { status: "tomorrow", blockers: ["מעבר לטיפול פומי"] },
    },
  ],
};

/** Rooms with no seed entry are genuinely empty — a ward is never full, and the
 *  empty-room state needs to be visible in the demo. Room 13 is out of service
 *  so the "unavailable" state is reachable too. */
const UNAVAILABLE_ROOMS = new Set([13]);

/** Spread the roster across the ward so the field is visibly populated and
 *  visibly varied, without writing a doctor into all forty seed entries.
 *  Deterministic, so the demo looks the same on every run. */
let doctorCursor = 0;
const nextDoctor = () => WARD_DOCTORS[doctorCursor++ % WARD_DOCTORS.length];

function buildPatient(seed: Seed, roomId: string): Patient {
  const patientId = id("p");
  const data = emptyClinicalData();

  data.chiefComplaint = seed.chief.map((t) => item(t));
  data.pastMedicalHistory = seed.pmh.map((t) => item(t));
  data.socialStatus = seed.social.map((t) => item(t));
  data.tests.physicalExam = seed.exam.map((t) => item(t));
  data.tests.labs = seed.labs.map((t) => item(t));
  data.tests.imaging = seed.imaging.map((t) => item(t));
  data.tests.otherTests = (seed.otherTests ?? []).map((t) => item(t));
  data.workingDiagnosis = seed.workingDx.map((t) => item(t));
  data.treatmentPlan = seed.plan.map((t) => item(t));
  data.other = (seed.other ?? []).map((t) => item(t));

  for (const [key, value] of Object.entries(seed.vitals)) {
    if (value) {
      data.vitals[key as keyof typeof data.vitals] = reading(value);
    }
  }

  const tasks: Task[] = seed.tasks.map((t) => ({
    id: id("t"),
    patientId,
    title: t.title,
    category: (t.category === ("otherTests" as never) ? "other" : t.category) as Task["category"],
    priority: t.priority,
    status: t.status,
    timing: t.timing,
    createdFrom: "round",
    createdAt: Date.now(),
  }));

  const consultations: Consultation[] = (seed.consults ?? []).map((c) => ({
    id: id("k"),
    patientId,
    specialty: c.specialty,
    state: c.state,
    reason: c.reason ?? null,
    createdFrom: "round",
  }));

  return {
    id: patientId,
    name: seed.name,
    age: seed.age,
    idNumber: seed.idNumber,
    hmo: seed.hmo,
    roomId,
    bed: seed.bed,
    hospitalDay: seed.hospitalDay,
    primaryDiagnosis: seed.primaryDiagnosis,
    attendingDoctor: nextDoctor(),
    status: seed.status,
    approvedClinicalData: data,
    draftClinicalData: null,
    draftTasks: [],
    draftConsultations: [],
    draftDischarge: null,
    draftDemographics: null,
    tasks,
    consultations,
    discharge: {
      status: seed.discharge.status,
      blockers: seed.discharge.blockers.map((text) => ({
        id: id("b"),
        text,
        resolved: false,
      })),
    },
    lastRoundAt: null,
    lastTranscript: null,
    roundNote: null,
    rounds: [],
    dischargedAt: null,
    dischargeReport: null,
  };
}

export interface WardData {
  rooms: Room[];
  patients: Record<string, Patient>;
}

export function buildDemoWard(): WardData {
  n = 0;
  doctorCursor = 0;
  const rooms: Room[] = [];
  const patients: Record<string, Patient> = {};

  for (let number = 1; number <= 15; number += 1) {
    const roomId = `room-${number}`;
    const seeds = SEEDS[number] ?? [];

    if (UNAVAILABLE_ROOMS.has(number)) {
      rooms.push({
        id: roomId,
        number,
        status: "unavailable",
        patientIds: [],
        note: "בשיפוץ — אינו פעיל",
      });
      continue;
    }

    const built = seeds.map((seed) => buildPatient(seed, roomId));
    for (const p of built) patients[p.id] = p;

    rooms.push({
      id: roomId,
      number,
      status: built.length > 0 ? "active" : "empty",
      patientIds: built.map((p) => p.id),
    });
  }

  return { rooms, patients };
}
