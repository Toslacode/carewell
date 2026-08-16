"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * A destructive control that asks once, in place.
 *
 * Not window.confirm: that is a different typeface, a different language and a
 * modal the ward cannot style. The question replaces the button, so the answer
 * lands under the same finger that asked for it, and Escape is "no".
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  icon,
  className,
  tone = "urgent",
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  icon?: ReactNode;
  className?: string;
  tone?: "urgent" | "info";
}) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!asking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAsking(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asking]);

  if (asking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 rounded-chip border border-line-strong bg-card-raised px-2 py-1">
        <span className="text-[12px] text-ink-muted">{question}</span>
        <button
          type="button"
          autoFocus
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
          className={cn(
            "rounded-chip px-2.5 py-1 text-[12px] font-semibold text-white transition-[filter,background-color]",
            tone === "urgent" ? "bg-urgent hover:brightness-110" : "bg-navy hover:bg-navy-deep",
          )}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-chip px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-page-deep"
        >
          ביטול
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border border-line-strong bg-card px-3 py-1.5 text-[13px] font-medium transition-colors",
        tone === "urgent"
          ? "text-ink-muted hover:border-urgent-line hover:bg-urgent-bg hover:text-urgent"
          : "text-ink hover:bg-page-deep",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
