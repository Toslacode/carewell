/**
 * Verifies the rule-based extractor against the worked example in the brief,
 * plus the priority-derivation rules.
 *
 *   npm run check:extraction
 *
 * This is the offline path — the one that runs with no API key and no network —
 * so it is the path most worth pinning down.
 */

import { extractByRules } from "../lib/ai/rules";
import { derivePriority } from "../lib/schemas/clinical";

const TRANSCRIPT = `היה לו חום 39 בלילה,
לחץ דם 105 על 65,
עדיין משתעל.
ברקע סוכרת ויתר לחץ דם.
גר לבד והבת שלו עוזרת לו.
נעשה צילום חזה היום ונחזור על ספירת דם.
כנראה דלקת ריאות.
אם יהיה שיפור אולי נוכל לשחרר מחר.`;

let failures = 0;

function check(label: string, actual: unknown, predicate: (v: never) => boolean) {
  const ok = predicate(actual as never);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "  ok  " : " FAIL "} ${label}\n         → ${JSON.stringify(actual)}`,
  );
}

const r = extractByRules(TRANSCRIPT);

console.log("\n── מדדים ──");
check("חום", r.vitals.temperature, (v: string | null) => v === "39°C");
check("לחץ דם", r.vitals.bloodPressure, (v: string | null) => v === "105/65");

console.log("\n── מחלות רקע ──");
check("סוכרת", r.pastMedicalHistory, (v: string[]) => v.includes("סוכרת"));
check("יתר לחץ דם", r.pastMedicalHistory, (v: string[]) =>
  v.includes("יתר לחץ דם"),
);

console.log("\n── סטטוס סוציאלי ──");
check("גר לבד", r.socialStatus, (v: string[]) => v.includes("גר לבד"));
check("בתו מסייעת", r.socialStatus, (v: string[]) =>
  v.some((s) => s.includes("בתו")),
);

console.log("\n── תלונה עיקרית ──");
check("שיעול", r.chiefComplaint, (v: string[]) =>
  v.some((s) => s.includes("שיעול")),
);

console.log("\n── בדיקות ──");
check("צילום חזה בהדמיה", r.tests.imaging, (v: string[]) =>
  v.some((s) => s.includes("צילום חזה")),
);
check("ספירת דם במעבדה", r.tests.labs, (v: string[]) =>
  v.some((s) => s.includes("ספירת דם")),
);

console.log("\n── אבחנת עבודה ──");
check("חשד לדלקת ריאות", r.workingDiagnosis, (v: string[]) =>
  v.some((s) => s.includes("דלקת ריאות") && s.includes("חשד")),
);

console.log("\n── תכנית טיפול ──");
check("צילום חזה היום", r.treatmentPlan, (v: string[]) =>
  v.some((s) => s.includes("צילום חזה")),
);
check("ספירת דם", r.treatmentPlan, (v: string[]) =>
  v.some((s) => s.includes("ספירת דם")),
);

console.log("\n── משימות ──");
check("משימת צילום חזה", r.tasks, (v: typeof r.tasks) =>
  v.some((t) => t.title.includes("צילום חזה")),
);
check("משימת ספירת דם", r.tasks, (v: typeof r.tasks) =>
  v.some((t) => t.title.includes("ספירת דם")),
);
check("עדיפות 'היום' על צילום חזה", r.tasks, (v: typeof r.tasks) => {
  const t = v.find((x) => x.title.includes("צילום חזה"));
  return derivePriority(t?.timing ?? null) === "today";
});

console.log("\n── שחרור ──");
check("אפשרי מחר", r.discharge.status, (v: string) => v === "tomorrow");

console.log("\n── גזירת עדיפות ──");
const priorities: Array<[string, string]> = [
  ["עכשיו", "urgent"],
  ["היום", "today"],
  ["מחר בבוקר", "scheduled"],
  ["לפני השחרור", "before-discharge"],
];
for (const [phrase, expected] of priorities) {
  check(`"${phrase}" → ${expected}`, derivePriority(phrase), (v: string) => v === expected);
}
check('ללא תזמון → unset', derivePriority(null), (v: string) => v === "unset");

console.log("\n── אי־ודאות ──");
const uncertain = extractByRules("הקריאטינין שלו היה בערך ככה לא זוכר");
check("סומן כדורש בדיקה", uncertain.needsReview, (v: typeof r.needsReview) =>
  v.length > 0,
);

console.log(
  failures === 0
    ? "\n✓ כל הבדיקות עברו\n"
    : `\n✗ ${failures} בדיקות נכשלו\n`,
);
process.exit(failures === 0 ? 0 : 1);
