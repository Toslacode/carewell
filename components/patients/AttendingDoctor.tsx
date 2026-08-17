"use client";

import { useEffect, useRef, useState } from "react";
import { WARD_DOCTORS } from "@/lib/schemas/clinical";
import { useWard } from "@/lib/store/ward-store";
import { cn } from "@/lib/utils/cn";
import { IconCheck, IconChevronDown, IconStethoscope } from "@/components/ui/icons";

/**
 * Who is responsible for this patient.
 *
 * Reads as a labelled fact and edits in one tap, because reassignment happens
 * on the ward far more often than the rest of a patient's details change and
 * should not require opening the whole admission form.
 *
 * This is the only way the field is ever written. Extraction has no path to
 * it: a doctor's name inside a round note is a report about who treated the
 * patient, not an instruction to hand the patient over, and acting on that
 * reading would silently move responsibility for someone's care.
 */
export function AttendingDoctor({
  patientId,
  doctor,
}: {
  patientId: string;
  doctor: string;
}) {
  const { setAttendingDoctor } = useWard();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const holder = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!holder.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (name: string) => {
    setAttendingDoctor(patientId, name);
    setCustom("");
    setOpen(false);
  };

  return (
    <div ref={holder} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="שינוי הרופא המטפל"
        className={cn(
          "inline-flex items-center gap-2 rounded-chip border px-3 py-1.5 text-[13px] transition-colors",
          open
            ? "border-navy bg-navy-wash"
            : "border-line-strong bg-card hover:bg-page-deep",
        )}
      >
        <IconStethoscope className="h-4 w-4 shrink-0 text-ink-muted" />
        <span className="text-ink-muted">רופא מטפל:</span>
        <span className="font-semibold text-navy-deep">{doctor || "לא שויך"}</span>
        <IconChevronDown className="h-4 w-4 text-ink-muted" />
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-40 w-[min(300px,calc(100vw-3rem))] overflow-hidden rounded-card border border-line bg-card shadow-lift">
          <p className="border-b border-line px-4 pb-2 pt-3 text-[11px] font-semibold tracking-[0.04em] text-ink-decor">
            צוות המחלקה
          </p>
          <ul>
            {WARD_DOCTORS.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => choose(name)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2.5 text-start text-[14px] transition-colors hover:bg-page-deep",
                    name === doctor ? "font-semibold text-navy-deep" : "text-ink",
                  )}
                >
                  {name}
                  {name === doctor && <IconCheck className="ms-auto h-4 w-4 text-navy" />}
                </button>
              </li>
            ))}
          </ul>

          {/* A locum, or anyone not on the ward's own roster. */}
          <div className="flex items-center gap-1.5 border-t border-line p-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  e.preventDefault();
                  choose(custom);
                }
              }}
              placeholder="שם אחר…"
              className="min-w-0 flex-1 rounded-md border border-line-strong bg-card-raised px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-navy"
            />
            <button
              type="button"
              disabled={!custom.trim()}
              onClick={() => choose(custom)}
              className="rounded-chip bg-navy px-3 py-1.5 text-[12px] font-semibold text-on-navy transition-colors hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              שיוך
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
