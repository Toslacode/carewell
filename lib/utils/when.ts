/**
 * Timestamps as a ward reads them.
 *
 * Almost everything a nurse enters happened in the last few hours, so the date
 * is noise the eye has to step over. It appears only once the reading is old
 * enough for "08:20" to be genuinely ambiguous.
 */

const HHMM: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

export function isToday(at: number): boolean {
  const d = new Date(at);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

/** "08:20" today, "18.08 · 08:20" earlier this year, full date before that. */
export function shortWhen(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("he-IL", HHMM);
  if (isToday(at)) return time;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `${date} · ${time}`;
}

/** The full stamp, for detail rows where the exact moment is the point. */
export function fullWhen(at: number): string {
  return new Date(at).toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time, which toISOString
 *  does not give — it converts to UTC and would shift the reading by the
 *  timezone offset. */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  const at = new Date(value).getTime();
  return Number.isFinite(at) ? at : Date.now();
}
