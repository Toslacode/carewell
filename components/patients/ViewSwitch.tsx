"use client";

import { cn } from "@/lib/utils/cn";

export type PatientView = "doctor" | "nursing";

/**
 * רופא | סיעוד — which job you are here to do.
 *
 * Not a permission boundary and not a route: the same patient and the same
 * record either way, shown for reading or for entry. Kept deliberately small,
 * because it is a preference about the current task rather than a section of
 * the application, and it should not announce itself above the patient's name.
 */
export function ViewSwitch({
  view,
  onChange,
}: {
  view: PatientView;
  onChange: (view: PatientView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="תצוגת מטופל"
      className="inline-flex items-center gap-0.5 rounded-chip border border-line bg-card/70 p-0.5"
    >
      <Tab active={view === "doctor"} onClick={() => onChange("doctor")} label="רופא" />
      <Tab active={view === "nursing"} onClick={() => onChange("nursing")} label="סיעוד" />
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "rounded-chip px-4 py-1.5 text-[13px] font-semibold transition-colors",
        active
          ? "bg-navy text-on-navy"
          : "text-ink-muted hover:bg-page-deep/70 hover:text-navy",
      )}
    >
      {label}
    </button>
  );
}
